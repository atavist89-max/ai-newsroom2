# Finland News Podcast Producer - Run in Kimi Agent

Copy and paste the prompt below into a NEW Kimi Agent conversation.

---

## PROMPT TO PASTE:

```
Please serve the Finland News Podcast Producer webapp from /mnt/okcomputer/output/app/ using your built-in webapp deployment feature.

## What This App Does
This is a full-stack podcast production system that:
1. Researches Finnish and European news using web_search
2. Lets me select stories (human-in-the-loop)
3. Generates BBC-standard scripts using llm_generate
4. Audits scripts with an Editor subagent (iteration loop)
5. Fact-checks stories using web_search
6. Produces final audio using generate_speech with music mixing

## Files Location
All source code is in: /mnt/okcomputer/output/app/

## Build Instructions
1. cd /mnt/okcomputer/output/app/
2. npm install
3. npm run build
4. Serve the dist/ folder using your webapp feature

## Required Kimi Tools (MUST be available to the app)
- web_search: For researching news from Finnish and European sources
- llm_generate: For script writing, editing, and fact checking
- generate_speech: For TTS audio production

## Expected Workflow
When I use the app:
1. I select timeframe (Daily/Weekly/Monthly) and voice/music options
2. Click "Start Production" → app calls web_search for Finnish & European news
3. App displays real news stories with scores
4. I select exactly 5 Finnish stories (human-in-the-loop pause)
5. App generates script using llm_generate
6. Editor audits script using llm_generate (may iterate 1-5 times)
7. Fact checker verifies using web_search
8. Audio producer generates final MP3 using generate_speech + music
9. I can download the finished podcast

## What I Need From You
1. Build and serve the webapp
2. Provide me with the webapp URL
3. Confirm that web_search, llm_generate, and generate_speech are available to the app

Please start now.
```

---

## After Kimi Serves the App

Kimi will provide you with a URL like:
`https://[random-string].kimi.moonshot.cn`

This URL will have full access to:
- ✅ web_search
- ✅ llm_generate
- ✅ generate_speech

## Testing the App

Once you have the working URL, test each feature:

1. **Timeframe Selection**: Select "Daily" → Start Production
2. **Real News**: Verify stories come from actual sources (Yle, HS, BBC, etc.)
3. **Human Pause**: App should wait for you to select 5 Finnish stories
4. **Editor Loop**: Watch progress bar go through EDITING iterations
5. **Audio Output**: Download and play the final MP3

## If Something Doesn't Work

Tell Kimi:
- "web_search is not working" → Kimi will debug the news research
- "llm_generate failed" → Kimi will check script generation
- "generate_speech error" → Kimi will fix TTS audio
- "App shows demo stories instead of real news" → Kimi will verify web_search is being called

---

## Full Test Checklist

| Feature | How to Test | Expected Result |
|---------|-------------|-----------------|
| Timeframe | Select Daily/Weekly/Monthly | Date range matches selection |
| News Research | Click Start Production | Real articles from Yle, HS, BBC, etc. |
| Story Scoring | View research results | Stories have scores (7-10) |
| Human Pause | Wait after research | UI shows "AWAITING_SELECTION" |
| Story Selection | Select 5 Finnish stories | Generate Script button enables |
| Script Generation | Click Generate Script | BBC-format script appears |
| Editor Loop | Watch progress | Goes through EDITING → SCRIPTING iterations |
| Fact Check | Automatic after editor | Uses web_search to verify claims |
| Audio Production | Final phase | MP3 with selected voice + music |
| Download | Click Download MP3 | File saves to computer |

---

## Troubleshooting Common Issues

**Issue: "web_search is not defined" error**
→ The app is not running in Kimi's environment. Make sure Kimi served it, not deployed to external hosting.

**Issue: Stories are fake/demo data**
→ web_search returned no results. Tell Kimi: "The news research is using fallback stories instead of real web_search results. Please verify web_search is working."

**Issue: Script generation failed**
→ llm_generate may have timed out. Tell Kimi: "Script generation failed. Please check llm_generate is available and retry."

**Issue: No audio output**
→ generate_speech may have failed. Tell Kimi: "Audio production failed. Please verify generate_speech is working."

---

## Project Files Summary

```
/mnt/okcomputer/output/app/
├── src/
│   ├── agent/
│   │   ├── controller.ts          # Main workflow orchestration
│   │   ├── memorySpace.ts         # State management
│   │   ├── types.ts               # TypeScript types
│   │   ├── prompts/               # LLM prompts for each subagent
│   │   │   ├── newsResearcher.ts
│   │   │   ├── scriptWriter.ts
│   │   │   ├── editor.ts
│   │   │   ├── factChecker.ts
│   │   │   └── audioProducer.ts
│   │   └── subagents/             # Real implementations using Kimi tools
│   │       ├── newsResearcher.ts  # Uses web_search
│   │       ├── scriptWriter.ts    # Uses llm_generate
│   │       ├── editor.ts          # Uses llm_generate
│   │       ├── factChecker.ts     # Uses web_search + llm_generate
│   │       └── audioProducer.ts   # Uses generate_speech
│   ├── App.tsx                    # Main React UI
│   └── ...
├── public/audio/                  # Voice samples & music assets
└── package.json
```

---

## Ready to Use

Copy the prompt above, start a NEW Kimi Agent conversation, paste it, and Kimi will serve the working webapp for you.
