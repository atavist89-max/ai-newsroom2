# AI Newsroom Podcast Producer

A fully-automated, multi-agent podcast production system that researches real news, writes BBC-style scripts, verifies facts, and produces professional audio podcasts using 7 specialized AI agents with strict editorial review gates.

**Live Demo:** https://ccn7h2z5m53rm.ok.kimi.link

---

## Overview

The AI Newsroom uses a sophisticated **7-agent execution workflow** powered by AutoGen v0.4 and Kimi AI. Unlike simple prompt-chaining systems, this uses a **rigorous editorial process** with mandatory approval gates and rejection loops to ensure BBC-quality output.

### What Makes This Different

- **Real News, Real Time**: Agents search actual news sources in native languages
- **Strict Editorial Process**: Two-phase editor review with 11 hard requirements
- **Rejection Loops**: Failed scripts automatically return for revision (up to 3 attempts)
- **Human-in-the-Loop**: Review gates for story selection and fact-check failures
- **Transparent Process**: Real-time agent activity log with pass/fail criteria tracking
- **Error Resilience**: Graceful handling of API failures and parsing errors

---

## The 7-Agent Execution Workflow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         EXECUTION WORKFLOW                                   │
└─────────────────────────────────────────────────────────────────────────────┘

STEP 1: NEWS RESEARCHER (Agent 1)
├── Searches local news (native language)
├── Searches continental news (English)
├── Returns 10+ local + 5+ continent stories
└── Creates FIRST DRAFT SCRIPT
         │
         ▼
STEP 2: EDITOR - PHASE 1 (Agent 2)
├── Reviews initial draft
├── Checks: Story count, Basic structure, Country context
├── DECISION: APPROVED or REJECTED
│
├── ❌ REJECTED ──────────────────────────┐
│   ├── Increment attempt counter          │
│   └── LOOP BACK to Step 1 (Researcher)  │
│   (Max 3 attempts)                       │
│◀─────────────────────────────────────────┘
│
└── ✅ APPROVED
         │
         ▼
STEP 3: WRITER (Agent 3)
├── Polishes script for BBC standards
├── Optimizes for spoken delivery
├── Adds transitions, intro, outro
└── PHASE 2 COMPLETE
         │
         ▼
STEP 4: FACT CHECKER (Agent 4)
├── Cross-references all factual claims
├── Grades each story (PASS/FAIL)
└── Generates VERIFICATION REPORT
         │
         ▼
STEP 5: RECOVERY RESEARCHER (Agent 5) - IF NEEDED
├── Only activated if Fact Check finds issues
├── Finds 3-5 replacement stories
└── Fixes factual issues
         │
         ▼
STEP 6: EDITOR - FINAL CHECK (Agent 2 - Same Editor)
├── 🔒 CRITICAL FINAL APPROVAL GATE
├── ALL 11 REQUIREMENTS MUST PASS - NO EXCEPTIONS
│
│   1. ✅ Character Count (≥1500 chars per story)
│   2. ✅ Sentence Distribution (60% between 15-30 words)
│   3. ✅ Average Sentence Length (>15 words)
│   4. ✅ International Listener Wouldn't Google
│   5. ✅ All Terms Defined (no undefined local references)
│   6. ✅ 5 Ws + How Complete (Who, What, When, Where, Why, How)
│   7. ✅ Political/Geographical Concepts Defined
│   8. ✅ No Prior Knowledge Assumed
│   9. ✅ No Country Stories in Continent Block
│  10. ✅ Continent Angle Present (continent-specific perspective)
│  11. ✅ Country Attribution Format ("In [country]...")
│
├── Logs EACH criterion with ✅ PASS / ❌ FAIL
├── DECISION: APPROVED or REJECTED
│
├── ❌ REJECTED ─────────────────────────────────────────┐
│   ├── Show WHICH requirements failed                    │
│   ├── LOOP: Writer → Fact Checker → Editor             │
│   │   (Recovery Researcher if needed)                  │
│   └── Repeat until ALL 11 pass (Max 3 attempts)        │
│◀────────────────────────────────────────────────────────┘
│
└── ✅ ALL 11 REQUIREMENTS PASSED
         │
         ▼
STEP 7: AUDIO PRODUCER (Agent 6)
├── Generates narration with selected voice
├── Mixes music cues at proper timestamps
├── Produces final MP3 file
└── 🎉 WORKFLOW COMPLETE
```

### Agent Details

| Step | Agent | Role | Key Responsibility |
|------|-------|------|-------------------|
| 1 | **🔍 News Researcher** | Investigative Researcher | Finds real news from local + continental sources |
| 2 | **✏️ Editor** | BBC Content Editor | **Phase 1**: Initial review. **Final**: All 11 requirements |
| 3 | **📝 Writer** | BBC Script Writer | Polishes script for broadcast, adds transitions |
| 4 | **✅ Fact Checker** | Verification Specialist | Cross-references claims, generates report |
| 5 | **🔄 Recovery Researcher** | Backup Researcher | Fixes fact-check failures (conditional) |
| 6 | **🎙️ Audio Producer** | Audio Engineer | Generates MP3 with voice + music |

### The 11 Hard Requirements (Non-Negotiable)

The Editor's Final Check enforces these requirements with **zero tolerance**:

| # | Requirement | Rejection Criteria |
|---|-------------|-------------------|
| 1 | **Character Count** | Any story < 1500 characters = AUTO-REJECT |
| 2 | **Sentence Distribution** | < 60% of sentences between 15-30 words = REJECT |
| 3 | **Average Sentence Length** | Average < 15 words = REJECT |
| 4 | **No Googling Required** | International listener would need to search = REJECT |
| 5 | **All Terms Defined** | Any undefined local term/acronym = REJECT |
| 6 | **5 Ws + How** | Missing Who, What, When, Where, Why, or How = REJECT |
| 7 | **Political/Geo Concepts** | Undefined concepts for international audience = REJECT |
| 8 | **No Prior Knowledge** | Assumes listener knows country's internal affairs = REJECT |
| 9 | **Continent Block Purity** | Country's own stories in continent block = REJECT |
| 10 | **Continent Angle** | Stories lack continent-specific perspective = REJECT |
| 11 | **Country Attribution** | Doesn't start with "In [country]..." = REJECT |

**NO APPROVAL UNTIL ALL REQUIREMENTS PASS. NO EXCEPTIONS.**

### Review Gates

The workflow pauses at two points for human review:

1. **Story Selection Gate** (after Step 1)
   - Review all discovered stories
   - Select exactly **5 local + 3 continent stories**
   - Click "Continue Production" to proceed

2. **Replacement Selection Gate** (if Fact Check fails)
   - Review fact-check failures
   - Choose replacement story or remove failed story
   - Workflow continues with revised script

---

## Features

### Geographic Coverage
- **100+ countries** across 7 continents
- Interactive map with country selection
- Automatic continent detection
- Local news sources in native languages
- Continental news sources in English

### Content Options
- **Timeframes**: Daily (24h), Weekly (7d), Monthly (30d)
- **Topics**: General News, Economy, Entertainment, Politics, Society, Sport, Technology, Crime
- **Voices**: Multiple professional narrators (Adam, Josh, Rachel, etc.)
- **Music**: Customizable intro/outro with style selection

### Real-Time Monitoring
- **Agent Activity Log**: Live feed with timestamps and criteria pass/fail status
- **5-Second Heartbeat**: Status updates every 5 seconds during API calls
- **Progress Tracking**: 0-100% progress for each agent
- **Step Numbers**: Visual 1-7 indicators on each agent card
- **Error Visibility**: Clear error messages with retry options
- **Stuck Detection**: Warnings when agents take longer than expected

---

## Tech Stack

### Backend (Python)
- **FastAPI** - REST API framework
- **Socket.IO** - Real-time WebSocket communication
- **AutoGen v0.4** - Multi-agent orchestration
- **Kimi API** - LLM for agent reasoning
- **Pydantic** - Data validation and serialization

### Frontend (TypeScript/React)
- **React 19** - UI framework
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling
- **Socket.IO Client** - Real-time updates
- **Leaflet** - Interactive maps

### Proxy Server (Node.js)
- **Express** - HTTP server
- **TypeScript** - Type safety

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client (Browser)                         │
│                    React + Socket.IO Client                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ WebSocket/HTTP
┌─────────────────────────────────────────────────────────────────┐
│                     Node.js Proxy (Port 3001)                    │
│              Static files + API routing + Fallbacks              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ HTTP/WebSocket
┌─────────────────────────────────────────────────────────────────┐
│                  Python Server (Port 8000)                       │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────────┐ │
│  │  FastAPI    │  │  Socket.IO   │  │  WorkflowOrchestrator   │ │
│  │   Routes    │  │   Handler    │  │  (7-Agent Pipeline)     │ │
│  └─────────────┘  └──────────────┘  └─────────────────────────┘ │
│                                              │                   │
│                    ┌─────────────────────────┘                   │
│                    ▼                                             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              AutoGen v0.4 Agent System                    │   │
│  │  ┌─────────┐ ┌────────┐ ┌────────┐ ┌─────────┐          │   │
│  │  │ Research│ │ Editor │ │ Writer │ │ FactChk │  ...      │   │
│  │  └─────────┘ └────────┘ └────────┘ └─────────┘          │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ API Calls
┌─────────────────────────────────────────────────────────────────┐
│                      Kimi API (Moonshot)                         │
│              LLM reasoning for all 7 agents                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Getting Started

### Prerequisites
- Python 3.10+
- Node.js 18+
- Kimi API key

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/atavist89-max/ai-newsroom.git
cd ai-newsroom
```

2. **Set up Python environment**
```bash
cd python_server
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cd ..
```

3. **Set up Node.js dependencies**
```bash
npm install
cd server && npm install && cd ..
```

4. **Configure environment**
```bash
# Copy example env file
cp .env.example .env

# Edit .env and add your Kimi API key
KIMI_API_KEY=your_api_key_here
```

### Running the Application

**Option 1: Manual startup (3 terminals)**

Terminal 1 - Python Server:
```bash
cd python_server
python -m main
# Runs on http://localhost:8000
```

Terminal 2 - Node Proxy:
```bash
cd server
npm start
# Runs on http://localhost:3001
```

Terminal 3 - Vite Dev Server:
```bash
npm run dev
# Runs on http://localhost:5173
```

**Option 2: VS Code tasks**

Use the provided `.vscode/tasks.json` to start all servers with Ctrl+Shift+P → "Run Task"

### Using the Application

1. Open http://localhost:5173 in your browser
2. Select a country from the map or dropdown
3. Choose timeframe (Daily/Weekly/Monthly)
4. Select up to 3 topics
5. Pick a voice for narration
6. Configure music style
7. Click "Generate Podcast"
8. **Wait for research phase** (2-4 minutes)
9. **Review stories** - Select 5 local + 3 continent stories
10. Click "Continue Production"
11. **Monitor the execution workflow:**
    - Editor Phase 1 (can reject and loop back)
    - Writer Phase 2
    - Fact Checker Verification
    - Editor Final Check (all 11 requirements logged)
    - If any fail: Writer → Fact Checker → Editor loop
    - Audio Producer (MP3 generation)
12. Download your MP3 when complete!

---

## API Endpoints

### Workflow Management
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/workflow/start` | POST | Start new podcast workflow |
| `/workflow/{id}/select` | POST | Submit story selection |
| `/workflow/{id}/replace` | POST | Submit replacement story |
| `/workflow/{id}/status` | GET | Get current workflow status |
| `/workflow/{id}/stop` | POST | Stop running workflow |

### WebSocket Events (Client → Server)
| Event | Data | Description |
|-------|------|-------------|
| `join_session` | `{session_id}` | Subscribe to session updates |

### WebSocket Events (Server → Client)
| Event | Data | Description |
|-------|------|-------------|
| `workflow_started` | `{session_id, config}` | Workflow initiated |
| `workflow_paused` | `{reason, data}` | Waiting for human input |
| `workflow_resumed` | `{step}` | Continuing after pause |
| `workflow_completed` | `{mp3_url, filename}` | Podcast ready |
| `workflow_error` | `{error}` | Workflow failed |
| `agent_started` | `{agent, task}` | Agent began working |
| `agent_working` | `{agent, message, progress}` | Progress update |
| `agent_completed` | `{agent, output}` | Agent finished |
| `agent_error` | `{agent, error}` | Agent failed |
| `criteria_check` | `{criterion, status}` | Editor requirement checked |

---

## Error Handling

The system handles various failure scenarios:

| Scenario | Behavior |
|----------|----------|
| **API Timeout** | 5-minute timeout per agent, clear error message |
| **Parse Error** | JSON parsing fails → agent error, workflow stops |
| **Editor Rejection** | Logs which requirements failed, loops back |
| **Max Attempts** | After 3 failed attempts → workflow error |
| **Network Issues** | WebSocket reconnection with 3s retry interval |

---

## Configuration

### Agent Configuration
Agent prompts and settings are in `/autogen-config/agents/`:
- `news_researcher.json`
- `editor.json`
- `final_writer.json`
- `fact_checker.json`
- `recovery_researcher.json`
- `audio_producer.json`

### Countries & Topics
Data files are in `/src/data/`:
- `countries.ts` - Country definitions with news sources
- `topics.ts` - Topic definitions with search terms

### Environment Variables
```bash
# Required
KIMI_API_KEY=your_kimi_api_key

# Optional (with defaults)
PYTHON_WS_URL=ws://localhost:8000
PYTHON_API_URL=http://localhost:8000
NODE_PORT=3001
VITE_PORT=5173
```

---

## Development

### Project Structure
```
ai-newsroom/
├── python_server/          # Python backend
│   ├── agents/            # Agent definitions & workflow
│   │   ├── workflow.py    # Main orchestrator with execution flow
│   │   └── loader.py      # Agent loader
│   ├── models/            # Pydantic models
│   │   └── state.py       # Workflow state with criteria tracking
│   └── main.py            # FastAPI app
├── server/                # Node.js proxy
│   └── index.ts           # Express server
├── src/                   # React frontend
│   ├── components/        # UI components
│   ├── data/             # Static data
│   └── hooks/            # Custom hooks
├── autogen-config/        # Agent configs
│   └── agents/           # JSON agent definitions
└── public/               # Static assets
```

### Adding a New Requirement

To add a new hard requirement to the Editor Final Check:

1. Edit `_run_editor_final_check()` in `workflow.py`
2. Add to the `task_message` prompt
3. Add to the `req_names` mapping for logging
4. Update this README with the new requirement

### Testing the Workflow

Run end-to-end test:
```bash
# Start all servers, then:
curl -X POST http://localhost:8000/workflow/start \
  -H "Content-Type: application/json" \
  -d '{"country":{"name":"Germany","language":"German"},"topics":["Politics"],...}'

# Monitor in browser - watch for:
# - Phase 1 approval/rejection
# - Writer Phase 2 completion
# - All 11 criteria pass/fail logs
# - Final approval before audio
```

---

## Troubleshooting

### Common Issues

**"Editor Final Check Failed - X requirements"**
- Check Agent Activity Log for which requirements failed
- System will auto-loop to Writer for fixes
- Max 3 attempts before workflow error

**"No file to download"**
- Audio Producer creates placeholder MP3
- For real TTS, integrate ElevenLabs/OpenAI TTS API

**Workflow stuck on "Working"**
- Check `/tmp/python_server.log` for errors
- 5-minute timeout will trigger automatically
- Check Kimi API status

---

## Changelog

### v2.2 - Fact Checker Logic Improvement (Current)
- **Fixed**: Fact checker now properly distinguishes between correctable vs severe issues
- **New**: Stories with minor errors go to Writer for correction (with supplemental sources)
- **New**: Replacement only triggered for severe issues (hallucination, wrong topic, too old)
- **New**: Detailed justification required for replacement (must specify severe_issues)
- **Fixed**: Vite proxy config to forward API requests correctly

### v2.1 - Bug Fix: Replacement Selection
- **Fixed**: `submit_replacement_selection()` now properly applies human-selected replacement stories
- **Fixed**: Replacement stories are correctly written to `selected_stories.json`
- **Fixed**: Workflow state properly resets after replacement (clears `first_draft_md`, `evaluation_json`, etc.)
- **Fixed**: Writer regenerates script with new story after replacement selection
- **Removed**: Unused `workflow_new.py` stub file

### v2.0 - Rigorous Editorial Workflow
- Complete rewrite with 2-phase editor review
- 11 hard requirements with pass/fail logging
- Rejection loops: Editor → Researcher, Editor → Writer
- Max 3 attempts per phase
- Real-time criteria tracking in Agent Activity Log
- Step number badges (1-7) on agent cards

### v1.0 - Basic Multi-Agent (Legacy)
- Simple linear pipeline
- No rejection loops
- Single editor review

---

## License

MIT License - See LICENSE file

---

## Acknowledgments

- AutoGen team at Microsoft Research
- Kimi by Moonshot AI
- FastAPI and Socket.IO communities
- React and Vite teams

---

*Built with ❤️ for automated journalism with editorial rigor*
