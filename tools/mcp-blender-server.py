#!/usr/bin/env python3
"""
MCP Server for Headless Blender on Lightning AI
Allows Claude to send Blender Python scripts and retrieve rendered outputs.

Run on Lightning AI:
    python mcp-blender-server.py --port 8080 --workspace /teamspace/studios/this_studio

Access from Claude Code:
    claude mcp add --transport http blender-lightning http://YOUR_LIGHTNING_URL:8080/mcp
"""
import argparse
import asyncio
import json
import os
import subprocess
import tempfile
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

# ============================================================================
# Models
# ============================================================================

class BlenderJobRequest(BaseModel):
    """Request to run a Blender Python script."""
    script: str
    description: str
    output_format: str = "png"  # png, jpg, glb, blend
    render: bool = False  # If True, render the scene
    camera_position: Optional[List[float]] = None
    camera_target: Optional[List[float]] = None


class BlenderJobResponse(BaseModel):
    """Response from a Blender job."""
    job_id: str
    status: str  # running, completed, failed
    output_files: List[str]
    stdout: str
    stderr: str
    duration_seconds: float


# ============================================================================
# FastAPI App
# ============================================================================

app = FastAPI(title="Blender MCP Server", version="1.0.0")

# Global config
WORKSPACE_DIR: Path = Path("/teamspace/studios/this_studio")
BLENDER_BIN: str = "blender"
JOBS_DIR: Path = WORKSPACE_DIR / "blender_jobs"
JOBS_DIR.mkdir(exist_ok=True)

# Job storage (in-memory; use Redis for production)
jobs: Dict[str, Dict[str, Any]] = {}


# ============================================================================
# Blender Execution
# ============================================================================

async def run_blender_script(
    job_id: str,
    script: str,
    output_format: str,
    render: bool,
    camera_position: Optional[List[float]],
    camera_target: Optional[List[float]],
) -> BlenderJobResponse:
    """Execute a Blender Python script in headless mode."""
    job_dir = JOBS_DIR / job_id
    job_dir.mkdir(exist_ok=True)

    script_path = job_dir / "script.py"
    output_path = job_dir / f"output.{output_format}"
    log_path = job_dir / "log.txt"

    # Wrap the script with output setup
    wrapped_script = f"""
import bpy
import sys
import time

start_time = time.time()

# User script
{script}

# Auto-setup camera if requested
"""
    if camera_position and camera_target:
        wrapped_script += f"""
if 'Camera' not in bpy.data.objects:
    bpy.ops.object.camera_add(location={camera_position})
    cam = bpy.context.object
    cam.name = 'Camera'
else:
    cam = bpy.data.objects['Camera']
    cam.location = {camera_position}

# Point camera at target
import mathutils
direction = mathutils.Vector({camera_target}) - mathutils.Vector({camera_position})
rot_quat = direction.to_track_quat('-Z', 'Y')
cam.rotation_euler = rot_quat.to_euler()
bpy.context.scene.camera = cam
"""

    if render:
        wrapped_script += f"""
# Render setup
bpy.context.scene.render.filepath = '{output_path.as_posix()}'
bpy.context.scene.render.image_settings.file_format = '{output_format.upper()}'
bpy.context.scene.render.resolution_x = 1920
bpy.context.scene.render.resolution_y = 1080
bpy.ops.render.render(write_still=True)
print(f"RENDERED: {{'{output_path.as_posix()}'}}")
"""
    elif output_format in ["glb", "blend"]:
        wrapped_script += f"""
# Export
if '{output_format}' == 'glb':
    bpy.ops.export_scene.gltf(filepath='{output_path.as_posix()}', export_format='GLB')
elif '{output_format}' == 'blend':
    bpy.ops.wm.save_as_mainfile(filepath='{output_path.as_posix()}')
print(f"EXPORTED: {{'{output_path.as_posix()}'}}")
"""

    wrapped_script += """
duration = time.time() - start_time
print(f"DURATION: {duration:.2f}s")
"""

    script_path.write_text(wrapped_script)

    # Run Blender
    cmd = [
        BLENDER_BIN,
        "--background",
        "--python", str(script_path),
        "--log-level", "0",
    ]

    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        cwd=str(job_dir),
    )

    stdout, stderr = await proc.communicate()
    stdout_text = stdout.decode("utf-8")
    stderr_text = stderr.decode("utf-8")

    # Parse duration
    duration = 0.0
    for line in stdout_text.splitlines():
        if line.startswith("DURATION:"):
            duration = float(line.split(":")[1].strip().rstrip("s"))

    # Find output files
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


# ============================================================================
# API Endpoints
# ============================================================================

@app.post("/mcp/jobs", response_model=BlenderJobResponse)
async def create_blender_job(req: BlenderJobRequest):
    """Submit a Blender Python script for execution."""
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
    """Check the status of a Blender job."""
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    return JSONResponse(content=jobs[job_id])


@app.get("/mcp/jobs/{job_id}/download/{filename}")
async def download_output(job_id: str, filename: str):
    """Download an output file from a completed job."""
    file_path = JOBS_DIR / job_id / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_path)


@app.get("/mcp/health")
async def health_check():
    """Health check endpoint."""
    blender_version = subprocess.run(
        [BLENDER_BIN, "--version"],
        capture_output=True,
        text=True,
    ).stdout.split("\n")[0]

    return {
        "status": "ok",
        "blender": blender_version,
        "workspace": str(WORKSPACE_DIR),
        "jobs_count": len(jobs),
    }


# ============================================================================
# Main
# ============================================================================

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8080)
    parser.add_argument("--workspace", type=Path, default=Path("/teamspace/studios/this_studio"))
    args = parser.parse_args()

    WORKSPACE_DIR = args.workspace
    JOBS_DIR = WORKSPACE_DIR / "blender_jobs"
    JOBS_DIR.mkdir(exist_ok=True)

    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=args.port)
