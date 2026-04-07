import express from 'express';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const AUTOGEN_URL = process.env.AUTOGEN_URL || 'http://localhost:8080/api/runs';

app.use(cors());
app.use(express.json());
app.use('/output', express.static('/workspaces/autogen-newsroom/output'));

interface Country {
  name: string;
  code: string;
  language: string;
  newsSources: string[];
}

interface Continent {
  name: string;
  newsSources: { name: string; language: string }[];
}

interface Timeframe {
  label: string;
  days: number;
  mode: 'daily' | 'weekly' | 'monthly';
}

interface Voice {
  label: string;
  voiceId: string;
}

interface MusicConfig {
  intro: { description: string; mood: string };
  outro: { description: string; mood: string };
  blockSting: { description: string };
  storySting: { description: string };
}

interface PodcastConfig {
  country: Country;
  continent: Continent;
  timeframe: Timeframe;
  topics: string[];
  voice: Voice;
  music: MusicConfig;
  date: string;
}

interface WorkflowResponse {
  output: any;
  decision?: 'APPROVED' | 'REJECTED' | 'BBC CLEARED Phase 2';
  reason?: string;
  overall_status?: 'PASS' | 'ISSUES_FOUND';
  violations?: string[];
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/api/generate-podcast', async (req, res) => {
  const config: PodcastConfig = req.body;
  const jobId = Date.now().toString();
  
  try {
    console.log(`[${jobId}] Starting podcast generation for ${config.country.name}`);
    
    const research = await callWorkflow('01-Research', {
      country: config.country,
      continent: config.continent,
      timeframe: config.timeframe,
      topics: config.topics,
      date: config.date
    });
    
    let draft = research.output;
    let approved = false;
    let attempts = 0;
    const maxAttempts = 3;
    
    while (!approved && attempts < maxAttempts) {
      const editorReview = await callWorkflow('02-Editor-Review', {
        draft: draft,
        topics: config.topics,
        timeframe: config.timeframe,
        attempt: attempts + 1
      });
      
      if (editorReview.decision === 'APPROVED') {
        approved = true;
      } else {
        attempts++;
        if (attempts >= maxAttempts) {
          return res.status(400).json({
            error: 'Max editor attempts reached',
            reason: editorReview.reason,
            violations: editorReview.violations
          });
        }
        
        const researchRetry = await callWorkflow('01-Research', {
          country: config.country,
          continent: config.continent,
          timeframe: config.timeframe,
          topics: config.topics,
          date: config.date,
          previousDraft: draft,
          editorFeedback: editorReview.reason
        });
        
        draft = researchRetry.output;
      }
    }
    
    const finalScript = await callWorkflow('03-Final-Writer', {
      approvedDraft: draft,
      voice: config.voice,
      music: config.music
    });
    
    let script = finalScript.output;
    let factCheckPassed = false;
    let factCheckAttempts = 0;
    const maxFactChecks = 3;
    
    while (!factCheckPassed && factCheckAttempts < maxFactChecks) {
      const factCheck = await callWorkflow('04-Fact-Checker', {
        script: script,
        country: config.country,
        continent: config.continent,
        date: config.date
      });
      
      if (factCheck.overall_status === 'PASS') {
        factCheckPassed = true;
      } else {
        factCheckAttempts++;
        if (factCheckAttempts >= maxFactChecks) {
          return res.status(400).json({
            error: 'Max fact check attempts reached',
            factCheck: factCheck.output
          });
        }
        
        const recovery = await callWorkflow('05-Recovery', {
          factCheck: factCheck.output,
          country: config.country,
          continent: config.continent,
          date: config.date
        });
        
        const rewrite = await callWorkflow('03-Final-Writer', {
          approvedDraft: script,
          recoveryActions: recovery.output,
          voice: config.voice,
          music: config.music,
          isRewrite: true
        });
        
        script = rewrite.output;
      }
    }
    
    const finalReview = await callWorkflow('06-Final-Editor-Gate', {
      script: script,
      topics: config.topics,
      isFinal: true
    });
    
    if (finalReview.decision !== 'APPROVED' && finalReview.decision !== 'BBC CLEARED Phase 2') {
      return res.status(400).json({
        error: 'Final editor rejection',
        violations: finalReview.violations
      });
    }
    
    const audioResult = await callWorkflow('07-Audio-Producer', {
      script: script,
      voice: config.voice,
      music: config.music,
      country: config.country,
      timeframe: config.timeframe,
      date: config.date
    });
    
    const mp3Filename = `${config.country.name.replace(/\s+/g, '_')}_${config.timeframe.label.replace(/\s+/g, '_')}_${config.date}.mp3`;
    
    res.json({
      success: true,
      jobId: jobId,
      mp3Url: `/output/${mp3Filename}`,
      filename: mp3Filename,
      script: script,
      metadata: {
        country: config.country.name,
        timeframe: config.timeframe.label,
        topics: config.topics,
        voice: config.voice.label,
        editorAttempts: attempts,
        factCheckAttempts: factCheckAttempts,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error: any) {
    console.error(`[${jobId}] Error:`, error);
    res.status(500).json({
      error: 'Workflow failed',
      message: error.message
    });
  }
});

async function callWorkflow(workflowId: string, input: any): Promise<WorkflowResponse> {
  const response = await axios.post(AUTOGEN_URL, {
    workflow_id: workflowId,
    input: input
  }, {
    timeout: 300000,
    headers: { 'Content-Type': 'application/json' }
  });
  
  return response.data;
}

app.get('/api/outputs', (req, res) => {
  const outputDir = '/workspaces/autogen-newsroom/output';
  
  if (!fs.existsSync(outputDir)) {
    return res.json({ files: [] });
  }
  
  const files = fs.readdirSync(outputDir)
    .filter(f => f.endsWith('.mp3'))
    .map(f => ({
      filename: f,
      url: `/output/${f}`,
      created: fs.statSync(path.join(outputDir, f)).mtime
    }))
    .sort((a, b) => b.created.getTime() - a.created.getTime());
  
  res.json({ files });
});

app.listen(PORT, () => {
  console.log(`AI Newsroom API Server running on port ${PORT}`);
});
