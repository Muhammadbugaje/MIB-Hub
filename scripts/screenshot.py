"""Full-page screenshots of the running site, in light and dark, on macOS 12.

Playwright does not run on macOS 12, so this uses an offscreen WKWebView through
pyobjc (pip install pyobjc-framework-WebKit). The system WebKit is older than
current Safari: it lacks color-mix(), View Transitions and a few other features,
so treat small differences from a real browser as renderer artifacts.

Usage (with the dev server running on :4321):
  python3 scripts/screenshot.py OUT_DIR [--email E --password P] [--width 1440]

Shots: home, sign-in, admin (admin needs --email/--password of an admin or owner).
Animations are switched off (offscreen WebKit never advances them, so elements would stay at their first, invisible frame).
"""
import argparse
import os
import sys
import time

from AppKit import NSAppearance, NSApplication, NSBitmapImageRep, NSJPEGFileType
from Foundation import NSDate, NSMakeRect, NSRunLoop, NSURL, NSURLRequest
from WebKit import (
    WKSnapshotConfiguration,
    WKUserScript,
    WKWebView,
    WKWebViewConfiguration,
    WKWebsiteDataStore,
)

BASE = "http://localhost:4321"
FREEZE = """
document.documentElement.setAttribute('data-motion','reduce');
var s=document.createElement('style');
s.textContent='*,*::before,*::after{animation:none!important;transition:none!important}';
document.documentElement.appendChild(s);
"""


def spin(seconds):
    end = time.time() + seconds
    while time.time() < end:
        NSRunLoop.currentRunLoop().runUntilDate_(NSDate.dateWithTimeIntervalSinceNow_(0.02))


def make_view(width, dark):
    cfg = WKWebViewConfiguration.alloc().init()
    cfg.setWebsiteDataStore_(WKWebsiteDataStore.nonPersistentDataStore())  # cookies live only in this run
    ctrl = cfg.userContentController()
    # injection time 0 = at document start (before the theme script), main frame only
    ctrl.addUserScript_(WKUserScript.alloc().initWithSource_injectionTime_forMainFrameOnly_(
        "try{localStorage.clear()}catch(e){}", 0, True))
    ctrl.addUserScript_(WKUserScript.alloc().initWithSource_injectionTime_forMainFrameOnly_(FREEZE, 1, True))
    view = WKWebView.alloc().initWithFrame_configuration_(NSMakeRect(0, 0, width, 900), cfg)
    view.setAppearance_(NSAppearance.appearanceNamed_("NSAppearanceNameDarkAqua" if dark else "NSAppearanceNameAqua"))
    return view


def js(view, code, timeout=30):
    box = {}

    def done(result, error):
        box["r"], box["e"] = result, error

    view.evaluateJavaScript_completionHandler_(code, done)
    start = time.time()
    while "r" not in box and time.time() - start < timeout:
        NSRunLoop.currentRunLoop().runUntilDate_(NSDate.dateWithTimeIntervalSinceNow_(0.01))
    if box.get("e"):
        print("  js error:", str(box["e"])[:200])
    return box.get("r")


def load(view, url, wait=4.0):
    view.loadRequest_(NSURLRequest.requestWithURL_(NSURL.URLWithString_(url)))
    spin(wait)
    # wait until the document is complete (the dev server can be slow)
    for _ in range(60):
        if js(view, "document.readyState") == "complete":
            break
        spin(0.5)
    spin(1.0)


def snap(view, path, width, theme):
    js(view, "document.documentElement.setAttribute('data-theme', %r)" % theme)
    height = int(js(view, "Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)") or 900)
    height = max(700, min(height, 6000))
    view.setFrame_(NSMakeRect(0, 0, width, height))
    spin(1.5)
    box = {}

    def done(image, error):
        box["i"] = image

    view.takeSnapshotWithConfiguration_completionHandler_(WKSnapshotConfiguration.alloc().init(), done)
    start = time.time()
    while "i" not in box and time.time() - start < 30:
        NSRunLoop.currentRunLoop().runUntilDate_(NSDate.dateWithTimeIntervalSinceNow_(0.01))
    if box.get("i") is None:
        print("  snapshot failed:", path)
        return
    rep = NSBitmapImageRep.imageRepWithData_(box["i"].TIFFRepresentation())
    data = rep.representationUsingType_properties_(NSJPEGFileType, {"NSImageCompressionFactor": 0.86})
    data.writeToFile_atomically_(path, True)
    view.setFrame_(NSMakeRect(0, 0, width, 900))
    print("  saved", path, "(%dx%d)" % (width, height))


def sign_in(view, email, password):
    load(view, BASE + "/auth/sign-in")
    js(view, """
      document.querySelector('#f-email').value=%r;
      document.querySelector('#f-password').value=%r;
      document.querySelector('form').submit(); true
    """ % (email, password))
    spin(6)
    for _ in range(40):
        if js(view, "document.readyState") == "complete":
            break
        spin(0.5)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("--email")
    ap.add_argument("--password")
    ap.add_argument("--width", type=int, default=1440)
    ap.add_argument("--suffix", default="")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    NSApplication.sharedApplication()

    for theme in ("light", "dark"):
        print(theme)
        view = make_view(a.width, theme == "dark")
        load(view, BASE + "/")
        snap(view, os.path.join(a.out, "home-%s%s.jpg" % (theme, a.suffix)), a.width, theme)
        load(view, BASE + "/auth/sign-in")
        snap(view, os.path.join(a.out, "sign-in-%s%s.jpg" % (theme, a.suffix)), a.width, theme)
        if a.email and a.password:
            sign_in(view, a.email, a.password)
            load(view, BASE + "/admin")
            if "/admin" not in (js(view, "location.pathname") or ""):
                print("  not signed in; admin shot skipped")
            else:
                snap(view, os.path.join(a.out, "admin-%s%s.jpg" % (theme, a.suffix)), a.width, theme)
    return 0


if __name__ == "__main__":
    sys.exit(main())
