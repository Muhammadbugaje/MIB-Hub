#!/usr/bin/env python3
"""Step 6: Start Blender MCP Server with ngrok tunnel for Colab"""
import threading
import time
import socket
import subprocess
import sys
import os

# ============================================================================
# Auto-install missing dependencies
# ============================================================================
def install_if_missing(*packages):
    import importlib
    for pkg in packages:
        try:
            importlib.import_module(pkg.replace("-", "_"))
        except ImportError:
            print(f"📦 Installing {pkg}...")
            subprocess.run([sys.executable, "-m", "pip", "install", "-q", pkg],
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

install_if_missing("pyngrok", "uvicorn", "fastapi", "nest_asyncio")

from pyngrok import ngrok
import uvicorn
from fastapi import FastAPI
nest_asyncio.apply()

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
# Write the MCP server script (embedded, line-by-line to avoid quote issues)
# ============================================================================
SERVER_PY = []
SERVER_PY.append('#!/usr/bin/env python3')
SERVER_PY.append('# MCP Server for Headless Blender on Google Colab')
SERVER_PY.append('import asyncio')
SERVER_PY.append('import json')
SERVER_PY.append('import os')
SERVER_PY.append('import subprocess')
SERVER_PY.append('import tempfile')
SERVER_PY.append('import uuid')
SERVER_PY.append('from pathlib import Path')
SERVER_PY.append('from typing import Any, Dict, List, Optional')
SERVER_PY.append('from fastapi import FastAPI, HTTPException')
SERVER_PY.append('from fastapi.responses import FileResponse, JSONResponse')
SERVER_PY.append('from pydantic import BaseModel')
SERVER_PY.append('import nest_asyncio')
SERVER_PY.append('nest_asyncio.apply()')
SERVER_PY.append('')
SERVER_PY.append('BLENDER_BIN = "/usr/local/bin/blender"')
SERVER_PY.append('WORKSPACE_DIR = Path("/content/drive/MyDrive/MIB-Hub-Assets")')
SERVER_PY.append('JOBS_DIR = WORKSPACE_DIR / "blender_jobs"')
SERVER_PY.append('JOBS_DIR.mkdir(parents=True, exist_ok=True)')
SERVER_PY.append('')
SERVER_PY.append('jobs: Dict[str, Dict[str, Any]] = {}')
SERVER_PY.append('')
SERVER_PY.append('class BlenderJobRequest(BaseModel):')
SERVER_PY.append('    script: str')
SERVER_PY.append('    description: str')
SERVER_PY.append('    output_format: str = "png"')
SERVER_PY.append('    render: bool = False')
SERVER_PY.append('    camera_position: Optional[List[float]] = None')
SERVER_PY.append('    camera_target: Optional[List[float]] = None')
SERVER_PY.append('')
SERVER_PY.append('class BlenderJobResponse(BaseModel):')
SERVER_PY.append('    job_id: str')
SERVER_PY.append('    status: str')
SERVER_PY.append('    output_files: List[str]')
SERVER_PY.append('    stdout: str')
SERVER_PY.append('    stderr: str')
SERVER_PY.append('    duration_seconds: float')
SERVER_PY.append('')
SERVER_PY.append('app = FastAPI(title="Blender MCP Server (Colab)", version="1.0.0")')
SERVER_PY.append('')
SERVER_PY.append('async def run_blender_script(')
SERVER_PY.append('    job_id: str,')
SERVER_PY.append('    script: str,')
SERVER_PY.append('    output_format: str,')
SERVER_PY.append('    render: bool,')
SERVER_PY.append('    camera_position: Optional[List[float]],')
SERVER_PY.append('    camera_target: Optional[List[float]],')
SERVER_PY.append(') -> BlenderJobResponse:')
SERVER_PY.append('    """Execute a Blender Python script."""')
SERVER_PY.append('    job_dir = JOBS_DIR / job_id')
SERVER_PY.append('    job_dir.mkdir(parents=True, exist_ok=True)')
SERVER_PY.append('    script_path = job_dir / "script.py"')
SERVER_PY.append('    output_path = job_dir / f"output.{output_format}"')
SERVER_PY.append('')
SERVER_PY.append('    wrapped_script = f"import bpy\\nimport time\\nstart_time = time.time()\\n{script}\\n"')
SERVER_PY.append('')
SERVER_PY.append('    if camera_position and camera_target:')
SERVER_PY.append('        wrapped_script += "\\nimport mathutils\\n"')
SERVER_PY.append('        wrapped_script += "if \'Camera\' not in bpy.data.objects:\\n"')
SERVER_PY.append('        wrapped_script += "    bpy.ops.object.camera_add(location={camera_position})\\n"')
SERVER_PY.append('        wrapped_script += "    cam = bpy.context.object\\n"')
SERVER_PY.append('        wrapped_script += "    cam.name = \'Camera\',\\n"')
SERVER_PY.append('        wrapped_script += "else:\\n"')
SERVER_PY.append('        wrapped_script += "    cam = bpy.data.objects[\'Camera\']\\n"')
SERVER_PY.append('        wrapped_script += "    cam.location = {camera_position}\\n"')
SERVER_PY.append('        wrapped_script += "direction = mathutils.Vector({camera_target}) - mathutils.Vector({camera_position})\\n"')
SERVER_PY.append('        wrapped_script += "rot_quat = direction.to_track_quat(\'-Z\', \'Y\')\\n"')
SERVER_PY.append('        wrapped_script += "cam.rotation_euler = rot_quat.to_euler()\\n"')
SERVER_PY.append('        wrapped_script += "bpy.context.scene.camera = cam\\n"')
SERVER_PY.append('')
SERVER_PY.append('    if render:')
SERVER_PY.append('        wrapped_script += "\\n# Render\\n"')
SERVER_PY.append('        wrapped_script += "bpy.context.scene.render.filepath = \\'{output_path.as_posix()}\\'\\n"')
SERVER_PY.append('        wrapped_script += "bpy.context.scene.render.image_settings.file_format = \\'{output_format.upper()}\\'\\n"')
SERVER_PY.append('        wrapped_script += "bpy.context.scene.render.resolution_x = 1920\\n"')
SERVER_PY.append('        wrapped_script += "bpy.context.scene.render.resolution_y = 1080\\n"')
SERVER_PY.append('        wrapped_script += "bpy.context.scene.render.engine = \\'CYCLES\\'\\n"')
SERVER_PY.append('        wrapped_script += "bpy.context.scene.cycles.samples = 64\\n"')
SERVER_PY.append('        wrapped_script += "bpy.context.scene.cycles.device = \\'GPU\\'\\n"')
SERVER_PY.append('        wrapped_script += "bpy.ops.render.render(write_still=True)\\n"')
SERVER_PY.append('        wrapped_script += "print(f\\\"RENDERED: {output_path.as_posix()}\\\")\\n"')
SERVER_PY.append('')
SERVER_PY.append('    elif output_format == "glb":')
SERVER_PY.append('        wrapped_script += "\\n# Export GLB\\n"')
SERVER_PY.append('        wrapped_script += "bpy.ops.export_scene.gltf(\\n"')
SERVER_PY.append('        wrapped_script += "    filepath=\\'{output_path.as_posix()}\\',\\n"')
SERVER_PY.append('        wrapped_script += "    export_format=\\'GLB\\',\\n"')
SERVER_PY.append('        wrapped_script += "    export_draco_mesh_compression_enable=True,\\n"')
SERVER_PY.append('        wrapped_script += "    export_draco_mesh_compression_level=6\\n"')
SERVER_PY.append('        wrapped_script += ")\\n"')
SERVER_PY.append('        wrapped_script += "print(f\\\"EXPORTED: {output_path.as_posix()}\\\")\\n"')
SERVER_PY.append('')
SERVER_PY.append('    elif output_format == "blend":')
SERVER_PY.append('        wrapped_script += f"bpy.ops.wm.save_as_mainfile(filepath=\\'{output_path.as_posix()}\\')\\nprint(f\\\"SAVED: {output_path.as_posix()}\\\")\\n"')
SERVER_PY.append('')
SERVER_PY.append('    wrapped_script += "duration = time.time() - start_time\\nprint(f\\\"DURATION: {duration:.2f}s\\\\")\\n"')
SERVER_PY.append('    script_path.write_text(wrapped_script)')
SERVER_PY.append('')
SERVER_PY.append('    cmd = [BLENDER_BIN, "--background", "--python", str(script_path)]')
SERVER_PY.append('    proc = await asyncio.create_subprocess_exec(')
SERVER_PY.append('        *cmd,')
SERVER_PY.append('        stdout=asyncio.subprocess.PIPE,')
SERVER_PY.append('        stderr=asyncio.subprocess.PIPE,')
SERVER_PY.append('        cwd=str(job_dir),')
SERVER_PY.append('    )')
SERVER_PY.append('    stdout, stderr = await proc.communicate()')
SERVER_PY.append('    stdout_text = stdout.decode("utf-8")')
SERVER_PY.append('    stderr_text = stderr.decode("utf-8")')
SERVER_PY.append('')
SERVER_PY.append('    duration = 0.0')
SERVER_PY.append('    for line in stdout_text.splitlines():')
SERVER_PY.append('        if line.startswith("DURATION:"):')
SERVER_PY.append('            duration = float(line.split(":")[1].strip().rstrip("s"))')
SERVER_PY.append('')
SERVER_PY.append('    output_files = [str(f.relative_to(WORKSPACE_DIR)) for f in job_dir.glob("output.*")]')
SERVER_PY.append('    status = "completed" if proc.returncode == 0 else "failed"')
SERVER_PY.append('')
SERVER_PY.append('    return BlenderJobResponse(')
SERVER_PY.append('        job_id=job_id,')
SERVER_PY.append('        status=status,')
SERVER_PY.append('        output_files=output_files,')
SERVER_PY.append('        stdout=stdout_text,')
SERVER_PY.append('        stderr=stderr_text,')
SERVER_PY.append('        duration_seconds=duration,')
SERVER_PY.append('    )')
SERVER_PY.append('')
SERVER_PY.append('@app.post("/mcp/jobs", response_model=BlenderJobResponse)')
SERVER_PY.append('async def create_blender_job(req: BlenderJobRequest):')
SERVER_PY.append('    job_id = str(uuid.uuid4())')
SERVER_PY.append('    jobs[job_id] = {"status": "running", "request": req.dict()}')
SERVER_PY.append('    result = await run_blender_script(')
SERVER_PY.append('        job_id=job_id,')
SERVER_PY.append('        script=req.script,')
SERVER_PY.append('        output_format=req.output_format,')
SERVER_PY.append('        render=req.render,')
SERVER_PY.append('        camera_position=req.camera_position,')
SERVER_PY.append('        camera_target=req.camera_target,')
SERVER_PY.append('    )')
SERVER_PY.append('    jobs[job_id] = result.dict()')
SERVER_PY.append('    return result')
SERVER_PY.append('')
SERVER_PY.append('@app.get("/mcp/jobs/{job_id}", response_model=BlenderJobResponse)')
SERVER_PY.append('async def get_job_status(job_id: str):')
SERVER_PY.append('    if job_id not in jobs:')
SERVER_PY.append('        raise HTTPException(status_code=404, detail="Job not found")')
SERVER_PY.append('    return JSONResponse(content=jobs[job_id])')
SERVER_PY.append('')
SERVER_PY.append('@app.get("/mcp/jobs/{job_id}/download/{filename}")')
SERVER_PY.append('async def download_output(job_id: str, filename: str):')
SERVER_PY.append('    file_path = JOBS_DIR / job_id / filename')
SERVER_PY.append('    if not file_path.exists():')
SERVER_PY.append('        raise HTTPException(status_code=404, detail="File not found")')
SERVER_PY.append('    return FileResponse(file_path)')
SERVER_PY.append('')
SERVER_PY.append('@app.get("/mcp/health")')
SERVER_PY.append('async def health_check():')
SERVER_PY.append('    try:')
SERVER_PY.append('        version_result = subprocess.run(')
SERVER_PY.append('            [BLENDER_BIN, "--version"],')
SERVER_PY.append('            capture_output=True,')
SERVER_PY.append('            text=True,')
SERVER_PY.append('        ).stdout.split("\\n")[0]')
SERVER_PY.append('    except:')
SERVER_PY.append('        version_result = "unknown"')
SERVER_PY.append('    return {')
SERVER_PY.append('        "status": "ok",')
SERVER_PY.append('        "blender": version_result,')
SERVER_PY.append('        "workspace": str(WORKSPACE_DIR),')
SERVER_PY.append('        "jobs_count": len(jobs),')
SERVER_PY.append('    }')
SERVER_PY.append('')
SERVER_PY.append('print("✅ MCP Server script ready")')
SERVER_PY.append('')

with open("/content/mcp_blender_server.py", "w") as f:
    f.write("\n".join(SERVER_PY))

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
    cwd="/content",
)

with open("/content/mcp_server.pid", "w") as f:
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