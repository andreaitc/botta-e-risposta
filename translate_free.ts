import * as fs from 'fs';
import translate from 'google-translate-api-x';

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
  { id: 'ps', label: 'پښto' },
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

const GOOGLE_MAP: Record<string, string> = {
  en: 'en',
  fr: 'fr',
  ar: 'ar',
  bn: 'bn',
  uk: 'uk',
  ku: 'ku',
  so: 'so',
  wo: 'wo',
  fa: 'fa',
  bm: 'bm',
  mnk: 'mnk',
  ps: 'ps',
  ur: 'ur',
  es: 'es',
  fuc: 'ff', // Fulah/Pulaar is ff
  zh: 'zh-CN',
  hi: 'hi',
  pt: 'pt',
  ru: 'ru',
  ind: 'id',
  de: 'de',
  ja: 'ja',
  sw: 'sw',
  tr: 'tr',
  pa: 'pa',
  tw: 'ak', // Twi is Akan (ak)
  mos: 'mos' // Mooré is mos
};

// West African fallback to French, others to English
const FALLBACK_MAP: Record<string, string> = {
  ddn: 'fr',   // Dendi fallback to French
  kri: 'en',   // Krio fallback to English
  gwe: 'fr',   // Guéré fallback to French
  bete: 'fr',  // Bété fallback to French
};

function loadQuestions(): any[] {
  const content = fs.readFileSync('src/data/questions.ts', 'utf-8');
  const match = content.match(/export const questions: Question\[\] = (\[[\s\S]*?\]);/);
  if (!match) {
    throw new Error("Could not parse src/data/questions.ts");
  }
  return eval(match[1]);
}

function saveQuestions(questions: any[]) {
  const content = fs.readFileSync('src/data/questions.ts', 'utf-8');
  
  const newQuestionsStr = '[\n' + questions.map((q: any) => {
    // We order keys elegantly
    const keysOrdered = [
      'id', 'category', 'it', 'en', 'fr', 'ar', 'bn', 'uk', 'ku', 'so', 'wo',
      'fa', 'bm', 'mnk', 'ddn', 'ps', 'ur', 'es', 'fuc', 'kri', 'zh', 'hi',
      'pt', 'ru', 'ind', 'de', 'ja', 'sw', 'tr', 'pa', 'gwe', 'tw', 'bete', 'mos'
    ];
    
    const parts = keysOrdered.map(k => {
      if (q[k] === undefined) return null;
      return `${k}: ${JSON.stringify(q[k])}`;
    }).filter(Boolean);
    
    return `  { ${parts.join(', ')} }`;
  }).join(',\n') + '\n]';

  const newContent = content.replace(/export const questions: Question\[\] = \[[\s\S]*?\];/, `export const questions: Question[] = ${newQuestionsStr};`);
  fs.writeFileSync('src/data/questions.ts', newContent);
}

// Chunking questions to bypass query lengths limits (45 items per batch of Google Translate)
function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

async function translateWithFallback(texts: string[], targetLangId: string): Promise<string[]> {
  const googleCode = GOOGLE_MAP[targetLangId];
  if (!googleCode) {
    // Map directly to fallback language (it will be translated to French or English instead)
    const fallbackId = FALLBACK_MAP[targetLangId] || 'fr';
    console.log(`    ⚠️ Codice "${targetLangId}" non supportato nativamente da Google. Ripiego su "${fallbackId}"...`);
    return await translateWithFallback(texts, fallbackId);
  }

  // Translation call
  try {
    const res = await translate(texts, { to: googleCode });
    return res.map((r: any) => r.text);
  } catch (error: any) {
    // If it fails (e.g. Google blocks that specific sub-dialect codes), fall back to French/English
    const fallbackId = FALLBACK_MAP[targetLangId] || 'fr';
    if (fallbackId && fallbackId !== targetLangId) {
      console.warn(`    ⚠️ Errore con "${googleCode}": ${error?.message || error}. Ripiego su "${fallbackId}"...`);
      return await translateWithFallback(texts, fallbackId);
    }
    throw error;
  }
}

async function main() {
  console.log("Loading questions from src/data/questions.ts...");
  const questions = loadQuestions();
  console.log(`Loaded ${questions.length} questions.`);

  let totalTranslationsCount = 0;

  for (let l = 0; l < LANGUAGES_CONFIG.length; l++) {
    const lang = LANGUAGES_CONFIG[l];
    console.log(`\n=== Lingua ${l + 1}/${LANGUAGES_CONFIG.length}: "${lang.label}" (${lang.id}) ===`);

    const missingQuestions = questions.filter(q => {
      const val = q[lang.id];
      return !val || typeof val !== 'string' || val.trim().length === 0;
    });

    if (missingQuestions.length === 0) {
      console.log(`✓ 100% Tradotto per "${lang.label}"`);
      continue;
    }

    console.log(`Translating ${missingQuestions.length} missing questions for "${lang.label}" (${lang.id})...`);

    // We do batches of 25 (very light and polite)
    const BATCH_SIZE = 25;
    const batches = chunk(missingQuestions, BATCH_SIZE);

    for (let b = 0; b < batches.length; b++) {
      const batch = batches[b];
      const italianTexts = batch.map(q => q.it);

      try {
        console.log(`  -> Batch ${b + 1}/${batches.length}...`);
        const translatedTexts = await translateWithFallback(italianTexts, lang.id);

        batch.forEach((q, idx) => {
          const original = questions.find(item => item.id === q.id);
          if (original) {
            original[lang.id] = translatedTexts[idx] || q.it;
            totalTranslationsCount++;
          }
        });
      } catch (e: any) {
        console.error(`  ❌ Failed batch ${b + 1} for ${lang.id}:`, e?.message || e);
      }

      // 800ms lag between requests to be extra courteous to Google Free endpoints
      await new Promise(resolve => setTimeout(resolve, 800));
    }

    // Progress save
    saveQuestions(questions);
    console.log(`✓ Salvate modifiche per "${lang.label}" (${lang.id}).`);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`\nSISTEMA COMPILATO CON SUCCESSO! Totale traduzioni inserite offline: ${totalTranslationsCount}`);
}

main().catch(err => {
  console.error("Fatal error:", err);
});
