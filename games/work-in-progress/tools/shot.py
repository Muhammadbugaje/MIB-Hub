"""Take still pictures of the game with the offscreen WebKit view (macOS 12 has no Playwright).

The game, opened with ?shot=1, renders frames by hand (offscreen views never run
requestAnimationFrame), exposes the picture as window.__wipShot and sets the title
to SHOT_READY. This script waits for that and writes the JPEG.

Usage (dev server on :4321):
  ~/Downloads/eehub-2/.venv/bin/python -I games/work-in-progress/tools/shot.py OUT.jpg "time=8&view=aerial" [--width 1600 --height 900] [--page]

Useful queries (see src/main.ts):
  "menu=title|main|creator|settings|credits|missions"            the front end (use --page to include the HTML)
  "cut=cut_m001_film_b&at=12"                                     a cutscene block from Y1.md at a second
  "mission=m003&step=2&t=6"                                       a mission step after t seconds (--page shows the HUD)
  "specials=jiya,taty,madison"                                    switch the special characters on
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

import os as _os
BASE = "http://localhost:4321/play-files-dev/work-in-progress/index.html" if _os.environ.get("WIP_OUT") == "dev" else "http://localhost:4321/play-files/work-in-progress/index.html"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("query")
    ap.add_argument("--width", type=int, default=1600)
    ap.add_argument("--height", type=int, default=900)
    ap.add_argument("--timeout", type=int, default=240)
    ap.add_argument("--page", action="store_true", help="snapshot the whole page (HTML menus, HUD, subtitles) instead of the canvas only")
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
    if a.page:
        from AppKit import NSBitmapImageRep, NSJPEGFileType
        from Foundation import NSDate, NSRunLoop
        from WebKit import WKSnapshotConfiguration
        spin(1.0)
        box = {}
        def done(img, err):
            box["i"] = img

        view.takeSnapshotWithConfiguration_completionHandler_(WKSnapshotConfiguration.alloc().init(), done)
        t0 = time.time()
        while "i" not in box and time.time() - t0 < 30:
            NSRunLoop.currentRunLoop().runUntilDate_(NSDate.dateWithTimeIntervalSinceNow_(0.01))
        if box.get("i") is None:
            print("page snapshot failed")
            return 1
        rep = NSBitmapImageRep.imageRepWithData_(box["i"].TIFFRepresentation())
        rep.representationUsingType_properties_(NSJPEGFileType, {"NSImageCompressionFactor": 0.9}).writeToFile_atomically_(a.out, True)
        print("saved page", a.out, js(view, "JSON.stringify(window.__wipStats)"))
        errs = js(view, "JSON.stringify(window.__wipErrors||[])")
        if errs and errs != "[]":
            print("console:", errs[:3000])
        return 0
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
