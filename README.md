# AI Newsroom Podcast Producer

A web application that generates sophisticated agent swarm prompts for automated news podcast production. Configure your news source, topics, voice, and music, then generate a complete prompt for Kimi Agent to produce professional BBC-style news podcasts.

**Live Demo:** https://ccn7h2z5m53rm.ok.kimi.link

---

## Features

### Geographic Selection
- **100+ countries** across 7 continents
- Interactive map with country selection
- Automatic continent detection
- Local news sources for each country
- Continental news sources for broader coverage

### Timeframe Options
- **Daily Briefing** - 24-hour news window
- **Weekly Review** - 7-day news roundup  
- **Monthly Roundup** - 30-day comprehensive review

### Topic Selection
Select up to 3 topics:
- General News
- Economy
- Entertainment
- Politics
- Society
- Sport
- Technology
- Crime

### Voice Selection
- **Adam** - Professional male, American accent
- **Josh** - Authoritative male, British accent
- **Rachel** - Warm female, American accent

### Music Suite
Customize your podcast's audio identity:
- **Intro Music** - Orchestral, Modern, Nordic, BBC, Contemporary
- **Outro Music** - Matching intro style
- **Story Sting** - Short transition between stories
- **Block Transition** - Between major sections

---

## Agent Swarm Architecture

The generated prompt orchestrates 6 AI agents working together:

### Agent 1: News Researcher
- Searches local news sources in the country's language
- Searches continental news sources in English
- Auto-selects top stories based on relevance and diversity
- **Excludes** selected country stories from continent block

### Agent 2: The Editor (Quality Gate)
Reviews scripts for:
- BBC broadcast standards
- Story completeness (1500+ characters minimum)
- International audience understanding
- Term definitions and context
- 5 Ws + How coverage
- Sentence length distribution (60% between 15-30 words)
- Continent-specific angles for continental news

### Agent 3: The Writer
- Polishes scripts for active voice
- Ensures oral readability
- Maintains BBC style
- Adds transitional narration

### Agent 4: Fact Checker
- Verifies all claims against multiple sources
- Flags factual inaccuracies
- Triggers replacement story search if needed

### Agent 5: Researcher (Conditional)
- Only activated if fact-check fails
- Finds replacement stories from yesterday's news
- Ensures narrative continuity

### Agent 6: Audio Producer
- Generates speech using selected voice
- Mixes music cues at proper timestamps
- Produces final MP3

---

## Hard Requirements (Non-Negotiable)

Every story must meet these criteria:

1. **Minimum 1500 characters** - Ensures sufficient detail
2. **60% of sentences 15-30 words** - Natural speech rhythm
3. **Average sentence length >15 words** - Prevents choppy delivery
4. **All terms defined** - No unexplained local references
5. **5 Ws + How answered** - Complete information
6. **International context** - Assume zero prior knowledge
7. **Continent angle** - Continental news must have continent-specific perspective
8. **"In [country]..." start** - Continental news must specify country

---

## Usage

1. **Select a country** from the map or dropdown
2. **Choose timeframe** (Daily/Weekly/Monthly)
3. **Select topics** (up to 3)
4. **Pick a voice** for narration
5. **Configure music suite** for transitions
6. **Click "Generate Podcast Prompt"**
7. **Copy the prompt** and paste into Kimi Agent

---

## Technical Details

### Built With
- React + TypeScript
- Tailwind CSS
- Leaflet (interactive maps)
- Vite (build tool)

### Deployment
Static site deployed to production environment.

### Audio Assets
- 35 audio files included
- Music: intro, outro, story stings, block transitions
- Voice samples for preview

---

## GitHub Repository

https://github.com/atavist89-max/Ai-newsroom

---

## Changelog

### Latest Updates
- Removed non-functional download button
- Added "Crime" topic
- Changed sentence length requirement to statistical distribution (60% between 15-30 words)
- Added continent-specific angle requirements
- Fixed map z-index overlay issue
- Made all editor requirements hard and non-negotiable
- Added Mandarin TTS with English language instruction

---

*This README is kept up to date with all project changes.*
