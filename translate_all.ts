import * as fs from 'fs';
import { GoogleGenAI, Type } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("ERRORE: GEMINI_API_KEY non configurata!");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

// All target languages matching the fields in Question and LANGUAGES_POOL_STATIC
const LANGUAGES_CONFIG = [
  { id: 'en', label: 'English' },
  { id: 'fr', label: 'Français' },
  { id: 'ar', label: 'العربية' },
  { id: 'bn', label: 'বাংলা' },
  { id: 'uk', label: 'українською' },
  { id: 'ku', label: 'Kurdish' },
  { id: 'so', label: 'Soomaali' },
  { id: 'wo', label: 'Wolof' },
  { id: 'fa', label: 'فارسی' },
  { id: 'bm', label: 'Bamanankan' },
  { id: 'mnk', label: "Mandin'ka" },
  { id: 'ddn', label: 'Dendi' },
  { id: 'ps', label: 'پښتو' },
  { id: 'ur', label: 'اردو' },
  { id: 'es', label: 'español' },
  { id: 'fuc', label: 'Pulaar' },
  { id: 'kri', label: 'Krio' },
  { id: 'zh', label: '中文' },
  { id: 'hi', label: 'हिन्दी' },
  { id: 'pt', label: 'Português' },
  { id: 'ru', label: 'Русский' },
  { id: 'ind', label: 'Bahasa Indonesia' },
  { id: 'de', label: 'Deutsch' },
  { id: 'ja', label: '日本語' },
  { id: 'sw', label: 'Kiswahili' },
  { id: 'tr', label: 'Türkçe' },
  { id: 'pa', label: 'ਪੰਜਾਬੀ' },
  { id: 'gwe', label: 'Guéré' },
  { id: 'tw', label: 'Twi' },
  { id: 'bete', label: 'Bété' },
  { id: 'mos', label: 'Mooré' }
];

async function runWithRetry<T>(fn: () => Promise<T>, retries = 6, initialDelay = 2000): Promise<T> {
  let delay = initialDelay;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      const errorStr = String(error?.message || error || "");
      const isRetryable = errorStr.includes("429") || 
                          errorStr.includes("RESOURCE_EXHAUSTED") || 
                          errorStr.includes("Quota") || 
                          errorStr.includes("quota") ||
                          errorStr.includes("503") ||
                          errorStr.includes("UNAVAILABLE") ||
                          errorStr.includes("overloaded") ||
                          errorStr.includes("demand") ||
                          errorStr.includes("timeout") ||
                          errorStr.includes("Timeout") ||
                          errorStr.includes("EAI_AGAIN") ||
                          errorStr.includes("fetch failed");
      
      if (isRetryable && attempt < retries) {
        console.warn(`[Gemini API] Request failed (${errorStr.slice(0, 80)}...). Retrying in ${delay}ms... (Attempt ${attempt + 1}/${retries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 1.8; // Exponential backoff
        continue;
      }
      throw error;
    }
  }
  throw new Error("Max retries reached for Gemini call");
}

async function translateQuestionsBulkForSingleLanguage(
  questions: { id: string; it: string }[],
  targetLangName: string,
  targetLangId: string
): Promise<Record<string, string>> {
  if (questions.length === 0) return {};

  const fetchBulk = async () => {
    const questionsDescription = questions
      .map(q => `- id: "${q.id}", testo: "${q.it}"`)
      .join("\n");

    const responseSchemaProperties: Record<string, any> = {};
    questions.forEach(q => {
      responseSchemaProperties[q.id] = { type: Type.STRING };
    });

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Sei un traduttore empatico e professionale. Traduci ciascuna delle seguenti domande in lingua italiana nella lingua nativa "${targetLangName}" (Codice ISO: "${targetLangId}").
Mantenere lo stesso tono intimo, amichevole ed empatico. Rispettare lo stile della domanda originale.

Domande in Italiano da tradurre:
${questionsDescription}

Restituisci un oggetto JSON contenente le chiavi id e la frase tradotta corrispondente.`,
      config: {
        temperature: 0.15,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: responseSchemaProperties,
          required: questions.map(q => q.id)
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as Record<string, string>;
    }
    throw new Error("No text returned from Gemini bulk translation");
  };

  return await runWithRetry(fetchBulk, 5, 2000);
}

function loadQuestions(): any[] {
  const content = fs.readFileSync('src/data/questions.ts', 'utf-8');
  const match = content.match(/export const questions: Question\[\] = (\[[\s\S]*?\]);/);
  if (!match) {
    throw new Error("Could not parse src/data/questions.ts for questions array!");
  }
  return eval(match[1]);
}

function saveQuestions(questions: any[]) {
  const content = fs.readFileSync('src/data/questions.ts', 'utf-8');
  
  const newQuestionsStr = '[\n' + questions.map((q: any) => {
    const keysOrdered = ['id', 'category', 'it', 'en', 'fr', 'ar', 'bn'];
    const otherKeys = Object.keys(q).filter(k => !keysOrdered.includes(k));
    const allKeys = [...keysOrdered, ...otherKeys];
    
    const parts = allKeys.map(k => {
      if (q[k] === undefined) return null;
      return `${k}: ${JSON.stringify(q[k])}`;
    }).filter(Boolean);
    
    return `  { ${parts.join(', ')} }`;
  }).join(',\n') + '\n]';

  const newContent = content.replace(/export const questions: Question\[\] = \[[\s\S]*?\];/, `export const questions: Question[] = ${newQuestionsStr};`);
  fs.writeFileSync('src/data/questions.ts', newContent);
}

// Helper to chunk an array
function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

async function main() {
  console.log("Loading all questions from src/data/questions.ts...");
  const questions = loadQuestions();
  console.log(`Loaded ${questions.length} questions.`);

  let totalTranslationsMade = 0;

  // Process each language sequentially
  for (let l = 0; l < LANGUAGES_CONFIG.length; l++) {
    const lang = LANGUAGES_CONFIG[l];
    console.log(`\n=== Processing Language ${l + 1}/${LANGUAGES_CONFIG.length}: "${lang.label}" (${lang.id}) ===`);

    const missingQuestions = questions.filter(q => {
      const val = q[lang.id];
      return !val || typeof val !== 'string' || val.trim().length === 0;
    });

    if (missingQuestions.length === 0) {
      console.log(`✓ Lingua "${lang.label}" (${lang.id}): 100% translated`);
      continue;
    }

    console.log(`Lingua "${lang.label}" (${lang.id}): translating ${missingQuestions.length}/${questions.length} missing questions sequentially...`);

    // Batch size of 45 for efficiency
    const BATCH_SIZE = 45;
    const batches = chunk(missingQuestions, BATCH_SIZE);

    for (let b = 0; b < batches.length; b++) {
      const batch = batches[b];
      const payload = batch.map(q => ({ id: q.id, it: q.it }));
      
      try {
        const translationsMap = await translateQuestionsBulkForSingleLanguage(payload, lang.label, lang.id);
        
        let mergedInBatch = 0;
        batch.forEach(item => {
          if (translationsMap[item.id]) {
            const originalQ = questions.find(q => q.id === item.id);
            if (originalQ) {
              originalQ[lang.id] = translationsMap[item.id];
              mergedInBatch++;
              totalTranslationsMade++;
            }
          }
        });
        console.log(`  [${lang.id}] Batch ${b + 1}/${batches.length}: translated ${mergedInBatch} questions.`);
      } catch (e: any) {
        console.error(`  [${lang.id}] ❌ Error in batch ${b + 1}/${batches.length}:`, e?.message || e);
      }

      // 1.5 seconds throttle between batches to avoid RPM limitations
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    // Save progressively after each language is completed
    saveQuestions(questions);
    console.log(`✓ Saved progress for "${lang.label}" (${lang.id}).`);
    
    // Slight sleep between languages
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`\nCOMPLETATO SUCCESSO! Totale traduzioni inserite/aggiornate: ${totalTranslationsMade}.`);
}

main().catch(err => {
  console.error("Errore fatale nello script di traduzione:", err);
  process.exit(1);
});
