import * as fs from 'fs';
fs.appendFileSync('./src/data/questions.ts', `\nexport const getRandomQuestion = (category?: Category): Question => {\n  const filtered = category ? questions.filter(q => q.category === category) : questions;\n  return filtered[Math.floor(Math.random() * filtered.length)];\n};\n`);
