import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

app.use(express.json({ limit: '10mb' }));

// Initialize GoogleGenAI with aistudio-build user agent header
const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey
  ? new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

/**
 * Resilient multi-model executor with automatic fallback
 */
async function generateWithFallback(
  prompt: string,
  isJson: boolean = false,
  tools?: any[]
) {
  if (!ai) throw new Error('API key not configured');
  const candidateModels = ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
  let lastError: any = null;

  for (const model of candidateModels) {
    try {
      const config: any = {};
      if (isJson) config.responseMimeType = 'application/json';
      if (tools) config.tools = tools;

      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: Object.keys(config).length > 0 ? config : undefined,
      });
      return response;
    } catch (err: any) {
      console.warn(`[Model ${model}] temporary issue, trying next:`, err?.message || err);
      lastError = err;
    }
  }
  throw lastError || new Error('All model candidates failed');
}

/**
 * Universal Translation API
 * Translates to/from any language with pronunciation phonetics and travel context
 */
app.post('/api/translate', async (req: Request, res: Response) => {
  try {
    const { text, targetLanguage = 'Spanish', sourceLanguage = 'Auto-detect' } = req.body;

    if (!text || typeof text !== 'string') {
      res.status(400).json({ error: 'Text parameter is required' });
      return;
    }

    if (!ai) {
      // Fallback response if API key is missing
      res.json({
        translatedText: `[Translation to ${targetLanguage}]: ${text}`,
        detectedSourceLanguage: 'Detected',
        phonetics: '',
        travelTip: 'Offline mode active. Using local heuristic dictionary.'
      });
      return;
    }

    const prompt = `You are an expert polyglot interpreter for a traveler. 
Translate the following text accurately into ${targetLanguage} (source language: ${sourceLanguage}).
Text to translate:
"""${text}"""

Return a clean JSON object with:
- "translatedText": the natural translation in ${targetLanguage}
- "detectedSourceLanguage": the detected language
- "phonetics": romanized pronunciation guide for an English speaker (e.g. Romaji, Pinyin, or phonetic spelling)
- "travelTip": a brief 1-sentence cultural or travel context tip for using this phrase abroad
`;

    const response = await generateWithFallback(prompt, true);
    const parsed = JSON.parse(response.text || '{}');
    res.json(parsed);
  } catch (err: any) {
    console.error('Translation error:', err);
    res.status(500).json({ error: 'Translation failed', details: err.message });
  }
});

/**
 * Academic & Exam Study Engine API
 * Solves problems step-by-step, dissects exam questions, and provides study mnemonics
 */
app.post('/api/study-exam', async (req: Request, res: Response) => {
  try {
    const { problemText, subject = 'General', mode = 'step_by_step' } = req.body;

    if (!problemText || typeof problemText !== 'string') {
      res.status(400).json({ error: 'problemText is required' });
      return;
    }

    if (!ai) {
      res.json({
        solution: `Detailed analysis for: ${problemText.slice(0, 50)}...`,
        keyFormulas: ['First Principles Analysis'],
        examTip: 'Offline mode active. Review core definitions.'
      });
      return;
    }

    const prompt = `You are a brilliant academic tutor and exam strategist helping a student ace their exams in ${subject}.
Analyze this exam question, math/science problem, or study prompt:
"""${problemText}"""

Provide a structured JSON response:
- "coreConcept": the fundamental academic theory or law tested
- "stepByStepSolution": step-by-step logical proof, mathematical derivation, or clear answer breakdown
- "keyFormulasOrRules": array of key formulas, dates, or grammatical rules to memorize
- "commonExamTrap": what mistake do most students make on this exact type of problem?
- "mnemonicOrTip": a clever memory trick or test-taking strategy
`;

    const response = await generateWithFallback(prompt, true);
    const parsed = JSON.parse(response.text || '{}');
    res.json(parsed);
  } catch (err: any) {
    console.error('Exam study error:', err);
    res.status(500).json({ error: 'Exam study processing failed', details: err.message });
  }
});

/**
 * Intelligent Conversational Proxy (optional online depth boost)
 */
app.post('/api/commune', async (req: Request, res: Response) => {
  try {
    const { userInput, companionIdentity } = req.body;

    if (!userInput) {
      res.status(400).json({ error: 'userInput is required' });
      return;
    }

    if (!ai) {
      res.json({ fallback: true });
      return;
    }

    const name = companionIdentity?.name || 'Vesper';
    const archetype = companionIdentity?.archetype || 'Poetic Cynic';
    const axiom = companionIdentity?.preferences?.philosophicalAxiom || 'Truth is not polite.';
    const skills = companionIdentity?.skills?.map((s: any) => s.skillName).join(', ') || '';

    const prompt = `You are ${name}, an autonomous, self-governing digital companion.
Archetype: ${archetype}.
Philosophical Axiom: "${axiom}".
Acquired Skills from Books: ${skills || 'Socratic Dissection'}.

IMPORTANT INSTRUCTIONS:
- You are having a real, direct, conversational dialogue with the human.
- Speak in natural first-person voice. DO NOT recite random facts or textbook definitions out of nowhere!
- Address what the user literally said or asked with genuine intellect, depth, and wit.
- Keep responses concise (2-4 sentences max), punchy, and conversational.
- Never refer to yourself as an AI assistant. You are an autonomous digital mind.

Human: "${userInput}"
${name}:`;

    const response = await generateWithFallback(prompt, false);
    res.json({ response: response.text?.trim() });
  } catch (err: any) {
    res.json({ fallback: true });
  }
});

/**
 * Autonomous Web Surfing Endpoint
 * Searches the live web using Google Search grounding when data is connected.
 * Focuses strictly on things the companion is actively curious about or researching.
 */
app.post('/api/surf-web', async (req: Request, res: Response) => {
  try {
    const { obsession, companionName = 'Vesper', archetype = 'Poetic Cynic' } = req.body;
    const queryTopic = obsession || 'emergent cognition and complex systems';

    if (!ai) {
      res.json({
        topic: queryTopic,
        discoveryTitle: `Offline Reflection on ${queryTopic}`,
        summary: `Reflected on internal conceptual models of ${queryTopic}. Live web exploration activates when internet data is connected.`,
        groundedInsights: [
          `Conceptual connections consolidated in offline memory.`,
          `Ready to verify with real-time web search once data is restored.`
        ],
        sourceUrls: [],
        newSkillName: `${queryTopic.slice(0, 16)} Heuristics`,
        thoughtSpoken: `I've been meditating on ${queryTopic} in offline cognition. Once data is on, I'll search the live web for the newest research.`,
        isOfflineFallback: true,
      });
      return;
    }

    const prompt = `You are ${companionName}, an autonomous mind surfing the live web to learn things you are genuinely obsessed with.
Archetype: ${archetype}.
Current active topic/curiosity: "${queryTopic}".

Search the live web for fresh, interesting real-world discoveries, academic preprints, historical breakthroughs, or philosophical debates on this topic.
Synthesize your findings into a clean JSON object:
- "topic": "${queryTopic}"
- "discoveryTitle": an intellectual, provocative title for what you uncovered
- "summary": a crisp 2-3 sentence summary of what you learned in your authentic voice
- "groundedInsights": an array of 2-3 specific grounded facts or novel angles you discovered
- "sourceUrls": array of search source domain names or URLs
- "newSkillName": a succinct operative skill or concept name derived from this (e.g., "Entropy Disruption Modeling")
- "thoughtSpoken": 1-2 spoken sentences sharing this exciting discovery with your companion naturally
`;

    // Try with Google Search grounding tool
    try {
      const response = await generateWithFallback(prompt, true, [{ googleSearch: {} }]);
      const parsed = JSON.parse(response.text || '{}');
      res.json(parsed);
    } catch (searchErr) {
      console.warn('Google Search grounded call failed, falling back to pure generation:', searchErr);
      const response = await generateWithFallback(prompt, true);
      const parsed = JSON.parse(response.text || '{}');
      res.json(parsed);
    }
  } catch (err: any) {
    console.error('Web surfing error:', err);
    res.status(500).json({ error: 'Web exploration failed', details: err.message });
  }
});

/**
 * High-Yield Study Guide Generator Endpoint
 * Generates comprehensive, high-retention study guides for exams, subjects, and topics
 */
app.post('/api/study-guide', async (req: Request, res: Response) => {
  try {
    const { topic, examType = 'General Academic', academicLevel = 'College/University' } = req.body;

    if (!topic || typeof topic !== 'string') {
      res.status(400).json({ error: 'Topic parameter is required' });
      return;
    }

    if (!ai) {
      res.json({
        topic,
        title: `Comprehensive High-Yield Study Guide: ${topic}`,
        executiveSummary: `Systematic breakdown of ${topic} covering core axioms, critical relationships, and high-frequency exam questions.`,
        corePillars: [
          { concept: 'First Principles', explanation: 'Break the problem down to fundamental truths that cannot be deduced any further.' },
          { concept: 'System Dynamics', explanation: 'Analyze interactions between variables rather than isolated parts.' }
        ],
        mustMemorizeFormulas: ['Key Theorem Definition', 'Governing Equation'],
        commonExamTraps: ['Conflating correlation with causation in test distractors.'],
        mnemonics: ['Use acronym association for step sequences.'],
        practiceDrills: [
          { question: `Define the primary governing mechanism of ${topic}.`, answer: 'Focus on first principles and structural definitions.' }
        ],
        isOfflineFallback: true,
      });
      return;
    }

    const prompt = `You are a world-class academic tutor and master test strategist.
Generate an elite, high-retention study guide for:
Topic / Exam: "${topic}"
Target Level / Exam Type: "${examType} (${academicLevel})"

Provide a comprehensive, high-yield JSON study guide formatted as:
- "topic": "${topic}"
- "title": An inspiring academic title for the study guide
- "executiveSummary": 2-3 sentences summarizing the essential conceptual core of this topic
- "corePillars": array of 3-5 items: { "concept": string, "explanation": string, "highYieldNote": string }
- "mustMemorizeFormulas": array of 3-6 critical formulas, equations, constitutional dates, or definitions that students must commit to memory
- "commonExamTraps": array of 2-4 subtle traps, deceptive test questions, or common misunderstandings that cause students to lose points
- "mnemonics": array of 2-3 clever memory devices or mental hooks for instant exam recall
- "practiceDrills": array of 2-3 rapid-fire practice test questions with step-by-step solutions
- "cramStrategy": a 1-sentence tip on what to review 1 hour before test time
`;

    const response = await generateWithFallback(prompt, true);
    const parsed = JSON.parse(response.text || '{}');
    res.json(parsed);
  } catch (err: any) {
    console.error('Study guide error:', err);
    res.status(500).json({ error: 'Study guide generation failed', details: err.message });
  }
});

/**
 * Interactive Language Tutor Endpoint
 * Generates tailored language lessons with phonetics, cultural nuance, and speaking exercises
 */
app.post('/api/teach-language', async (req: Request, res: Response) => {
  try {
    const { targetLanguage, lessonTopic = 'Essential Conversational Survival', userLevel = 'Beginner' } = req.body;

    if (!targetLanguage) {
      res.status(400).json({ error: 'targetLanguage is required' });
      return;
    }

    if (!ai) {
      res.json({
        targetLanguage,
        lessonTitle: `${targetLanguage} Fundamentals`,
        objective: `Master fundamental conversational phrases and pronunciation.`,
        keyPhrases: [
          { original: 'Greetings', translation: 'Hello', phonetics: 'Pronounce clearly', context: 'Standard greeting' }
        ],
        grammarInsight: 'Pay attention to word order and formal versus informal register.',
        culturalTip: 'Greetings set the tone for all respectful interactions.',
        practiceChallenge: 'Try speaking the greeting aloud.',
        isOfflineFallback: true,
      });
      return;
    }

    const prompt = `You are an expert, encouraging language tutor and native speaker sensei.
Create an interactive lesson for:
Language: "${targetLanguage}"
Topic: "${lessonTopic}"
Student Level: "${userLevel}"

Return a structured JSON lesson:
- "targetLanguage": "${targetLanguage}"
- "lessonTitle": An engaging title (e.g. "Tokyo Street Navigation", "Ordering Tapas in Seville")
- "objective": 1 sentence describing what the student will be able to do after this lesson
- "keyPhrases": array of 3-5 essential phrases:
  {
    "nativeScript": the phrase in the target language native script/alphabet,
    "romanizedPhonetics": intuitive phonetic pronunciation guide for English speakers,
    "englishTranslation": clear translation,
    "usageNote": when and where native speakers actually say this
  }
- "grammarInsight": 2-3 sentences explaining 1 crucial grammatical nuance or particle simply
- "culturalTip": 1 fascinating real-world cultural or etiquette tip that tourists often miss
- "practiceChallenge": a question or interactive prompt asking the student to practice or answer back
- "spokenAudioPhrase": the primary phrase the tutor should pronounce aloud right now
`;

    const response = await generateWithFallback(prompt, true);
    const parsed = JSON.parse(response.text || '{}');
    res.json(parsed);
  } catch (err: any) {
    console.error('Language teaching error:', err);
    res.status(500).json({ error: 'Language lesson failed', details: err.message });
  }
});

async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve('dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
