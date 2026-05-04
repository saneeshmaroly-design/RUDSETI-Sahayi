import { GoogleGenAI } from "@google/genai";

// Initialization with lazy access to environment variable
let aiClient: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required");
    }
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

export async function generateChatResponse(prompt: string, systemInstruction: string) {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      systemInstruction,
      temperature: 0.7,
      topP: 0.95,
      topK: 64,
    },
  });
  return response.text;
}
