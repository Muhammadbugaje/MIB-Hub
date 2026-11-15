import sys, time
from Foundation import NSURL, NSRunLoop, NSDate, NSMakeRect, NSURLRequest
from AppKit import NSApplication
from WebKit import WKWebView, WKWebViewConfiguration
app = NSApplication.sharedApplication()
wv = WKWebView.alloc().initWithFrame_configuration_(NSMakeRect(0, 0, 400, 550), WKWebViewConfiguration.alloc().init())
def js(code, to=60):
    box = {}
    def done(res, err): box["r"] = res; box["e"] = err
    wv.evaluateJavaScript_completionHandler_(code, done); t = time.time()
    while "r" not in box and time.time() - t < to: NSRunLoop.currentRunLoop().runUntilDate_(NSDate.dateWithTimeIntervalSinceNow_(0.005))
    return box.get("r"), str(box.get("e"))[:300]
wv.loadRequest_(NSURLRequest.requestWithURL_(NSURL.URLWithString_(sys.argv[1]))); t0 = time.time()
while time.time() - t0 < 60:
    NSRunLoop.currentRunLoop().runUntilDate_(NSDate.dateWithTimeIntervalSinceNow_(1))
    r = js("String(window.__ready)+' '+JSON.stringify(window.__err||[]).slice(0,600)+' CC='+(typeof CC)")
    print("%.0f" % (time.time() - t0), r, flush=True)
    if r[0] and (r[0].startswith('true') or r[0].startswith('error') or '[]' not in r[0]): break
