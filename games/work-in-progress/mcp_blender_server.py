#!/usr/bin/env python3
"""MCP Server for Headless Blender on Google Colab"""
import asyncio
import json
import os
import subprocess
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
import nest_asyncio

nest_asyncio.apply()

BLENDER_BIN = "/usr/local/bin/blender"
WORKSPACE_DIR = Path("/content/drive/MyDrive/MIB-Hub-Assets")
JOBS_DIR = WORKSPACE_DIR / "blender_jobs"
JOBS_DIR.mkdir(parents=True, exist_ok=True)

jobs: Dict[str, Dict[str, Any]] = {}

class BlenderJobRequest(BaseModel):
    script: str
    description: str
    output_format: str = "png"
    render: bool = False
    camera_position: Optional[List[float]] = None
    camera_target: Optional[List[float]] = None

class BlenderJobResponse(BaseModel):
    job_id: str
    status: str
    output_files: List[str]
    stdout: str
    stderr: str
    duration_seconds: float

app = FastAPI(title="Blender MCP Server (Colab)", version="1.0.0")

async def run_blender_script(
    job_id: str,
    script: str,
    output_format: str,
    render: bool,
    camera_position: Optional[List[float]],
    camera_target: Optional[List[float]],
) -> BlenderJobResponse:
    job_dir = JOBS_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)
    script_path = job_dir / "script.py"
    output_path = job_dir / f"output.{output_format}"

    wrapped_script = f"import bpy\nimport time\nstart_time = time.time()\n{script}\n"

    if camera_position and camera_target:
        wrapped_script += """
import mathutils
if 'Camera' not in bpy.data.objects:
    bpy.ops.object.camera_add(location={camera_position})
    cam = bpy.context.object
    cam.name = 'Camera'
else:
    cam = bpy.data.objects['Camera']
    cam.location = {camera_position}
direction = mathutils.Vector({camera_target}) - mathutils.Vector({camera_position})
rot_quat = direction.to_track_quat('-Z', 'Y')
cam.rotation_euler = rot_quat.to_euler()
bpy.context.scene.camera = cam
"""

    if render:
        wrapped_script += """
bpy.context.scene.render.filepath = '{output_path.as_posix()}'
bpy.context.scene.render.image_settings.file_format = '{output_format.upper()}'
bpy.context.scene.render.resolution_x = 1920
bpy.context.scene.render.resolution_y = 1080
bpy.context.scene.render.engine = 'CYCLES'
bpy.context.scene.cycles.samples = 64
bpy.context.scene.cycles.device = 'GPU'
bpy.ops.render.render(write_still=True)
print(f"RENDERED: {output_path.as_posix()}")
"""
    elif output_format == "glb":
        wrapped_script += """
bpy.ops.export_scene.gltf(
    filepath='{output_path.as_posix()}',
    export_format='GLB',
    export_draco_mesh_compression_enable=True,
    export_draco_mesh_compression_level=6
)
print(f"EXPORTED: {output_path.as_posix()}")
"""
    elif output_format == "blend":
        wrapped_script += "bpy.ops.wm.save_as_mainfile(filepath='{output_path.as_posix()}')\nprint(f\"SAVED: {output_path.as_posix()}\")\n"

    wrapped_script += "duration = time.time() - start_time\nprint(f\"DURATION: {duration:.2f}s\")\n"
    script_path.write_text(wrapped_script)

    cmd = [BLENDER_BIN, "--background", "--python", str(script_path)]
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        cwd=str(job_dir),
    )
    stdout, stderr = await proc.communicate()
    stdout_text = stdout.decode("utf-8")
    stderr_text = stderr.decode("utf-8")

    duration = 0.0
    for line in stdout_text.splitlines():
        if line.startswith("DURATION:"):
            duration = float(line.split(":")[1].strip().rstrip("s"))

    output_files = [str(f.relative_to(WORKSPACE_DIR)) for f in job_dir.glob("output.*")]
    status = "completed" if proc.returncode == 0 else "failed"

    return BlenderJobResponse(
        job_id=job_id,
        status=status,
        output_files=output_files,
        stdout=stdout_text,
        stderr=stderr_text,
        duration_seconds=duration,
    )

@app.post("/mcp/jobs", response_model=BlenderJobResponse)
async def create_blender_job(req: BlenderJobRequest):
    job_id = str(uuid.uuid4())
    jobs[job_id] = {"status": "running", "request": req.dict()}
    result = await run_blender_script(
        job_id=job_id,
        script=req.script,
        output_format=req.output_format,
        render=req.render,
        camera_position=req.camera_position,
        camera_target=req.camera_target,
    )
    jobs[job_id] = result.dict()
    return result

@app.get("/mcp/jobs/{job_id}", response_model=BlenderJobResponse)
async def get_job_status(job_id: str):
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    return JSONResponse(content=jobs[job_id])

@app.get("/mcp/jobs/{job_id}/download/{filename}")
async def download_output(job_id: str, filename: str):
    file_path = JOBS_DIR / job_id / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_path)

@app.get("/mcp/health")
async def health_check():
    try:
        version_result = subprocess.run(
            [BLENDER_BIN, "--version"],
            capture_output=True,
            text=True,
        ).stdout.split("\n")[0]
    except:
        version_result = "unknown"
    return {
        "status": "ok",
        "blender": version_result,
        "workspace": str(WORKSPACE_DIR),
        "jobs_count": len(jobs),
    }

print("✅ MCP Server script ready")