import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface TestimonyResult {
  domanda_proposta: string;
  domanda_proposta_lingua_originale: string;
  domanda_voto?: string; // or other fields if any
  category?: string;
  lingua_originale: string;
  trascrizione_originale: string;
  traduzione_italiano: string;
  parola_chiave: string;
  parola_chiave_lingua_originale: string;
  etichetta_parola_chiave_lingua_originale: string;
  invito_altra_domanda_lingua_originale: string;
  no_grazie_lingua_originale: string;
  suno_prompt: string;
  music_links: { title: string; url: string }[];
}



export async function processAudioTestimony(
  audioBase64: string,
  mimeType: string,
  question: string,
  signal?: AbortSignal
): Promise<TestimonyResult> {
  if (signal?.aborted) throw new Error('Aborted: Manual');
  
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.trim() === "") {
    throw new Error("La chiave API Gemini non è configurata o è vuota. Configurala nel pannello Impostazioni > Secrets.");
  }
  
  // Clean mimeType to avoid ";codecs=opus" or other extra attributes causing 400 bad request in Gemini
  let cleanMimeType = mimeType.split(';')[0].trim().toLowerCase();
  if (cleanMimeType === 'audio/x-wav' || cleanMimeType === 'audio/vnd.wave' || cleanMimeType === 'audio/wave') {
    cleanMimeType = 'audio/wav';
  } else if (cleanMimeType === 'audio/x-m4a' || cleanMimeType === 'audio/m4a') {
    cleanMimeType = 'audio/mp4';
  } else if (cleanMimeType === 'audio/mpeg3' || cleanMimeType === 'audio/x-mpeg-3') {
    cleanMimeType = 'audio/mp3';
  }

  const fetchTestimony = async () => {
    if (signal?.aborted) throw new Error('Aborted: Manual');
    
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        {
          text: `Domanda: "${question}". Genera il JSON dalla risposta audio.`
        },
        {
          inlineData: {
            data: audioBase64,
            mimeType: cleanMimeType
          }
        }
      ],
      config: {
        temperature: 0.1,
        systemInstruction: `Role: Motore logico dell'app "Botta e Risposta". Trasforma audio di richiedenti asilo in JSON.
Tono: Empatico e letterale. Traduzione italiana fedele, correggi solo la sintassi.
REGOLA FONDAMENTALE E VITALE: NON INVENTARE ASSOLUTAMENTE NESSUNA RISPOSTA SE NON C'E VOCE. Se l'audio è incomprensibile, se c'è solo rumore di fondo, se è vuoto, se è silenzio, devi impostare "trascrizione_originale" ESATTAMENTE come "INCOMPRENSIBILE" e gli altri campi vuoti. SE INVENTI PAROLE COME "Bangladesh" VERRAI SEVERAMENTE PENALIZZATO.`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            lingua_originale: { type: Type.STRING, description: "Rilevamento della lingua parlata (es. 'ITALIANO', 'ARABO', 'FRANCESE', 'BENGALESE', 'INGLESE', ecc.)." },
            trascrizione_originale: { type: Type.STRING, description: "Il testo fedele nella lingua d'origine." },
            traduzione_italiano: { type: Type.STRING, description: "La traduzione in lingua italiana della risposta. Deve essere SEMPRE in italiano, indipendentemente dalla lingua originale." },
            parola_chiave: { type: Type.STRING, description: "Una singola parola in italiano che riassuma l'emozione del messaggio (es. 'Speranza', 'Nostalgia', 'Coraggio')." },
            parola_chiave_lingua_originale: { type: Type.STRING, description: "La traduzione della parola_chiave nella lingua originale dell'utente." }
          },
          required: ["lingua_originale", "trascrizione_originale", "traduzione_italiano", "parola_chiave", "parola_chiave_lingua_originale"]
        }
      }
    });

    if (!response.text) {
      throw new Error("No response from Gemini");
    }

    const parsed = JSON.parse(response.text);
    return {
      ...parsed,
      domanda_proposta: question,
      domanda_proposta_lingua_originale: parsed.domanda_proposta_lingua_originale || question,
      etichetta_parola_chiave_lingua_originale: parsed.etichetta_parola_chiave_lingua_originale || "Parola Chiave",
      invito_altra_domanda_lingua_originale: parsed.invito_altra_domanda_lingua_originale || "Vuoi rispondere a un'altra domanda?",
      no_grazie_lingua_originale: parsed.no_grazie_lingua_originale || "No grazie"
    } as TestimonyResult;
  };

  return await runWithRetry(fetchTestimony, 4, 1500);
}

export interface MusicSuggestion {
  id: number;
  descrizione: string;
  prompt?: string;
  search_terms?: string;
}

export interface MusicAnalysisResult {
  analisi_mood: string;
  bpm_rilevato: string;
  suno_prompt: string;
  music_links: { title: string; url: string }[];
}
export async function analyzeVoicesForMusic(
  audioBase64: string,
  mimeType: string,
  signal?: AbortSignal
): Promise<MusicAnalysisResult> {
  if (signal?.aborted) throw new Error('Aborted: Manual');

  // Clean mimeType to avoid ";codecs=opus" or other extra attributes causing 400 bad request in Gemini
  let cleanMimeType = mimeType.split(';')[0].trim().toLowerCase();
  if (cleanMimeType === 'audio/x-wav' || cleanMimeType === 'audio/vnd.wave' || cleanMimeType === 'audio/wave') {
    cleanMimeType = 'audio/wav';
  } else if (cleanMimeType === 'audio/x-m4a' || cleanMimeType === 'audio/m4a') {
    cleanMimeType = 'audio/mp4';
  } else if (cleanMimeType === 'audio/mpeg3' || cleanMimeType === 'audio/x-mpeg-3') {
    cleanMimeType = 'audio/mp3';
  }

  const fetchAnalysis = async () => {
    if (signal?.aborted) throw new Error('Aborted: Manual');

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        {
          text: "Analizza questo audio e suggerisci la regia musicale."
        },
        {
          inlineData: {
            data: audioBase64,
            mimeType: cleanMimeType
          }
        }
      ],
      config: {
        systemInstruction: `Agisci come il motore di intelligenza artificiale integrato in un'app di montaggio audio.
Identifica il mood (es. serio, commovente, dinamico, istituzionale) e il ritmo del parlato.
Genera suggerimenti di sottofondo, esclusivamente strumentali e senza parole.
REQUISITO STILE: "Meno AI, più Orchestra". Prediligi strumenti acustici (pianoforte, violino, violoncello, fiati).
IMPORTANTE: Il prompt per Suno deve essere in ITALIANO e deve riflettere la natura multiculturale e multilinguistica delle voci analizzate.
RUOLO MUSICALE: La musica deve agire come un "tappeto sonoro" (musical carpet). Deve creare un'atmosfera che sostiene il racconto senza diventare protagonista o prevaricare la voce. Deve essere un accompagnamento discreto e soffuso.

Restituisci:
1. Un prompt dettagliato in ITALIANO per Suno AI o simili per creare un tappeto sonoro orchestrale/acustico di sottofondo che rispetti la multiculturalità e non prevarichi la voce.
2. Cinque (5) link a ricerche su Jamendo, Freesound, Pixabay Music o Musopen. I link devono essere URL validi e cliccabili.

Restituisci il risultato esclusivamente in formato JSON.`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            analisi_mood: { type: Type.STRING },
            bpm_rilevato: { type: Type.STRING },
            suno_prompt: { type: Type.STRING },
            music_links: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  url: { type: Type.STRING }
                },
                required: ["title", "url"]
              }
            }
          },
          required: ["analisi_mood", "bpm_rilevato", "suno_prompt", "music_links"]
        }
      }
    });

    if (!response.text) {
      throw new Error("No response from Gemini");
    }

    return JSON.parse(response.text) as MusicAnalysisResult;
  };

  try {
    return await runWithRetry(fetchAnalysis, 4, 1500);
  } catch (error) {
    console.error("[Gemini Server] analyzeVoicesForMusic failed. Returning safe music analysis fallback...", error);
    return {
      analisi_mood: "Emozionale, intimo, riflessivo",
      bpm_rilevato: "75 BPM",
      suno_prompt: "Tappeto sonoro orchestrale delicato, pianoforte minimale e archi caldi, atmosfera di pace, volume soffuso di sottofondo, world music acustica discreta.",
      music_links: [
        { title: "Jamendo - Ambient Piano", url: "https://www.jamendo.com/search?q=ambient+piano" },
        { title: "Freesound - Gentle String Ensemble", url: "https://freesound.org/search/?q=strings" },
        { title: "Pixabay - Calming Background Sound", url: "https://pixabay.com/music/search/calm/" },
        { title: "Musopen - Classical Minimalist Solo", url: "https://musopen.org/music/search/?q=piano" },
        { title: "Jamendo - Emotional Cinematic Background", url: "https://www.jamendo.com/search?q=cinematic" }
      ]
    };
  }
}

export async function generateMusicFromPrompt(prompt: string): Promise<Blob> {
  const response = await ai.models.generateContentStream({
    model: "lyria-3-clip-preview",
    contents: prompt,
  });

  let audioBase64 = "";
  let mimeType = "audio/wav";

  for await (const chunk of response) {
    const parts = chunk.candidates?.[0]?.content?.parts;
    if (!parts) continue;
    for (const part of parts) {
      if (part.inlineData?.data) {
        if (!audioBase64 && part.inlineData.mimeType) {
          mimeType = part.inlineData.mimeType;
        }
        audioBase64 += part.inlineData.data;
      }
    }
  }

  if (!audioBase64) {
    throw new Error("Failed to generate music");
  }

  const binary = atob(audioBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

// Global adaptive rate-limiting queue state to handle rate limit (429) errors gracefully
let globalDelayBetweenRequests = 100; // Zero noticeable delay under standard load
let lastRequestEndTime = 0;

async function acquireSlot() {
  const now = Date.now();
  const timeSinceLast = now - lastRequestEndTime;
  if (timeSinceLast < globalDelayBetweenRequests) {
    // Add randomized jitter to prevent synchronized concurrent workers (thundering herds)
    const sleepTime = (globalDelayBetweenRequests - timeSinceLast) + (Math.random() * 400);
    await new Promise(resolve => setTimeout(resolve, sleepTime));
  }
}

// Helper function to retry Gemini API calls in case of 429 rate limit or transient network errors
async function runWithRetry<T>(fn: () => Promise<T>, retries = 5, initialDelay = 1500): Promise<T> {
  let delay = initialDelay;
  for (let attempt = 0; attempt <= retries; attempt++) {
    await acquireSlot();
    try {
      const result = await fn();
      lastRequestEndTime = Date.now();
      // Decay global delay duration on successful calls to recover translation speed
      globalDelayBetweenRequests = Math.max(100, globalDelayBetweenRequests - 300);
      return result;
    } catch (error: any) {
      lastRequestEndTime = Date.now();
      const errorStr = String(error?.message || error || "").toLowerCase();
      const isRateLimit = errorStr.includes("429") || errorStr.includes("resource_exhausted") || errorStr.includes("quota");
      const isTransientNetwork = errorStr.includes("500") || errorStr.includes("502") || errorStr.includes("503") || errorStr.includes("504") || errorStr.includes("proxy") || errorStr.includes("timeout") || errorStr.includes("xhr") || errorStr.includes("network") || errorStr.includes("failed to fetch");
      
      if ((isRateLimit || isTransientNetwork) && attempt < retries) {
        if (isRateLimit) {
          // Increase standard spacing interval when rate limiting triggers
          globalDelayBetweenRequests = Math.min(6000, globalDelayBetweenRequests + 2000);
          console.warn(`[Gemini API] 429 Rate Limit hit. Backoff increased to ${globalDelayBetweenRequests}ms.`);
        }
        
        // Jittered backoff delay for the current thread to stagger retries
        const jitter = Math.random() * 1200;
        const currentRetryDelay = delay + jitter;
        console.warn(`[Gemini API] Transient or Rate Limit hit. Retrying in ${Math.round(currentRetryDelay)}ms... (Attempt ${attempt + 1}/${retries})`);
        
        await new Promise(resolve => setTimeout(resolve, currentRetryDelay));
        delay *= 2; // Exponential backoff for subsequent individual attempts
        continue;
      }
      throw error;
    }
  }
  throw new Error("Maximum retries reached for Gemini call");
}

export async function translateText(text: string, langName: string): Promise<string> {
  try {
    const fetchTranslateText = async () => {
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `Traduci questa frase in ${langName}. Restituisci SOLO ed ESCLUSIVAMENTE la frase tradotta, senza commenti, spiegazioni o virgolette esterne: "${text}"`,
        config: {
          temperature: 0.1,
        }
      });
      return response.text ? response.text.trim() : text;
    };
    return await runWithRetry(fetchTranslateText, 4, 1500);
  } catch (error) {
    console.error("Gemini translation failed, using fallback:", error);
    return text;
  }
}

export async function translateQuestionsBulk(
  questions: { id: string; it: string }[],
  targetLangName: string
): Promise<Record<string, string>> {
  if (questions.length === 0) return {};
  
  const targetLangId = getLanguageIdFromName(targetLangName);
  
  // Chunking logic: process max 12 questions per call to avoid hitting timeouts and optimize speed
  const CHUNK_SIZE = 12;
  const chunks: { id: string; it: string }[][] = [];
  for (let i = 0; i < questions.length; i += CHUNK_SIZE) {
    chunks.push(questions.slice(i, i + CHUNK_SIZE));
  }
  
  const finalResults: Record<string, string> = {};

  // Execute chunk calls concurrently for immediate processing
  const chunkPromises = chunks.map(async (chunk, c) => {
    try {
      const fetchBulk = async () => {
        const questionsDescription = chunk
          .map(q => `- id: "${q.id}", testo: "${q.it}"`)
          .join("\n");

        const responseSchemaProperties: Record<string, any> = {};
        chunk.forEach(q => {
          responseSchemaProperties[q.id] = { type: Type.STRING };
        });

        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: `Sei un traduttore empatico e professionale. Traduci ciascuna delle seguenti domande in lingua italiana nella lingua nativa "${targetLangName}".
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
              required: chunk.map(q => q.id)
            }
          }
        });

        if (response.text) {
          return JSON.parse(response.text) as Record<string, string>;
        }
        throw new Error("No text returned from Gemini bulk translation chunk");
      };

      const chunkResult = await runWithRetry(fetchBulk, 3, 1000);
      return { success: true, chunkResult, chunk: null };
    } catch (error) {
      console.error(`Gemini bulk translation failed for chunk ${c}, using fallback:`, error);
      return { success: false, chunkResult: null, chunk };
    }
  });

  const resolvedChunks = await Promise.all(chunkPromises);

  // Merge the resolved chunk results or apply database fallback in parallel
  const fallbackPromises = resolvedChunks.map(async (res, c) => {
    if (res.success && res.chunkResult) {
      Object.assign(finalResults, res.chunkResult);
    } else if (res.chunk) {
      const chunk = res.chunk;
      // Fallback for this chunk: Look up standard translations in the local database
      try {
        const { questions: dbQuestions } = await import("../data/questions");
        chunk.forEach(q => {
          const found = dbQuestions.find(dbQ => dbQ.id === q.id);
          if (found && (found as any)[targetLangId]) {
            finalResults[q.id] = (found as any)[targetLangId] as string;
          } else {
            finalResults[q.id] = q.it; // fallback to Italian
          }
        });
      } catch (fallbackErr) {
        console.error("Local database lookup failed during fallback for chunk:", fallbackErr);
        chunk.forEach(q => {
          finalResults[q.id] = q.it;
        });
      }
    }
  });

  await Promise.all(fallbackPromises);
  
  return finalResults;
}

export async function translateToAllLanguages(
  text: string,
  targetLanguages: { id: string; labelNative: string }[]
): Promise<Record<string, string>> {
  if (targetLanguages.length === 0) return {};

  // Optimize: Chunk size increased to 50 to translate all 30+ target languages in a single robust request.
  const CHUNK_SIZE = 50;
  const chunks: { id: string; labelNative: string }[][] = [];
  for (let i = 0; i < targetLanguages.length; i += CHUNK_SIZE) {
    chunks.push(targetLanguages.slice(i, i + CHUNK_SIZE));
  }
  
  const finalResults: Record<string, string> = {};

  // Process all language chunks in parallel to achieve a massive speed boost
  const chunkPromises = chunks.map(async (chunk, c) => {
    try {
      const fetchToAllChunk = async () => {
        const listDescription = chunk
          .map(lang => `- ${lang.id}: traduci in ${lang.labelNative}`)
          .join("\n");

        const responseSchemaProperties: Record<string, any> = {};
        chunk.forEach(lang => {
          responseSchemaProperties[lang.id] = { type: Type.STRING };
        });

        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: `Tu sei un traduttore professionista ed empatico. Traduci la seguente frase in italiano in tutte le altre lingue elencate di seguito.
Frase da tradurre: "${text}"

Lingue di destinazione richieste:
${listDescription}

Fornisci traduzioni naturali, accurate e culturalmente appropriate, mantenendo lo stesso tono intimo della frase originale.`,
          config: {
            temperature: 0.15,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: responseSchemaProperties,
              required: chunk.map(l => l.id)
            }
          }
        });

        if (response.text) {
          return JSON.parse(response.text) as Record<string, string>;
        }
        throw new Error("No text returned from Gemini for this language chunk");
      };

      const chunkResult = await runWithRetry(fetchToAllChunk, 3, 1000);
      return { success: true, chunkResult, chunk: null };
    } catch (error) {
      console.error(`Gemini batch translation chunk ${c} failed:`, error);
      return { success: false, chunkResult: null, chunk };
    }
  });

  const resolvedChunks = await Promise.all(chunkPromises);

  resolvedChunks.forEach(res => {
    if (res.success && res.chunkResult) {
      Object.assign(finalResults, res.chunkResult);
    } else if (res.chunk) {
      // Safe fallback to original text for this chunk in case of failure
      res.chunk.forEach(lang => {
        finalResults[lang.id] = text;
      });
    }
  });
  
  return finalResults;
}

export async function detectLanguageDetails(requestedLangName: string): Promise<{ id: string, label: string, labelNative: string, support: 'high' | 'medium' | 'low', dir: 'ltr' | 'rtl' }> {
  // PROACTIVE OFFLINE LOOKUP: check if the typed language matches our comprehensive offline DB
  const norm = requestedLangName.toLowerCase().trim();
  const matched = OFFLINE_LANGS_DB[norm];
  if (matched) {
    console.log(`Detected language "${requestedLangName}" instantly via offline database:`, matched);
    return { ...matched };
  }

  try {
    const fetchLangDetails = async () => {
      const prompt = `Identifica i dettagli di configurazione linguistica per la lingua richiesta: "${requestedLangName}".
      Estrai:
      1. Un codice ISO 639-1 a due lettere minuscole (es: 'ro' per il Romeno, 'pl' per il Polacco). Se è una variante specifica, offri un codice compresso.
      2. Il nome completo della lingua in lingua ITALIANA, interamente in MAIUSCOLO (es: 'ROMENO', 'POLACCO', 'RUSSOPHONE').
      3. Il nome originale della lingua scritto nell'alfabeto e script nativo (es: 'Română' per il Romeno, 'Polski' per il Polacco, 'Русский' per il Russo).
      4. Un livello di affidabilità della traduzione automatica con IA (scegli tra 'high', 'medium', 'low'. Usa 'high' per le principali lingue occidentali come Tedesco, Russo, Spagnolo, Cinese, Giapponese; 'medium' per lingue standard diffuse; 'low' per parlate dialettali o lingue rare/sperimentali).
      5. Direzione della scrittura ('ltr' per sinistra a destra, 'rtl' per destra a sinistra, come l'Arabo, l'Ebraico, l'Urdu o il Persiano).

      Restituisci esclusivamente in formato JSON.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          temperature: 0.1,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              label: { type: Type.STRING },
              labelNative: { type: Type.STRING },
              support: { type: Type.STRING, enum: ["high", "medium", "low"] },
              dir: { type: Type.STRING, enum: ["ltr", "rtl"] }
            },
            required: ["id", "label", "labelNative", "support", "dir"]
          }
        }
      });

      if (response.text) {
        return JSON.parse(response.text) as any;
      }
      throw new Error("No response text from Gemini");
    };

    return await runWithRetry(fetchLangDetails, 3, 1000);
  } catch (error) {
    console.error("Failed to detect language details with Gemini, using robust fallback:", error);
    // Safe lookup fallback based on common variations
    const fallbackId = getLanguageIdFromName(requestedLangName);
    const dbFallback = Object.values(OFFLINE_LANGS_DB).find(val => val.id === fallbackId);
    if (dbFallback) {
      return { ...dbFallback };
    }

    return {
      id: fallbackId,
      label: requestedLangName.toUpperCase(),
      labelNative: requestedLangName,
      support: 'low',
      dir: 'ltr'
    };
  }
}

export async function translateUiPhrases(
  phrases: Record<string, string>,
  langNameOriginal: string
): Promise<Record<string, string>> {
  const langId = getLanguageIdFromName(langNameOriginal);
  const offlineDict = OFFLINE_UI_TRANSLATIONS[langId];
  
  // PROACTIVE OFFLINE LOOKUP: If we have pre-translated phrases, return them instantly without API calls
  if (offlineDict) {
    console.log(`UI translation for "${langNameOriginal}" (${langId}) resolved offline.`);
    const result: Record<string, string> = { ...phrases };
    Object.keys(phrases).forEach(key => {
      if (offlineDict[key]) {
        result[key] = offlineDict[key];
      }
    });
    return result;
  }

  try {
    const listDescription = Object.entries(phrases)
      .map(([key, value]) => `- ${key}: "${value}"`)
      .join("\n");

    const responseSchemaProperties: Record<string, any> = {};
    Object.keys(phrases).forEach(key => {
      responseSchemaProperties[key] = { type: Type.STRING };
    });

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Sei un traduttore professionista ed empatico. Traduci i seguenti testi dell'interfaccia utente (UI) dall'Italiano alla lingua nativa "${langNameOriginal}".
Mantieni lo stesso tono rispettoso, intimo ed empatico dei testi originali.
NOMI DEI CAMPI E FRASI ORIGINALI:
${listDescription}
Restituisci l'esatto schema JSON richiesto, traducendo ciascun valore del campo corrispondente.`,
      config: {
        temperature: 0.15,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: responseSchemaProperties,
          required: Object.keys(phrases)
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as Record<string, string>;
    }
    throw new Error("No text returned from Gemini");
  } catch (error) {
    console.error("Gemini UI translation failed, using fallbacks:", error);
    return phrases;
  }
}

// ==========================================
// OFFLINE BACKBODY DATABASE FOR RESILIENCY
// ==========================================

export function getLanguageIdFromName(name: string): string {
  const norm = name.toLowerCase().trim();
  const found = OFFLINE_LANGS_DB[norm];
  if (found) return found.id;
  
  if (norm.includes('inglese') || norm.includes('english') || norm === 'en') return 'en';
  if (norm.includes('spagnolo') || norm.includes('spanish') || norm.includes('español') || norm === 'es') return 'es';
  if (norm.includes('fracese') || norm.includes('francese') || norm.includes('french') || norm.includes('français') || norm === 'fr') return 'fr';
  if (norm.includes('arabo') || norm.includes('arabic') || norm.includes('العربية') || norm === 'ar') return 'ar';
  if (norm.includes('romeno') || norm.includes('rumeno') || norm.includes('romanian') || norm.includes('română') || norm === 'ro') return 'ro';
  if (norm.includes('tedesco') || norm.includes('german') || norm.includes('deutsch') || norm === 'de') return 'de';
  if (norm.includes('portoghese') || norm.includes('portuguese') || norm.includes('português') || norm === 'pt') return 'pt';
  if (norm.includes('ucraino') || norm.includes('ukrainian') || norm.includes('українською') || norm.includes('українська') || norm === 'uk') return 'uk';
  if (norm.includes('italiano') || norm.includes('italian') || norm === 'it') return 'it';
  return norm.substring(0, 2).toLowerCase();
}

const OFFLINE_LANGS_DB: Record<string, { id: string, label: string, labelNative: string, support: 'high' | 'medium' | 'low', dir: 'ltr' | 'rtl' }> = {
  arabo: { id: 'ar', label: 'ARABO', labelNative: 'العربية', support: 'high', dir: 'rtl' },
  arabic: { id: 'ar', label: 'ARABO', labelNative: 'العربية', support: 'high', dir: 'rtl' },
  spagnolo: { id: 'es', label: 'SPAGNOLO', labelNative: 'Español', support: 'high', dir: 'ltr' },
  spanish: { id: 'es', label: 'SPAGNOLO', labelNative: 'Español', support: 'high', dir: 'ltr' },
  español: { id: 'es', label: 'SPAGNOLO', labelNative: 'Español', support: 'high', dir: 'ltr' },
  rumeno: { id: 'ro', label: 'ROMENO', labelNative: 'Română', support: 'medium', dir: 'ltr' },
  romeno: { id: 'ro', label: 'ROMENO', labelNative: 'Română', support: 'medium', dir: 'ltr' },
  romanian: { id: 'ro', label: 'ROMENO', labelNative: 'Română', support: 'medium', dir: 'ltr' },
  inglese: { id: 'en', label: 'INGLESE', labelNative: 'English', support: 'high', dir: 'ltr' },
  english: { id: 'en', label: 'INGLESE', labelNative: 'English', support: 'high', dir: 'ltr' },
  francese: { id: 'fr', label: 'FRANCESE', labelNative: 'Français', support: 'high', dir: 'ltr' },
  french: { id: 'fr', label: 'FRANCESE', labelNative: 'Français', support: 'high', dir: 'ltr' },
  français: { id: 'fr', label: 'FRANCESE', labelNative: 'Français', support: 'high', dir: 'ltr' },
  tedesco: { id: 'de', label: 'TEDESCO', labelNative: 'Deutsch', support: 'high', dir: 'ltr' },
  german: { id: 'de', label: 'TEDESCO', labelNative: 'Deutsch', support: 'high', dir: 'ltr' },
  deutsch: { id: 'de', label: 'TEDESCO', labelNative: 'Deutsch', support: 'high', dir: 'ltr' },
  portoghese: { id: 'pt', label: 'PORTOGHESE', labelNative: 'Português', support: 'high', dir: 'ltr' },
  portuguese: { id: 'pt', label: 'PORTOGHESE', labelNative: 'Português', support: 'high', dir: 'ltr' },
  português: { id: 'pt', label: 'PORTOGHESE', labelNative: 'Português', support: 'high', dir: 'ltr' },
  cinese: { id: 'zh', label: 'CINESE', labelNative: '中文', support: 'high', dir: 'ltr' },
  chinese: { id: 'zh', label: 'CINESE', labelNative: '中文', support: 'high', dir: 'ltr' },
  giapponese: { id: 'ja', label: 'GIAPPONESE', labelNative: '日本語', support: 'high', dir: 'ltr' },
  japanese: { id: 'ja', label: 'GIAPPONESE', labelNative: '日本語', support: 'high', dir: 'ltr' },
  russo: { id: 'ru', label: 'RUSSO', labelNative: 'Русский', support: 'high', dir: 'ltr' },
  russian: { id: 'ru', label: 'RUSSO', labelNative: 'Русский', support: 'high', dir: 'ltr' },
  ucraino: { id: 'uk', label: 'UCRAINO', labelNative: 'Українська', support: 'medium', dir: 'ltr' },
  ukrainian: { id: 'uk', label: 'UCRAINO', labelNative: 'Українська', support: 'medium', dir: 'ltr' },
  polacco: { id: 'pl', label: 'POLACCO', labelNative: 'Polski', support: 'medium', dir: 'ltr' },
  polish: { id: 'pl', label: 'POLACCO', labelNative: 'Polski', support: 'medium', dir: 'ltr' },
  turco: { id: 'tr', label: 'TURCO', labelNative: 'Türkçe', support: 'high', dir: 'ltr' },
  turkish: { id: 'tr', label: 'TURCO', labelNative: 'Türkçe', support: 'high', dir: 'ltr' },
  hindi: { id: 'hi', label: 'HINDI', labelNative: 'हिन्दी', support: 'medium', dir: 'ltr' },
  bengalese: { id: 'bn', label: 'BENGALESE', labelNative: 'বাংলা', support: 'medium', dir: 'ltr' },
  bengali: { id: 'bn', label: 'BENGALESE', labelNative: 'বাংলা', support: 'medium', dir: 'ltr' },
  urdu: { id: 'ur', label: 'URDU', labelNative: 'اُردُو', support: 'medium', dir: 'rtl' },
  persiano: { id: 'fa', label: 'PERSIANO', labelNative: 'فارسی', support: 'medium', dir: 'rtl' },
  farsi: { id: 'fa', label: 'PERSIANO', labelNative: 'فارسی', support: 'medium', dir: 'rtl' },
  pashto: { id: 'ps', label: 'PASHTO', labelNative: 'پښتو', support: 'low', dir: 'rtl' },
  punjabi: { id: 'pa', label: 'PUNJABI', labelNative: 'ਪੰਜਾਬੀ', support: 'medium', dir: 'ltr' },
  swahili: { id: 'sw', label: 'SWAHILI', labelNative: 'Kiswahili', support: 'medium', dir: 'ltr' },
  albanese: { id: 'sq', label: 'ALBANESE', labelNative: 'Shqip', support: 'medium', dir: 'ltr' },
  albanian: { id: 'sq', label: 'ALBANESE', labelNative: 'Shqip', support: 'medium', dir: 'ltr' },
  svedese: { id: 'sv', label: 'SVEDESE', labelNative: 'Svenska', support: 'high', dir: 'ltr' },
  swedish: { id: 'sv', label: 'SVEDESE', labelNative: 'Svenska', support: 'high', dir: 'ltr' },
  olandese: { id: 'nl', label: 'OLANDESE', labelNative: 'Nederlands', support: 'high', dir: 'ltr' },
  dutch: { id: 'nl', label: 'OLANDESE', labelNative: 'Nederlands', support: 'high', dir: 'ltr' },
  norvegese: { id: 'no', label: 'NORVEGESE', labelNative: 'Norsk', support: 'high', dir: 'ltr' },
  norwegian: { id: 'no', label: 'NORVEGESE', labelNative: 'Norsk', support: 'high', dir: 'ltr' },
  danese: { id: 'da', label: 'DANESE', labelNative: 'Dansk', support: 'high', dir: 'ltr' },
  danish: { id: 'da', label: 'DANESE', labelNative: 'Dansk', support: 'high', dir: 'ltr' },
  finlandese: { id: 'fi', label: 'FINLANDESE', labelNative: 'Suomi', support: 'high', dir: 'ltr' },
  finnish: { id: 'fi', label: 'FINLANDESE', labelNative: 'Suomi', support: 'high', dir: 'ltr' },
  greco: { id: 'el', label: 'GRECO', labelNative: 'Ελληνικά', support: 'medium', dir: 'ltr' },
  greek: { id: 'el', label: 'GRECO', labelNative: 'Ελληνικά', support: 'medium', dir: 'ltr' },
  ungherese: { id: 'hu', label: 'UNGHERESE', labelNative: 'Magyar', support: 'medium', dir: 'ltr' },
  hungarian: { id: 'hu', label: 'UNGHERESE', labelNative: 'Magyar', support: 'medium', dir: 'ltr' },
  ceco: { id: 'cs', label: 'CECO', labelNative: 'Čeština', support: 'medium', dir: 'ltr' },
  czech: { id: 'cs', label: 'CECO', labelNative: 'Čeština', support: 'medium', dir: 'ltr' },
  slovacco: { id: 'sk', label: 'SLOVACCO', labelNative: 'Slovenčina', support: 'medium', dir: 'ltr' },
  slovak: { id: 'sk', label: 'SLOVACCO', labelNative: 'Slovenčina', support: 'medium', dir: 'ltr' },
  bulgaro: { id: 'bg', label: 'BULGARO', labelNative: 'Български', support: 'medium', dir: 'ltr' },
  bulgarian: { id: 'bg', label: 'BULGARO', labelNative: 'Български', support: 'medium', dir: 'ltr' },
  italiano: { id: 'it', label: 'ITALIANO', labelNative: 'Italiano', support: 'high', dir: 'ltr' },
  italian: { id: 'it', label: 'ITALIANO', labelNative: 'Italiano', support: 'high', dir: 'ltr' },
};

const OFFLINE_UI_TRANSLATIONS: Record<string, Record<string, string>> = {
  en: {
    greeting: "Hello! Thank you for choosing to play with us. Would you like to answer a simple question? We will ask you in English, but you can answer in your mother tongue. Your answer will remain anonymous. Feel free to answer whatever you want!",
    readyButton: "I'm ready",
    nativeLanguagePrompt: "You can answer in your native language",
    processingText: "Thank you! We are carefully translating your words.",
    processingTitle: "Processing...",
    errorText: "Sorry, I didn't hear much. Let's try again",
    audioTooLowError: "I'm sorry, I couldn't hear you well.",
    processingError: "Error processing audio.",
    timeoutError: "Processing is taking too long. Please try again.",
    changeQuestionPrompt: "Would you like to answer another question?",
    changeQuestionLastPrompt: "Shall we do one last question?",
    tryAgainButton: "Try again",
    noThanksButton: "No thanks",
    stopButton: "STOP",
    status: "Recording in progress... We are listening to you"
  },
  es: {
    greeting: "¡Hola! Gracias por elegir jugar con nosotros. ¿Te apetece responder a una pregunta sencilla? Te la haremos en español, pero puedes responder in tu lengua materna. Tu respuesta seguirá siendo anónima. ¡Siente libre de responder lo que quieras!",
    readyButton: "Estoy listo",
    nativeLanguagePrompt: "Puedes responder en tu lengua materna",
    processingText: "¡Gracias! Estamos traduciendo cuidadosamente tus palabras.",
    processingTitle: "Procesando...",
    errorText: "Lo siento, no escuché mucho. Intentemos de nuevo",
    audioTooLowError: "Lo siento, no pude escucharte bien.",
    processingError: "Error al procesar el audio.",
    timeoutError: "El procesamiento está tardando demasiado. Inténtalo de nuevo.",
    changeQuestionPrompt: "¿Te apetece responder a otra pregunta?",
    changeQuestionLastPrompt: "¿Hacemos una última pregunta?",
    tryAgainButton: "Intentar de nuevo",
    noThanksButton: "No, gracias",
    stopButton: "PARAR",
    status: "Grabación en curso... Te estamos escuchando"
  },
  fr: {
    greeting: "Bonjour ! Merci d'avoir choisi de jouer avec nous. Voudriez-vous répondre à une question simple ? Nous vous la poserons en français, mais vous pouvez répondre dans votre langue maternelle. Votre réponse restera anonyme. N'hésitez pas à répondre ce que vous voulez !",
    readyButton: "Je suis prêt",
    nativeLanguagePrompt: "Vous pouvez répondre dans votre langue maternelle",
    processingText: "Merci ! Nous traduisons soigneusement vos paroles.",
    processingTitle: "Traitement en cours...",
    errorText: "Désolé, je n'ai pas entendu grand-chose. Réessayons",
    audioTooLowError: "Désolé, je ne vous ai pas bien entendu.",
    processingError: "Erreur lors du traitement de l'audio.",
    timeoutError: "Le traitement prend trop de temps. Veuillez réessayer.",
    changeQuestionPrompt: "Voulez-vous répondre à une autre question ?",
    changeQuestionLastPrompt: "On en fait une dernière ?",
    tryAgainButton: "Réessayer",
    noThanksButton: "Non merci",
    stopButton: "ARRÊTER",
    status: "Enregistrement en cours... Nous vous écoutons"
  },
  ro: {
    greeting: "Bună! Îți mulțumim că ai ales să te joci cu noi. Vrei să răspunzi la o întrebare simplă? Îți vom pune întrebarea în română, dar poți răspunde în limba ta maternă. Răspunsul tău va rămâne anonim. Simte-te liber să răspunzi cum dorești!",
    readyButton: "Sunt gata",
    nativeLanguagePrompt: "Poți răspunde în limba ta maternă",
    processingText: "Mulțumim! Îți traducem cu atenție cuvintele.",
    processingTitle: "Procesare...",
    errorText: "Scuze, dar nu am auzit prea bine. Să încercăm din nou",
    audioTooLowError: "Îmi pare rău, dar nu am auzit bine.",
    processingError: "Eroare la procesarea audio.",
    timeoutError: "Procesarea durează prea mult. Încearcă din nou.",
    changeQuestionPrompt: "Vrei să răspunzi la o altă întrebare?",
    changeQuestionLastPrompt: "Să facem o ultimă întrebare?",
    tryAgainButton: "Încearcă din nou",
    noThanksButton: "Nu, mersi",
    stopButton: "STOP",
    status: "Înregistrare în curs... Te ascultăm"
  },
  ar: {
    greeting: "مرحباً! شكراً لاختيارك اللعب معنا. هل ترغب في الإجابة على سؤال بسيط؟ سنطرحه عليك باللغة العربية ولكن يمكنك الإجابة بلغتك الأم. ستبقى إجابتك سرية. لا تتردد في الإجابة بما تريد!",
    readyButton: "أنا جاهز",
    nativeLanguagePrompt: "يمكنك الإجابة بلغتك الأم",
    processingText: "شکراً لك! نحن نترجم كلماتك بعناية.",
    processingTitle: "جاري المعالجة...",
    errorText: "معذرة، لم أسمع جيداً. فلنحاول مجدداً",
    audioTooLowError: "معذرة، لم أسمعك جيداً.",
    processingError: "خطأ في معالجة الصوت.",
    timeoutError: "المعالجة تستغرق وقتاً طويلاً. يرجى المحاولة مرة أخرى.",
    changeQuestionPrompt: "هل ترغب في الإجابة على سؤال آخر؟",
    changeQuestionLastPrompt: "هل نطرح سؤالاً أخيراً؟",
    tryAgainButton: "إعادة المحاولة",
    noThanksButton: "لا شكراً",
    stopButton: "إيقاف",
    status: "جاري التسجيل... نحن نستمع إليك"
  },
  de: {
    greeting: "Hallo! Vielen Dank, dass du dich entschieden hast, mit uns zu spielen. Möchtest du eine einfache Frage beantworten? Wir stellen sie dir auf Deutsch, aber du kannst in deiner Muttersprache antworten. Deine Antwort bleibt anonym. Antworte ganz unbefangen, was du möchtest!",
    readyButton: "Ich bin bereit",
    nativeLanguagePrompt: "Du kannst in deiner Muttersprache antworten",
    processingText: "Danke! Wir übersetzen deine Worte sorgfältig.",
    processingTitle: "Verarbeitung läuft...",
    errorText: "Entschuldigung, ich habe nicht viel gehört. Lass es uns noch einmal versuchen",
    audioTooLowError: "Es tut mir leid, ich konnte dich nicht gut hören.",
    processingError: "Fehler bei der Audioverarbeitung.",
    timeoutError: "Die Verarbeitung dauert zu lange. Bitte versuche es erneut.",
    changeQuestionPrompt: "Möchtest du eine andere Frage beantworten?",
    changeQuestionLastPrompt: "Wollen wir eine letzte Frage machen?",
    tryAgainButton: "Erneut versuchen",
    noThanksButton: "Nein, danke",
    stopButton: "STOPP",
    status: "Aufnahme läuft... Wir hören dir zu"
  },
  pt: {
    greeting: "Olá! Obrigado por escolher jogar conosco. Gostaria de responder a uma pergunta simples? Nós faremos a pergunta em português, mas você pode responder na sua língua materna. Sua resposta será anônima. Sinta-se livre para responder o que quiser!",
    readyButton: "Estou pronto",
    nativeLanguagePrompt: "Você pode responder na sua língua materna",
    processingText: "Obrigado! Estamos traduzindo suas palavras com cuidado.",
    processingTitle: "Processando...",
    errorText: "Desculpe, não ouvi quase nada. Vamos tentar novamente",
    audioTooLowError: "Desculpe, não consegui ouvir bem.",
    processingError: "Erro ao processar áudio.",
    timeoutError: "O processamento está demorando muito. Por favor, tente novamente.",
    changeQuestionPrompt: "Gostaria de responder a outra pergunta?",
    changeQuestionLastPrompt: "Vamos fazer uma última pergunta?",
    tryAgainButton: "Tentar novamente",
    noThanksButton: "Não, obrigado",
    stopButton: "PARAR",
    status: "Gravação em andamento... Estamos ouvindo você"
  },
  uk: {
    greeting: "Привіт! Дякуємо, що вирішили пограти з нами. Бажаєте відповісти на просте запитання? Ми поставимо його українською, але ви можете відповідати рідною мовою. Ваша відповідь залишиться анонімною. Відповідайте все, що забажаєте!",
    readyButton: "Я готовий",
    nativeLanguagePrompt: "Ви можете відповідати рідною мовою",
    processingText: "Дякуємо! Ми бережно перекладаємо ваші слова.",
    processingTitle: "Обробка...",
    errorText: "Вибачте, майже нічого не було чутно. Спробуймо ще раз",
    audioTooLowError: "Вибачте, я не розчув.",
    processingError: "Помилка обробки аудіо.",
    timeoutError: "Обробка триває занадто довго. Спробуйте ще раз.",
    changeQuestionPrompt: "Бажаєте відповісти на інше запитання?",
    changeQuestionLastPrompt: "Зробимо останнє?",
    tryAgainButton: "Спробувати ще раз",
    noThanksButton: "Ні, дякую",
    stopButton: "СТОП",
    status: "Запис триває... Ми слухаємо вас"
  }
};

export async function extractQuestionsFromPdf(pdfBase64: string): Promise<any[]> {
  try {
    const fetchExtract = async () => {
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [
          {
            inlineData: {
              data: pdfBase64,
              mimeType: "application/pdf"
            }
          },
          {
            text: `Leggi questo documento PDF ed estrai tutte le domande presenti per l'installazione "Botta & Risposta".
Per ciascuna domanda trovata nel documento, determina:
1. Una categoria appropriata tra: "Passato", "Presente", o "Futuro".
2. Il testo italiano della domanda nel campo "it".
3. Se presente o facilmente traducibile, il corrispondente testo inglese nel campo "en".

Restituisci un array JSON contenente l'elenco delle domande secondo lo schema richiesto.`
          }
        ],
        config: {
          temperature: 0.1,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                category: { type: Type.STRING, enum: ["Passato", "Presente", "Futuro"], description: "La categoria temporale della domanda" },
                it: { type: Type.STRING, description: "Il testo della domanda in Italiano" },
                en: { type: Type.STRING, description: "Il testo della domanda in Inglese (facoltativo)" }
              },
              required: ["category", "it"]
            }
          }
        }
      });

      if (response.text) {
        return JSON.parse(response.text) as any[];
      }
      throw new Error("Nessuna risposta ricevuta da Gemini durante la lettura del PDF.");
    };

    return await runWithRetry(fetchExtract, 4, 2000);
  } catch (error) {
    console.error("Errore nell'estrazione delle domande dal PDF:", error);
    throw error;
  }
}

