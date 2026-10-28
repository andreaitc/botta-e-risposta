import * as fs from 'fs';
import { questions } from './src/data/questions';

async function translateText(text: string) {
  const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=it&tl=bn&dt=t&q=${encodeURIComponent(text)}`);
  const json = await res.json();
  return json[0][0][0];
}

async function run() {
  let newContent = `export type Category = 'Passato' | 'Presente' | 'Futuro';\n\nexport interface Question {\n  id: string;\n  category: Category;\n  it: string;\n  en: string;\n  fr: string;\n  ar: string;\n  bn: string;\n}\n\nexport const questions: Question[] = [\n`;
  
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const bn = await translateText(q.it);
    newContent += `  { id: '${q.id}', category: '${q.category}', it: '${q.it.replace(/'/g, "\\'")}', en: '${q.en.replace(/'/g, "\\'")}', fr: '${q.fr.replace(/'/g, "\\'")}', ar: '${q.ar.replace(/'/g, "\\'")}', bn: '${bn.replace(/'/g, "\\'")}' },\n`;
    if (i % 10 === 0) console.log(`Translated ${i} questions...`);
    await new Promise(r => setTimeout(r, 200)); // rate limit
  }
  
  newContent += `];\n`;
  fs.writeFileSync('./src/data/questions.ts', newContent);
  console.log('Done!');
}

run();
