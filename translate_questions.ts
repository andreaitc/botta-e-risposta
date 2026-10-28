import fs from 'fs';
import translate from 'google-translate-api-x';

async function main() {
  const content = fs.readFileSync('src/data/questions.ts', 'utf-8');
  
  const match = content.match(/export const questions: Question\[\] = (\[[\s\S]*?\]);/);
  if (!match) {
    console.error("Could not find questions array");
    return;
  }
  
  const questionsStr = match[1];
  const questions = eval(questionsStr);
  
  console.log(`Found ${questions.length} questions. Translating in bulk...`);
  
  const itTexts = questions.map((q: any) => q.it);
  
  const translateLang = async (lang: string) => {
    console.log(`Translating to ${lang}...`);
    try {
      const res: any = await translate(itTexts, { to: lang });
      return res.map((r: any) => r.text);
    } catch (e) {
      console.error(`Failed to translate to ${lang}:`, e);
      return null;
    }
  };

  const ukTexts = questions.some((q: any) => !q.uk) ? await translateLang('uk') : null;
  const kuTexts = questions.some((q: any) => !q.ku) ? await translateLang('ku') : null;
  const soTexts = questions.some((q: any) => !q.so) ? await translateLang('so') : null;
  
  let woTexts = null;
  if (questions.some((q: any) => !q.wo)) {
    try {
      woTexts = await translateLang('wo');
    } catch (e) {
      console.log("Wolof failed, using French");
      woTexts = questions.map((q: any) => q.fr);
    }
  }
  
  const faTexts = questions.some((q: any) => !q.fa) ? await translateLang('fa') : null;

  for (let i = 0; i < questions.length; i++) {
    if (ukTexts && ukTexts[i]) questions[i].uk = ukTexts[i];
    if (kuTexts && kuTexts[i]) questions[i].ku = kuTexts[i];
    if (soTexts && soTexts[i]) questions[i].so = soTexts[i];
    if (woTexts && woTexts[i]) questions[i].wo = woTexts[i];
    if (faTexts && faTexts[i]) questions[i].fa = faTexts[i];
  }
  
  let newContent = content.replace(
    /export interface Question \{[\s\S]*?\}/,
    `export interface Question {
  id: string;
  category: Category;
  it: string;
  en: string;
  fr: string;
  ar: string;
  bn: string;
  uk?: string;
  ku?: string;
  so?: string;
  wo?: string;
  fa?: string;
}`
  );
  
  const newQuestionsStr = '[\n' + questions.map((q: any) => {
    return `  { id: '${q.id}', category: '${q.category}', it: ${JSON.stringify(q.it)}, en: ${JSON.stringify(q.en)}, fr: ${JSON.stringify(q.fr)}, ar: ${JSON.stringify(q.ar)}, bn: ${JSON.stringify(q.bn)}, uk: ${JSON.stringify(q.uk)}, ku: ${JSON.stringify(q.ku)}, so: ${JSON.stringify(q.so)}, wo: ${JSON.stringify(q.wo)}, fa: ${JSON.stringify(q.fa)} }`;
  }).join(',\n') + '\n]';
  
  newContent = newContent.replace(/export const questions: Question\[\] = \[[\s\S]*?\];/, `export const questions: Question[] = ${newQuestionsStr};`);
  
  fs.writeFileSync('src/data/questions.ts', newContent);
  console.log("Done!");
}

main();
