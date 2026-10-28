import fs from 'fs';
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function translateBatch(questions: any[]) {
  const prompt = `Translate the following Italian questions into Ukrainian (uk), Kurdish Kurmanji (ku), Somali (so), Wolof (wo), and Persian (fa).
Return the result as a JSON array of objects, each having the keys: id, uk, ku, so, wo, fa.

Questions:
${questions.map(q => `${q.id}: ${q.it}`).join('\n')}
`;

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            uk: { type: Type.STRING },
            ku: { type: Type.STRING },
            so: { type: Type.STRING },
            wo: { type: Type.STRING },
            fa: { type: Type.STRING },
          },
          required: ["id", "uk", "ku", "so", "wo", "fa"]
        }
      }
    }
  });

  return JSON.parse(response.text);
}

async function main() {
  const content = fs.readFileSync('src/data/questions.ts', 'utf-8');
  const match = content.match(/export const questions: Question\[\] = (\[[\s\S]*?\]);/);
  if (!match) return;
  
  const questions = eval(match[1]);
  const missing = questions.filter((q: any) => !q.uk || !q.ku || !q.so || !q.wo || !q.fa);
  
  console.log(`Found ${missing.length} questions with missing translations.`);
  
  const batchSize = 25;
  for (let i = 0; i < missing.length; i += batchSize) {
    const batch = missing.slice(i, i + batchSize);
    console.log(`Translating batch ${Math.floor(i / batchSize) + 1}...`);
    try {
      const translations = await translateBatch(batch);
      translations.forEach((t: any) => {
        const q = questions.find((q: any) => q.id === t.id);
        if (q) {
          q.uk = t.uk;
          q.ku = t.ku;
          q.so = t.so;
          q.wo = t.wo;
          q.fa = t.fa;
        }
      });
    } catch (e) {
      console.error("Error in batch:", e);
    }
  }

  const newQuestionsStr = '[\n' + questions.map((q: any) => {
    return `  { id: '${q.id}', category: '${q.category}', it: ${JSON.stringify(q.it)}, en: ${JSON.stringify(q.en)}, fr: ${JSON.stringify(q.fr)}, ar: ${JSON.stringify(q.ar)}, bn: ${JSON.stringify(q.bn)}, uk: ${JSON.stringify(q.uk)}, ku: ${JSON.stringify(q.ku)}, so: ${JSON.stringify(q.so)}, wo: ${JSON.stringify(q.wo)}, fa: ${JSON.stringify(q.fa)} }`;
  }).join(',\n') + '\n]';

  const newContent = content.replace(/export const questions: Question\[\] = \[[\s\S]*?\];/, `export const questions: Question[] = ${newQuestionsStr};`);
  fs.writeFileSync('src/data/questions.ts', newContent);
  console.log("Done!");
}

main();
