#!/usr/bin/env python3
"""Send a Blender Python script to the Colab MCP server and print the result."""
import json, sys, urllib.request, pathlib, base64, re

BASE = "https://thanklessly-skyborne-miyoko.ngrok-free.dev"
URL = BASE + "/mcp/jobs"

def main():
    script_path = pathlib.Path(sys.argv[1])
    desc = sys.argv[2] if len(sys.argv) > 2 else script_path.stem
    fmt = sys.argv[3] if len(sys.argv) > 3 else "png"
    body = json.dumps({
        "script": script_path.read_text(),
        "description": desc,
        "output_format": fmt,
        "render": False,
    }).encode()
    req = urllib.request.Request(URL, data=body, headers={
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
    })
    with urllib.request.urlopen(req, timeout=600) as r:
        data = json.load(r)
    print("STATUS :", data.get("status"))
    print("JOB    :", data.get("job_id"))
    print("FILES  :", data.get("output_files"))
    out = data.get("stdout") or ""
    # pull out any inline base64 images and save them locally
    for name, b64 in re.findall(r"BASE64_IMAGE:([\w.-]+):([A-Za-z0-9+/=]+)", out):
        dst = f"/tmp/{name}"
        open(dst, "wb").write(base64.b64decode(b64))
        print("SAVED_IMAGE:", dst)
    out = re.sub(r"BASE64_IMAGE:[\w.-]+:[A-Za-z0-9+/=]+", "<<image>>", out)
    print("--- STDOUT ---")
    print(out.strip()[-5000:])
    if data.get("stderr"):
        print("--- STDERR ---")
        print(data["stderr"].strip()[-4000:])


if __name__ == "__main__":
    main()
