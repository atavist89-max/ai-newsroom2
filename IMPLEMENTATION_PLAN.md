# Finland News Podcast Producer - Full Implementation Plan

## Executive Summary
Transform the current demo webapp into a production-ready podcast production system using Kimi Agent subagents for automated news research, script writing, editing, fact-checking, and audio production.

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER INTERFACE                                  │
│                     (React + TypeScript + Tailwind)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │ Control Panel│  │Progress Panel│  │Story Selector│  │Audio Player  │   │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ API Calls
┌─────────────────────────────────────────────────────────────────────────────┐
│                         KIMI AGENT CONTROLLER                                │
│                    (Main orchestration logic)                                │
│  - Receives user actions from frontend                                       │
│  - Manages workflow state via memory_space                                   │
│  - Spawns subagents for each production phase                                │
│  - Returns progress updates to frontend                                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
        ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
        │   SUBAGENT 1  │ │   SUBAGENT 2  │ │   SUBAGENT 3  │
        │ News Researcher│ │ Script Writer │ │    Editor     │
        └───────────────┘ └───────────────┘ └───────────────┘
                    │               │               │
        ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
        │   SUBAGENT 4  │ │   SUBAGENT 5  │ │   SUBAGENT 6  │
        │  Fact Checker │ │Researcher-Recovery│Audio Producer│
        └───────────────┘ └───────────────┘ └───────────────┘
```

---

## 2. Detailed Component Specifications

### 2.1 Frontend (React Webapp)

**Changes Required:**
- Replace mock workflow with real API calls to Kimi Agent
- Add error handling for subagent failures
- Add retry mechanisms for failed operations
- Implement WebSocket or polling for real-time progress updates

**New API Integration:**
```typescript
// New service: agentService.ts
interface AgentService {
  startProduction(config: ProductionConfig): Promise<WorkflowId>;
  getStatus(workflowId: string): Promise<WorkflowStatus>;
  submitStorySelection(workflowId: string, selections: UserSelections): Promise<void>;
  getScript(workflowId: string): Promise<string>;
  getAudio(workflowId: string): Promise<AudioResult>;
}
```

---

### 2.2 Kimi Agent Controller

**Responsibilities:**
1. Initialize workflow with unique ID
2. Manage state in memory_space
3. Spawn subagents with appropriate prompts
4. Handle subagent responses
5. Implement retry logic for failures
6. Send progress updates to frontend

**State Schema (memory_space):**
```json
{
  "workflow_id": "fp_20260401_105259",
  "config": {
    "timeframe": "daily|weekly|monthly",
    "voice_selection": "voice_1",
    "music_suite": {
      "intro": "orch_a",
      "outro": "orch_a", 
      "story_sting": "nordic_c",
      "block_sting": "bbc_d"
    },
    "date_params": {
      "today": "2026-04-01",
      "window_start": "2026-03-31",
      "coverage_period": "24h"
    }
  },
  "research_results": {
    "finnish_candidates": [...],
    "european_candidates": [...]
  },
  "selected_stories": {
    "finnish": [...],
    "european": [...]
  },
  "production_state": {
    "status": "RESEARCHING|AWAITING_SELECTION|SCRIPTING|EDITING|FACT_CHECKING|AUDIO_PRODUCTION|COMPLETE",
    "current_phase": "research_finnish",
    "editor_iterations": 0,
    "script_versions": [...],
    "fact_check_report": {...},
    "final_audio_url": ""
  }
}
```

---

### 2.3 Subagent 1: News Researcher

**Purpose:** Search and grade news stories from Finnish and European sources

**Input:**
- Region: "finnish" or "european"
- Timeframe: "daily", "weekly", "monthly"
- Date range: start_date, end_date

**Process:**
1. Use `web_search` tool to search news sources
2. For Finnish: Search Yle, HS, IS, MTV, Turun Sanomat, Aamulehti
3. For European: Search BBC, Politico EU, Euronews, DW, France 24
4. Filter results by date range
5. Grade each story 1-10 on:
   - Immediacy (how recent/newsworthy)
   - Proximity (relevance to Finnish audience)
   - Consequence (impact/importance)
   - Prominence (involves notable people/organizations)
   - Human Interest (emotional appeal)

**Output:**
```json
{
  "stories": [
    {
      "id": 1,
      "headline": "Finnish Government Announces New Climate Initiative",
      "summary": "Comprehensive plan for carbon neutrality by 2035...",
      "score": 9,
      "source": "Yle Uutiset",
      "date": "2026-04-01",
      "url": "https://yle.fi/news/...",
      "full_text": "..."
    }
  ]
}
```

**Estimated Runtime:** 30-60 seconds per region

---

### 2.4 Subagent 2: Script Writer

**Purpose:** Generate BBC-standard broadcast script from selected stories

**Input:**
- Selected story IDs
- Timeframe (for sign-off text)
- Music suite configuration (for cue placement)

**Process:**
1. Retrieve full story details from memory_space
2. Generate script with structure:
   - [INTRO MUSIC: 8s]
   - Opening: "These are today's headlines from Finland and Europe."
   - Headlines block (30 seconds, all stories)
   - [BLOCK TRANSITION STING: 3s]
   - Finnish stories deep dive (3-4 min)
   - [STORY STING: 1-2s] between each story
   - [BLOCK TRANSITION STING: 3s]
   - European stories deep dive (2-3 min)
   - [OUTRO MUSIC: 6s]
   - Sign-off
3. Add phonetic pronunciation guides
4. Ensure sentences < 20 words
5. Use active voice, attribute sources

**Output:** Full markdown script with music cues

**Estimated Runtime:** 20-30 seconds

---

### 2.5 Subagent 3: Editor (Quality Auditor)

**Purpose:** Audit script against BBC documentary standards

**Input:**
- Script content
- Phase: 1 (structure) or 2 (readability)

**Audit Checklist:**
- [ ] Opening phrasing correct
- [ ] Music cues properly formatted [IN BRACKETS]
- [ ] All European stories have country attribution
- [ ] Sentence length < 20 words
- [ ] Oral readability (sounds natural when read aloud)
- [ ] Proper structure (Intro → Headlines → Blocks → Outro)
- [ ] Phonetic guides for difficult names
- [ ] Active voice used
- [ ] No unexplained jargon
- [ ] Source attribution present
- [ ] Sign-off correct

**Output:**
```json
{
  "status": "BBC_CLEARED|NEEDS_REVISION",
  "phase": 1,
  "directives": ["Fix opening phrasing", "Add country attribution for story 3"],
  "issues": ["Opening should be 'These are today's headlines'"]
}
```

**Estimated Runtime:** 15-20 seconds

---

### 2.6 Subagent 4: Fact Checker

**Purpose:** Verify factual claims in script

**Input:**
- BBC-cleared script
- Date window for verification

**Process:**
1. Extract factual claims from each story
2. Use `web_search` to find corroborating sources
3. Verify against 2+ independent sources
4. Check publication dates within window
5. Grade each story:
   - FACT_CHECKED_FULLY_CORRECT
   - PARTIALLY_CORRECT
   - FAILED

**Output:**
```json
{
  "overall_status": "PASS|ISSUES_FOUND",
  "stories": [
    {
      "story_id": 1,
      "grade": "FACT_CHECKED_FULLY_CORRECT",
      "verified_sources": ["Yle Uutiset", "Helsingin Sanomat"],
      "claims_checked": [
        {"claim": "Government announced climate plan", "verified": true, "source": "Yle"}
      ],
      "action": "NONE"
    }
  ]
}
```

**Estimated Runtime:** 30-45 seconds

---

### 2.7 Subagent 5: Researcher-Recovery (Conditional)

**Purpose:** Find replacement stories when fact-checking fails

**Trigger:** Only if Fact Checker finds PARTIALLY_CORRECT or FAILED stories

**Input:**
- Failed/partial story IDs
- Original search parameters

**Process:**
1. Search for replacement stories on same topic
2. Or find additional verification sources
3. Ensure replacements meet quality criteria (score >= 7)

**Output:**
```json
{
  "replacements": [
    {
      "original_id": 3,
      "replacement_story": {...},
      "reason": "Original story had unverified claim"
    }
  ],
  "writer_instructions": ["Replace story 3 with new story"]
}
```

**Estimated Runtime:** 30-60 seconds

---

### 2.8 Subagent 6: Audio Producer

**Purpose:** Generate final podcast audio with TTS and music mixing

**Input:**
- Final BBC-cleared script
- Voice profile selection
- Music suite configuration

**Process:**
1. Chunk script into segments:
   - Intro (with music)
   - Headlines
   - Story 1-5 (Finnish)
   - Story 6-10 (European, if present)
   - Sign-off (with music)

2. Generate TTS for each chunk using Kimi-Audio:
   - Opening: 140 WPM, warm
   - Headlines: 170 WPM, driving
   - Deep Dives: 140 WPM, authoritative
   - Sign-off: 130 WPM, measured

3. Mix with music:
   - [INTRO MUSIC]: 8s, fade under voice at 0:06
   - [BLOCK TRANSITION STING]: 3s, -20dB below voice
   - [STORY STING]: 1-2s, -20dB below voice
   - [OUTRO MUSIC]: 6s, definitive close

4. Normalize to -16 LUFS
5. Export MP3 (320kbps, 44.1kHz)

**Output:**
```json
{
  "audio_url": "https://storage.kimi.com/audio/fp_xxx.mp3",
  "timeline": {
    "segments": [
      {"type": "intro", "start_time": 0, "duration": 8},
      {"type": "headlines", "start_time": 8, "duration": 30},
      ...
    ],
    "total_duration": 480
  }
}
```

**Estimated Runtime:** 60-120 seconds

---

## 3. Workflow Orchestration Logic

```
START
  │
  ▼
┌─────────────────┐
│  Initialize     │
│  Workflow State │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│  Research       │────▶│  Research       │
│  Finnish News   │     │  European News  │
│  (Parallel)     │     │  (Parallel)     │
└────────┬────────┘     └────────┬────────┘
         │                       │
         └───────────┬───────────┘
                     ▼
         ┌─────────────────────┐
         │  Store Results in   │
         │  memory_space       │
         └──────────┬──────────┘
                    ▼
         ┌─────────────────────┐
         │  PAUSE: Wait for    │
         │  User Story         │
         │  Selection          │
         └──────────┬──────────┘
                    ▼
         ┌─────────────────────┐
         │  Validate Selection │
         │  (Exactly 5 Finnish)│
         └──────────┬──────────┘
                    ▼
         ┌─────────────────────┐
         │  Generate Script    │
         │  (Script Writer)    │
         └──────────┬──────────┘
                    ▼
         ┌─────────────────────┐
         │  Editor Review      │◄────┐
         │  Phase 1            │     │
         └──────────┬──────────┘     │
                    │                 │
         ┌──────────┴──────────┐     │
         │  BBC CLEARED?       │     │
         └──────────┬──────────┘     │
              Yes /   \ No           │
                 /     \             │
                ▼       ▼            │
    ┌──────────────┐  ┌──────────────┤
    │  Phase 2     │  │  Writer      │
    │  Review      │  │  Revision    │
    └──────┬───────┘  │  (Loop max 5)│
           │          └──────────────┘
           ▼
    ┌──────────────┐
    │  Fact Check  │
    └──────┬───────┘
           │
    ┌──────┴────────┐
    │  Issues Found?│
    └──────┬────────┘
     Yes /   \ No
        /     \
       ▼       ▼
┌──────────┐  ┌──────────────┐
│ Recovery │  │  Audio       │
│ Process  │  │  Production  │
│ (Optional)│  │  (TTS + Mix) │
└────┬─────┘  └──────┬───────┘
     │               │
     └───────┬───────┘
             ▼
    ┌─────────────────┐
    │  Store Audio    │
    │  Return URL     │
    └────────┬────────┘
             ▼
    ┌─────────────────┐
    │  COMPLETE       │
    └─────────────────┘
```

---

## 4. Implementation Phases

### Phase 1: Backend Foundation (Week 1)
- [ ] Set up Kimi Agent controller with memory_space
- [ ] Implement workflow state management
- [ ] Create subagent prompt templates
- [ ] Implement error handling and retry logic

### Phase 2: News Research Implementation (Week 1-2)
- [ ] Implement News Researcher subagent
- [ ] Integrate web_search for Finnish sources
- [ ] Integrate web_search for European sources
- [ ] Add story scoring algorithm
- [ ] Test with real news searches

### Phase 3: Script Generation Pipeline (Week 2)
- [ ] Implement Script Writer subagent
- [ ] Implement Editor subagent with audit checklist
- [ ] Implement Editor-Writer iteration loop
- [ ] Add deadlock detection (max 5 iterations)
- [ ] Test script generation quality

### Phase 4: Fact Checking & Recovery (Week 2-3)
- [ ] Implement Fact Checker subagent
- [ ] Implement Researcher-Recovery subagent
- [ ] Add conditional recovery path
- [ ] Test with partially correct stories

### Phase 5: Audio Production (Week 3)
- [ ] Implement Audio Producer subagent
- [ ] Integrate Kimi-Audio TTS
- [ ] Implement music mixing logic
- [ ] Add audio normalization (-16 LUFS)
- [ ] Test full audio pipeline

### Phase 6: Frontend Integration (Week 3-4)
- [ ] Replace mock workflow with real API calls
- [ ] Add real-time progress updates (WebSocket/polling)
- [ ] Implement error handling and retry UI
- [ ] Add loading states and user feedback
- [ ] Test end-to-end workflow

### Phase 7: Testing & Optimization (Week 4)
- [ ] End-to-end testing with real news
- [ ] Performance optimization
- [ ] Error scenario testing
- [ ] Documentation

---

## 5. Technical Requirements

### Kimi Agent Capabilities Needed
- `web_search` - for news research and fact checking
- `memory_space` - for state persistence
- `generate_speech` - for TTS (Audio Producer)
- Subagent spawning - for workflow orchestration

### External APIs
- News sources (no API key needed for web search)
- Kimi-Audio for TTS

### Storage
- Temporary storage for audio files (Kimi storage or external)
- Workflow state in memory_space

### Rate Limits to Consider
- Web search: ~10 calls per workflow (5 for Finnish, 5 for European, plus fact checking)
- TTS: ~10-15 chunks per podcast
- Total API calls per podcast: ~20-30

---

## 6. Cost Estimate

Based on Kimi Agent pricing:

| Component | Calls per Podcast | Estimated Cost |
|-----------|-------------------|----------------|
| News Research (Finnish) | 1 | $0.05-0.10 |
| News Research (European) | 1 | $0.05-0.10 |
| Script Writer | 1-3 (with revisions) | $0.05-0.15 |
| Editor | 1-3 (with revisions) | $0.05-0.15 |
| Fact Checker | 1 | $0.05-0.10 |
| Audio Producer | 1 | $0.10-0.20 |
| **Total per Podcast** | | **$0.35-0.80** |

---

## 7. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Web search returns no results | High | Fallback to broader search terms, use cached news |
| Fact checker finds too many issues | Medium | Implement recovery subagent, allow user override |
| Editor-Writer deadlock | Low | Max 5 iterations, then alert user |
| TTS generation fails | Medium | Retry with different voice, alert user |
| Audio mixing quality issues | Low | Preview before final, allow regeneration |
| Rate limiting on web search | Medium | Implement caching, stagger requests |

---

## 8. Success Criteria

- [ ] Successfully research 8-10 Finnish stories and 6-8 European stories
- [ ] Generate BBC-standard script with proper structure
- [ ] Pass Editor audit within 3 iterations
- [ ] Fact-check all stories with 2+ sources
- [ ] Produce 8-12 minute podcast audio
- [ ] Total production time < 5 minutes
- [ ] User can preview and approve at each stage
- [ ] Error rate < 5% for full workflow

---

## 9. Approval Required

Please review and approve:

1. **Architecture** - Is the subagent approach acceptable?
2. **Timeline** - 4 weeks realistic for your needs?
3. **Cost** - $0.35-0.80 per podcast acceptable?
4. **Phases** - Should we prioritize any specific phase?
5. **Features** - Any additional features needed?

**Once approved, I will begin implementation starting with Phase 1.**
