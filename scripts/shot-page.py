"""Screenshot a page — and, if it is a canvas game, actually let the game run.

`scripts/screenshot.py` freezes animations on purpose, and offscreen WebKit never
fires requestAnimationFrame, so anything that draws in rAF (all the arcade games)
stands still. This tool injects a timer-based rAF before the page loads, then runs
a list of steps so you can click through menus and let the game play itself for a
few seconds before the snapshot.

Usage (dev server on :4321):
  python3 scripts/shot-page.py OUT.jpg http://localhost:4321/play/momentum-cup \
      --width 1280 --height 800 --step "4:" \
      --step "1:document.querySelector('[data-act=quick]').click()" \
      --step "1:document.querySelector('[data-act=go]').click()" \
      --step "1:document.querySelector('[data-act=kickoff]').click()" \
      --step "9:"

Each --step is "SECONDS:JAVASCRIPT": wait SECONDS, then run the script (errors are
printed, not fatal). The snapshot is taken after the last step.

Simulating play (hold a key, tap twice):
  --step "2:window.__key('ArrowRight',true)" --step "1:window.__key('ArrowRight',false)"
"""
import argparse
import base64
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from screenshot import js, spin  # noqa: E402
from AppKit import NSApplication, NSBitmapImageRep, NSJPEGFileType  # noqa: E402
from Foundation import NSDate, NSMakeRect, NSRunLoop, NSURL, NSURLRequest  # noqa: E402
from WebKit import WKSnapshotConfiguration, WKUserScript, WKWebView, WKWebViewConfiguration, WKWebsiteDataStore  # noqa: E402

# Offscreen views never run rAF, and they throttle timers to about 1 Hz, so a
# game loop left to itself runs at a crawl (MAX_DT per frame). Instead, frames are
# queued here and pumped by hand on a synthetic 60 Hz clock: deterministic, and a
# step can advance ten seconds of game time in one call.
RAF = """
(function(){
  // An offscreen view reports itself hidden; games rightly stop their loop for that.
  try {
    Object.defineProperty(document, 'hidden', { get: function(){ return false; }, configurable: true });
    Object.defineProperty(document, 'visibilityState', { get: function(){ return 'visible'; }, configurable: true });
    Object.defineProperty(document, 'webkitHidden', { get: function(){ return false; }, configurable: true });
    Object.defineProperty(document, 'webkitVisibilityState', { get: function(){ return 'visible'; }, configurable: true });
  } catch (e) {}
  document.addEventListener('visibilitychange', function(e){ e.stopImmediatePropagation(); }, true);
  window.__errors = [];
  window.addEventListener('error', function(e){ window.__errors.push(String(e.message)); });
  var queue = [], clock = 0, empty = 0;
  window.requestAnimationFrame = function(cb){ queue.push(cb); return queue.length; };
  window.cancelAnimationFrame = function(){ /* the pump drops queued frames by name */ };
  window.__pump = function(frames, step){
    step = step || 16.6667;
    for (var i = 0; i < frames; i++) {
      clock += step;
      var batch = queue; queue = [];
      if (!batch.length) { empty++; if (empty > 3) return { frames: i, pending: 0, stopped: true }; continue; }
      empty = 0;
      for (var j = 0; j < batch.length; j++) {
        try { batch[j](clock); } catch (e) { window.__errors.push(String(e && e.message || e)); }
      }
    }
    return { frames: frames, pending: queue.length, clock: Math.round(clock) };
  };
  // Keyboard helpers, so a step can drive a game without real key events.
  window.__key = function(key, down){
    var ev = new KeyboardEvent(down ? 'keydown' : 'keyup', { key: key, code: key, bubbles: true });
    (document.activeElement || document.body || document.documentElement).dispatchEvent(ev);
    window.dispatchEvent(ev);
  };
  window.__tap = function(key){ window.__key(key, true); setTimeout(function(){ window.__key(key, false); }, 60); };
})();
"""


def shot(view, path, width, height):
    view.setFrame_(NSMakeRect(0, 0, width, height))
    spin(1.2)
    box = {}

    def done(img, err):
        box["i"] = img

    view.takeSnapshotWithConfiguration_completionHandler_(WKSnapshotConfiguration.alloc().init(), done)
    t0 = time.time()
    while "i" not in box and time.time() - t0 < 30:
        NSRunLoop.currentRunLoop().runUntilDate_(NSDate.dateWithTimeIntervalSinceNow_(0.01))
    if box.get("i") is None:
        print("snapshot failed:", path)
        return False
    rep = NSBitmapImageRep.imageRepWithData_(box["i"].TIFFRepresentation())
    data = rep.representationUsingType_properties_(NSJPEGFileType, {"NSImageCompressionFactor": 0.9})
    data.writeToFile_atomically_(path, True)
    print("saved", path)
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("url")
    ap.add_argument("--width", type=int, default=1280)
    ap.add_argument("--height", type=int, default=800)
    ap.add_argument("--step", action="append", default=[], help='"SECONDS:JS"; use __pump(N) in JS to advance frames')
    ap.add_argument("--frames", type=int, default=1, help="frames to pump just before the snapshot")
    ap.add_argument("--canvas", help="CSS selector of a canvas; save its pixels instead of a page snapshot")
    ap.add_argument("--raf", default="on", choices=["on", "off"])
    ap.add_argument("--touch", action="store_true", help="pretend to be a touch device, so the phone pad shows (arcade.js adds .is-on only for pointer:coarse)")
    a = ap.parse_args()

    NSApplication.sharedApplication()
    cfg = WKWebViewConfiguration.alloc().init()
    cfg.setWebsiteDataStore_(WKWebsiteDataStore.nonPersistentDataStore())
    ctrl = cfg.userContentController()
    if a.raf == "on":
        ctrl.addUserScript_(WKUserScript.alloc().initWithSource_injectionTime_forMainFrameOnly_(RAF, 0, True))
    view = WKWebView.alloc().initWithFrame_configuration_(NSMakeRect(0, 0, a.width, a.height), cfg)
    view.loadRequest_(NSURLRequest.requestWithURL_(NSURL.URLWithString_(a.url)))

    for _ in range(80):
        spin(0.5)
        if js(view, "document.readyState") == "complete":
            break
    spin(1.5)
    print("title:", js(view, "document.title"))

    for step in a.step:
        secs, _, code = step.partition(":")
        spin(float(secs or 0))
        if code.strip():
            out = js(view, code)
            if os.environ.get("SHOT_VERBOSE") and out is not None:
                print("  step ->", str(out)[:400])

    if a.touch:
        js(view, "(function(){var t=document.querySelector('[data-gm-touch]');if(t)t.classList.add('is-on');})()")
        spin(0.4)
    if a.frames:
        print("pump:", js(view, "JSON.stringify(window.__pump(%d))" % a.frames))
    if a.canvas:
        # A snapshot copies the last *composited* layer, and an offscreen view never
        # composites, so a canvas that is redrawn by hand comes out stale. Read the
        # canvas pixels back instead.
        data = js(view, "(document.querySelector(%r)||{}).toDataURL ? document.querySelector(%r).toDataURL('image/png') : ''" % (a.canvas, a.canvas))
        if not data or "," not in data:
            print("no canvas pixels (selector %r)" % a.canvas)
            return 1
        with open(a.out, "wb") as f:
            f.write(base64.b64decode(data.split(",", 1)[1]))
        print("saved canvas", a.out)
    else:
        if not shot(view, a.out, a.width, a.height):
            return 1
    errs = js(view, "JSON.stringify(window.__errors||[])")
    if errs and errs != "[]":
        print("page errors:", errs[:2000])
    return 0


if __name__ == "__main__":
    sys.exit(main())
