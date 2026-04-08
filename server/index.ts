import express from 'express';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const AUTOGEN_URL = process.env.AUTOGEN_URL || 'http://localhost:8080/api/runs';

app.use(cors());
app.use(express.json());
app.use('/output', express.static('/workspaces/autogen-newsroom/output'));

// Workflow state storage (in-memory with file persistence)
const WORKFLOW_STATE_DIR = '/workspaces/autogen-newsroom/workflow_states';
if (!fs.existsSync(WORKFLOW_STATE_DIR)) {
  fs.mkdirSync(WORKFLOW_STATE_DIR, { recursive: true });
}

// Workflow states in memory
const workflowStates = new Map<string, WorkflowState>();

// Load existing states from disk
function loadWorkflowStates() {
  try {
    const files = fs.readdirSync(WORKFLOW_STATE_DIR);
    for (const file of files) {
      if (file.endsWith('.json')) {
        const sessionId = file.replace('.json', '');
        const data = fs.readFileSync(path.join(WORKFLOW_STATE_DIR, file), 'utf-8');
        const state = JSON.parse(data) as WorkflowState;
        // Check if timed out
        if (state.workflowState !== 'complete' && state.workflowState !== 'error' && state.workflowState !== 'timeout') {
          const lastUpdated = new Date(state.lastUpdated).getTime();
          const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;
          if (lastUpdated < thirtyMinutesAgo) {
            state.workflowState = 'timeout';
            state.error = 'Workflow timed out - no user response within 30 minutes';
          }
        }
        workflowStates.set(sessionId, state);
      }
    }
  } catch (error) {
    console.error('Error loading workflow states:', error);
  }
}

// Save workflow state to disk
function saveWorkflowState(sessionId: string, state: WorkflowState) {
  state.lastUpdated = new Date().toISOString();
  workflowStates.set(sessionId, state);
  try {
    fs.writeFileSync(
      path.join(WORKFLOW_STATE_DIR, `${sessionId}.json`),
      JSON.stringify(state, null, 2)
    );
  } catch (error) {
    console.error('Error saving workflow state:', error);
  }
}

// Clean up old workflow states
function cleanupOldStates() {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [sessionId, state] of workflowStates.entries()) {
    const lastUpdated = new Date(state.lastUpdated).getTime();
    if (lastUpdated < oneHourAgo) {
      workflowStates.delete(sessionId);
      try {
        fs.unlinkSync(path.join(WORKFLOW_STATE_DIR, `${sessionId}.json`));
      } catch (error) {
        // Ignore errors
      }
    }
  }
}

// Run cleanup every 10 minutes
setInterval(cleanupOldStates, 10 * 60 * 1000);

// Load states on startup
loadWorkflowStates();

// Types
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

interface Story {
  id: string;
  headline: string;
  summary: string;
  newsRating: number;
  source: string;
  originalLanguage: string;
  section: 'local' | 'continent';
  url?: string;
}

interface FailedStory {
  storyId: string;
  headline: string;
  reason: string;
}

interface WorkflowState {
  sessionId: string;
  workflowState: 'running' | 'awaiting_selection' | 'awaiting_replacement' | 'error' | 'complete' | 'timeout';
  currentStep: string;
  progress: number;
  config: PodcastConfig;
  
  // Research phase
  researchOutput?: {
    localStories: Story[];
    continentStories: Story[];
  };
  
  // User selections
  userSelection?: {
    localStoryIds: string[];
    continentStoryIds: string[];
  };
  
  // Recovery phase
  failedStory?: FailedStory;
  replacementOptions?: Story[];
  
  // Script and final output
  draftScript?: string;
  finalScript?: string;
  mp3Url?: string;
  filename?: string;
  
  // Metadata
  editorAttempts: number;
  factCheckAttempts: number;
  lastUpdated: string;
  error?: string;
  
  // Resume promise resolver
  resumePromise?: {
    resolve: (value: any) => void;
    reject: (reason: any) => void;
  };
}

interface WorkflowResponse {
  output: any;
  decision?: 'APPROVED' | 'REJECTED' | 'BBC CLEARED Phase 2';
  reason?: string;
  overall_status?: 'PASS' | 'ISSUES_FOUND';
  violations?: string[];
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start podcast generation - returns sessionId immediately
app.post('/api/generate-podcast/start', async (req, res) => {
  const config: PodcastConfig = req.body;
  const sessionId = uuidv4();
  
  const state: WorkflowState = {
    sessionId,
    workflowState: 'running',
    currentStep: 'researching',
    progress: 10,
    config,
    editorAttempts: 0,
    factCheckAttempts: 0,
    lastUpdated: new Date().toISOString()
  };
  
  saveWorkflowState(sessionId, state);
  
  // Start workflow in background
  runWorkflow(sessionId, state).catch(error => {
    console.error(`[${sessionId}] Workflow error:`, error);
    const currentState = workflowStates.get(sessionId);
    if (currentState) {
      currentState.workflowState = 'error';
      currentState.error = error.message;
      saveWorkflowState(sessionId, currentState);
    }
  });
  
  res.json({ sessionId, status: 'started' });
});

// Get workflow status
app.get('/api/workflow/:sessionId/status', (req, res) => {
  const { sessionId } = req.params;
  const state = workflowStates.get(sessionId);
  
  if (!state) {
    return res.status(404).json({ error: 'Workflow not found' });
  }
  
  // Check for timeout
  if (state.workflowState === 'awaiting_selection' || state.workflowState === 'awaiting_replacement') {
    const lastUpdated = new Date(state.lastUpdated).getTime();
    const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;
    if (lastUpdated < thirtyMinutesAgo) {
      state.workflowState = 'timeout';
      state.error = 'Workflow timed out - no user response within 30 minutes';
      saveWorkflowState(sessionId, state);
      
      // Reject the resume promise if it exists
      if (state.resumePromise) {
        state.resumePromise.reject(new Error('Timeout'));
      }
    }
  }
  
  res.json({
    sessionId: state.sessionId,
    workflowState: state.workflowState,
    currentStep: state.currentStep,
    progress: state.progress,
    researchOutput: state.researchOutput,
    failedStory: state.failedStory,
    replacementOptions: state.replacementOptions,
    error: state.error,
    mp3Url: state.mp3Url,
    filename: state.filename
  });
});

// Submit story selection
app.post('/api/workflow/:sessionId/select-stories', async (req, res) => {
  const { sessionId } = req.params;
  const { localStoryIds, continentStoryIds } = req.body;
  
  const state = workflowStates.get(sessionId);
  if (!state) {
    return res.status(404).json({ error: 'Workflow not found' });
  }
  
  if (state.workflowState !== 'awaiting_selection') {
    return res.status(400).json({ error: 'Workflow is not awaiting story selection' });
  }
  
  // Validate selection counts
  if (localStoryIds.length !== 5) {
    return res.status(400).json({ error: 'Must select exactly 5 local stories' });
  }
  if (continentStoryIds.length !== 3) {
    return res.status(400).json({ error: 'Must select exactly 3 continent stories' });
  }
  
  // Update state
  state.userSelection = { localStoryIds, continentStoryIds };
  state.workflowState = 'running';
  state.currentStep = 'writing';
  state.progress = 30;
  saveWorkflowState(sessionId, state);
  
  // Resume the workflow
  if (state.resumePromise) {
    state.resumePromise.resolve({ localStoryIds, continentStoryIds });
  }
  
  res.json({ success: true, message: 'Story selection submitted' });
});

// Submit replacement selection
app.post('/api/workflow/:sessionId/select-replacement', async (req, res) => {
  const { sessionId } = req.params;
  const { selectedStoryId, removeStory } = req.body;
  
  const state = workflowStates.get(sessionId);
  if (!state) {
    return res.status(404).json({ error: 'Workflow not found' });
  }
  
  if (state.workflowState !== 'awaiting_replacement') {
    return res.status(400).json({ error: 'Workflow is not awaiting replacement selection' });
  }
  
  // Update state
  state.workflowState = 'running';
  state.currentStep = 'rewriting';
  state.progress = 60;
  saveWorkflowState(sessionId, state);
  
  // Resume the workflow
  if (state.resumePromise) {
    state.resumePromise.resolve({ selectedStoryId, removeStory });
  }
  
  res.json({ success: true, message: 'Replacement selection submitted' });
});

// Legacy endpoint for backward compatibility
app.post('/api/generate-podcast', async (req, res) => {
  try {
    const config: PodcastConfig = req.body;
    const sessionId = uuidv4();
    
    const state: WorkflowState = {
      sessionId,
      workflowState: 'running',
      currentStep: 'researching',
      progress: 10,
      config,
      editorAttempts: 0,
      factCheckAttempts: 0,
      lastUpdated: new Date().toISOString()
    };
    
    saveWorkflowState(sessionId, state);
    
    // Run workflow synchronously
    await runWorkflow(sessionId, state);
    
    const finalState = workflowStates.get(sessionId);
    if (!finalState) {
      return res.status(500).json({ error: 'Workflow state lost' });
    }
    
    if (finalState.workflowState === 'error') {
      return res.status(500).json({ error: finalState.error });
    }
    
    if (finalState.workflowState === 'timeout') {
      return res.status(408).json({ error: 'Workflow timed out' });
    }
    
    res.json({
      success: true,
      jobId: sessionId,
      mp3Url: finalState.mp3Url,
      filename: finalState.filename,
      script: finalState.finalScript,
      metadata: {
        country: finalState.config.country.name,
        timeframe: finalState.config.timeframe.label,
        topics: finalState.config.topics,
        voice: finalState.config.voice.label,
        editorAttempts: finalState.editorAttempts,
        factCheckAttempts: finalState.factCheckAttempts,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('Workflow error:', error);
    res.status(500).json({
      error: 'Workflow failed',
      message: error.message
    });
  }
});

// Main workflow runner
async function runWorkflow(sessionId: string, state: WorkflowState): Promise<void> {
  try {
    const { config } = state;
    
    // Step 1: Research - this now returns ALL stories and pauses for selection
    console.log(`[${sessionId}] Starting research phase`);
    state.currentStep = 'researching';
    state.progress = 10;
    saveWorkflowState(sessionId, state);
    
    const researchResult = await callResearchWorkflow(config);
    
    // Store research output
    state.researchOutput = {
      localStories: researchResult.localStories,
      continentStories: researchResult.continentStories
    };
    
    // Pause for human selection
    state.workflowState = 'awaiting_selection';
    state.currentStep = 'awaiting_story_selection';
    state.progress = 20;
    saveWorkflowState(sessionId, state);
    
    console.log(`[${sessionId}] Paused for story selection`);
    
    // Wait for user selection
    const userSelection = await waitForUserSelection(sessionId, state);
    
    // Get selected stories
    const selectedLocalStories = researchResult.localStories.filter(
      s => userSelection.localStoryIds.includes(s.id)
    );
    const selectedContinentStories = researchResult.continentStories.filter(
      s => userSelection.continentStoryIds.includes(s.id)
    );
    
    // Create initial draft from selected stories
    let draft = await createInitialDraft(selectedLocalStories, selectedContinentStories, config);
    state.draftScript = draft;
    saveWorkflowState(sessionId, state);
    
    // Step 2: Editor Review Loop
    let approved = false;
    const maxAttempts = 3;
    
    while (!approved && state.editorAttempts < maxAttempts) {
      state.currentStep = 'editing';
      state.progress = 30 + state.editorAttempts * 5;
      saveWorkflowState(sessionId, state);
      
      const editorReview = await callWorkflow('02-Editor-Review', {
        draft: draft,
        topics: config.topics,
        timeframe: config.timeframe,
        attempt: state.editorAttempts + 1
      });
      
      if (editorReview.decision === 'APPROVED') {
        approved = true;
      } else {
        state.editorAttempts++;
        if (state.editorAttempts >= maxAttempts) {
          throw new Error(`Max editor attempts reached: ${editorReview.reason}`);
        }
        
        // Retry research with feedback
        const researchRetry = await callResearchWorkflow(config, draft, editorReview.reason);
        
        // Pause again for selection on retry
        state.researchOutput = {
          localStories: researchRetry.localStories,
          continentStories: researchRetry.continentStories
        };
        state.workflowState = 'awaiting_selection';
        state.currentStep = 'awaiting_story_selection_retry';
        saveWorkflowState(sessionId, state);
        
        const retrySelection = await waitForUserSelection(sessionId, state);
        
        const retryLocalStories = researchRetry.localStories.filter(
          s => retrySelection.localStoryIds.includes(s.id)
        );
        const retryContinentStories = researchRetry.continentStories.filter(
          s => retrySelection.continentStoryIds.includes(s.id)
        );
        
        draft = await createInitialDraft(retryLocalStories, retryContinentStories, config);
        state.draftScript = draft;
        saveWorkflowState(sessionId, state);
      }
    }
    
    // Step 3: Final Writer
    state.currentStep = 'writing';
    state.progress = 50;
    saveWorkflowState(sessionId, state);
    
    const finalScriptResult = await callWorkflow('03-Final-Writer', {
      approvedDraft: draft,
      voice: config.voice,
      music: config.music
    });
    
    let script = finalScriptResult.output;
    
    // Step 4: Fact Check Loop
    let factCheckPassed = false;
    const maxFactChecks = 3;
    
    while (!factCheckPassed && state.factCheckAttempts < maxFactChecks) {
      state.currentStep = 'fact-checking';
      state.progress = 60 + state.factCheckAttempts * 5;
      saveWorkflowState(sessionId, state);
      
      const factCheck = await callWorkflow('04-Fact-Checker', {
        script: script,
        country: config.country,
        continent: config.continent,
        date: config.date
      });
      
      if (factCheck.overall_status === 'PASS') {
        factCheckPassed = true;
      } else {
        state.factCheckAttempts++;
        if (state.factCheckAttempts >= maxFactChecks) {
          throw new Error('Max fact check attempts reached');
        }
        
        // Find failed stories
        const failedStories = factCheck.output?.stories?.filter(
          (s: any) => s.grade === 'FACT CHECK FAILED'
        ) || [];
        
        if (failedStories.length === 0) {
          // No failed stories, just issues - try rewrite
          const rewrite = await callWorkflow('03-Final-Writer', {
            approvedDraft: script,
            recoveryActions: { fix_issues: true },
            voice: config.voice,
            music: config.music,
            isRewrite: true
          });
          script = rewrite.output;
        } else {
          // Handle first failed story with human in the loop
          const failedStory = failedStories[0];
          
          // Call recovery researcher to find alternatives
          const recovery = await callRecoveryWorkflow(failedStory, config);
          
          // Pause for replacement selection
          state.failedStory = {
            storyId: failedStory.story_id,
            headline: failedStory.headline,
            reason: failedStory.unverified_claims?.join(', ') || 'Fact check failed'
          };
          state.replacementOptions = recovery.alternatives;
          state.workflowState = 'awaiting_replacement';
          state.currentStep = 'awaiting_replacement_selection';
          saveWorkflowState(sessionId, state);
          
          console.log(`[${sessionId}] Paused for replacement selection`);
          
          // Wait for user replacement selection
          const replacementSelection = await waitForReplacementSelection(sessionId, state);
          
          // Apply replacement
          if (replacementSelection.removeStory) {
            // Remove the story from script
            script = await removeStoryFromScript(script, failedStory.story_id);
          } else if (replacementSelection.selectedStoryId) {
            // Replace with selected alternative
            const selectedAlternative = recovery.alternatives.find(
              a => a.id === replacementSelection.selectedStoryId
            );
            if (selectedAlternative) {
              script = await replaceStoryInScript(script, failedStory.story_id, selectedAlternative);
            }
          }
          
          // Rewrite with replacement
          const rewrite = await callWorkflow('03-Final-Writer', {
            approvedDraft: script,
            recoveryActions: { story_replaced: true },
            voice: config.voice,
            music: config.music,
            isRewrite: true
          });
          script = rewrite.output;
        }
      }
    }
    
    // Step 5: Final Editor Gate
    state.currentStep = 'final-review';
    state.progress = 85;
    saveWorkflowState(sessionId, state);
    
    const finalReview = await callWorkflow('06-Final-Editor-Gate', {
      script: script,
      topics: config.topics,
      isFinal: true
    });
    
    if (finalReview.decision !== 'APPROVED' && finalReview.decision !== 'BBC CLEARED Phase 2') {
      throw new Error(`Final editor rejection: ${finalReview.violations?.join(', ')}`);
    }
    
    state.finalScript = script;
    saveWorkflowState(sessionId, state);
    
    // Step 6: Audio Production
    state.currentStep = 'producing';
    state.progress = 90;
    saveWorkflowState(sessionId, state);
    
    const audioResult = await callWorkflow('07-Audio-Producer', {
      script: script,
      voice: config.voice,
      music: config.music,
      country: config.country,
      timeframe: config.timeframe,
      date: config.date
    });
    
    const mp3Filename = `${config.country.name.replace(/\s+/g, '_')}_${config.timeframe.label.replace(/\s+/g, '_')}_${config.date}.mp3`;
    
    state.workflowState = 'complete';
    state.currentStep = 'complete';
    state.progress = 100;
    state.mp3Url = `/output/${mp3Filename}`;
    state.filename = mp3Filename;
    saveWorkflowState(sessionId, state);
    
    console.log(`[${sessionId}] Workflow completed successfully`);
    
  } catch (error: any) {
    console.error(`[${sessionId}] Workflow error:`, error);
    state.workflowState = 'error';
    state.error = error.message;
    saveWorkflowState(sessionId, state);
    throw error;
  }
}

// Wait for user story selection
async function waitForUserSelection(sessionId: string, state: WorkflowState): Promise<{ localStoryIds: string[]; continentStoryIds: string[] }> {
  return new Promise((resolve, reject) => {
    // Store promise resolvers in state
    state.resumePromise = { resolve, reject };
    
    // Set timeout
    const timeoutId = setTimeout(() => {
      state.workflowState = 'timeout';
      state.error = 'Workflow timed out - no user response within 30 minutes';
      saveWorkflowState(sessionId, state);
      reject(new Error('Timeout'));
    }, 30 * 60 * 1000);
    
    // Override resolve to clear timeout
    const originalResolve = resolve;
    resolve = (value) => {
      clearTimeout(timeoutId);
      originalResolve(value);
    };
    
    // Update state with new resolve
    state.resumePromise = { resolve, reject };
  });
}

// Wait for user replacement selection
async function waitForReplacementSelection(sessionId: string, state: WorkflowState): Promise<{ selectedStoryId?: string; removeStory: boolean }> {
  return new Promise((resolve, reject) => {
    // Store promise resolvers in state
    state.resumePromise = { resolve, reject };
    
    // Set timeout
    const timeoutId = setTimeout(() => {
      state.workflowState = 'timeout';
      state.error = 'Workflow timed out - no user response within 30 minutes';
      saveWorkflowState(sessionId, state);
      reject(new Error('Timeout'));
    }, 30 * 60 * 1000);
    
    // Override resolve to clear timeout
    const originalResolve = resolve;
    resolve = (value) => {
      clearTimeout(timeoutId);
      originalResolve(value);
    };
    
    // Update state with new resolve
    state.resumePromise = { resolve, reject };
  });
}

// Call research workflow
async function callResearchWorkflow(
  config: PodcastConfig,
  previousDraft?: string,
  editorFeedback?: string
): Promise<{ localStories: Story[]; continentStories: Story[] }> {
  const response = await axios.post(AUTOGEN_URL, {
    workflow_id: '01-Research',
    input: {
      country: config.country,
      continent: config.continent,
      timeframe: config.timeframe,
      topics: config.topics,
      date: config.date,
      previousDraft,
      editorFeedback
    }
  }, {
    timeout: 300000,
    headers: { 'Content-Type': 'application/json' }
  });
  
  // Parse the research output - expecting JSON with all ranked stories
  const output = response.data.output;
  
  if (typeof output === 'string') {
    // Try to extract JSON from string
    const jsonMatch = output.match(/```json\n?([\s\S]*?)\n?```/) || 
                      output.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      return {
        localStories: parsed.localStories || [],
        continentStories: parsed.continentStories || []
      };
    }
  }
  
  return {
    localStories: output.localStories || [],
    continentStories: output.continentStories || []
  };
}

// Call recovery workflow
async function callRecoveryWorkflow(failedStory: any, config: PodcastConfig): Promise<{ alternatives: Story[] }> {
  const response = await axios.post(AUTOGEN_URL, {
    workflow_id: '05-Recovery',
    input: {
      failedStory,
      country: config.country,
      continent: config.continent,
      date: config.date
    }
  }, {
    timeout: 300000,
    headers: { 'Content-Type': 'application/json' }
  });
  
  const output = response.data.output;
  
  if (typeof output === 'string') {
    const jsonMatch = output.match(/```json\n?([\s\S]*?)\n?```/) || 
                      output.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      return { alternatives: parsed.alternatives || [] };
    }
  }
  
  return { alternatives: output.alternatives || [] };
}

// Create initial draft from selected stories
async function createInitialDraft(
  localStories: Story[],
  continentStories: Story[],
  config: PodcastConfig
): Promise<string> {
  // Call the writer to create initial draft
  const response = await axios.post(AUTOGEN_URL, {
    workflow_id: '03-Final-Writer',
    input: {
      selectedStories: {
        local: localStories,
        continent: continentStories
      },
      voice: config.voice,
      music: config.music,
      isInitialDraft: true
    }
  }, {
    timeout: 300000,
    headers: { 'Content-Type': 'application/json' }
  });
  
  return response.data.output;
}

// Remove story from script
async function removeStoryFromScript(script: string, storyId: string): Promise<string> {
  // This would be handled by the writer agent
  // For now, return script as-is (writer will handle removal)
  return script;
}

// Replace story in script
async function replaceStoryInScript(script: string, storyId: string, replacement: Story): Promise<string> {
  // This would be handled by the writer agent
  // For now, return script as-is (writer will handle replacement)
  return script;
}

// Generic workflow caller
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

// List outputs
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
