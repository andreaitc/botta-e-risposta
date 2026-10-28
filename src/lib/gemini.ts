export interface TestimonyResult {
  domanda_proposta: string;
  domanda_proposta_lingua_originale: string;
  domanda_voto?: string;
  category?: string;
  lingua_originale: string;
  trascrizione_originale: string;
  traduzione_italiano: string;
  parola_chiave: string;
  parola_chiave_lingua_originale: string;
  etichetta_parola_chiave_lingua_originale: string;
  invito_altra_domanda_lingua_originale: string;
  no_grazie_lingua_originale: string;
}


async function callGeminiApi(functionName: string, args: any[], signal?: AbortSignal): Promise<any> {
  const response = await fetch('/api/gemini', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ functionName, args }),
    signal,
  }).catch((err) => {
    if (err.name === 'AbortError') {
      throw err;
    }
    throw new Error(`Errore di connessione al server: ${err.message}`);
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(errText || `Errore del server durante ${functionName}`);
  }
  return response.json();
}

export async function processAudioTestimony(
  audioBase64: string,
  mimeType: string,
  question: string,
  signal?: AbortSignal
): Promise<TestimonyResult> {
  return callGeminiApi('processAudioTestimony', [audioBase64, mimeType, question], signal);
}

export async function analyzeVoicesForMusic(
  texts: string[],
  signal?: AbortSignal
): Promise<string> {
  return callGeminiApi('analyzeVoicesForMusic', [texts], signal);
}

export async function generateMusicFromPrompt(
  prompt: string
): Promise<Blob> {
  // We handle Blob response specially if needed, but generateMusicFromPrompt is returning a Blob.
  // Wait, does the server return a Blob? Let's make sure the client fetches it and converts it to a Blob!
  // In callGeminiApi we return response.json(), so let's handle generateMusicFromPrompt as a binary file fetch or base64.
  const response = await fetch('/api/gemini', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ functionName: 'generateMusicFromPrompt', args: [prompt] }),
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(errText || "Errore del server durante generateMusicFromPrompt");
  }
  return response.blob();
}

export async function translateText(
  text: string,
  langName: string
): Promise<string> {
  return callGeminiApi('translateText', [text, langName]);
}

export async function translateQuestionsBulk(
  questions: { id: string; it: string }[],
  targetLangName: string,
  signal?: AbortSignal
): Promise<Record<string, string>> {
  return callGeminiApi('translateQuestionsBulk', [questions, targetLangName], signal);
}

export async function translateToAllLanguages(
  questionIt: string,
  targetLanguages: { id: string; label: string }[],
  signal?: AbortSignal
): Promise<Record<string, string>> {
  return callGeminiApi('translateToAllLanguages', [questionIt, targetLanguages], signal);
}

export async function detectLanguageDetails(
  requestedLangName: string
): Promise<{ id: string; label: string; labelNative: string; support: 'high' | 'medium' | 'low'; dir: 'ltr' | 'rtl' }> {
  return callGeminiApi('detectLanguageDetails', [requestedLangName]);
}

export async function translateUiPhrases(
  phrases: Record<string, string>,
  targetLangName: string,
  signal?: AbortSignal
): Promise<Record<string, string>> {
  return callGeminiApi('translateUiPhrases', [phrases, targetLangName], signal);
}

export async function extractQuestionsFromPdf(
  pdfBase64: string
): Promise<any[]> {
  return callGeminiApi('extractQuestionsFromPdf', [pdfBase64]);
}
