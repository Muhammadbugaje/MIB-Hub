/**
 * Test helpers for the offline scripts in public/ (plain browser scripts,
 * not modules): load them with stand-ins for the browser APIs they use
 * (Cache Storage, IndexedDB-like stores, fetch).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const PUBLIC = fileURLToPath(new URL("../public/", import.meta.url));
export const ORIGIN = "https://mib.test";

export function publicFile(path: string): string {
  return readFileSync(PUBLIC + path.replace(/^\//, ""), "utf8");
}

/** A loose type for the MIBSync object (the script is plain JavaScript). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Any = any;

/** Run public/offline/mib-sync.js and return its MIBSync object. */
export function loadSync(self: Record<string, unknown> = {}): Any {
  const code = publicFile("/offline/mib-sync.js");
  new Function("self", code)(self);
  return self.MIBSync;
}

/** An in-memory stand-in for one IndexedDB object store ({ all, get, put, del }). */
export function memStore(key = "id") {
  const rows = new Map<string, Any>();
  return {
    rows,
    all: async () => [...rows.values()].map((r) => structuredClone(r)),
    get: async (id: string) => structuredClone(rows.get(id)),
    put: async (v: Any) => void rows.set(v[key], structuredClone(v)),
    del: async (id: string) => void rows.delete(id),
  };
}

function keyOf(req: string | Request | URL, ignoreSearch = false): string {
  const u = new URL(typeof req === "string" ? req : req instanceof URL ? req.href : req.url, ORIGIN);
  return u.pathname + (ignoreSearch ? "" : u.search);
}

/** An in-memory Cache (one named cache in Cache Storage). */
export class FakeCache {
  entries = new Map<string, Response>();
  async match(req: string | Request, opts: { ignoreSearch?: boolean } = {}): Promise<Response | undefined> {
    const k = keyOf(req, false);
    const hit = this.entries.get(k);
    if (hit) return hit.clone();
    if (opts.ignoreSearch) {
      const bare = keyOf(req, true);
      for (const [key, r] of this.entries) if (key.split("?")[0] === bare) return r.clone();
    }
    return undefined;
  }
  async put(req: string | Request, res: Response): Promise<void> {
    this.entries.set(keyOf(req), res.clone());
  }
  async delete(req: string | Request): Promise<boolean> {
    return this.entries.delete(keyOf(req));
  }
  async keys(): Promise<Request[]> {
    return [...this.entries.keys()].map((k) => new Request(ORIGIN + k));
  }
  async addAll(reqs: (string | Request)[]): Promise<void> {
    for (const r of reqs) this.entries.set(keyOf(r), new Response("x"));
  }
}

/** An in-memory Cache Storage (window.caches). */
export class FakeCaches {
  stores = new Map<string, FakeCache>();
  async open(name: string): Promise<FakeCache> {
    if (!this.stores.has(name)) this.stores.set(name, new FakeCache());
    return this.stores.get(name)!;
  }
  async keys(): Promise<string[]> {
    return [...this.stores.keys()];
  }
  async delete(name: string): Promise<boolean> {
    return this.stores.delete(name);
  }
  async has(name: string): Promise<boolean> {
    return this.stores.has(name);
  }
  async match(req: string | Request, opts: { ignoreSearch?: boolean } = {}): Promise<Response | undefined> {
    for (const c of this.stores.values()) {
      const r = await c.match(req, opts);
      if (r) return r;
    }
    return undefined;
  }
}

/** A fetch stand-in serving a map of path -> body (string) or a handler; anything else is 404. */
export function fakeFetch(routes: Record<string, string | ((init?: RequestInit) => Response | Promise<Response>)>, log: string[] = []) {
  return async (input: string | Request, init?: RequestInit): Promise<Response> => {
    const path = keyOf(input);
    log.push(`${init?.method ?? (typeof input === "string" ? "GET" : input.method)} ${path}`);
    const r = routes[path] ?? routes[path.split("?")[0]!];
    if (r === undefined) return new Response("not found", { status: 404 });
    if (typeof r === "function") return r(init);
    const type = path.endsWith(".css") ? "text/css" : path.endsWith(".js") ? "text/javascript" : path.endsWith(".json") ? "application/json" : "text/html";
    return new Response(r, { status: 200, headers: { "content-type": type } });
  };
}
