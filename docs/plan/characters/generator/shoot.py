"""Offscreen WKWebView capture. usage: shoot.py URL W H out_prefix 'view|{json}' ...  -> out_prefix_<i>.png"""
import sys, time, base64, json
from Foundation import NSURL, NSRunLoop, NSDate, NSMakeRect, NSURLRequest
from AppKit import NSApplication
from WebKit import WKWebView, WKWebViewConfiguration
url, W, H, pre = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
app = NSApplication.sharedApplication()
wv = WKWebView.alloc().initWithFrame_configuration_(NSMakeRect(0, 0, W, H), WKWebViewConfiguration.alloc().init())
def spin(s):
    end = time.time() + s
    while time.time() < end: NSRunLoop.currentRunLoop().runUntilDate_(NSDate.dateWithTimeIntervalSinceNow_(0.02))
def js(code, to=180):
    box = {}
    def done(res, err): box["r"] = res; box["e"] = err
    wv.evaluateJavaScript_completionHandler_(code, done); t = time.time()
    while "r" not in box and time.time() - t < to: NSRunLoop.currentRunLoop().runUntilDate_(NSDate.dateWithTimeIntervalSinceNow_(0.005))
    if box.get("e"): print("JSERR", str(box["e"])[:300], flush=True)
    return box.get("r")
wv.loadRequest_(NSURLRequest.requestWithURL_(NSURL.URLWithString_(url))); t0 = time.time(); r = None
while time.time() - t0 < 600:
    spin(0.5); r = js("String(window.__ready)")
    if r in ("true", "error"): break
print("ready", r, "%.0fs" % (time.time() - t0), "errors", js("JSON.stringify((window.__err||[]).slice(0,8))"), flush=True)
if r == "true":
    for i, spec in enumerate(sys.argv[5:]):
        name, _, arg = spec.partition("|")
        js("view(%s,%s)" % (json.dumps(name), arg or "{}"))
        u = js("snap('image/jpeg')")
        if u: open("%s_%d.jpg" % (pre, i), "wb").write(base64.b64decode(u.split(",", 1)[1])); print("saved", "%s_%d.jpg" % (pre, i), flush=True)
