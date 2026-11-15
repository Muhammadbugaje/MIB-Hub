import sys, time
from Foundation import NSURL, NSRunLoop, NSDate, NSMakeRect, NSURLRequest
from AppKit import NSApplication
from WebKit import WKWebView, WKWebViewConfiguration
app = NSApplication.sharedApplication()
wv = WKWebView.alloc().initWithFrame_configuration_(NSMakeRect(0, 0, 300, 300), WKWebViewConfiguration.alloc().init())
def spin(s):
    end = time.time() + s
    while time.time() < end: NSRunLoop.currentRunLoop().runUntilDate_(NSDate.dateWithTimeIntervalSinceNow_(0.02))
def js(code):
    box = {}
    def done(res, err): box["r"] = res; box["e"] = err
    wv.evaluateJavaScript_completionHandler_(code, done); t = time.time()
    while "r" not in box and time.time() - t < 60: NSRunLoop.currentRunLoop().runUntilDate_(NSDate.dateWithTimeIntervalSinceNow_(0.005))
    return box.get("r"), box.get("e")
wv.loadRequest_(NSURLRequest.requestWithURL_(NSURL.URLWithString_(sys.argv[1])))
for i in range(200):
    spin(0.5)
    if js("String(window.__ready)")[0] in ("true","error"): break
print(js(sys.argv[2]))
