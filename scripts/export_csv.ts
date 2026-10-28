import fs from 'fs';
import path from 'path';
import { questions } from '../src/data/questions.js'; // Note the .js extension for tsx execution

function generateCSV() {
  let csvContent = 'ID,Categoria,Italiano,Inglese,Francese,Arabo\n';
  
  for (const q of questions) {
    // Escape quotes by doubling them, and wrap in quotes
    const it = `"${q.it.replace(/"/g, '""')}"`;
    const en = `"${q.en.replace(/"/g, '""')}"`;
    const fr = `"${q.fr.replace(/"/g, '""')}"`;
    const ar = `"${q.ar.replace(/"/g, '""')}"`;
    
    csvContent += `${q.id},${q.category},${it},${en},${fr},${ar}\n`;
  }

  const publicDir = path.join(process.cwd(), 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir);
  }
  
  const filePath = path.join(publicDir, 'domande_botta_e_risposta.csv');
  fs.writeFileSync(filePath, csvContent);
  console.log(`CSV generated successfully at ${filePath}`);
}

generateCSV();
