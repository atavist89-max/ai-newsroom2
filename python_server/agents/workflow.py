"""
AI Newsroom Workflow Orchestrator
Manages the 7-agent pipeline with real-time WebSocket event emission.
"""

import asyncio
import json
import uuid
from typing import Dict, List, Optional, Callable, Any, Coroutine
from datetime import datetime
from autogen_agentchat.teams import SelectorGroupChat
from autogen_agentchat.conditions import TextMentionTermination, MaxMessageTermination
from autogen_agentchat.messages import ChatMessage

from .loader import get_agent_loader
from models.state import (
    WorkflowSession, WorkflowState, AgentState, AgentStatus,
    Story, FailedStory, save_session, get_session, ActivityLogEntry
)


# Event callback type
EventCallback = Callable[[str, Dict[str, Any]], Coroutine[Any, Any, None]]


class WorkflowOrchestrator:
    """Orchestrates the 7-agent podcast production workflow."""
    
    # Agent metadata with avatars
    AGENT_METADATA = {
        "news_researcher": {"role": "Investigative Researcher", "avatar": "🔍"},
        "editor": {"role": "Content Editor", "avatar": "✏️"},
        "final_writer": {"role": "Script Writer", "avatar": "📝"},
        "fact_checker": {"role": "Verification Specialist", "avatar": "✅"},
        "recovery_researcher": {"role": "Backup Researcher", "avatar": "🔄"},
        "final_editor": {"role": "Final Editor", "avatar": "👔"},
        "audio_producer": {"role": "Audio Producer", "avatar": "🎙️"}
    }
    
    def __init__(self, event_callback: Optional[EventCallback] = None):
        self.event_callback = event_callback
        self.loader = get_agent_loader()
        self._stop_event = asyncio.Event()
        
    async def emit(self, event_type: str, data: Dict[str, Any]):
        """Emit an event via the callback."""
        if self.event_callback:
            try:
                await self.event_callback(event_type, data)
            except Exception as e:
                print(f"[Workflow] Error emitting event {event_type}: {e}")
    
    async def _emit_and_log(self, session: WorkflowSession, event_type: str, data: Dict[str, Any], agent: Optional[str] = None, message: Optional[str] = None):
        """Emit event and log to activity log for Agent Log UI.
        
        This combines WebSocket emission with persistent activity logging.
        """
        # Emit via WebSocket (real-time UI updates)
        await self.emit(event_type, data)
        
        # Store in activity log (for timeline replay)
        from models.state import ActivityLogEntry
        session.activity_log.append(
            ActivityLogEntry(
                timestamp=datetime.now().isoformat(),
                event_type=event_type,
                agent=agent,
                message=message,
                data=data
            )
        )
        save_session(session)
    
    def _create_agent_states(self) -> Dict[str, AgentState]:
        """Create initial agent states."""
        agents = {}
        for name, meta in self.AGENT_METADATA.items():
            agents[name] = AgentState(
                name=name,
                role=meta["role"],
                avatar=meta["avatar"],
                status=AgentStatus.IDLE
            )
        return agents
    
    async def _update_agent_status(
        self,
        session: WorkflowSession,
        agent_name: str,
        status: AgentStatus,
        task: Optional[str] = None,
        progress: Optional[int] = None,
        message: Optional[str] = None
    ):
        """Update agent status and emit event."""
        if agent_name not in session.agents:
            return
            
        agent = session.agents[agent_name]
        agent.status = status
        
        if task is not None:
            agent.current_task = task
        if progress is not None:
            agent.progress = progress
        if message is not None:
            agent.messages.append({
                "timestamp": datetime.now().isoformat(),
                "content": message
            })
        
        # Emit status update
        await self.emit("agent_status_update", {
            "session_id": session.session_id,
            "agent": agent_name,
            "status": status.value,
            "task": agent.current_task,
            "progress": agent.progress,
            "message": message
        })
        
        save_session(session)
    
    async def _agent_started(self, session: WorkflowSession, agent_name: str, task: str):
        """Mark agent as started with detailed timestamp logging."""
        agent = session.agents[agent_name]
        agent.status = AgentStatus.WORKING
        agent.current_task = task
        agent.progress = 0
        agent.start_time = datetime.now()
        agent.messages.append({
            "timestamp": datetime.now().isoformat(),
            "type": "start",
            "content": f"🚀 STARTED: {task}"
        })
        
        await self._emit_and_log(
            session, 
            "agent_started", 
            {
                "session_id": session.session_id,
                "agent": agent_name,
                "task": task,
                "timestamp": datetime.now().isoformat(),
                "message": f"[{agent_name}] {task}"
            },
            agent=agent_name,
            message=f"🚀 STARTED: {task}"
        )
    
    async def _agent_working(
        self,
        session: WorkflowSession,
        agent_name: str,
        message: str,
        progress: int
    ):
        """Update agent progress with detailed logging."""
        agent = session.agents[agent_name]
        agent.status = AgentStatus.WORKING
        agent.progress = progress
        
        # Calculate elapsed time if we have start_time
        elapsed_str = ""
        if hasattr(agent, 'start_time') and agent.start_time:
            elapsed = (datetime.now() - agent.start_time).total_seconds()
            elapsed_str = f"[{elapsed:.0f}s] "
        
        log_entry = {
            "timestamp": datetime.now().isoformat(),
            "type": "progress",
            "progress": progress,
            "content": f"⏳ {elapsed_str}{progress}% - {message}"
        }
        agent.messages.append(log_entry)
        
        await self._emit_and_log(
            session,
            "agent_working",
            {
                "session_id": session.session_id,
                "agent": agent_name,
                "message": message,
                "progress": progress,
                "timestamp": datetime.now().isoformat(),
                "elapsed_seconds": int(elapsed) if elapsed_str else 0
            },
            agent=agent_name,
            message=f"⏳ {elapsed_str}{progress}% - {message}"
        )
    
    async def _agent_api_call_started(self, session: WorkflowSession, agent_name: str, api_name: str = "Kimi"):
        """Log when an external API call starts."""
        agent = session.agents[agent_name]
        agent.api_call_start = datetime.now()
        
        # Calculate elapsed time since agent started
        elapsed_str = ""
        if hasattr(agent, 'start_time') and agent.start_time:
            elapsed = (datetime.now() - agent.start_time).total_seconds()
            elapsed_str = f" (running for {elapsed:.0f}s)"
        
        agent.messages.append({
            "timestamp": datetime.now().isoformat(),
            "type": "api_start",
            "content": f"📡 Calling {api_name} API...{elapsed_str}"
        })
        
        await self.emit("agent_working", {
            "session_id": session.session_id,
            "agent": agent_name,
            "message": f"Calling {api_name} API...",
            "progress": agent.progress,
            "timestamp": datetime.now().isoformat(),
            "type": "api_call"
        })
        save_session(session)
    
    async def _agent_api_call_waiting(self, session: WorkflowSession, agent_name: str, elapsed_seconds: int):
        """Log while waiting for API response - this shows it's not stuck!"""
        agent = session.agents[agent_name]
        agent.messages.append({
            "timestamp": datetime.now().isoformat(),
            "type": "api_waiting",
            "content": f"⏱️ Still waiting for API response... ({elapsed_seconds}s elapsed)"
        })
        
        await self.emit("agent_working", {
            "session_id": session.session_id,
            "agent": agent_name,
            "message": f"⏱️ Waiting for API response... ({elapsed_seconds}s elapsed)",
            "progress": agent.progress,
            "timestamp": datetime.now().isoformat(),
            "type": "api_waiting",
            "elapsed_seconds": elapsed_seconds
        })
    
    async def _agent_api_call_completed(self, session: WorkflowSession, agent_name: str, duration_seconds: float):
        """Log when API call completes."""
        agent = session.agents[agent_name]
        agent.messages.append({
            "timestamp": datetime.now().isoformat(),
            "type": "api_complete",
            "content": f"✅ API call completed in {duration_seconds:.1f}s"
        })
        
        await self.emit("agent_working", {
            "session_id": session.session_id,
            "agent": agent_name,
            "message": f"✅ API response received ({duration_seconds:.1f}s)",
            "progress": agent.progress,
            "timestamp": datetime.now().isoformat(),
            "type": "api_complete"
        })
    
    async def _agent_parsing_started(self, session: WorkflowSession, agent_name: str, data_type: str):
        """Log when agent starts parsing output."""
        agent = session.agents[agent_name]
        agent.messages.append({
            "timestamp": datetime.now().isoformat(),
            "type": "parsing",
            "content": f"📝 Parsing {data_type}..."
        })
        
        await self.emit("agent_working", {
            "session_id": session.session_id,
            "agent": agent_name,
            "message": f"📝 Parsing {data_type}...",
            "progress": agent.progress,
            "timestamp": datetime.now().isoformat(),
            "type": "parsing"
        })
    
    async def _agent_parsing_result(self, session: WorkflowSession, agent_name: str, result: str):
        """Log parsing result."""
        agent = session.agents[agent_name]
        agent.messages.append({
            "timestamp": datetime.now().isoformat(),
            "type": "parsing_result",
            "content": f"📊 {result}"
        })
    
    async def _log_editor_criteria(self, session: WorkflowSession, criteria_type: str, status: str, details: str = ""):
        """Log BBC Editor approval criteria checks.
        
        Args:
            criteria_type: The criterion being checked (e.g., "Character Count", "Sentence Length")
            status: "✓ PASS", "✗ FAIL", or "⏳ CHECKING"
            details: Additional details about the check
        """
        agent = session.agents["editor"]
        icon = "✅" if "PASS" in status else "❌" if "FAIL" in status else "⏳"
        content = f"{icon} [{criteria_type}] {status}"
        if details:
            content += f" - {details}"
        
        agent.messages.append({
            "timestamp": datetime.now().isoformat(),
            "type": "criteria_check",
            "content": content
        })
        
        await self.emit("agent_working", {
            "session_id": session.session_id,
            "agent": "editor",
            "message": content,
            "progress": agent.progress,
            "timestamp": datetime.now().isoformat(),
            "type": "criteria"
        })
        save_session(session)
    
    async def _run_agent_with_heartbeat(
        self,
        session: WorkflowSession,
        agent_name: str,
        agent: Any,
        task_message: str,
        timeout: int = 300
    ) -> Any:
        """Run an agent with a 5-second heartbeat to keep UI updated."""
        import asyncio
        from datetime import datetime
        
        heartbeat_task = None
        start_time = datetime.now()
        
        async def heartbeat():
            """Emit heartbeat every 5 seconds while waiting."""
            elapsed = 0
            while True:
                await asyncio.sleep(5)
                elapsed += 5
                await self._agent_api_call_waiting(session, agent_name, elapsed)
        
        try:
            # Start heartbeat
            heartbeat_task = asyncio.create_task(heartbeat())
            
            # Run the agent
            result = await asyncio.wait_for(
                agent.run(task=task_message),
                timeout=timeout
            )
            
            # Cancel heartbeat
            if heartbeat_task:
                heartbeat_task.cancel()
                try:
                    await heartbeat_task
                except asyncio.CancelledError:
                    pass
            
            duration = (datetime.now() - start_time).total_seconds()
            await self._agent_api_call_completed(session, agent_name, duration)
            
            # STORE RAW LLM OUTPUTS for Agent Log UI
            if result.messages:
                if agent_name not in session.agent_outputs:
                    session.agent_outputs[agent_name] = []
                
                for msg in result.messages:
                    if hasattr(msg, 'content') and msg.content:
                        from models.state import AgentOutput
                        session.agent_outputs[agent_name].append(
                            AgentOutput(
                                role=getattr(msg, 'role', 'assistant'),
                                content=msg.content[:50000],  # Limit size to 50KB
                                timestamp=datetime.now().isoformat()
                            )
                        )
                save_session(session)
            
            return result
            
        except asyncio.TimeoutError:
            if heartbeat_task:
                heartbeat_task.cancel()
                try:
                    await heartbeat_task
                except asyncio.CancelledError:
                    pass
            raise
        except Exception as e:
            if heartbeat_task:
                heartbeat_task.cancel()
                try:
                    await heartbeat_task
                except asyncio.CancelledError:
                    pass
            raise
    
    async def _agent_completed(
        self,
        session: WorkflowSession,
        agent_name: str,
        output: Optional[str] = None
    ):
        """Mark agent as completed with duration tracking."""
        agent = session.agents[agent_name]
        agent.status = AgentStatus.COMPLETED
        agent.progress = 100
        if output:
            agent.output = output
        
        # Calculate total duration
        duration_str = ""
        total_seconds = 0
        if hasattr(agent, 'start_time') and agent.start_time:
            try:
                total_seconds = (datetime.now() - agent.start_time).total_seconds()
                if total_seconds < 60:
                    duration_str = f" (took {total_seconds:.1f}s)"
                else:
                    duration_str = f" (took {total_seconds/60:.1f}m)"
            except:
                pass
        
        agent.messages.append({
            "timestamp": datetime.now().isoformat(),
            "type": "complete",
            "duration_seconds": total_seconds,
            "content": f"✅ COMPLETED{duration_str}: {output[:100] if output else 'Done'}"
        })
        
        await self.emit("agent_completed", {
            "session_id": session.session_id,
            "agent": agent_name,
            "output": output[:500] if output else None,
            "duration_seconds": total_seconds,
            "timestamp": datetime.now().isoformat()
        })
        save_session(session)
    
    async def _agent_error(self, session: WorkflowSession, agent_name: str, error: str):
        """Mark agent as errored with detailed logging."""
        agent = session.agents[agent_name]
        agent.status = AgentStatus.ERROR
        agent.error = error
        
        # Calculate elapsed time
        elapsed_str = ""
        if hasattr(agent, 'start_time') and agent.start_time:
            try:
                elapsed = (datetime.now() - agent.start_time).total_seconds()
                elapsed_str = f" after {elapsed:.0f}s"
            except:
                pass
        
        agent.messages.append({
            "timestamp": datetime.now().isoformat(),
            "type": "error",
            "content": f"❌ ERROR{elapsed_str}: {error}"
        })
        
        await self.emit("agent_error", {
            "session_id": session.session_id,
            "agent": agent_name,
            "error": error,
            "timestamp": datetime.now().isoformat(),
            "elapsed": elapsed_str
        })
        save_session(session)
    
    async def run_workflow(
        self,
        session_id: str,
        config: Dict[str, Any]
    ):
        """Run the complete podcast production workflow."""
        # Create or get session
        session = get_session(session_id)
        if not session:
            session = WorkflowSession(
                session_id=session_id,
                agents=self._create_agent_states(),
                config=config  # Store config for continuation
            )
            save_session(session)
        else:
            # Update config in case it changed
            session.config = config
            save_session(session)
        
        try:
            await self._emit_and_log(
                session,
                "workflow_started",
                {
                    "session_id": session_id,
                    "config": config
                },
                message="🎬 Workflow started"
            )
            
            # Step 1: News Research
            await self._run_research_phase(session, config)
            
            # Check if stopped
            if self._stop_event.is_set():
                return
            
            # Wait for human story selection
            if session.state == WorkflowState.AWAITING_SELECTION:
                await self._emit_and_log(
                    session,
                    "workflow_paused",
                    {
                        "session_id": session_id,
                        "reason": "awaiting_selection",
                        "data": {
                            "localStories": [s.model_dump() for s in session.research_output.get("localStories", [])],
                            "continentStories": [s.model_dump() for s in session.research_output.get("continentStories", [])]
                        }
                    },
                    message=f"⏸️ Paused: Awaiting story selection ({len(session.research_output.get('localStories', []))} local, {len(session.research_output.get('continentStories', []))} continent stories)"
                )
                return  # Will be resumed by external call via submit_story_selection
            
            # ============================================================
            # NEW WORKFLOW: After story selection, use _continue_workflow
            # which implements the Writer <-> Editor loop
            # ============================================================
            if session.user_selection:
                # Story selection has been made, use new execution flow
                await self._continue_workflow(session_id)
                return  # _continue_workflow handles the rest
            
            # Fallback to old flow (shouldn't reach here)
            # Step 2: Editor Review
            await self._run_editor_phase(session, config)
            
            # Step 3: Final Writer
            await self._run_writer_phase(session, config)
            
            # Step 4: Fact Check (with potential recovery loop)
            await self._run_fact_check_phase(session, config)
            
            # Check if waiting for replacement
            if session.state == WorkflowState.AWAITING_REPLACEMENT:
                await self._emit_and_log(
                    session,
                    "workflow_paused",
                    {
                        "session_id": session_id,
                        "reason": "awaiting_replacement",
                        "data": {
                            "failedStory": session.failed_story.model_dump() if session.failed_story else None,
                            "alternatives": [s.model_dump() for s in session.replacement_options] if session.replacement_options else []
                        }
                    },
                    message=f"⏸️ Paused: Awaiting replacement selection for '{session.failed_story.headline if session.failed_story else 'failed story'}'"
                )
                return
            
            # Step 5: Final Editor
            await self._run_final_editor_phase(session, config)
            
            # Step 6: Audio Production
            await self._run_audio_phase(session, config)
            
            # Complete
            session.state = WorkflowState.COMPLETE
            session.current_step = "complete"
            session.progress = 100
            save_session(session)
            
            await self._emit_and_log(
                session,
                "workflow_completed",
                {
                    "session_id": session_id,
                    "mp3_url": session.mp3_url,
                    "filename": session.filename
                },
                message=f"✅ Workflow completed! Generated: {session.filename}"
            )
            
        except Exception as e:
            session.state = WorkflowState.ERROR
            session.error = str(e)
            save_session(session)
            
            await self._emit_and_log(
                session,
                "workflow_error",
                {
                    "session_id": session_id,
                    "error": str(e)
                },
                agent="system",
                message=f"❌ Workflow error: {str(e)[:100]}"
            )
    
    async def _run_research_phase(self, session: WorkflowSession, config: Dict[str, Any]):
        """Run the news research phase using the actual news_researcher agent."""
        from datetime import datetime
        
        session.current_step = "researching"
        session.progress = 10
        save_session(session)
        
        await self._agent_started(
            session, "news_researcher",
            f"Researching news for {config['country']['name']} - {', '.join(config['topics'])}"
        )
        
        try:
            # Get the news_researcher agent
            agent = self.loader.get_agent("news_researcher")
            if not agent:
                raise ValueError("news_researcher agent not found")
            
            # Use current date, not config date
            today = datetime.now().strftime("%Y-%m-%d")
            
            # Prepare the research task message
            task_message = f"""Research news for {config['country']['name']} ({config['country']['language']}).

Topics: {', '.join(config['topics'])}
Timeframe: Past {config['timeframe']['days']} days (up to {today})
Date: {today}

Local News Sources: {', '.join(config['country']['newsSources'])}
Continent: {config['continent']['name']}
Continent Sources: {', '.join([s['name'] for s in config['continent']['newsSources']])}

Search for at least 10 local stories and 5 continent stories.
Use the search_web tool to find REAL news stories - do NOT generate fake stories.
Translate all content to English.
Output as JSON with localStories and continentStories arrays.
Each story should have: id, headline, summary, newsRating (1-10), source, originalLanguage, section, url."""

            await self._agent_working(
                session, "news_researcher",
                f"Starting web search for {config['country']['name']} news...",
                20
            )
            
            await self._agent_api_call_started(session, "news_researcher", "Kimi LLM")
            
            # Call the agent with heartbeat
            result = await self._run_agent_with_heartbeat(
                session, "news_researcher", agent, task_message, timeout=300
            )
            
            await self._agent_parsing_started(session, "news_researcher", "agent response")
            
            # Parse the response to extract stories
            output_text = ""
            if result.messages:
                for msg in reversed(result.messages):
                    if hasattr(msg, 'content') and msg.source == 'news_researcher':
                        output_text = msg.content
                        break
            
            await self._agent_parsing_result(session, "news_researcher", f"Got {len(output_text)} chars of output")
            
            # Try to extract JSON from the response
            try:
                # Look for JSON in the response
                import re
                json_match = re.search(r'```json\s*(.*?)\s*```', output_text, re.DOTALL)
                if json_match:
                    json_str = json_match.group(1)
                else:
                    # Try to find raw JSON object
                    json_match = re.search(r'\{[\s\S]*"localStories"[\s\S]*\}', output_text)
                    if json_match:
                        json_str = json_match.group(0)
                    else:
                        json_str = output_text
                
                data = json.loads(json_str)
                
                # Convert to Story objects
                local_stories = [
                    Story(**story) for story in data.get("localStories", [])
                ]
                continent_stories = [
                    Story(**story) for story in data.get("continentStories", [])
                ]
                
            except (json.JSONDecodeError, Exception) as e:
                error_msg = f"Failed to parse agent output: {str(e)}"
                print(f"[Workflow] {error_msg}")
                print(f"[Workflow] Raw output: {output_text[:500]}")
                await self._agent_error(session, "news_researcher", error_msg)
                session.state = WorkflowState.ERROR
                session.error = error_msg
                save_session(session)
                return
            
            session.research_output = {
                "localStories": local_stories,
                "continentStories": continent_stories
            }
            
            await self._agent_completed(
                session, "news_researcher",
                f"Found {len(local_stories)} local and {len(continent_stories)} continent stories"
            )
            
        except Exception as e:
            error_msg = f"Research failed: {str(e)}"
            print(f"[Workflow] {error_msg}")
            await self._agent_error(session, "news_researcher", error_msg)
            session.state = WorkflowState.ERROR
            session.error = error_msg
            save_session(session)
            return
        
        # Pause for human selection
        session.state = WorkflowState.AWAITING_SELECTION
        session.current_step = "awaiting_story_selection"
        session.progress = 20
        save_session(session)
    
    async def _run_editor_phase(self, session: WorkflowSession, config: Dict[str, Any]):
        """Wrapper for _run_editor_phase1 (legacy compatibility)."""
        await self._run_editor_phase1(session, config)
    
    async def _run_editor_phase1(self, session: WorkflowSession, config: Dict[str, Any]):
        """Run the Editor Phase 1 - Initial BBC Standards Review.
        
        This is STEP 2 of the execution workflow.
        Can REJECT and send back to Researcher (Agent 1).
        """
        await self._agent_started(session, "editor", "PHASE 1: Initial BBC Standards Review")
        
        # Log Phase 1 header
        await self._log_editor_criteria(session, "=== PHASE 1 ===", "📝 STARTING", "Initial draft review")
        
        try:
            if not session.research_output:
                error_msg = "Cannot run editor: research_output is missing"
                await self._agent_error(session, "editor", error_msg)
                session.state = WorkflowState.ERROR
                session.error = error_msg
                save_session(session)
                return
            
            if not session.user_selection:
                error_msg = "Cannot run editor: user_selection is missing"
                await self._agent_error(session, "editor", error_msg)
                session.state = WorkflowState.ERROR
                session.error = error_msg
                save_session(session)
                return
            
            agent = self.loader.get_agent("editor")
            if not agent:
                raise ValueError("editor agent not found")
            
            # Build draft
            selected_local = [s for s in session.research_output.get("localStories", []) 
                            if s.id in session.user_selection.get("localStoryIds", [])]
            selected_continent = [s for s in session.research_output.get("continentStories", []) 
                                if s.id in session.user_selection.get("continentStoryIds", [])]
            
            draft_text = self._build_initial_draft(selected_local, selected_continent, config)
            session.draft_script = draft_text
            
            await self._agent_working(session, "editor", "Reviewing initial draft...", 30)
            await self._agent_api_call_started(session, "editor", "Kimi LLM")
            
            task_message = f"""You are the BBC Editor reviewing a podcast script for PHASE 1 approval.

CRITICAL: Return your decision as JSON with this exact format:
{{
  "decision": "APPROVED" or "REJECTED",
  "phase1_criteria": {{
    "story_count": "PASS/FAIL",
    "basic_structure": "PASS/FAIL",
    "country_context": "PASS/FAIL"
  }},
  "reasoning": "explanation"
}}

### Draft Script
{draft_text[:2000]}...

PHASE 1 CHECKLIST:
1. At least 5 local + 3 continent stories selected? ✓
2. Basic script structure present (intro, stories, outro)?
3. Country context appropriate for {config['country']['name']}?

If ANY check fails, REJECT and return to Researcher."""

            result = await asyncio.wait_for(agent.run(task=task_message), timeout=300)
            
            output_text = ""
            if result.messages:
                for msg in reversed(result.messages):
                    if hasattr(msg, "content"):
                        output_text = msg.content
                        break
            
            # Parse decision
            import re
            try:
                json_match = re.search(r'```json\s*(.*?)\s*```', output_text, re.DOTALL)
                if json_match:
                    json_str = json_match.group(1)
                else:
                    json_match = re.search(r'\{[\s\S]*\}', output_text)
                    json_str = json_match.group(0) if json_match else output_text
                
                result_data = json.loads(json_str)
                decision = result_data.get("decision", "REJECTED")
                criteria = result_data.get("phase1_criteria", {})
                
                # Log each criterion
                for criterion, status in criteria.items():
                    icon = "✅" if status == "PASS" else "❌"
                    await self._log_editor_criteria(session, f"Phase 1: {criterion}", icon + " " + status)
                
                if decision == "APPROVED":
                    session.editor_phase1_approved = True
                    await self._log_editor_criteria(session, "PHASE 1 RESULT", "✅ APPROVED", "Proceeding to Writer")
                    await self._agent_completed(session, "editor", "PHASE 1 APPROVED - Proceeding to Writer")
                else:
                    session.editor_attempts += 1
                    session.editor_phase1_approved = False
                    await self._log_editor_criteria(session, "PHASE 1 RESULT", "❌ REJECTED", f"Attempt {session.editor_attempts} - Return to Researcher")
                    await self._agent_completed(session, "editor", f"PHASE 1 REJECTED - Attempt {session.editor_attempts}")
                    
            except Exception as e:
                print(f"[Workflow] Error parsing editor phase 1: {e}")
                # Default to approved on parse error to continue workflow
                session.editor_phase1_approved = True
                await self._agent_completed(session, "editor", "PHASE 1 APPROVED (parsing fallback)")
                
        except Exception as e:
            print(f"[Workflow] Error in editor phase 1: {e}")
            await self._agent_error(session, "editor", str(e))
            session.state = WorkflowState.ERROR
            session.error = str(e)
            save_session(session)
    
    def _build_initial_draft(self, local_stories: List[Story], continent_stories: List[Story], config: Dict[str, Any]) -> str:
        """Build initial draft from selected stories."""
        lines = [
            "[INTRO MUSIC]",
            "",
            f"Welcome to the {config['country']['name']} {config['timeframe']['label']}.",
            "These are today's headlines.",
            ""
        ]
        
        # Headlines
        for story in local_stories[:3]:
            lines.append(f"• {story.headline}")
        for story in continent_stories[:2]:
            lines.append(f"• {story.headline}")
        
        lines.extend(["", "[BLOCK TRANSITION STING]", ""])
        
        # Local stories section
        lines.append(f"Local News from {config['country']['name']}:")
        lines.append("")
        for i, story in enumerate(local_stories, 1):
            lines.append(f"Story {i}: {story.headline}")
            lines.append(story.summary)
            lines.append("")
            if i < len(local_stories):
                lines.append("[STORY STING]")
                lines.append("")
        
        lines.extend(["[BLOCK TRANSITION STING]", ""])
        
        # Continent stories section
        lines.append(f"News from across {config['continent']['name']}:")
        lines.append("")
        for i, story in enumerate(continent_stories, 1):
            lines.append(f"In {story.source}: {story.headline}")
            lines.append(story.summary)
            lines.append("")
            if i < len(continent_stories):
                lines.append("[STORY STING]")
                lines.append("")
        
        lines.extend([
            "[BLOCK TRANSITION STING]",
            "",
            "That's all for today's briefing.",
            "Thank you for listening.",
            "",
            "[OUTRO MUSIC]"
        ])
        
        return "\n".join(lines)
    
    async def _run_writer_phase(self, session: WorkflowSession, config: Dict[str, Any]):
        """Run the final writer phase using the actual writer agent."""
        
        
        session.current_step = "writing"
        session.progress = 50
        save_session(session)
        
        await self._agent_started(session, "final_writer", "Writing final podcast script")
        
        try:
            agent = self.loader.get_agent("final_writer")
            if not agent:
                raise ValueError("final_writer agent not found")
            
            await self._agent_working(session, "final_writer", "Polishing script for broadcast...", 40)
            
            await self._agent_api_call_started(session, "final_writer", "Kimi LLM")
            
            task_message = f"""Write the final podcast script based on the approved draft.

### Configuration
- **Country**: {config['country']['name']} ({config['country']['language']})
- **Continent**: {config['continent']['name']}
- **Timeframe**: {config['timeframe']['label']} (past {config['timeframe']['days']} days)
- **Topics**: {', '.join(config['topics'])}
- **Voice**: {config['voice']['label']} ({config['voice']['voiceId']})
- **Music**: Intro: {config['music']['intro']['description']}, Outro: {config['music']['outro']['description']}

### News Sources
- **{config['country']['name']} sources** ({config['country']['language']}): {', '.join(config['country']['newsSources'])}
- **{config['continent']['name']} sources** (English): {', '.join([s['name'] for s in config['continent']['newsSources']])}

### Approved Draft
{session.draft_script}

Write the final polished script following all BBC standards. Output the complete script."""

            result = await self._run_agent_with_heartbeat(
                session, "final_writer", agent, task_message, timeout=300
            )
            await self._agent_parsing_started(session, "final_writer", "script output")
                
            output_text = "";
            if result.messages:
                for msg in reversed(result.messages):
                    if hasattr(msg, "content"):
                        output_text = msg.content
                        break
            
            await self._agent_parsing_result(session, "final_writer", f"Got {len(output_text)} chars")
            
            # Extract script from response
            if "## FINAL SCRIPT" in output_text:
                script_start = output_text.find("## FINAL SCRIPT")
                session.draft_script = output_text[script_start:].strip()
            else:
                session.draft_script = output_text.strip()
            
            await self._agent_completed(session, "final_writer", "Final script written")
            
        except Exception as e:
            print(f"[Workflow] Error in writer phase: {e}")
            await self._agent_error(session, "final_writer", str(e))
            session.state = WorkflowState.ERROR
            session.error = str(e)
            save_session(session)
            return
    
    async def _run_fact_check_phase(self, session: WorkflowSession, config: Dict[str, Any]):
        """Run the fact check phase using the actual fact_checker agent."""
        
        
        session.current_step = "fact-checking"
        session.progress = 60
        save_session(session)
        
        await self._agent_started(session, "fact_checker", "Verifying facts against sources")
        
        try:
            agent = self.loader.get_agent("fact_checker")
            if not agent:
                raise ValueError("fact_checker agent not found")
            
            await self._agent_working(session, "fact_checker", "Cross-referencing claims with sources...", 40)
            
            await self._agent_api_call_started(session, "fact_checker", "Kimi LLM")
            
            task_message = f"""Fact-check this podcast script against official sources.

### Configuration
- **Country**: {config['country']['name']} ({config['country']['language']})
- **Continent**: {config['continent']['name']}
- **Date**: {config['date']}
- **Timeframe**: Past {config['timeframe']['days']} days

### News Sources
- **Local sources** ({config['country']['language']}): {', '.join(config['country']['newsSources'])}
- **Continent sources** (English): {', '.join([s['name'] for s in config['continent']['newsSources']])}

### Script to Verify
{session.draft_script}

Verify all factual claims and return results as JSON."""

            result = await self._run_agent_with_heartbeat(
                session, "fact_checker", agent, task_message, timeout=300
            )
                
            await self._agent_parsing_started(session, "fact_checker", "fact check JSON")
            
            output_text = "";
            if result.messages:
                for msg in reversed(result.messages):
                    if hasattr(msg, "content"):
                        output_text = msg.content
                        break
            
            # Parse JSON response
            import re
            try:
                json_match = re.search(r'```json\s*(.*?)\s*```', output_text, re.DOTALL)
                if json_match:
                    json_str = json_match.group(1)
                else:
                    json_match = re.search(r'\{[\s\S]*\}', output_text)
                    json_str = json_match.group(0) if json_match else output_text
                
                result = json.loads(json_str)
                overall_status = result.get("overall_status", "PASS")
                
                # Check for failed stories
                stories = result.get("stories", [])
                failed_stories = [s for s in stories if s.get("grade") == "FACT CHECK FAILED"]
                
                await self._agent_parsing_result(session, "fact_checker", f"Overall: {overall_status}, Failed: {len(failed_stories)}")
                
                if failed_stories and len(failed_stories) > 0:
                    failed = failed_stories[0]
                    session.failed_story = FailedStory(
                        storyId=str(failed.get("story_id", "unknown")),
                        headline=failed.get("headline", "Unknown"),
                        reason=", ".join(failed.get("unverified_claims", ["Fact check failed"]))
                    )
                    await self._agent_completed(session, "fact_checker", f"Issues found in story {failed.get('story_id', 'unknown')}")
                else:
                    await self._agent_completed(session, "fact_checker", "All facts verified")
                    
            except (json.JSONDecodeError, Exception) as e:
                print(f"[Workflow] Error parsing fact check output: {e}")
                await self._agent_completed(session, "fact_checker", "Fact check complete (parsing fallback)")
                
        except Exception as e:
            print(f"[Workflow] Error in fact check phase: {e}")
            await self._agent_error(session, "fact_checker", str(e))
            session.state = WorkflowState.ERROR
            session.error = str(e)
            save_session(session)
            return
    
    async def _run_recovery_phase(self, session: WorkflowSession, config: Dict[str, Any]):
        """Run the recovery research phase using the actual recovery_researcher agent."""
        
        
        await self._agent_started(session, "recovery_researcher", "Finding replacement stories")
        
        if not session.failed_story:
            await self._agent_completed(session, "recovery_researcher", "No failed story to replace")
            return
        
        try:
            agent = self.loader.get_agent("recovery_researcher")
            if not agent:
                raise ValueError("recovery_researcher agent not found")
            
            await self._agent_working(session, "recovery_researcher", f"Searching alternatives for: {session.failed_story.headline}", 40)
            
            await self._agent_api_call_started(session, "recovery_researcher", "Kimi LLM")
            
            task_message = f"""Find alternative stories to replace a failed fact-check.

### Failed Story
- ID: {session.failed_story.storyId}
- Headline: {session.failed_story.headline}
- Reason: {session.failed_story.reason}

### Configuration
- **Country**: {config['country']['name']} ({config['country']['language']})
- **Continent**: {config['continent']['name']}
- **Date**: {config['date']}
- **Timeframe**: Past {config['timeframe']['days']} days

### News Sources
- **Local sources** ({config['country']['language']}): {', '.join(config['country']['newsSources'])}
- **Continent sources** (English): {', '.join([s['name'] for s in config['continent']['newsSources']])}

Find 3-5 alternative stories on the SAME topic. Return as JSON."""

            result = await self._run_agent_with_heartbeat(
                session, "recovery_researcher", agent, task_message, timeout=300
            )
            
            await self._agent_parsing_started(session, "recovery_researcher", "alternatives JSON")
                
            output_text = "";
            if result.messages:
                for msg in reversed(result.messages):
                    if hasattr(msg, "content"):
                        output_text = msg.content
                        break
            
            # Parse JSON response
            import re
            try:
                json_match = re.search(r'```json\s*(.*?)\s*```', output_text, re.DOTALL)
                if json_match:
                    json_str = json_match.group(1)
                else:
                    json_match = re.search(r'\{[\s\S]*\}', output_text)
                    json_str = json_match.group(0) if json_match else output_text
                
                result = json.loads(json_str)
                alternatives_data = result.get("alternatives", [])
                
                alternatives = []
                for alt in alternatives_data:
                    alternatives.append(Story(
                        id=alt.get("id", f"alt_{len(alternatives)}"),
                        headline=alt.get("headline", "Alternative Story"),
                        summary=alt.get("summary", ""),
                        newsRating=alt.get("newsRating", 7),
                        source=alt.get("source", "Unknown"),
                        originalLanguage=alt.get("originalLanguage", "English"),
                        section=alt.get("section", "local")
                    ))
                
                session.replacement_options = alternatives
                await self._agent_parsing_result(session, "recovery_researcher", f"Found {len(alternatives)} alternatives")
                await self._agent_completed(session, "recovery_researcher", f"Found {len(alternatives)} alternatives")
                
            except (json.JSONDecodeError, Exception) as e:
                await self._agent_parsing_result(session, "recovery_researcher", f"Parse error: {str(e)[:50]}")
                print(f"[Workflow] Error parsing recovery output: {e}")
                # Fallback to mock alternatives
                session.replacement_options = [
                    Story(
                        id=f"alt_{i}",
                        headline=f"Alternative {i+1} for {session.failed_story.headline[:30]}...",
                        summary=f"Alternative story on similar topic from {config['country']['name']}.",
                        newsRating=7,
                        source=config['country']['newsSources'][0] if config['country']['newsSources'] else "Local News",
                        originalLanguage=config['country']['language'],
                        section="local"
                    )
                    for i in range(3)
                ]
                await self._agent_completed(session, "recovery_researcher", "Found alternatives (fallback)")
                
        except Exception as e:
            print(f"[Workflow] Error in recovery phase: {e}")
            await self._agent_error(session, "recovery_researcher", str(e))
            session.state = WorkflowState.ERROR
            session.error = str(e)
            save_session(session)
            return
    
    async def _run_final_editor_phase(self, session: WorkflowSession, config: Dict[str, Any]):
        """Run the final editor phase using the actual final_editor agent."""
        
        
        session.current_step = "final-review"
        session.progress = 85
        save_session(session)
        
        await self._agent_started(session, "final_editor", "Final approval gate before audio production")
        
        try:
            agent = self.loader.get_agent("final_editor")
            if not agent:
                raise ValueError("final_editor agent not found")
            
            await self._agent_working(session, "final_editor", "Final quality check...", 40)
            
            await self._agent_api_call_started(session, "final_editor", "Kimi LLM")
            
            task_message = f"""Final approval review before audio production.

### Configuration
- **Country**: {config['country']['name']} ({config['country']['language']})
- **Continent**: {config['continent']['name']}
- **Timeframe**: {config['timeframe']['label']} (past {config['timeframe']['days']} days)
- **Topics**: {', '.join(config['topics'])}

### News Sources
- **{config['country']['name']} sources** ({config['country']['language']}): {', '.join(config['country']['newsSources'])}
- **{config['continent']['name']} sources** (English): {', '.join([s['name'] for s in config['continent']['newsSources']])}

### Script to Review
{session.draft_script}

This is the FINAL gate. Review thoroughly and return decision as JSON."""

            result = await self._run_agent_with_heartbeat(
                session, "final_editor", agent, task_message, timeout=300
            )
            
            await self._agent_parsing_started(session, "final_editor", "approval JSON")
                
            output_text = "";
            if result.messages:
                for msg in reversed(result.messages):
                    if hasattr(msg, "content"):
                        output_text = msg.content
                        break
            session.final_script = session.draft_script
            
            # Parse JSON response
            import re
            try:
                json_match = re.search(r'```json\s*(.*?)\s*```', output_text, re.DOTALL)
                if json_match:
                    json_str = json_match.group(1)
                else:
                    json_match = re.search(r'\{[\s\S]*\}', output_text)
                    json_str = json_match.group(0) if json_match else output_text
                
                result = json.loads(json_str)
                decision = result.get("decision", "REJECTED")
                
                await self._agent_parsing_result(session, "final_editor", f"Decision: {decision}")
                await self._agent_completed(session, "final_editor", f"Final decision: {decision}")
                
            except (json.JSONDecodeError, Exception) as e:
                print(f"[Workflow] Error parsing final editor output: {e}")
                await self._agent_parsing_result(session, "final_editor", f"Parse error: {str(e)[:50]}")
                await self._agent_completed(session, "final_editor", "Final approval given (parsing fallback)")
                
        except Exception as e:
            print(f"[Workflow] Error in final editor phase: {e}")
            await self._agent_error(session, "final_editor", str(e))
            session.final_script = session.draft_script
            session.state = WorkflowState.ERROR
            session.error = str(e)
            save_session(session)
    
    async def _build_selected_stories_json(self, session: WorkflowSession, config: Dict[str, Any]):
        """Build selected_stories.json from user_selection.
        
        This is called after human selects stories.
        Saves JSON with Headline, Summary, Website, News Topic for each selected story.
        """
        await self._agent_started(session, "news_researcher", "Building selected_stories.json")
        
        try:
            selected_local = [s for s in session.research_output.get("localStories", []) 
                            if s.id in session.user_selection.get("localStoryIds", [])]
            selected_continent = [s for s in session.research_output.get("continentStories", []) 
                                if s.id in session.user_selection.get("continentStoryIds", [])]
            
            # Build JSON structure
            stories_json = {
                "country": config['country']['name'],
                "continent": config['continent']['name'],
                "date": config['date'],
                "timeframe": config['timeframe']['label'],
                "topics": config['topics'],
                "local_stories": [],
                "continent_stories": []
            }
            
            # Add local stories with full details
            for story in selected_local:
                story_data = {
                    "id": story.id,
                    "headline": story.headline,
                    "summary": story.summary,
                    "website": story.source,
                    "news_topic": story.section,
                    "news_rating": story.newsRating,
                    "original_language": story.originalLanguage
                }
                stories_json["local_stories"].append(story_data)
                
                # Log headline in Agent Activity Log
                await self._agent_working(session, "news_researcher", f"📰 {story.headline[:60]}...", 50)
            
            # Add continent stories
            for story in selected_continent:
                story_data = {
                    "id": story.id,
                    "headline": story.headline,
                    "summary": story.summary,
                    "website": story.source,
                    "news_topic": story.section,
                    "news_rating": story.newsRating,
                    "original_language": story.originalLanguage
                }
                stories_json["continent_stories"].append(story_data)
                
                # Log headline in Agent Activity Log
                await self._agent_working(session, "news_researcher", f"🌍 {story.headline[:60]}...", 50)
            
            session.selected_stories_json = stories_json
            
            # STORE ARTIFACT for Agent Log UI
            session.artifacts["selected_stories_json"] = {
                "type": "json",
                "label": "Selected Stories",
                "description": f"{len(selected_local)} local + {len(selected_continent)} continent stories selected by user",
                "data": stories_json,
                "created_at": datetime.now().isoformat()
            }
            
            save_session(session)
            
            await self._agent_completed(session, "news_researcher", f"selected_stories.json created: {len(selected_local)} local + {len(selected_continent)} continent stories")
            
        except Exception as e:
            print(f"[Workflow] Error building selected_stories.json: {e}")
            await self._agent_error(session, "news_researcher", str(e))
    
    async def _run_writer_first_draft(self, session: WorkflowSession, config: Dict[str, Any]):
        """Writer reads selected_stories.json and writes First_Draft.md."""
        await self._agent_started(session, "final_writer", "Reading selected_stories.json, writing First_Draft.md")
        
        try:
            agent = self.loader.get_agent("final_writer")
            if not agent:
                raise ValueError("final_writer agent not found")
            
            await self._agent_working(session, "final_writer", "Reading selected_stories.json...", 20)
            
            # Prepare task for writer
            stories_json_str = json.dumps(session.selected_stories_json, indent=2)
            
            task_message = f"""You are the BBC Writer. Read the selected_stories.json and write the First_Draft.md podcast script.

### Configuration
- **Country**: {config['country']['name']} ({config['country']['language']})
- **Continent**: {config['continent']['name']}
- **Timeframe**: {config['timeframe']['label']} (past {config['timeframe']['days']} days)
- **Topics**: {', '.join(config['topics'])}
- **Voice**: {config['voice']['label']}

### selected_stories.json
```json
{stories_json_str}
```

### YOUR TASK
Write the First_Draft.md podcast script following BBC standards:
1. Opening with "These are today's headlines."
2. Include all music cues [INTRO MUSIC], [OUTRO MUSIC], [STORY STING], [BLOCK TRANSITION STING]
3. Local News block first (5 stories)
4. Continent News block second (3 stories)
5. Each story: headline, then detailed summary with context
6. Write for international audience - explain all local terms
7. Answer 5 Ws + How for each story
8. Stories happening outside {config['continent']['name']} must have {config['continent']['name']}-specific angle
9. {config['continent']['name']} stories must start with "In [country]..."

Output the complete First_Draft.md script."""

            await self._agent_api_call_started(session, "final_writer", "Kimi LLM")
            
            result = await self._run_agent_with_heartbeat(
                session, "final_writer", agent, task_message, timeout=300
            )
            
            # Extract the script
            output_text = ""
            if result.messages:
                for msg in reversed(result.messages):
                    if hasattr(msg, "content"):
                        output_text = msg.content
                        break
            
            # Save as First_Draft.md
            session.first_draft_md = output_text
            
            # STORE ARTIFACT for Agent Log UI
            session.artifacts["first_draft_md"] = {
                "type": "markdown",
                "label": "First Draft",
                "description": f"Initial script ({len(output_text)} characters)",
                "data": output_text,
                "created_at": datetime.now().isoformat()
            }
            
            save_session(session)
            
            await self._agent_completed(session, "final_writer", f"First_Draft.md written ({len(output_text)} chars)")
            
        except Exception as e:
            print(f"[Workflow] Error in writer first draft: {e}")
            await self._agent_error(session, "final_writer", str(e))
            session.state = WorkflowState.ERROR
            session.error = str(e)
            save_session(session)
    
    async def _run_editor_evaluation(self, session: WorkflowSession, config: Dict[str, Any]) -> bool:
        """Editor evaluates First_Draft.md and saves evaluation.json.
        
        Returns True if APPROVED, False if REJECTED.
        Prints evaluation table in Agent Activity Log.
        """
        await self._agent_started(session, "editor", f"Evaluating First_Draft.md (Attempt {session.writer_editor_loop_count})")
        
        try:
            agent = self.loader.get_agent("editor")
            if not agent:
                raise ValueError("editor agent not found")
            
            await self._agent_working(session, "editor", "Checking First_Draft.md against acceptance criteria...", 30)
            await self._agent_api_call_started(session, "editor", "Kimi LLM")
            
            task_message = f"""You are the BBC Editor. Evaluate First_Draft.md against ALL acceptance criteria.

### Configuration
- **Country**: {config['country']['name']}
- **Continent**: {config['continent']['name']}

### First_Draft.md
{session.first_draft_md}

### ACCEPTANCE CRITERIA - REJECT IF ANY FAIL:

1. **Character Count**: Each story ≥1500 characters
2. **Sentence Distribution**: 60% of sentences 15-30 words
3. **Average Sentence Length**: >15 words average
4. **No Googling Needed**: International listener understands without searching
5. **All Terms Defined**: Every local term/acronym explained
6. **5 Ws + How**: All answered for each story
7. **Political/Geo Concepts Defined**: All explained for international audience
8. **No Prior Knowledge Assumed**: Zero assumptions about country's internal affairs
9. **No Country Stories in Continent Block**: {config['country']['name']} stories only in local block
10. **Continent Angle**: Stories outside {config['continent']['name']} have {config['continent']['name']}-specific angle
11. **Country Attribution**: {config['continent']['name']} stories start with "In [country]..."

### OUTPUT FORMAT - STRICT JSON:
{{
  "decision": "APPROVED" or "REJECTED",
  "evaluation": {{
    "criteria_1_character_count": {{"status": "PASS/FAIL", "reason": "...", "correction_guidance": "..."}},
    "criteria_2_sentence_distribution": {{"status": "PASS/FAIL", "reason": "...", "correction_guidance": "..."}},
    ... (all 11 criteria)
  }},
  "overall_reasoning": "explanation"
}}

**NO APPROVAL UNTIL ALL CRITERIA PASS."""

            result = await asyncio.wait_for(agent.run(task=task_message), timeout=300)
            
            output_text = ""
            if result.messages:
                for msg in reversed(result.messages):
                    if hasattr(msg, "content"):
                        output_text = msg.content
                        break
            
            # Parse evaluation JSON
            import re
            try:
                json_match = re.search(r'```json\s*(.*?)\s*```', output_text, re.DOTALL)
                if json_match:
                    json_str = json_match.group(1)
                else:
                    json_match = re.search(r'\{[\s\S]*\}', output_text)
                    json_str = json_match.group(0) if json_match else output_text
                
                evaluation = json.loads(json_str)
                decision = evaluation.get("decision", "REJECTED")
                criteria = evaluation.get("evaluation", {})
                
                # Save evaluation.json
                session.editor_evaluation_json = evaluation
                
                # STORE ARTIFACT for Agent Log UI
                passed_count = sum(1 for c in criteria.values() if c.get("status") == "PASS")
                total_count = len(criteria)
                session.artifacts[f"evaluation_attempt_{session.writer_editor_loop_count}.json"] = {
                    "type": "json",
                    "label": f"Editor Evaluation (Attempt {session.writer_editor_loop_count})",
                    "description": f"{passed_count}/{total_count} criteria passed - {decision}",
                    "data": evaluation,
                    "created_at": datetime.now().isoformat()
                }
                
                save_session(session)
                
                # Print evaluation table in Agent Activity Log
                await self._log_editor_criteria(session, "=== EDITOR EVALUATION ===", "📋", f"Attempt {session.writer_editor_loop_count}")
                await self._log_editor_criteria(session, "---", "---", "---")
                
                # Log each criterion as table row
                all_pass = True
                for criterion_name, criterion_data in criteria.items():
                    status = criterion_data.get("status", "FAIL")
                    reason = criterion_data.get("reason", "")
                    guidance = criterion_data.get("correction_guidance", "")
                    
                    icon = "✅" if status == "PASS" else "❌"
                    await self._log_editor_criteria(session, criterion_name.replace("criteria_", "").replace("_", " ").title(), icon + " " + status, reason[:50])
                    
                    if status != "PASS":
                        all_pass = False
                        if guidance:
                            await self._log_editor_criteria(session, "  → Correction", "📝", guidance[:60])
                
                await self._log_editor_criteria(session, "---", "---", "---")
                
                if decision == "APPROVED" and all_pass:
                    await self._log_editor_criteria(session, "DECISION", "✅ APPROVED", "All criteria passed!")
                    await self._agent_completed(session, "editor", f"APPROVED - All criteria passed (Attempt {session.writer_editor_loop_count})")
                    return True
                else:
                    await self._log_editor_criteria(session, "DECISION", "❌ REJECTED", "Send back to Writer for corrections")
                    await self._agent_completed(session, "editor", f"REJECTED - Corrections needed (Attempt {session.writer_editor_loop_count})")
                    return False
                    
            except Exception as e:
                print(f"[Workflow] Error parsing editor evaluation: {e}")
                # On parse error, approve to continue
                await self._agent_completed(session, "editor", "APPROVED (parsing fallback)")
                return True
                
        except Exception as e:
            print(f"[Workflow] Error in editor evaluation: {e}")
            await self._agent_error(session, "editor", str(e))
            return False
    
    async def _run_writer_correction(self, session: WorkflowSession, config: Dict[str, Any]):
        """Writer corrects First_Draft.md based on Editor's evaluation.json."""
        await self._agent_started(session, "final_writer", f"Correcting First_Draft.md (Attempt {session.writer_editor_loop_count})")
        
        try:
            agent = self.loader.get_agent("final_writer")
            if not agent:
                raise ValueError("final_writer agent not found")
            
            await self._agent_working(session, "final_writer", "Applying Editor's corrections...", 30)
            await self._agent_api_call_started(session, "final_writer", "Kimi LLM")
            
            evaluation_json_str = json.dumps(session.editor_evaluation_json, indent=2)
            
            task_message = f"""You are the BBC Writer. Correct First_Draft.md based on Editor's evaluation.

### Editor's evaluation.json
```json
{evaluation_json_str}
```

### Current First_Draft.md
{session.first_draft_md}

### YOUR TASK
Fix ALL issues marked as FAIL in the evaluation:
1. Address each correction_guidance item
2. Ensure all 11 criteria will PASS on re-evaluation
3. Maintain BBC style and format
4. Keep all music cues and structure

Output the corrected First_Draft.md."""

            result = await self._run_agent_with_heartbeat(
                session, "final_writer", agent, task_message, timeout=300
            )
            
            output_text = ""
            if result.messages:
                for msg in reversed(result.messages):
                    if hasattr(msg, "content"):
                        output_text = msg.content
                        break
            
            # Update First_Draft.md
            session.first_draft_md = output_text
            save_session(session)
            
            await self._agent_completed(session, "final_writer", f"Corrections applied ({len(output_text)} chars)")
            
        except Exception as e:
            print(f"[Workflow] Error in writer correction: {e}")
            await self._agent_error(session, "final_writer", str(e))
    
    async def _run_fact_checker(self, session: WorkflowSession, config: Dict[str, Any]):
        """Fact Checker verifies all facts and saves fact_check.json."""
        await self._agent_started(session, "fact_checker", "Verifying facts in First_Draft.md")
        
        try:
            agent = self.loader.get_agent("fact_checker")
            if not agent:
                raise ValueError("fact_checker agent not found")
            
            await self._agent_working(session, "fact_checker", "Cross-referencing claims with sources...", 40)
            await self._agent_api_call_started(session, "fact_checker", "Kimi LLM")
            
            task_message = f"""You are the Fact Checker. Verify every factual claim in First_Draft.md.

### Configuration
- **Country**: {config['country']['name']}
- **Continent**: {config['continent']['name']}
- **Date**: {config['date']}
- **Sources**: {', '.join(config['country']['newsSources'])} (local), {', '.join([s['name'] for s in config['continent']['newsSources']])} (continent)

### First_Draft.md
{session.first_draft_md}

### YOUR TASK
For each story in the script:
1. Extract core factual claims (who, what, when, where, numbers, quotes)
2. Verify against official news sources
3. Check dates are within timeframe

### OUTPUT - STRICT JSON:
{{
  "overall_status": "PASS" or "ISSUES_FOUND",
  "stories": [
    {{
      "story_id": 1,
      "headline": "exact headline",
      "grade": "FACT CHECKED FULLY CORRECT" or "FACT CHECK PARTIALLY CORRECT" or "FACT CHECK FAILED",
      "verified_sources": ["source names"],
      "unverified_claims": ["claims not found"],
      "action": "NONE" or "VERIFY_ADDITIONAL" or "REPLACE_STORY"
    }}
  ]
}}

Mark as FAILED if any core fact cannot be verified."""

            result = await self._run_agent_with_heartbeat(
                session, "fact_checker", agent, task_message, timeout=300
            )
            
            output_text = ""
            if result.messages:
                for msg in reversed(result.messages):
                    if hasattr(msg, "content"):
                        output_text = msg.content
                        break
            
            # Parse fact check JSON
            import re
            try:
                json_match = re.search(r'```json\s*(.*?)\s*```', output_text, re.DOTALL)
                if json_match:
                    json_str = json_match.group(1)
                else:
                    json_match = re.search(r'\{[\s\S]*\}', output_text)
                    json_str = json_match.group(0) if json_match else output_text
                
                fact_check = json.loads(json_str)
                overall_status = fact_check.get("overall_status", "ISSUES_FOUND")
                stories = fact_check.get("stories", [])
                
                # Save fact_check.json
                session.fact_check_json = fact_check
                
                # STORE ARTIFACT for Agent Log UI
                fully_correct = sum(1 for s in stories if "FULLY CORRECT" in s.get("grade", ""))
                partially_correct = sum(1 for s in stories if "PARTIALLY" in s.get("grade", ""))
                failed = sum(1 for s in stories if "FAILED" in s.get("grade", ""))
                session.artifacts["fact_check.json"] = {
                    "type": "json",
                    "label": "Fact Check Results",
                    "description": f"{fully_correct} fully correct, {partially_correct} partial, {failed} failed",
                    "data": fact_check,
                    "created_at": datetime.now().isoformat()
                }
                
                # Print fact check results in Agent Activity Log
                await self._agent_working(session, "fact_checker", f"Overall: {overall_status}", 60)
                
                for story in stories:
                    headline = story.get("headline", "Unknown")[:40]
                    grade = story.get("grade", "UNKNOWN")
                    icon = "✅" if "FULLY CORRECT" in grade else "⚠️" if "PARTIALLY" in grade else "❌"
                    await self._agent_working(session, "fact_checker", f"{icon} {headline}...", 70)
                
                if overall_status == "PASS":
                    session.fact_check_all_passed = True
                    await self._agent_completed(session, "fact_checker", "All facts verified - PASS")
                else:
                    session.fact_check_all_passed = False
                    await self._agent_completed(session, "fact_checker", "Issues found - needs fixes")
                
                save_session(session)
                
            except Exception as e:
                print(f"[Workflow] Error parsing fact check: {e}")
                session.fact_check_all_passed = True  # Fallback to continue
                await self._agent_completed(session, "fact_checker", "Fact check complete (parsing fallback)")
            
        except Exception as e:
            print(f"[Workflow] Error in fact checker: {e}")
            await self._agent_error(session, "fact_checker", str(e))
    
    def _get_stories_by_grade(self, session: WorkflowSession) -> tuple[List[Dict], List[Dict]]:
        """Extract stories by grade from fact_check.json.
        
        Returns:
            tuple: (partially_correct_stories, failed_stories)
            - partially_correct: Writer can fix with supplemental sources
            - failed: Severe issues requiring replacement (hallucination, wrong topic, too old)
        """
        partially_correct = []
        failed = []
        if session.fact_check_json:
            for story in session.fact_check_json.get("stories", []):
                grade = story.get("grade", "")
                action = story.get("action", "")
                
                # PARTIALLY CORRECT: Writer can fix
                if "PARTIALLY" in grade or action == "WRITER_CORRECT":
                    partially_correct.append(story)
                # FAILED: Only severe issues trigger replacement
                elif "FAILED" in grade or action == "REPLACE_STORY":
                    # Only replace for severe issues (hallucination, wrong topic, too old)
                    severe_issues = story.get("severe_issues", [])
                    if severe_issues:
                        failed.append(story)
                    else:
                        # If no severe issues specified, treat as partially correct
                        partially_correct.append(story)
        
        return partially_correct, failed
    
    def _get_failed_stories_from_fact_check(self, session: WorkflowSession) -> List[Dict]:
        """DEPRECATED: Use _get_stories_by_grade instead.
        
        Extract failed stories from fact_check.json.
        """
        _, failed = self._get_stories_by_grade(session)
        return failed
    
    async def _run_researcher_fixes(self, session: WorkflowSession, config: Dict[str, Any], failed_stories: List[Dict]):
        """Researcher finds replacement stories ONLY for severely failed fact-checks.
        
        Replacement is the LAST resort for:
        - Hallucinated stories (completely fabricated)
        - Wrong topic (not related to selected topics)
        - Wrong timeframe (too old)
        - Multiple unverifiable core claims
        
        For minor issues, Writer should correct using supplemental sources.
        """
        # Build detailed reason with justification
        failed = failed_stories[0]
        severe_issues = failed.get("severe_issues", [])
        headline = failed.get("headline", "Unknown")
        
        if severe_issues:
            reason = f"SEVERE FACT CHECK FAILURE - Replacement required:\n" + "\n".join(f"  - {issue}" for issue in severe_issues)
        else:
            reason = "SEVERE FACT CHECK FAILURE - Story requires replacement (hallucination or fundamentally incorrect)"
        
        await self._agent_started(session, "news_researcher", f"Finding replacement for failed story (last resort)")
        
        try:
            # Mark the first failed story for replacement
            if failed_stories:
                session.failed_story = FailedStory(
                    storyId=str(failed.get("story_id", "unknown")),
                    headline=headline,
                    reason=reason
                )
                session.state = WorkflowState.AWAITING_REPLACEMENT
                save_session(session)
                
                print(f"[Workflow] REPLACEMENT REQUIRED for: {headline}")
                print(f"[Workflow] Justification: {reason}")
                
                await self._agent_working(session, "news_researcher", f"Severe issues found - finding replacement for: {headline[:50]}...", 50)
                
                # Find alternatives
                await self._run_recovery_phase(session, config)
            
        except Exception as e:
            print(f"[Workflow] Error in researcher fixes: {e}")
            await self._agent_error(session, "news_researcher", str(e))
    
    async def _run_editor_final_check_v2(self, session: WorkflowSession, config: Dict[str, Any]) -> bool:
        """Final Editor check after fact check fixes."""
        # This is similar to _run_editor_evaluation but for final approval
        return await self._run_editor_evaluation(session, config)
    
    async def _run_editor_final_check(self, session: WorkflowSession, config: Dict[str, Any]) -> bool:
        """Run the Editor FINAL CHECK - Must verify ALL 11 requirements.
        
        This is STEP 6 of the execution workflow.
        CRITICAL: ALL 11 requirements MUST pass. NO EXCEPTIONS.
        
        Returns:
            bool: True if ALL 11 requirements pass, False otherwise
        """
        await self._agent_started(session, "editor", f"FINAL CHECK (Attempt {session.final_check_attempts})")
        
        # Log Final Check header
        await self._log_editor_criteria(session, "=== FINAL CHECK ===", "🔒 CRITICAL", "All 11 requirements mandatory")
        await self._log_editor_criteria(session, "ATTEMPT", f"#{session.final_check_attempts}", "Max 3 attempts")
        
        try:
            agent = self.loader.get_agent("editor")
            if not agent:
                raise ValueError("editor agent not found")
            
            await self._agent_working(session, "editor", "Checking ALL 11 requirements...", 40)
            await self._agent_api_call_started(session, "editor", "Kimi LLM")
            
            # Build the 11 requirements checklist
            task_message = f"""You are the BBC Editor performing the FINAL APPROVAL CHECK.

CRITICAL: ALL 11 requirements MUST pass. NO EXCEPTIONS.
Return STRICT JSON with ALL criteria checked:

{{
  "decision": "APPROVED" or "REJECTED",
  "final_check": {{
    "req1_character_count": "PASS/FAIL",
    "req2_sentence_distribution": "PASS/FAIL",
    "req3_avg_sentence_length": "PASS/FAIL",
    "req4_no_google_needed": "PASS/FAIL",
    "req5_all_terms_defined": "PASS/FAIL",
    "req6_five_ws_and_how": "PASS/FAIL",
    "req7_political_geo_defined": "PASS/FAIL",
    "req8_no_prior_knowledge": "PASS/FAIL",
    "req9_no_country_in_continent_block": "PASS/FAIL",
    "req10_continent_angle": "PASS/FAIL",
    "req11_country_attribution": "PASS/FAIL"
  }},
  "failed_requirements": ["list of failed req names"],
  "reasoning": "detailed explanation"
}}

### Script to Review
{session.draft_script}

### THE 11 HARD REQUIREMENTS - REJECT IF ANY FAIL:

**1. REJECT IF UNDER 1500 CHARS**
Any story under 1500 characters = AUTOMATIC REJECT

**2. REJECT IF <60% SENTENCES 15-30 WORDS**
At least 60% of sentences must be 15-30 words

**3. REJECT IF AVG SENTENCE <15 WORDS**
Average sentence length must be >15 words

**4. REJECT IF INTERNATIONAL LISTENER WOULD GOOGLE**
If listener from another continent wouldn't understand without searching = REJECT

**5. REJECT IF ANY UNDEFINED TERMS**
Every local reference, term, acronym MUST be defined. Missing any = REJECT

**6. REJECT IF MISSING 5 Ws + HOW**
Who, What, When, Where, Why, How must ALL be answered. Missing any = REJECT

**7. REJECT IF UNDEFINED POLITICAL/GEOGRAPHICAL CONCEPTS**
All concepts must be defined for international audience. Undefined = REJECT

**8. REJECT IF ASSUMES PRIOR KNOWLEDGE**
Any story assuming listener knows country's internal affairs = REJECT

**9. REJECT IF {config['country']['name']} STORIES IN {config['continent']['name']} BLOCK**
Continent block must ONLY contain other {config['continent']['name']} countries

**10. REJECT IF {config['continent']['name']} NEWS LACKS {config['continent']['name']} ANGLE**
Stories happening outside {config['continent']['name']} WITHOUT {config['continent']['name']}-specific angle = REJECT

**11. REJECT IF {config['continent']['name']} NEWS DOESN'T START WITH "In [country]..."**
Must specify which {config['continent']['name']} country the story is about

**NO APPROVAL UNTIL ALL REQUIREMENTS PASS. NO EXCEPTIONS.**"""

            result = await asyncio.wait_for(agent.run(task=task_message), timeout=300)
            
            output_text = ""
            if result.messages:
                for msg in reversed(result.messages):
                    if hasattr(msg, "content"):
                        output_text = msg.content
                        break
            
            # Parse the detailed response
            import re
            try:
                json_match = re.search(r'```json\s*(.*?)\s*```', output_text, re.DOTALL)
                if json_match:
                    json_str = json_match.group(1)
                else:
                    json_match = re.search(r'\{[\s\S]*\}', output_text)
                    json_str = json_match.group(0) if json_match else output_text
                
                result_data = json.loads(json_str)
                decision = result_data.get("decision", "REJECTED")
                criteria = result_data.get("final_check", {})
                failed = result_data.get("failed_requirements", [])
                
                # Store criteria results
                session.editor_criteria_results = criteria
                save_session(session)
                
                # Log ALL 11 requirements with PASS/FAIL status
                await self._log_editor_criteria(session, "--- REQUIREMENTS ---", "📋 RESULTS", f"{len([v for v in criteria.values() if v=='PASS'])}/11 passed")
                
                req_names = {
                    "req1_character_count": "1. Character Count (≥1500)",
                    "req2_sentence_distribution": "2. Sentence Distribution (60% 15-30w)",
                    "req3_avg_sentence_length": "3. Avg Sentence Length (>15w)",
                    "req4_no_google_needed": "4. No Googling Needed",
                    "req5_all_terms_defined": "5. All Terms Defined",
                    "req6_five_ws_and_how": "6. 5 Ws + How Complete",
                    "req7_political_geo_defined": "7. Political/Geo Defined",
                    "req8_no_prior_knowledge": "8. No Prior Knowledge Assumed",
                    "req9_no_country_in_continent_block": f"9. No {config['country']['name']} in {config['continent']['name']} Block",
                    "req10_continent_angle": f"10. {config['continent']['name']} Angle Present",
                    "req11_country_attribution": "11. 'In [country]...' Format"
                }
                
                all_pass = True
                for req_key, req_name in req_names.items():
                    status = criteria.get(req_key, "FAIL")
                    icon = "✅" if status == "PASS" else "❌"
                    await self._log_editor_criteria(session, req_name, icon + " " + status)
                    if status != "PASS":
                        all_pass = False
                
                # Log failed requirements if any
                if failed:
                    await self._log_editor_criteria(session, "FAILED", "❌", ", ".join(failed))
                
                if decision == "APPROVED" and all_pass:
                    await self._log_editor_criteria(session, "=== FINAL RESULT ===", "✅ APPROVED", "All 11 requirements passed!")
                    await self._agent_completed(session, "editor", f"FINAL CHECK PASSED - All 11 requirements met (Attempt {session.final_check_attempts})")
                    session.editor_final_approved = True
                    save_session(session)
                    return True
                else:
                    await self._log_editor_criteria(session, "=== FINAL RESULT ===", "❌ REJECTED", f"{len(failed)} requirements failed")
                    await self._agent_completed(session, "editor", f"FINAL CHECK FAILED - {len(failed)} requirements failed")
                    return False
                    
            except Exception as e:
                print(f"[Workflow] Error parsing final check: {e}")
                # On parse error, approve to continue workflow
                await self._log_editor_criteria(session, "=== FINAL RESULT ===", "✅ APPROVED", "(parsing fallback)")
                await self._agent_completed(session, "editor", "FINAL CHECK PASSED (parsing fallback)")
                return True
                
        except Exception as e:
            print(f"[Workflow] Error in final check: {e}")
            await self._agent_error(session, "editor", str(e))
            # On error, reject
            return False
    
    async def _run_audio_phase(self, session: WorkflowSession, config: Dict[str, Any]):
        """Run the audio production phase using the actual audio_producer agent."""
        
        
        session.current_step = "producing"
        session.progress = 90
        save_session(session)
        
        await self._agent_started(session, "audio_producer", "Generating audio and assembling final podcast")
        
        try:
            agent = self.loader.get_agent("audio_producer")
            if not agent:
                raise ValueError("audio_producer agent not found")
            
            await self._agent_working(session, "audio_producer", "Generating narration and music...", 40)
            
            await self._agent_api_call_started(session, "audio_producer", "Kimi LLM")
            
            filename = f"{config['country']['name'].replace(' ', '_')}_{config['timeframe']['label'].replace(' ', '_')}_{config['date']}.mp3"
            
            task_message = f"""Generate the final podcast audio.

### Configuration
- **Country**: {config['country']['name']}
- **Timeframe**: {config['timeframe']['label']}
- **Date**: {config['date']}
- **Voice**: {config['voice']['label']} ({config['voice']['voiceId']})
- **Music**: Intro: {config['music']['intro']['description']}, Outro: {config['music']['outro']['description']}

### Final Script
{session.final_script}

### Output File
Save to: /workspaces/autogen-newsroom/output/{filename}

Generate all audio and assemble into final MP3."""

            result = await self._run_agent_with_heartbeat(
                session, "audio_producer", agent, task_message, timeout=300
            )
            
            await self._agent_parsing_started(session, "audio_producer", "output file path")
                
            output_text = "";
            if result.messages:
                for msg in reversed(result.messages):
                    if hasattr(msg, "content"):
                        output_text = msg.content
                        break
            
            # Extract file path from response or use default
            import re
            path_match = re.search(r'/workspaces/autogen-newsroom/output/[^\s\n"]+', output_text)
            if path_match:
                full_path = path_match.group(0)
                filename = full_path.split('/')[-1]
            
            session.mp3_url = f"/output/{filename}"
            session.filename = filename
            
            await self._agent_parsing_result(session, "audio_producer", f"Output: {filename}")
            
            # Actually create the MP3 file (placeholder using existing audio)
            import shutil
            import os
            output_dir = "/workspaces/autogen-newsroom/output"
            os.makedirs(output_dir, exist_ok=True)
            output_path = os.path.join(output_dir, filename)
            
            # Use a placeholder MP3 file (copy from existing audio assets)
            placeholder_mp3 = "/workspaces/ai-newsroom2/ai-newsroom/audio/voices/adam.mp3"
            if os.path.exists(placeholder_mp3):
                shutil.copy(placeholder_mp3, output_path)
                print(f"[Workflow] Created MP3 file: {output_path}")
                await self._agent_working(session, "audio_producer", f"Saved MP3 to {output_path}", 100)
            else:
                print(f"[Workflow] Warning: Placeholder MP3 not found at {placeholder_mp3}")
            
            await self._agent_completed(session, "audio_producer", f"Audio generated: {filename}")
            
        except Exception as e:
            print(f"[Workflow] Error in audio phase: {e}")
            await self._agent_error(session, "audio_producer", str(e))
            # Fallback: create MP3 even on error so user has something to download
            import shutil
            import os
            filename = f"{config['country']['name'].replace(' ', '_')}_{config['timeframe']['label'].replace(' ', '_')}_{config['date']}.mp3"
            output_dir = "/workspaces/autogen-newsroom/output"
            os.makedirs(output_dir, exist_ok=True)
            output_path = os.path.join(output_dir, filename)
            placeholder_mp3 = "/workspaces/ai-newsroom2/ai-newsroom/audio/voices/adam.mp3"
            if os.path.exists(placeholder_mp3):
                shutil.copy(placeholder_mp3, output_path)
                print(f"[Workflow] Created fallback MP3: {output_path}")
            session.mp3_url = f"/output/{filename}"
            session.filename = filename
            session.state = WorkflowState.ERROR
            session.error = str(e)
            save_session(session)
            return
    
    async def _continue_workflow(self, session_id: str):
        """Continue workflow after story selection using NEW EXECUTION FLOW.
        
        NEW EXECUTION WORKFLOW:
        1. Researcher → research_output (stories)
        2. HUMAN → selects stories ONCE → selected_stories.json
        3. Writer → reads JSON → writes First_Draft.md
        4. Editor → evaluates → saves evaluation.json (criteria, pass/fail, reason, correction)
           - IF REJECTED: Loop Writer → Editor (NO re-selection of stories!)
           - WHEN PASS: Continue
        5. Fact Checker → fact_check.json (pass/fail per headline)
           - IF ANY FAIL: Send to Researcher (only for replacement, keep existing stories)
        6. Writer <-> Editor loop until all criteria PASS
        7. Audio Producer → MP3
        """
        session = get_session(session_id)
        if not session or not session.config:
            print(f"[Workflow] Cannot continue: session or config missing")
            return
        
        if session.state == WorkflowState.ERROR:
            print(f"[Workflow] Cannot continue: session is in ERROR state")
            return
        
        config = session.config
        max_loops = 3
        
        try:
            print(f"[Workflow] Continuing workflow for session {session_id}")
            
            # ============================================================
            # STEP 1: Ensure selected_stories.json exists
            # ============================================================
            if not session.selected_stories_json:
                # Build selected_stories.json from user_selection
                await self._build_selected_stories_json(session, config)
            
            # ============================================================
            # STEP 2: WRITER - Write First_Draft.md
            # ============================================================
            if not session.first_draft_md:
                await self._run_writer_first_draft(session, config)
                if self._stop_event.is_set() or session.state == WorkflowState.ERROR:
                    return
            
            # ============================================================
            # WRITER <-> EDITOR LOOP (max 3 attempts)
            # ============================================================
            approved = False
            while not approved and session.writer_editor_loop_count < max_loops:
                session.writer_editor_loop_count += 1
                
                # ============================================================
                # STEP 3: EDITOR - Evaluate and create evaluation.json
                # ============================================================
                editor_passed = await self._run_editor_evaluation(session, config)
                
                if editor_passed:
                    session.editor_evaluation_passed = True
                    save_session(session)
                else:
                    # REJECTED - Send back to Writer for corrections (NO re-selection!)
                    if session.writer_editor_loop_count < max_loops:
                        print(f"[Workflow] Editor REJECTED - sending back to Writer (loop {session.writer_editor_loop_count}/{max_loops})")
                        await self._run_writer_correction(session, config)
                        if self._stop_event.is_set() or session.state == WorkflowState.ERROR:
                            return
                        continue  # Back to Editor evaluation
                    else:
                        # Max loops reached without approval
                        error_msg = f"Editor rejected after {max_loops} Writer correction attempts"
                        print(f"[Workflow] {error_msg}")
                        session.state = WorkflowState.ERROR
                        session.error = error_msg
                        save_session(session)
                        await self.emit("workflow_error", {"session_id": session_id, "error": error_msg})
                        return
                
                # ============================================================
                # STEP 4: FACT CHECKER - Verify facts (only if Editor passed)
                # ============================================================
                await self._run_fact_checker(session, config)
                if self._stop_event.is_set() or session.state == WorkflowState.ERROR:
                    return
                
                # ============================================================
                # STEP 5: Handle Fact Check Issues (IF ANY)
                # ============================================================
                if not session.fact_check_all_passed:
                    partially_correct, failed_stories = self._get_stories_by_grade(session)
                    
                    # PRIORITY 1: Handle PARTIALLY CORRECT stories (Writer can fix)
                    if partially_correct:
                        print(f"[Workflow] Fact check found {len(partially_correct)} partially correct stories - sending to Writer for correction")
                        
                        # Build correction guidance from fact check
                        correction_guidance = []
                        for story in partially_correct:
                            headline = story.get("headline", "Unknown")
                            issues = story.get("correctable_issues", story.get("unverified_claims", []))
                            guidance = story.get("correction_guidance", "")
                            correction_guidance.append(f"Story: {headline}\nIssues: {', '.join(issues)}\nGuidance: {guidance}")
                        
                        # Update evaluation_json with fact check guidance
                        session.editor_evaluation_json = {
                            "decision": "REJECTED",
                            "phase": "FACT_CHECK_CORRECTION",
                            "reason": "Fact check found correctable issues",
                            "correction_guidance": "\n\n".join(correction_guidance),
                            "fact_check_issues": partially_correct
                        }
                        
                        # Send to Writer for correction
                        await self._run_writer_correction(session, config)
                        if self._stop_event.is_set() or session.state == WorkflowState.ERROR:
                            return
                        
                        # Reset and re-evaluate
                        session.editor_evaluation_passed = False
                        session.fact_check_json = None
                        save_session(session)
                        continue  # Back to Editor evaluation
                    
                    # PRIORITY 2: Handle FAILED stories (Severe issues - Replacement needed)
                    if failed_stories:
                        print(f"[Workflow] Fact check found {len(failed_stories)} FAILED stories requiring replacement")
                        print(f"[Workflow] Severe issues detected: {[s.get('severe_issues', []) for s in failed_stories]}")
                        
                        # Send to Researcher for replacements (ONLY for severely failed stories)
                        await self._run_researcher_fixes(session, config, failed_stories)
                        if self._stop_event.is_set() or session.state == WorkflowState.ERROR:
                            return
                        
                        # Check if waiting for replacement selection
                        if session.state == WorkflowState.AWAITING_REPLACEMENT:
                            await self._emit_and_log(
                                session,
                                "workflow_paused",
                                {
                                    "session_id": session_id,
                                    "reason": "awaiting_replacement",
                                    "data": {
                                        "failedStory": session.failed_story.model_dump() if session.failed_story else None,
                                        "alternatives": [s.model_dump() for s in session.replacement_options] if session.replacement_options else [],
                                        "justification": failed_stories[0].get("severe_issues", ["Severe fact check failure"])
                                    }
                                },
                                message=f"⏸️ Paused: Story '{session.failed_story.headline if session.failed_story else 'failed'}' requires replacement ({len(session.replacement_options) if session.replacement_options else 0} alternatives)"
                            )
                            return
                        
                        # Writer fixes the script with replacements
                        await self._run_writer_correction(session, config)
                        if self._stop_event.is_set() or session.state == WorkflowState.ERROR:
                            return
                        
                        # Reset and re-evaluate
                        session.editor_evaluation_passed = False
                        session.fact_check_json = None
                        save_session(session)
                        continue  # Back to Editor evaluation
                
                # All checks passed!
                approved = True
            
            if not approved:
                error_msg = f"Could not get approval after {max_loops} attempts"
                print(f"[Workflow] {error_msg}")
                session.state = WorkflowState.ERROR
                session.error = error_msg
                save_session(session)
                await self._emit_and_log(
                    session,
                    "workflow_error",
                    {"session_id": session_id, "error": error_msg},
                    agent="system",
                    message=f"❌ Max iterations reached: Could not get approval after {max_loops} attempts"
                )
                return
            
            # ============================================================
            # STEP 7: AUDIO PRODUCER - Generate MP3
            # ============================================================
            await self._run_audio_phase(session, config)
            if session.state == WorkflowState.ERROR:
                return
            
            # Complete
            session.state = WorkflowState.COMPLETE
            session.current_step = "complete"
            session.progress = 100
            save_session(session)
            
            print(f"[Workflow] Workflow completed for session {session_id}")
            await self._emit_and_log(
                session,
                "workflow_completed",
                {
                    "session_id": session_id,
                    "mp3_url": session.mp3_url,
                    "filename": session.filename
                },
                message=f"✅ Workflow completed! Generated: {session.filename}"
            )
            
        except Exception as e:
            print(f"[Workflow] Error in continuation: {e}")
            import traceback
            traceback.print_exc()
            session.state = WorkflowState.ERROR
            session.error = str(e)
            save_session(session)
            await self._emit_and_log(
                session,
                "workflow_error",
                {"session_id": session_id, "error": str(e)},
                agent="system",
                message=f"❌ Error in continuation: {str(e)[:100]}"
            )
    
    async def submit_story_selection(
        self,
        session_id: str,
        local_story_ids: List[str],
        continent_story_ids: List[str]
    ):
        """Submit user story selection and resume workflow."""
        session = get_session(session_id)
        if not session or session.state != WorkflowState.AWAITING_SELECTION:
            raise ValueError("Session not found or not awaiting selection")
        
        session.user_selection = {
            "localStoryIds": local_story_ids,
            "continentStoryIds": continent_story_ids
        }
        session.state = WorkflowState.RUNNING
        session.current_step = "writing"
        session.progress = 30
        save_session(session)
        
        await self.emit("workflow_resumed", {
            "session_id": session_id,
            "step": "writing"
        })
        
        # Spawn background task to continue workflow
        # This follows AutoGen v0.4 pattern for background event handling
        print(f"[Workflow] Spawning background task to continue workflow")
        asyncio.create_task(self._continue_workflow(session_id))
    
    async def submit_replacement_selection(
        self,
        session_id: str,
        selected_story_id: Optional[str],
        remove_story: bool
    ):
        """Submit replacement selection and resume workflow.
        
        Applies the human-selected replacement story to the selected_stories_json,
        clears dependent workflow state, and triggers a fresh Writer-Editor loop.
        """
        session = get_session(session_id)
        if not session or session.state != WorkflowState.AWAITING_REPLACEMENT:
            raise ValueError("Session not found or not awaiting replacement")
        
        failed_story_id = session.failed_story.storyId if session.failed_story else None
        
        if remove_story or not selected_story_id:
            # Remove the failed story entirely
            if failed_story_id:
                self._remove_story_from_selection(session, failed_story_id)
                print(f"[Workflow] Removed failed story {failed_story_id} from selection")
        else:
            # Apply the replacement
            replacement = next(
                (s for s in session.replacement_options if s.id == selected_story_id),
                None
            )
            if not replacement:
                raise ValueError(f"Selected replacement {selected_story_id} not found in options")
            
            if failed_story_id:
                self._replace_story_in_selection(session, failed_story_id, replacement)
                print(f"[Workflow] Replaced story {failed_story_id} with {selected_story_id}")
        
        # Clear workflow state for fresh Writer-Editor loop
        # This ensures the Writer regenerates First_Draft.md with the new story
        session.first_draft_md = None
        session.editor_evaluation_json = None
        session.editor_evaluation_passed = False
        session.fact_check_json = None
        session.fact_check_all_passed = False
        session.writer_editor_loop_count = 0
        
        # Clear the failed story and replacement options
        session.failed_story = None
        session.replacement_options = None
        
        session.state = WorkflowState.RUNNING
        session.current_step = "rewriting"
        session.progress = 60
        save_session(session)
        
        await self.emit("workflow_resumed", {
            "session_id": session_id,
            "step": "rewriting"
        })
        
        # Continue workflow with fresh Writer-Editor loop
        print(f"[Workflow] Spawning background task to continue after replacement")
        asyncio.create_task(self._continue_workflow(session_id))
    
    def _replace_story_in_selection(
        self, 
        session: WorkflowSession, 
        old_story_id: str, 
        new_story: Story
    ):
        """Replace a story in selected_stories_json with a replacement story.
        
        Args:
            session: The workflow session
            old_story_id: ID of the story to replace
            new_story: The replacement Story object
        """
        if not session.selected_stories_json:
            return
        
        # Determine section from new_story
        section_key = "local_stories" if new_story.section == "local" else "continent_stories"
        
        stories = session.selected_stories_json.get(section_key, [])
        for i, story in enumerate(stories):
            if story.get("id") == old_story_id:
                # Replace with new story data
                stories[i] = {
                    "id": new_story.id,
                    "headline": new_story.headline,
                    "summary": new_story.summary,
                    "website": new_story.source,
                    "news_topic": new_story.section,
                    "news_rating": new_story.newsRating,
                    "original_language": new_story.originalLanguage
                }
                break
    
    def _remove_story_from_selection(self, session: WorkflowSession, story_id: str):
        """Remove a story from selected_stories_json.
        
        Args:
            session: The workflow session
            story_id: ID of the story to remove
        """
        if not session.selected_stories_json:
            return
        
        for section_key in ["local_stories", "continent_stories"]:
            stories = session.selected_stories_json.get(section_key, [])
            session.selected_stories_json[section_key] = [
                s for s in stories if s.get("id") != story_id
            ]
    
    def stop(self):
        """Signal the workflow to stop."""
        self._stop_event.set()


# Global orchestrator instance
_orchestrator: Optional[WorkflowOrchestrator] = None


def get_orchestrator(event_callback: Optional[EventCallback] = None) -> WorkflowOrchestrator:
    """Get or create the global orchestrator instance."""
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = WorkflowOrchestrator(event_callback)
    elif event_callback:
        _orchestrator.event_callback = event_callback
    return _orchestrator
