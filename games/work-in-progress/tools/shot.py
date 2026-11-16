"""Take still pictures of the game with the offscreen WebKit view (macOS 12 has no Playwright).

The game, opened with ?shot=1, renders frames by hand (offscreen views never run
requestAnimationFrame), exposes the picture as window.__wipShot and sets the title
to SHOT_READY. This script waits for that and writes the JPEG.

Usage (dev server on :4321):
  ~/Downloads/eehub-2/.venv/bin/python -I games/work-in-progress/tools/shot.py OUT.jpg "time=8&view=aerial" [--width 1600 --height 900]
"""
import argparse
import base64
import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "scripts"))
from screenshot import js, spin  # noqa: E402
from AppKit import NSApplication  # noqa: E402
from Foundation import NSMakeRect, NSURL, NSURLRequest  # noqa: E402
from WebKit import WKWebView, WKWebViewConfiguration, WKWebsiteDataStore  # noqa: E402

BASE = "http://localhost:4321/play/work-in-progress/index.html"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("query")
    ap.add_argument("--width", type=int, default=1600)
    ap.add_argument("--height", type=int, default=900)
    ap.add_argument("--timeout", type=int, default=240)
    a = ap.parse_args()
    NSApplication.sharedApplication()
    cfg = WKWebViewConfiguration.alloc().init()
    cfg.setWebsiteDataStore_(WKWebsiteDataStore.nonPersistentDataStore())
    view = WKWebView.alloc().initWithFrame_configuration_(NSMakeRect(0, 0, a.width, a.height), cfg)
    url = BASE + "?shot=1&" + a.query
    view.loadRequest_(NSURLRequest.requestWithURL_(NSURL.URLWithString_(url)))
    start = time.time()
    while time.time() - start < a.timeout:
        spin(1.0)
        title = js(view, "document.title") or ""
        if title == "SHOT_READY":
            break
        err = js(view, "(document.querySelector('.wip-error')||{}).textContent || ''")
        if err:
            print("game error:", err)
            return 1
    else:
        print("timed out; title =", js(view, "document.title"))
        print(js(view, "JSON.stringify(window.__mibErrors||[])"))
        return 1
    data = js(view, "window.__wipShot")
    stats = js(view, "JSON.stringify(window.__wipStats)")
    if not data:
        print("no picture")
        return 1
    with open(a.out, "wb") as f:
        f.write(base64.b64decode(data.split(",", 1)[1]))
    print("saved", a.out, stats)
    errs = js(view, "JSON.stringify(window.__wipErrors||[])")
    if errs and errs != "[]":
        print("console:", errs[:3000])
    return 0


if __name__ == "__main__":
    sys.exit(main())
