"""
AI Newsroom Python Server
FastAPI + Socket.IO server for running AutoGen workflows with real-time updates.
"""

import os
import sys
import asyncio
import socketio
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from contextlib import asynccontextmanager
from datetime import datetime

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from agents import get_orchestrator
from models import get_session, save_session, WorkflowState

# Output directory configuration
OUTPUT_DIR = "/workspaces/autogen-newsroom/output"
os.makedirs(OUTPUT_DIR, exist_ok=True)


# Socket.IO server
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',
    logger=True,
    engineio_logger=True
)


# Event emitter that forwards to Socket.IO
async def emit_to_clients(event_type: str, data: Dict[str, Any]):
    """Emit events to connected Socket.IO clients."""
    session_id = data.get('session_id')
    if session_id:
        # Emit to specific session room
        await sio.emit(event_type, data, room=session_id)
    # Also emit to global room for monitoring
    await sio.emit(event_type, data)


# Pydantic models
class PodcastConfig(BaseModel):
    """Podcast configuration."""
    country: Dict[str, Any]
    continent: Dict[str, Any]
    timeframe: Dict[str, Any]
    topics: List[str]
    voice: Dict[str, str]
    music: Dict[str, Any]
    date: str


class StorySelection(BaseModel):
    """Story selection request."""
    localStoryIds: List[str]
    continentStoryIds: List[str]


class ReplacementSelection(BaseModel):
    """Replacement selection request."""
    selectedStoryId: Optional[str] = None
    removeStory: bool = False


# Lifespan context manager
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle startup and shutdown."""
    # Startup
    print("[Server] Starting AI Newsroom Python Server...")
    
    # Initialize orchestrator with event emitter
    orchestrator = get_orchestrator(emit_to_clients)
    print("[Server] Workflow orchestrator initialized")
    
    yield
    
    # Shutdown
    print("[Server] Shutting down...")
    orchestrator.stop()


# FastAPI app
app = FastAPI(
    title="AI Newsroom Python Server",
    description="AutoGen workflow orchestration with real-time updates",
    version="1.0.0",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files for audio output and assets
app.mount("/output", StaticFiles(directory=OUTPUT_DIR), name="output")
app.mount("/ai-newsroom/audio", StaticFiles(directory="/workspaces/autogen-newsroom/ai-newsroom/audio"), name="audio")

# Socket.IO ASGI app
asgi_app = socketio.ASGIApp(sio, app)


# Socket.IO events
@sio.event
async def connect(sid, environ):
    """Handle client connection."""
    print(f"[Socket.IO] Client connected: {sid}")
    await sio.emit('connected', {'sid': sid}, room=sid)


@sio.event
async def disconnect(sid):
    """Handle client disconnection."""
    print(f"[Socket.IO] Client disconnected: {sid}")


@sio.event
async def join_session(sid, data):
    """Join a workflow session room."""
    session_id = data.get('session_id')
    if session_id:
        sio.enter_room(sid, session_id)
        print(f"[Socket.IO] Client {sid} joined session {session_id}")
        await sio.emit('joined', {'session_id': session_id}, room=sid)


@sio.event
async def leave_session(sid, data):
    """Leave a workflow session room."""
    session_id = data.get('session_id')
    if session_id:
        sio.leave_room(sid, session_id)
        print(f"[Socket.IO] Client {sid} left session {session_id}")
        await sio.emit('left', {'session_id': session_id}, room=sid)


# HTTP endpoints
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "ok",
        "service": "ai-newsroom-python-server",
        "timestamp": asyncio.get_event_loop().time()
    }


@app.get("/output/{filename}/metadata")
async def get_file_metadata(filename: str):
    """Get metadata for a generated audio file."""
    file_path = os.path.join(OUTPUT_DIR, filename)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    
    # Get file stats
    stat = os.stat(file_path)
    size_bytes = stat.st_size
    
    # Format size
    if size_bytes < 1024 * 1024:
        size_str = f"{(size_bytes / 1024):.1f} KB"
    else:
        size_str = f"{(size_bytes / (1024 * 1024)):.1f} MB"
    
    # Estimate duration (rough estimate: MP3 at 320kbps = 40KB per second)
    # This is a rough estimate - actual duration would require reading the file
    estimated_seconds = size_bytes / 40000
    minutes = int(estimated_seconds // 60)
    seconds = int(estimated_seconds % 60)
    duration_str = f"{minutes}:{seconds:02d}"
    
    return {
        "filename": filename,
        "size": size_bytes,
        "sizeFormatted": size_str,
        "estimatedDuration": duration_str,
        "created": datetime.fromtimestamp(stat.st_mtime).isoformat(),
        "url": f"/output/{filename}"
    }


@app.get("/outputs")
async def list_outputs():
    """List all generated audio files."""
    if not os.path.exists(OUTPUT_DIR):
        return {"files": []}
    
    files = []
    for filename in os.listdir(OUTPUT_DIR):
        if filename.endswith('.mp3'):
            file_path = os.path.join(OUTPUT_DIR, filename)
            stat = os.stat(file_path)
            size_bytes = stat.st_size
            
            # Format size
            if size_bytes < 1024 * 1024:
                size_str = f"{(size_bytes / 1024):.1f} KB"
            else:
                size_str = f"{(size_bytes / (1024 * 1024)):.1f} MB"
            
            files.append({
                "filename": filename,
                "sizeFormatted": size_str,
                "created": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                "url": f"/output/{filename}"
            })
    
    # Sort by creation date (newest first)
    files.sort(key=lambda x: x["created"], reverse=True)
    
    return {"files": files}


@app.post("/workflow/start")
async def start_workflow(config: PodcastConfig):
    """Start a new podcast generation workflow."""
    import uuid
    
    session_id = str(uuid.uuid4())
    print(f"[DEBUG API /workflow/start] Starting NEW workflow {session_id}")
    
    # Get orchestrator and start workflow in background
    orchestrator = get_orchestrator()
    
    # Start workflow asynchronously
    asyncio.create_task(
        orchestrator.run_workflow(session_id, config.model_dump())
    )
    
    return {
        "sessionId": session_id,
        "status": "started"
    }


@app.get("/workflow/{session_id}/status")
async def get_workflow_status(session_id: str):
    """Get current workflow status."""
    session = get_session(session_id)
    
    if not session:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    return {
        "sessionId": session.session_id,
        "workflowState": session.state.value,
        "currentStep": session.current_step,
        "progress": session.progress,
        "agents": {
            name: {
                "name": agent.name,
                "role": agent.role,
                "avatar": agent.avatar,
                "status": agent.status.value,
                "currentTask": agent.current_task,
                "progress": agent.progress,
                "error": agent.error
            }
            for name, agent in session.agents.items()
        },
        "researchOutput": {
            "localStories": [s.model_dump() for s in session.research_output.get("localStories", [])],
            "continentStories": [s.model_dump() for s in session.research_output.get("continentStories", [])]
        } if session.research_output else None,
        "failedStory": session.failed_story.model_dump() if session.failed_story else None,
        "replacementOptions": [s.model_dump() for s in session.replacement_options] if session.replacement_options else None,
        "mp3Url": session.mp3_url,
        "filename": session.filename,
        "error": session.error
    }


@app.post("/workflow/{session_id}/select")
async def submit_story_selection(session_id: str, selection: StorySelection):
    """Submit story selection to resume workflow."""
    print(f"[DEBUG API /workflow/select] Called for session {session_id}")
    session = get_session(session_id)
    
    if not session:
        print(f"[DEBUG API /workflow/select] Session {session_id} NOT FOUND")
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    print(f"[DEBUG API /workflow/select] Session found: state={session.state}, research_output={'PRESENT' if session.research_output else 'MISSING'}")
    
    if session.state != WorkflowState.AWAITING_SELECTION:
        raise HTTPException(status_code=400, detail="Workflow is not awaiting story selection")
    
    orchestrator = get_orchestrator()
    
    # Validate selection counts
    if len(selection.localStoryIds) != 5:
        raise HTTPException(status_code=400, detail="Must select exactly 5 local stories")
    if len(selection.continentStoryIds) != 3:
        raise HTTPException(status_code=400, detail="Must select exactly 3 continent stories")
    
    print(f"[DEBUG API /workflow/select] Submitting selection: {len(selection.localStoryIds)} local, {len(selection.continentStoryIds)} continent")
    
    # Submit selection and resume
    await orchestrator.submit_story_selection(
        session_id,
        selection.localStoryIds,
        selection.continentStoryIds
    )
    
    print(f"[DEBUG API /workflow/select] Selection submitted successfully for {session_id}")
    return {"success": True, "message": "Story selection submitted"}


@app.post("/workflow/{session_id}/replace")
async def submit_replacement_selection(session_id: str, selection: ReplacementSelection):
    """Submit replacement selection to resume workflow."""
    session = get_session(session_id)
    
    if not session:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    if session.state != WorkflowState.AWAITING_REPLACEMENT:
        raise HTTPException(status_code=400, detail="Workflow is not awaiting replacement selection")
    
    orchestrator = get_orchestrator()
    
    await orchestrator.submit_replacement_selection(
        session_id,
        selection.selectedStoryId,
        selection.removeStory
    )
    
    return {"success": True, "message": "Replacement selection submitted"}


@app.post("/workflow/{session_id}/resume")
async def resume_workflow(session_id: str):
    """Resume a paused workflow."""
    print(f"[DEBUG API /workflow/resume] Called for session {session_id}")
    session = get_session(session_id)
    
    if not session:
        print(f"[DEBUG API /workflow/resume] Session {session_id} NOT FOUND")
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    print(f"[DEBUG API /workflow/resume] Session found: state={session.state}, research_output={'PRESENT' if session.research_output else 'MISSING'}, user_selection={'PRESENT' if session.user_selection else 'MISSING'}")
    
    if session.state not in [WorkflowState.AWAITING_SELECTION, WorkflowState.AWAITING_REPLACEMENT]:
        raise HTTPException(status_code=400, detail="Workflow is not paused")
    
    orchestrator = get_orchestrator()
    
    # Continue workflow based on current state
    if session.state == WorkflowState.AWAITING_SELECTION:
        # This shouldn't happen - selection should be submitted first
        raise HTTPException(status_code=400, detail="Please submit story selection first")
    
    print(f"[DEBUG API /workflow/resume] Spawning run_workflow for {session_id}")
    # Resume workflow in background
    asyncio.create_task(
        orchestrator.run_workflow(session_id, {})  # Config will be loaded from session
    )
    
    return {"success": True, "message": "Workflow resumed"}


# Agent Log API Endpoints
@app.get("/workflow/{session_id}/artifacts")
async def get_workflow_artifacts(session_id: str):
    """Get all artifacts for a workflow session."""
    session = get_session(session_id)
    
    if not session:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    return {
        "sessionId": session_id,
        "artifacts": session.artifacts,
        "artifactTypes": list(session.artifacts.keys())
    }


@app.get("/workflow/{session_id}/artifacts/{artifact_type}")
async def get_specific_artifact(session_id: str, artifact_type: str):
    """Get a specific artifact by type."""
    session = get_session(session_id)
    
    if not session:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    if artifact_type not in session.artifacts:
        raise HTTPException(status_code=404, detail=f"Artifact type '{artifact_type}' not found")
    
    return {
        "sessionId": session_id,
        "artifactType": artifact_type,
        "content": session.artifacts[artifact_type]
    }


@app.get("/workflow/{session_id}/activity-log")
async def get_activity_log(session_id: str, limit: int = 100):
    """Get activity log for a workflow session."""
    session = get_session(session_id)
    
    if not session:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    # Return most recent events first, limited by 'limit'
    logs = session.activity_log[-limit:] if len(session.activity_log) > limit else session.activity_log
    
    return {
        "sessionId": session_id,
        "totalEvents": len(session.activity_log),
        "events": logs
    }


@app.get("/workflow/{session_id}/agent-outputs")
async def get_agent_outputs(session_id: str, agent: Optional[str] = None):
    """Get raw agent outputs for a workflow session."""
    session = get_session(session_id)
    
    if not session:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    if agent:
        # Return outputs for specific agent
        return {
            "sessionId": session_id,
            "agent": agent,
            "outputs": session.agent_outputs.get(agent, [])
        }
    
    # Return all agent outputs
    return {
        "sessionId": session_id,
        "agents": list(session.agent_outputs.keys()),
        "outputs": session.agent_outputs
    }


@app.get("/workflow/{session_id}/full-state")
async def get_full_workflow_state(session_id: str):
    """Get complete workflow state including status, artifacts, and logs."""
    session = get_session(session_id)
    
    if not session:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    return {
        "sessionId": session.session_id,
        "workflowState": session.state.value,
        "currentStep": session.current_step,
        "progress": session.progress,
        "agents": {
            name: {
                "name": agent.name,
                "role": agent.role,
                "avatar": agent.avatar,
                "status": agent.status.value,
                "currentTask": agent.current_task,
                "progress": agent.progress,
                "error": agent.error
            }
            for name, agent in session.agents.items()
        },
        "researchOutput": {
            "localStories": [s.model_dump() for s in session.research_output.get("localStories", [])],
            "continentStories": [s.model_dump() for s in session.research_output.get("continentStories", [])]
        } if session.research_output else None,
        "failedStory": session.failed_story.model_dump() if session.failed_story else None,
        "replacementOptions": [s.model_dump() for s in session.replacement_options] if session.replacement_options else None,
        "mp3Url": session.mp3_url,
        "filename": session.filename,
        "error": session.error,
        # Agent Log fields
        "artifacts": session.artifacts,
        "artifactTypes": list(session.artifacts.keys()),
        "activityLog": session.activity_log[-50:],  # Last 50 events
        "totalEvents": len(session.activity_log),
        "agentOutputs": {
            k: [
                {"role": o.role, "content": o.content[:10000], "timestamp": o.timestamp}
                for o in v[-5:]  # Last 5 messages per agent, limited content
            ]
            for k, v in session.agent_outputs.items()
        }
    }


# Run server
if __name__ == "__main__":
    import uvicorn
    
    port = int(os.getenv("PYTHON_SERVER_PORT", "8000"))
    host = os.getenv("PYTHON_SERVER_HOST", "0.0.0.0")
    
    print(f"[Server] Starting on {host}:{port}")
    uvicorn.run(asgi_app, host=host, port=port)
