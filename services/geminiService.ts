import { GoogleGenAI, Type } from "@google/genai";
import { HandData } from "../types";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

const modelId = "gemini-2.5-flash"; // Fast model for near real-time

const SYSTEM_INSTRUCTION = `
You are a vision analyzer for a 3D web experience. 
Analyze the image to detect a human hand.
1. Determine if the hand is OPEN (fingers spread, palm visible) or CLOSED (fist/grasping).
2. Estimate the center position of the hand in the frame (x, y) where 0,0 is top-left and 1,1 is bottom-right.
3. If no hand is clearly visible, return UNKNOWN.

Output JSON only.
`;

export const analyzeFrame = async (base64Image: string): Promise<HandData> => {
  if (!apiKey) {
    console.warn("No API Key provided");
    return { state: 'UNKNOWN', x: 0.5, y: 0.5 };
  }

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: {
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: base64Image } },
          { text: "Analyze hand state and position." }
        ]
      },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            state: { type: Type.STRING, enum: ['OPEN', 'CLOSED', 'UNKNOWN'] },
            x: { type: Type.NUMBER },
            y: { type: Type.NUMBER }
          },
          required: ['state', 'x', 'y']
        }
      }
    });

    if (response.text) {
      const data = JSON.parse(response.text) as HandData;
      return data;
    }
  } catch (error) {
    console.error("Gemini Vision Error:", error);
  }

  return { state: 'UNKNOWN', x: 0.5, y: 0.5 };
};