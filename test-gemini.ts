import { GoogleGenAI } from "@google/genai";
import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log("No GEMINI_API_KEY found");
  } else {
    console.log("Found key starting with:", apiKey.substring(0, 5));
  }
  
  const ai = new GoogleGenAI({ apiKey });
  const models = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-2.5-flash", "gemini-3-flash-preview"];
  for (const model of models) {
    try {
      console.log(`Testing ${model}...`);
      const res = await ai.models.generateContent({
        model: model,
        contents: "hi",
      });
      console.log(`${model} SUCCESS: ${res?.text?.substring(0, 5)}`);
    } catch (e: any) {
      console.error(`${model} FAILED: ${e.message}`);
    }
  }
}
main();
