"""Deterministic frame capture from the frozen copy served on :8779.
python cap.py shots.json [only,names]  ->  $FSLG_WORK/frames/<shot>/0000.jpg   (needs pyobjc: use the project's .venv python)"""
import sys, json, time, os, base64
from Foundation import NSURL, NSRunLoop, NSDate, NSMakeRect, NSURLRequest
from AppKit import NSApplication, NSBitmapImageRep, NSJPEGFileType
from WebKit import WKSnapshotConfiguration
from WebKit import WKWebView, WKWebViewConfiguration
WORK = os.environ.get("FSLG_WORK", ".")
app = NSApplication.sharedApplication()
wv = WKWebView.alloc().initWithFrame_configuration_(NSMakeRect(0, 0, 1920, 1080), WKWebViewConfiguration.alloc().init())
def spin(s):
    end = time.time() + s
    while time.time() < end: NSRunLoop.currentRunLoop().runUntilDate_(NSDate.dateWithTimeIntervalSinceNow_(0.02))
wv.loadRequest_(NSURLRequest.requestWithURL_(NSURL.URLWithString_("http://localhost:8779/t.html"))); spin(4)
def snap(path):
    box = {}
    def done(img, err): box["i"] = img
    wv.takeSnapshotWithConfiguration_completionHandler_(WKSnapshotConfiguration.alloc().init(), done); t = time.time()
    while "i" not in box and time.time() - t < 20: NSRunLoop.currentRunLoop().runUntilDate_(NSDate.dateWithTimeIntervalSinceNow_(0.01))
    if box.get("i") is None: return False
    rep = NSBitmapImageRep.imageRepWithData_(box["i"].TIFFRepresentation()); rep.representationUsingType_properties_(NSJPEGFileType, {"NSImageCompressionFactor": .9}).writeToFile_atomically_(path, True); return True
def js(code):
    box = {}
    def done(res, err): box["r"] = res; box["e"] = err
    wv.evaluateJavaScript_completionHandler_(code, done); t = time.time()
    while "r" not in box and time.time() - t < 60: NSRunLoop.currentRunLoop().runUntilDate_(NSDate.dateWithTimeIntervalSinceNow_(0.002))
    if box.get("e"): print("JSERR", str(box["e"])[:300], flush=True)
    return box.get("r")
shots = json.load(open(sys.argv[1])); only = sys.argv[2].split(",") if len(sys.argv) > 2 else None
print("boot", js("boot()"), flush=True); spin(1); t00 = time.time(); tot = 0
for s in shots:
    if only and s["name"] not in only: continue
    d = os.path.join(WORK, "frames", s["name"]); os.makedirs(d, exist_ok=True)
    for f in os.listdir(d): os.remove(os.path.join(d, f))
    r = js("(function(){%s; return shot(%s,%s,%s,%s,%s);})()" % (s.get("setup", ""), json.dumps(s.get("pre")), json.dumps(s.get("post")), "true" if s.get("hud") else "false", s.get("sub", 4), "true" if s.get("no3d") else "false"))
    t0 = time.time(); ok = 0
    for i in range(s["n"]):
        if s.get("dom"):
            if not js("adv(%d,%d)" % (i, s["n"])): break
            spin(.03)
            if not snap(os.path.join(d, "%04d.jpg" % i)): break
            ok += 1; continue
        u = js("frame(%d,%d)" % (i, s["n"]))
        if not u: break
        open(os.path.join(d, "%04d.jpg" % i), "wb").write(base64.b64decode(u.split(",", 1)[1])); ok += 1
    tot += ok; print(s["name"], "setup", r, "frames", ok, "%.2fs/frame" % ((time.time() - t0) / max(1, ok)), js(s.get("info", "''")), flush=True)
print("total", tot, "%.0fs" % (time.time() - t00), "errors:", js("JSON.stringify((window.__err||[]).slice(0,6))"), flush=True)
