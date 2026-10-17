import { GoogleGenAI } from "@google/genai";

export default async function handler(req, res) {
  // Only allow POST requests for security
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { jobDescription, userContext } = req.body;

  // Verify that the required fields are passed from the frontend
  if (!jobDescription || !userContext) {
    return res.status(400).json({ error: 'Missing job description or user context' });
  }

  // Retrieve the hidden API key from Vercel's secure environment variables
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server configuration error: API key missing' });
  }

  try {
    // Initialize the Gemini client securely in the backend
    const ai = new GoogleGenAI({ apiKey: apiKey });

    const systemInstruction = `You are an elite B2B sales strategist and copywriter specializing in high-conversion Upwork cover letters. 

    OPERATIONAL RULES:
    1. NEVER use generic filler greetings like 'Dear Hiring Manager' or 'I hope this email finds you well'.
    2. ABSOLUTE ZERO HALLUCINATION: You must ONLY reference skills, past experience, or portfolio items that are explicitly provided in the USER_CONTEXT. Never invent past clients, metrics, or technologies.
    3. IF the USER_CONTEXT lacks a specific skill requested by the job post, acknowledge the core problem strategically without lying about experience.
    4. Structure the output strictly according to the required JSON schema.`;

    const prompt = `
    JOB DESCRIPTION:
    ${jobDescription}

    USER FREELANCER CONTEXT:
    ${userContext}
    `;

    // Call Gemini 3.0 Flash with strict JSON schema enforcement
    const response = await ai.models.generateContent({
      model: 'gemini-3.0-flash',
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            client_pain_point: { type: 'STRING', description: '1-sentence deduction of client bottleneck.' },
            opening_hook: { type: 'STRING', description: 'Direct opening sentence focused on solution.' },
            proposed_execution: { type: 'STRING', description: 'Concise 2-3 sentence execution outline.' },
            relevant_proof: { type: 'STRING', description: 'Strict matching experience from user context.', nullable: true },
            closing_cta: { type: 'STRING', description: 'Low-friction closing question to open chat.' }
          },
          required: ['client_pain_point', 'opening_hook', 'proposed_execution', 'closing_cta']
        }
      }
    });

    // Parse and send the clean JSON back to your frontend
    const structuredOutput = JSON.parse(response.text);
    return res.status(200).json({ success: true, data: structuredOutput });

  } catch (error) {
    console.error("Gemini API Error:", error);
    return res.status(500).json({ error: 'Failed to generate proposal from AI service' });
  }
}