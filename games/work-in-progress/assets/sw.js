/**
 * MIB-Hub Work-in-Progress PWA Service Worker.
 *
 * Caches the game shell and its 3D assets (GLB models, animations, textures,
 * fonts) so repeat visits and offline play are fast. HTML and the JS bundle are
 * network-first so a new deploy is picked up immediately; heavy immutable
 * assets are cache-first.
 */

const VERSION = "wip-v3";
const CACHE = `wip-${VERSION}`;
const SHELL = ["./index.html"];

const isApi = (url) => url.pathname.includes("/api/");
const isHtml = (request, url) =>
  request.mode === "navigate" || url.pathname.endsWith("/") || url.pathname.endsWith(".html");
const isCode = (url) => url.pathname.endsWith(".js") || url.pathname.endsWith(".css");
const isAsset = (url) =>
  /\.(glb|gltf|bin|json|woff2?|ttf|otf|png|jpe?g|webp|gif|svg|mp3|ogg|wav|m4a)$/i.test(url.pathname);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

/** Network first, falling back to the cache (and the shell for navigations). */
async function networkFirst(request, url) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (isHtml(request, url)) {
      const shell = await cache.match("./index.html");
      if (shell) return shell;
    }
    throw new Error("offline");
  }
}

/** Cache first, then network; cache the response for next time. */
async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok && response.status === 200) cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || isApi(url)) return;

  if (isHtml(request, url) || isCode(url)) {
    event.respondWith(networkFirst(request, url));
    return;
  }
  if (isAsset(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }
  // Anything else: try the network, then whatever we already have.
  event.respondWith(fetch(request).catch(() => caches.match(request)));
});
