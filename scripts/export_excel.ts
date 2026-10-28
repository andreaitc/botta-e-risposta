import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import { questions } from '../src/data/questions';

const exportExcel = () => {
  const data = questions.map((q) => ({
    ID: q.id,
    Categoria: q.category,
    Italiano: q.it,
    Inglese: q.en,
    Francese: q.fr,
    Arabo: q.ar,
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Domande');

  const outputPath = path.join(process.cwd(), 'public', 'domande_botta_e_risposta.xlsx');
  XLSX.writeFile(workbook, outputPath);

  console.log(`Excel file successfully generated at: ${outputPath}`);
};

exportExcel();
