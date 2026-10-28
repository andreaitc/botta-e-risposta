import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BookOpen, Code, Sparkles, Mic, Music, Database, Terminal, 
  Settings, CheckCircle2, ChevronDown, ChevronUp, AlertCircle, Info,
  Layers, Cpu, FileSpreadsheet, Play, Check, ShieldAlert
} from 'lucide-react';

export function UserGuideTab() {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    quickstart: true,
    workflow: false,
    customisations: true,
    technical: false,
    troubleshooting: false
  });

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Title & Introduction */}
      <div className="bg-gradient-to-r from-olive/10 to-primary/5 rounded-[32px] p-6 md:p-8 border border-olive/20 shadow-sm">
        <div className="flex items-center gap-4 mb-4">
          <div className="p-3 bg-white rounded-2xl shadow-md border border-olive/30 text-olive">
            <BookOpen className="w-8 h-8" />
          </div>
          <div>
            <h2 className="font-serif text-2xl md:text-3xl font-black text-olive italic leading-tight">
              Manuale d'Uso & Registro Personalizzazioni
            </h2>
            <p className="text-xs text-text-muted font-mono tracking-widest uppercase mt-1">
              Guida operativa dell'applicazione e memoria tecnica delle soluzioni sviluppate
            </p>
          </div>
        </div>
        <p className="text-sm text-ink/80 leading-relaxed max-w-4xl">
          Benvenuto nella console di consultazione dell'applicazione. Questa pagina è stata creata per documentare 
          nel dettaglio il funzionamento dell'app, i flussi audio elaborati tramite Intelligenza Artificiale 
          e <strong>le centinaia di modifiche e calibrazioni su misura</strong> apportate per rendere l'esperienza 
          altamente professionale, fluida e sicura.
        </p>
      </div>

      {/* QUICKSTART GUIDE */}
      <div className="bg-white rounded-3xl p-6 border border-ink/10 shadow-sm">
        <button 
          onClick={() => toggleSection('quickstart')}
          className="w-full flex justify-between items-center text-left"
        >
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-olive" />
            <span className="font-serif text-xl font-bold text-olive">1. Flusso di Funzionamento Rapido (Come Funziona l'App)</span>
          </div>
          {openSections.quickstart ? <ChevronUp className="w-5 h-5 text-ink/40" /> : <ChevronDown className="w-5 h-5 text-ink/40" />}
        </button>

        <AnimatePresence>
          {openSections.quickstart && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mt-6 space-y-6 pt-4 border-t border-ink/5"
            >
              <div className="grid md:grid-cols-4 gap-4">
                <div className="bg-warm-bg/30 p-4 rounded-2xl border border-border/40 flex flex-col justify-between">
                  <div>
                    <span className="text-xs font-mono font-bold text-olive bg-olive/10 px-2 py-0.5 rounded-full inline-block mb-3">FASE 1</span>
                    <h4 className="font-bold text-xs uppercase tracking-wider text-ink mb-2 flex items-center gap-1.5">
                      <Mic className="w-3.5 h-3.5 text-accent" /> Domanda & Voce
                    </h4>
                    <p className="text-xs text-ink/75 leading-relaxed">
                      L'utente seleziona una lingua e una domanda attiva. Registra la sua risposta. Un indicatore radiale indica lo stato e la distorsione armonica in tempo reale.
                    </p>
                  </div>
                </div>

                <div className="bg-warm-bg/30 p-4 rounded-2xl border border-border/40 flex flex-col justify-between">
                  <div>
                    <span className="text-xs font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full inline-block mb-3">FASE 2</span>
                    <h4 className="font-bold text-xs uppercase tracking-wider text-ink mb-2 flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5 text-primary" /> Riconoscimento AI
                    </h4>
                    <p className="text-xs text-ink/75 leading-relaxed">
                      L'audio viene inviato a <strong>Gemini (server-side)</strong>. Riconosce la lingua originaria, traduce in italiano, genera una parola chiave evocativa ed un invito per altre domande.
                    </p>
                  </div>
                </div>

                <div className="bg-warm-bg/30 p-4 rounded-2xl border border-border/40 flex flex-col justify-between">
                  <div>
                    <span className="text-xs font-mono font-bold text-accent bg-accent/10 px-2 py-0.5 rounded-full inline-block mb-3">FASE 3</span>
                    <h4 className="font-bold text-xs uppercase tracking-wider text-ink mb-2 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-accent" /> Mix Studio
                    </h4>
                    <p className="text-xs text-ink/75 leading-relaxed">
                      I file audio approvati si accumulano in archivio. Nello <strong>Studio di Missaggio</strong>, puoi ordinare le clip, impostare crossfade dinamici e miscelare una musica di sottofondo globale.
                    </p>
                  </div>
                </div>

                <div className="bg-warm-bg/30 p-4 rounded-2xl border border-border/40 flex flex-col justify-between">
                  <div>
                    <span className="text-xs font-mono font-bold text-emerald bg-emerald-500/10 px-2 py-0.5 rounded-full inline-block mb-3">FASE 4</span>
                    <h4 className="font-bold text-xs uppercase tracking-wider text-ink mb-2 flex items-center gap-1.5">
                      <Database className="w-3.5 h-3.5 text-emerald-600" /> Esportazione WAV / ZIP
                    </h4>
                    <p className="text-xs text-ink/75 leading-relaxed">
                      Combina tutte le tracce ricampionate ed effettua il download del file WAV finale già mixato, di un pacchetto archivio completo ZIP o di cartelle strutturate per installazioni.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* CORE WORKFLOWS STEP-BY-STEP */}
      <div className="bg-white rounded-3xl p-6 border border-ink/10 shadow-sm">
        <button 
          onClick={() => toggleSection('workflow')}
          className="w-full flex justify-between items-center text-left"
        >
          <div className="flex items-center gap-3">
            <Layers className="w-6 h-6 text-olive" />
            <span className="font-serif text-xl font-bold text-olive">2. Dettaglio dei Flussi & Come Gestirli al Meglio</span>
          </div>
          {openSections.workflow ? <ChevronUp className="w-5 h-5 text-ink/40" /> : <ChevronDown className="w-5 h-5 text-ink/40" />}
        </button>

        <AnimatePresence>
          {openSections.workflow && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mt-6 space-y-6 pt-4 border-t border-ink/5 text-sm"
            >
              <div className="space-y-4">
                <div className="border-l-4 border-olive pl-4 space-y-1">
                  <h4 className="font-bold text-ink">Registrazione Vocale & Conversione Sicura</h4>
                  <p className="text-xs text-ink/80 leading-relaxed">
                    Il sistema registra l'audio dal microfono configurato. Durante la registrazione viene monitorato lo spettro ed i canali. 
                    Il file audio registrato temporaneamente viene salvato in <strong>IndexedDB (tramite audioStorage.ts)</strong> sotto forma di Blob PCM ad alta fedeltà. 
                    Questo evita consumo eccessivo di memoria volatile su iPad ed evita la perdita dei contenuti in caso di sbalzi della batteria.
                  </p>
                </div>

                <div className="border-l-4 border-primary pl-4 space-y-1">
                  <h4 className="font-bold text-ink">L'Area Studio: Segreti del Mixer Digitale</h4>
                  <p className="text-xs text-ink/80 leading-relaxed">
                    Nello Studio puoi impostare i millisecondi (o secondi) di <em>Crossfade</em> (dissolvenza incrociata) tra le varie tracce di testimonianza. 
                    Il pulsante <strong>"Genera Anteprima"</strong> crea un mix ad-hoc temporaneo. Puoi regolare il volume della singola traccia, ritagliare l'intervallo temporale 
                    utilizzando le maniglie visive di Wavesurfer (Trim Start/End) o sovrapporre una colonna sonora musicale complessiva caricando un file MP3/WAV o selezionando i loop forniti.
                  </p>
                </div>

                <div className="border-l-4 border-accent pl-4 space-y-1">
                  <h4 className="font-bold text-ink">Gestione Transazioni Admin & Caricamento Database</h4>
                  <p className="text-xs text-ink/80 leading-relaxed">
                    Dal pannello di amministrazione puoi caricare elenchi di domande in formato Excel (.xlsx). Puoi cliccare su ed elaborare i file. 
                    Ma la vera magia è l'<strong>Estrattore PDF assistito</strong>: carica un documento PDF con l'elenco grezzo delle domande e Gemini identificherà automaticamente la categoria, 
                    ordinerà le domande e genererà una struttura pronti per l'importazione nel database interno dell'applicazione.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* DETAILED REGISTER OF CUSTOMISATIONS (MILLESIMO DETTAGLIO) */}
      <div className="bg-white rounded-3xl p-6 border border-ink/10 shadow-sm border-olive/30 ring-1 ring-olive/5">
        <button 
          onClick={() => toggleSection('customisations')}
          className="w-full flex justify-between items-center text-left"
        >
          <div className="flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-accent" />
            <div className="flex flex-col">
              <span className="font-serif text-xl font-bold text-olive">3. Registro delle Personalizzazioni Sviluppate</span>
              <span className="text-[10px] font-mono text-text-muted">Manteniamo la memoria storica del software</span>
            </div>
          </div>
          {openSections.customisations ? <ChevronUp className="w-5 h-5 text-ink/40" /> : <ChevronDown className="w-5 h-5 text-ink/40" />}
        </button>

        <AnimatePresence>
          {openSections.customisations && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mt-6 space-y-6 pt-4 border-t border-ink/5"
            >
              <div className="space-y-4">
                
                {/* 1. MIGRATION TO FULL-STACK */}
                <div className="bg-[#FAF9F6] p-5 rounded-2xl border border-ink/5 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-emerald-100 text-emerald-800 rounded-lg mt-0.5">
                      <Check className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start flex-wrap gap-2">
                        <h4 className="font-bold text-sm text-ink font-sans uppercase tracking-wide">
                          Migrazione Full-Stack (Server Express + Esbuild)
                        </h4>
                        <span className="text-[10px] bg-emerald-500/10 text-emerald-800 font-mono font-bold px-2 py-0.5 rounded-full">STRUTTURA</span>
                      </div>
                      <p className="text-xs text-ink/75 leading-relaxed mt-1">
                        Inizialmente, l'applicazione effettuava chiamate API Gemini direttamente dal client. Abbiamo modificato radicalmente questa architettura 
                        creando un backend sicuro in Node.js Express (<code className="font-mono bg-ink/5 px-1 py-0.5 rounded">server.ts</code>) ed isolando tutte le chiavi 
                        dall'esposizione sul browser. Le transazioni ad alta densità di dati (come l'upload di audio lunghi o PDF corposi) ora vengono instradate 
                        attraverso proxy API sicuri con limiti di carico incrementati a <strong>150 Megabytes</strong>.
                      </p>
                    </div>
                  </div>
                </div>

                {/* 2. PROGRESS BAR FIX AT 10% AND TRANSITIONS */}
                <div className="bg-[#FAF9F6] p-5 rounded-2xl border border-ink/5 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-emerald-100 text-emerald-800 rounded-lg mt-0.5">
                      <Check className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start flex-wrap gap-2">
                        <h4 className="font-bold text-sm text-ink font-sans uppercase tracking-wide">
                          Risoluzione Blocco Caricamento Tracce al 10% & Transizioni
                        </h4>
                        <span className="text-[10px] bg-amber-500/10 text-amber-800 font-mono font-bold px-2 py-0.5 rounded-full">FLUIDITÀ UI</span>
                      </div>
                      <p className="text-xs text-ink/75 leading-relaxed mt-1">
                        Risolto il problema di blocco temporaneo al 10% che accadeva durante la decompressione e preparazione iniziale delle tracce audio in studio e nell'esportazione. 
                        Abbiamo inserito un contatore di progresso granularizzato in frazioni di caricamento della decodifica dell'AudioContext nel file <code className="font-mono bg-ink/5 px-1 py-0.5 rounded">studioMixer.ts</code>. 
                        Inoltre, i caricamenti asincroni e i messaggi vengono ora visualizzati dinamicamente su tutte le schermate operative, azzerando le transizioni incomplete.
                      </p>
                    </div>
                  </div>
                </div>

                {/* 3. 95% BLOCK FIXED FOR PROCESSING CIRCLE */}
                <div className="bg-[#FAF9F6] p-5 rounded-2xl border border-ink/5 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-emerald-100 text-emerald-800 rounded-lg mt-0.5">
                      <Check className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start flex-wrap gap-2">
                        <h4 className="font-bold text-sm text-ink font-sans uppercase tracking-wide">
                          Risoluzione del Blocco Calcolo Elaborazione al 95%
                        </h4>
                        <span className="text-[10px] bg-purple-500/10 text-purple-800 font-mono font-bold px-2 py-0.5 rounded-full">STABILITÀ AI</span>
                      </div>
                      <p className="text-xs text-ink/75 leading-relaxed mt-1">
                        Nel cerchio di progresso dell'elaborazione della registrazione vocale, il caricamento si fermava indefinitamente a 95% simulando attività ma senza dare feedback. 
                        Abbiamo modificato l'asincronia per scambiare messaggi reali con il backend Express, portando la barra di avanzamento e i messaggi dedicati 
                        fino al 100% effettivo solo quando le risposte tradotte e categorizzate di Gemini sono state completamente memorizzate.
                      </p>
                    </div>
                  </div>
                </div>

                {/* 4. CHIAVE DI MEMORIA PER MICROFONI IPAD */}
                <div className="bg-[#FAF9F6] p-5 rounded-2xl border border-ink/5 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-emerald-100 text-emerald-800 rounded-lg mt-0.5">
                      <Check className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start flex-wrap gap-2">
                        <h4 className="font-bold text-sm text-ink font-sans uppercase tracking-wide">
                          Gestione Microfono Dedicata per iPad e Dispositivi Esterni
                        </h4>
                        <span className="text-[10px] bg-blue-500/10 text-blue-800 font-mono font-bold px-2 py-0.5 rounded-full">HARDWARE</span>
                      </div>
                      <p className="text-xs text-ink/75 leading-relaxed mt-1">
                        I driver iOS/Safari bloccano l'AudioContext in caso di inattività. Abbiamo strutturato un pulsante di configurazione 
                        e sblocco automatico all'interno dell'amministrazione per permettere il cambio del microfono attivo, l'abilitazione del guadagno manuale 
                        e il monitor dei kHz per l'installazione in stand espositivi con microfoni professionali USB o jack.
                      </p>
                    </div>
                  </div>
                </div>

                {/* 5. GESTIONE DEI COOLDOWN E CACHE AUDIO */}
                <div className="bg-[#FAF9F6] p-5 rounded-2xl border border-ink/5 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-emerald-100 text-emerald-800 rounded-lg mt-0.5">
                      <Check className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start flex-wrap gap-2">
                        <h4 className="font-bold text-sm text-ink font-sans uppercase tracking-wide">
                          Ottimizzatore Storage IndexedDB & File ZIP
                        </h4>
                        <span className="text-[10px] bg-teal-500/10 text-teal-800 font-mono font-bold px-2 py-0.5 rounded-full">EFFICIENZA</span>
                      </div>
                      <p className="text-xs text-ink/75 leading-relaxed mt-1">
                        Per preservare la memoria, l'app include un gestore dei consumi di archiviazione (sotto forma di percentuale nella barra inferiore della pagina). 
                        Durante l'esportazione di un intero pacchetto ZIP, il sistema estrae in modalità asincrona sequenziale i dati da IndexedDB, preservando la CPU dell'iPad 
                        da crash improvvisi di WebKit che si verificavano esportando decine di megabyte di dati in parallelo.
                      </p>
                    </div>
                  </div>
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* TECHNICAL GUIDE FOR DEVELOPERS */}
      <div className="bg-white rounded-3xl p-6 border border-ink/10 shadow-sm">
        <button 
          onClick={() => toggleSection('technical')}
          className="w-full flex justify-between items-center text-left"
        >
          <div className="flex items-center gap-3">
            <Terminal className="w-6 h-6 text-olive" />
            <span className="font-serif text-xl font-bold text-olive">4. Informazioni Tecniche (Tra un anno...)</span>
          </div>
          {openSections.technical ? <ChevronUp className="w-5 h-5 text-ink/40" /> : <ChevronDown className="w-5 h-5 text-ink/40" />}
        </button>

        <AnimatePresence>
          {openSections.technical && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mt-6 space-y-6 pt-4 border-t border-ink/5 text-xs text-ink/80"
            >
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <h5 className="font-bold text-xs uppercase tracking-wide text-ink mb-2">Variabili d'Ambiente (<code className="font-mono">.env</code>)</h5>
                    <div className="bg-ink/5 p-3 rounded-xl border border-ink/10 font-mono text-[11px] text-ink/70">
                      # Chiave API di Google Gemini per elaborazione voce e PDF<br />
                      GEMINI_API_KEY=AIzaSyD...<br /><br />
                      # Modalità di ambiente<br />
                      NODE_ENV=production
                    </div>
                  </div>

                  <div>
                    <h5 className="font-bold text-xs uppercase tracking-wide text-ink mb-2">Comandi Principali per Avviare il Software</h5>
                    <div className="space-y-2">
                      <p className="leading-normal">
                        <strong>Avvio Sviluppo:</strong> <code className="font-mono bg-ink/5 px-1.5 py-0.5 rounded text-primary">npm run dev</code> (utilizza <code className="font-mono">tsx</code> per avviare il server express con supporto automatico TypeScript).
                      </p>
                      <p className="leading-normal">
                        <strong>Build di Produzione:</strong> <code className="font-mono bg-ink/5 px-1.5 py-0.5 rounded text-primary">npm run build</code> (compila il lato client tramite Vite ed esegue il pacchettizzatore CJS di Esbuild per produrre un server autonomo in <code className="font-mono">dist/server.cjs</code>).
                      </p>
                      <p className="leading-normal">
                        <strong>Start Produzione:</strong> <code className="font-mono bg-ink/5 px-1.5 py-0.5 rounded text-primary">npm run start</code> (avvia il server Node nativo sulla porta 3000).
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <h5 className="font-bold text-xs uppercase tracking-wide text-ink mb-2">Mappa dei File Chiave del Sistema</h5>
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b border-ink/10 text-left font-bold text-[10px] text-text-muted">
                          <th className="pb-2">File o Directory</th>
                          <th className="pb-2">Ruolo Principale</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ink/5">
                        <tr>
                          <td className="py-2 font-mono text-[11px] text-primary">/server.ts</td>
                          <td className="py-2 text-[11px]">Server di backend Express e proxy per API di Gemini.</td>
                        </tr>
                        <tr>
                          <td className="py-2 font-mono text-[11px] text-primary">/src/lib/gemini.server.ts</td>
                          <td className="py-2 text-[11px]">Integrazione diretta con le API di Gemini (server-side).</td>
                        </tr>
                        <tr>
                          <td className="py-2 font-mono text-[11px] text-primary">/src/lib/gemini.ts</td>
                          <td className="py-2 text-[11px]">Client-side proxy wrapper per invocare le funzioni del backend.</td>
                        </tr>
                        <tr>
                          <td className="py-2 font-mono text-[11px] text-primary">/src/lib/studioMixer.ts</td>
                          <td className="py-2 text-[11px]">Algoritmi di render, mixaggio, crossfade ed encoding in WAV.</td>
                        </tr>
                        <tr>
                          <td className="py-2 font-mono text-[11px] text-primary">/src/lib/audioStorage.ts</td>
                          <td className="py-2 text-[11px]">Wrapper IndexedDB per memorizzazione persistente di Blob Audio.</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="bg-amber-50 rounded-2xl border border-amber-200/60 p-4 space-y-1.5 text-amber-900">
                    <h6 className="font-bold text-xs flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 text-amber-600" />
                      Attenzione sulla Porta di Esecuzione
                    </h6>
                    <p className="text-[11px] leading-relaxed">
                      L'applicazione risponde rigorosamente ed unicamente sul container alla porta asincrona <strong>3000</strong>. Qualsiasi configurazione o debug locale che tenti di forzare un'altra porta non esporrà l'applicazione correttamante sul pannello di AI Studio o sui server di Cloud Run.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </div>
  );
}
