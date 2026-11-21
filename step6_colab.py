#!/usr/bin/env python3
"""Step 6: Start Blender MCP Server with ngrok tunnel for Colab"""
import threading
import time
import socket
import subprocess
import sys
import os

# ============================================================================
# Install dependencies first
# ============================================================================
print("📦 Installing required dependencies...")
subprocess.run([sys.executable, "-m", "pip", "install", "-q", "pyngrok", "uvicorn", "fastapi", "nest_asyncio"],
             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

import nest_asyncio
nest_asyncio.apply()

from pyngrok import ngrok
import uvicorn
from fastapi import FastAPI

# ============================================================================
# Force-kill any existing processes on ports 8080/8081
# ============================================================================
def kill_process_on_port(port):
    try:
        result = subprocess.run(
            ["fuser", "-k", f"{port}/tcp"],
            capture_output=True, text=True, timeout=5
        )
        if result.returncode == 0:
            print(f"🧹 Cleaned up process on port {port}")
    except (FileNotFoundError, subprocess.TimeoutExpired):
        try:
            result = subprocess.run(
                ["pkill", "-f", f"uvicorn.*{port}"],
                capture_output=True, text=True, timeout=3
            )
        except:
            pass

kill_process_on_port(8080)
kill_process_on_port(8081)

# ============================================================================
# Configure ngrok (handle already-configured token gracefully)
# ============================================================================
try:
    ngrok.set_auth_token("3AAm45UPC5zS4dhowPAqAe3n3uD_z4nXtGmLZb7LD8o63YZo")
    print("✅ ngrok authentication token set")
except Exception as e:
    print(f"ℹ ngrok token already configured or using default: {e}")

# Disconnect any existing tunnels
try:
    for tunnel in ngrok.get_tunnels():
        if "8080" in str(tunnel) or "8081" in str(tunnel):
            ngrok.disconnect(tunnel.public_url)
            print(f"🧹 Disconnected old tunnel: {tunnel.public_url}")
except Exception:
    pass

# ============================================================================
# Start ngrok tunnel
# ============================================================================
print("🔗 Starting ngrok tunnel on port 8080...")
try:
    public_tunnel = ngrok.connect(8080)
    public_url = str(public_tunnel).split('"')[1]
    print(f"✅ ngrok tunnel established: {public_url}")
except Exception as e:
    print(f"⚠ ngrok on 8080 failed: {e}")
    print("🔄 Trying port 8081...")
    try:
        public_tunnel = ngrok.connect(8081)
        public_url = str(public_tunnel).split('"')[1]
        print(f"✅ ngrok tunnel on 8081: {public_url}")
    except Exception as e2:
        print(f"❌ ngrok failed on both ports: {e2}")
        public_url = None

# ============================================================================
# Start uvicorn server as detached background process
# ============================================================================
def find_free_port():
    for port in [8080, 8081]:
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(1)
            s.bind(("0.0.0.0", port))
            s.close()
            return port
        except OSError:
            try:
                s.close()
            except:
                pass
    return None

port = find_free_port()
if not port:
    print("❌ No free ports available (8080 and 8081 both in use)")
    sys.exit(1)

print(f"🚀 Using port {port} for uvicorn server")

server_proc = subprocess.Popen(
    [sys.executable, "-m", "uvicorn", "mcp_blender_server:app",
     "--host", "0.0.0.0", "--port", str(port), "--log-level", "warning"],
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,
    start_new_session=True,
    cwd=os.getcwd(),
)

pid_file = os.path.join(os.getcwd(), "mcp_server.pid")
with open(pid_file, "w") as f:
    f.write(str(server_proc.pid))

print(f"✅ uvicorn server started (PID: {server_proc.pid})")

import urllib.request
print("⏳ Waiting for MCP server to respond...")
max_retries = 20
for attempt in range(max_retries):
    try:
        r = urllib.request.urlopen(f"http://127.0.0.1:{port}/mcp/health", timeout=2)
        if r.status == 200:
            print("✅ MCP server is responding locally")
            break
    except Exception:
        pass
    time.sleep(1)
else:
    print("⚠ Server may not be ready yet, but continuing...")

# Keep-alive monitor
def keep_alive_monitor():
    import time as t
    try:
        for _ in range(50):
            t.sleep(2)
            try:
                urllib.request.urlopen(f"http://127.0.0.1:{port}/mcp/health", timeout=2)
            except:
                pass
    except Exception:
        pass

monitor_thread = threading.Thread(target=keep_alive_monitor, daemon=True)
monitor_thread.start()

# ============================================================================
# Report success
# ============================================================================
print("=" * 80)
print("🚀 MCP SERVER IS LIVE!")
print("=" * 80)
if public_url:
    print(f"\n📡 Public URL: {public_url}\n")
    print("📋 COPY THIS URL AND GIVE IT TO CLAUDE:\n")
    print(f" {public_url}")
else:
    print(f"\n📡 Local only: http://127.0.0.1:{port}/mcp/health\n")

print("💻 On your LOCAL machine, run:")
if public_url:
    print(f" claude mcp add --transport http blender-colab {public_url}")
print(f"\n⏳ Server will keep running in background.")
print("=" * 80)
print("🛑 To stop: kill $(cat /content/mcp_server.pid)")
print("\n✅ Cell complete — server stays running, runtime stays active.\n")
print("=" * 80)