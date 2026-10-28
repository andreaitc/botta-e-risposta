import { GoogleGenAI, Type } from '@google/genai';
import fs from 'fs';
import path from 'path';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const categories = {
  Passato: [
    "Qual è il sapore di un piatto che ti manca tantissimo?",
    "Chi ti faceva ridere da bambino?",
    "Qual è il primo ricordo felice che ti viene in mente?",
    "C'è una canzone che ti ricorda casa?",
    "Quale profumo ti riporta alla tua infanzia?",
    "Chi è la persona che ti ha insegnato di più?",
    "Qual era il tuo gioco preferito da piccolo?",
    "Cosa ti diceva sempre tua madre o tuo padre?",
    "Qual è una tradizione del tuo paese che porti nel cuore?",
    "Qual è stato il giorno più coraggioso della tua vita?",
    "Quale festa ricordi con più gioia?",
    "Chi era il tuo migliore amico da piccolo?",
    "Qual è il consiglio più saggio che hai ricevuto da un nonno?",
    "Quale odore ti fa pensare alla tua vecchia casa?",
    "Qual era la tua materia preferita a scuola?",
    "Qual è stato il tuo primo viaggio?",
    "C'è un oggetto che hai portato con te e a cui tieni molto?",
    "Qual è il paesaggio più bello che hai visto nel tuo paese?",
    "Chi ti ha insegnato a cucinare?",
    "Quale storia ti raccontavano prima di dormire?",
    "Qual è stata la tua prima grande scoperta?",
    "Quale animale ti teneva compagnia da bambino?",
    "Qual è il regalo più bello che hai mai ricevuto?",
    "Quale suono ti ricorda le mattine nel tuo paese?",
    "Chi era il tuo eroe quando avevi dieci anni?",
    "Qual è il ricordo più divertente legato a un tuo fratello o sorella?",
    "Quale sapore ti ricorda la domenica?",
    "Qual è stata la prima volta che hai visto il mare o la neve?",
    "Quale abitudine della tua famiglia ti manca di più?",
    "Chi ti consolava quando piangevi?",
    "Qual è il vestito che amavi di più indossare da piccolo?",
    "Quale parola usava sempre la tua famiglia per darsi coraggio?",
    "Qual è il luogo segreto dove andavi a nasconderti o pensare?",
    "Quale stagione amavi di più nel tuo paese?",
    "Qual è la prima canzone che hai imparato a memoria?",
    "Chi ti ha insegnato a camminare o ad andare in bicicletta?",
    "Qual è il ricordo più dolce legato a un giorno di pioggia?",
    "Quale festa religiosa o tradizionale aspettavi con più ansia?",
    "Qual è la cosa più preziosa che hai imparato dai tuoi genitori?",
    "Quale sapore ti ricorda un giorno di festa?",
    "Chi era la persona più anziana e saggia che conoscevi?",
    "Qual è il primo lavoro che hai sognato di fare?",
    "Quale gioco di strada facevi con i tuoi amici?",
    "Qual è il ricordo più vivido del tuo primo giorno di scuola?",
    "Quale colore ti fa pensare alla tua infanzia?",
    "Chi ti ha fatto il complimento più bello quando eri piccolo?",
    "Qual è la cosa più coraggiosa che hai fatto da bambino?",
    "Quale canzone ti fa venire voglia di ballare pensando a casa?",
    "Qual è l'insegnamento del tuo passato che ti guida ancora oggi?",
    "Quale piccolo dettaglio della tua vecchia casa non dimenticherai mai?"
  ],
  Presente: [
    "Qual è il tuo angolo preferito di San Lazzaro?",
    "Cosa ti rende orgoglioso di te stesso oggi?",
    "Cosa ti ha fatto sorridere questa settimana?",
    "Chi è un nuovo amico che hai incontrato qui?",
    "Quale parola italiana ti piace di più pronunciare?",
    "Cosa ti dà forza quando ti senti stanco?",
    "C'è un gesto di gentilezza che hai ricevuto di recente?",
    "Come descriveresti la tua vita in questo momento con un colore?",
    "Qual è una cosa nuova che hai imparato a fare?",
    "Cosa significa per te la parola 'accoglienza'?",
    "Qual è la cosa che ti sorprende di più dell'Italia?",
    "Quale cibo italiano hai imparato ad amare?",
    "Chi ti ha aiutato di recente in un momento difficile?",
    "Qual è il tuo momento preferito della giornata qui al Centro?",
    "Quale parola italiana ti fa sorridere?",
    "Cosa fai per rilassarti quando sei stressato?",
    "Qual è la cosa più bella che hai visto oggi?",
    "Chi è la persona più divertente che hai conosciuto qui?",
    "Quale abitudine italiana ti sembra più strana?",
    "Cosa ti dà speranza in questo periodo della tua vita?",
    "Qual è la sfida più grande che stai affrontando oggi?",
    "Quale canzone ascolti per darti la carica?",
    "Qual è il posto dove ti senti più al sicuro adesso?",
    "Cosa ti piace fare nel tuo tempo libero?",
    "Qual è il complimento più bello che hai ricevuto di recente?",
    "Chi chiami quando hai una bella notizia da condividere?",
    "Quale sapore ti conforta quando sei triste?",
    "Qual è la cosa più importante che stai imparando su te stesso?",
    "Come descriveresti la tua giornata di oggi con una sola parola?",
    "Quale piccolo gesto ti ha fatto sentire accolto?",
    "Qual è la cosa che ti fa più ridere in questo periodo?",
    "Chi è il tuo punto di riferimento qui a San Lazzaro?",
    "Quale suono ti fa capire che è iniziata una nuova giornata?",
    "Cosa provi quando guardi il cielo oggi?",
    "Qual è la tua più grande conquista di questa settimana?",
    "Quale profumo ti fa sentire bene in questo momento?",
    "Cosa ti piace di più del carattere degli italiani?",
    "Qual è il momento in cui ti senti più in pace durante il giorno?",
    "Chi ti ispira a non arrenderti?",
    "Qual è la cosa più divertente che ti è successa da quando sei qui?",
    "Quale emozione provi più spesso in questi giorni?",
    "Cosa fai per far sorridere un amico?",
    "Qual è il tuo angolo di natura preferito qui vicino?",
    "Quale libro, film o storia ti sta accompagnando in questo periodo?",
    "Cosa significa per te la parola 'amicizia' oggi?",
    "Qual è la cosa più difficile da spiegare a chi non ha vissuto la tua storia?",
    "Quale piccolo dettaglio della tua stanza ti fa sentire a casa?",
    "Cosa ti fa sentire vivo in questo momento?",
    "Qual è la domanda che ti fai più spesso in questi giorni?",
    "Quale pensiero ti aiuta ad addormentarti sereno?"
  ],
  Futuro: [
    "Qual è il lavoro dei tuoi sogni?",
    "Cosa vorresti dire al te stesso di tra dieci anni?",
    "Dove ti immagini di vivere un giorno?",
    "Quale sogno tieni nascosto nel cassetto?",
    "Se potessi cambiare una cosa nel mondo, quale sarebbe?",
    "Cosa speri di poter insegnare ai tuoi figli?",
    "Qual è il prossimo traguardo che vuoi raggiungere?",
    "Come ti immagini la pace?",
    "Chi speri di riabbracciare presto?",
    "Qual è la prima cosa che farai quando ti sentirai completamente 'a casa'?",
    "Quale lingua vorresti imparare in futuro?",
    "Dove vorresti viaggiare un giorno?",
    "Quale abilità o mestiere vorresti padroneggiare?",
    "Come ti immagini la tua casa ideale?",
    "Quale messaggio vorresti lasciare alle generazioni future?",
    "Chi speri di diventare tra cinque anni?",
    "Quale paura speri di sconfiggere presto?",
    "Cosa vorresti costruire con le tue mani?",
    "Quale canzone vorresti cantare per festeggiare un grande successo?",
    "Come vorresti che il mondo ricordasse il tuo nome?",
    "Quale consiglio daresti a un bambino che inizia oggi il tuo stesso viaggio?",
    "Quale sapore vorresti far assaggiare ai tuoi futuri amici?",
    "Cosa speri di trovare alla fine del tuo percorso?",
    "Quale promessa hai fatto a te stesso per il futuro?",
    "Come ti immagini il giorno in cui realizzerai il tuo sogno più grande?",
    "Quale tradizione del tuo paese vorresti insegnare ai tuoi figli?",
    "Chi vorresti avere accanto nel momento del tuo più grande successo?",
    "Quale problema del mondo vorresti contribuire a risolvere?",
    "Cosa significa per te la parola 'libertà' pensando al domani?",
    "Quale paesaggio vorresti vedere svegliandoti al mattino?",
    "Quale libro vorresti scrivere sulla tua vita?",
    "Come ti immagini una giornata perfetta tra dieci anni?",
    "Quale emozione speri di provare più spesso in futuro?",
    "Cosa vorresti dire a chi ti ha aiutato, quando sarai indipendente?",
    "Quale nuova passione vorresti scoprire?",
    "Come vorresti contribuire alla comunità che ti ha accolto?",
    "Quale ostacolo speri che i tuoi figli non debbano mai affrontare?",
    "Cosa vorresti piantare nel tuo futuro giardino?",
    "Quale storia vorresti poter raccontare di te stesso da vecchio?",
    "Come ti immagini il momento in cui ti sentirai finalmente 'arrivato'?",
    "Quale parola vorresti che guidasse il tuo futuro?",
    "Chi speri di poter aiutare un giorno, come sei stato aiutato tu?",
    "Quale colore rappresenta il tuo futuro?",
    "Cosa vorresti festeggiare l'anno prossimo?",
    "Quale suono vorresti associare alla tua vita futura?",
    "Come vorresti che fosse la società in cui vivrai?",
    "Quale abitudine positiva vorresti mantenere per sempre?",
    "Cosa vorresti scoprire del mondo che ancora non conosci?",
    "Quale sorriso speri di vedere ogni giorno?",
    "Qual è il tuo augurio più grande per te stesso?"
  ]
};

async function translateBatch(category: string, questions: string[]) {
  const prompt = `Translate the following Italian questions into English, French, and Arabic.
Return a JSON array of objects with the exact following structure:
[
  { "it": "...", "en": "...", "fr": "...", "ar": "..." }
]
Here are the questions:
${JSON.stringify(questions)}
`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            it: { type: Type.STRING },
            en: { type: Type.STRING },
            fr: { type: Type.STRING },
            ar: { type: Type.STRING }
          },
          required: ["it", "en", "fr", "ar"]
        }
      }
    }
  });

  if (!response.text) throw new Error('No response text');
  return JSON.parse(response.text);
}

async function main() {
  const allQuestions: any[] = [];
  let idCounter = 1;

  for (const [category, questions] of Object.entries(categories)) {
    console.log(`Translating ${category}...`);
    const translated = await translateBatch(category, questions);
    for (const t of translated) {
      allQuestions.push({
        id: `${category.charAt(0).toLowerCase()}${idCounter++}`,
        category,
        ...t
      });
    }
  }

  // Write TS file
  const tsContent = `export type Category = 'Passato' | 'Presente' | 'Futuro';

export interface Question {
  id: string;
  category: Category;
  it: string;
  en: string;
  fr: string;
  ar: string;
}

export const questions: Question[] = ${JSON.stringify(allQuestions, null, 2)};

export function getRandomQuestion(): Question {
  const randomIndex = Math.floor(Math.random() * questions.length);
  return questions[randomIndex];
}
`;
  fs.writeFileSync(path.join(process.cwd(), 'src/data/questions.ts'), tsContent);

  // Write CSV file
  let csvContent = 'ID,Categoria,Italiano,Inglese,Francese,Arabo\n';
  for (const q of allQuestions) {
    csvContent += `${q.id},${q.category},"${q.it.replace(/"/g, '""')}","${q.en.replace(/"/g, '""')}","${q.fr.replace(/"/g, '""')}","${q.ar.replace(/"/g, '""')}"\n`;
  }
  
  const publicDir = path.join(process.cwd(), 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir);
  }
  fs.writeFileSync(path.join(publicDir, 'domande_botta_e_risposta.csv'), csvContent);

  console.log('Successfully generated questions.ts and domande_botta_e_risposta.csv');
}

main().catch(console.error);
