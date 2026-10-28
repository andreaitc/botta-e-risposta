import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, Plus, Edit2, Trash2, Upload, Download, Search, Check, 
  RotateCcw, FileText, Database, Languages, Calendar, Info, Save, 
  X, AlertTriangle, ChevronRight, FileSpreadsheet, Sparkles, Mic, Volume2, Loader2,
  Star, MessageSquare, BookOpen
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { Question, Category } from '../data/questions';
import { getNiceLanguageLabel } from '../lib/languagesStore';
import { translateToAllLanguages, translateUiPhrases, detectLanguageDetails, translateText, translateQuestionsBulk as geminiTranslateQuestionsBulk, extractQuestionsFromPdf } from '../lib/gemini';
import { UserGuideTab } from './UserGuideTab';

// Full configuration pool of languages (matching App.tsx)
const LANGUAGES_POOL_STATIC = [
  { id: 'it', label: 'ITALIANO', labelNative: 'Italiano' },
  { id: 'en', label: 'INGLESE', labelNative: 'English' },
  { id: 'ar', label: 'ARABO', labelNative: 'العربية' },
  { id: 'fr', label: 'FRANCESE', labelNative: 'Français' },
  { id: 'bn', label: 'BENGALESE', labelNative: 'বাংলা' },
  { id: 'so', label: 'SOMALO', labelNative: 'Soomaali' },
  { id: 'bm', label: 'BAMBARA', labelNative: 'Bamanankan' },
  { id: 'mnk', label: 'MANDINKA', labelNative: "Mandin'ka" },
  { id: 'uk', label: 'UCRAINO', labelNative: 'українською' },
  { id: 'ddn', label: 'DENDI', labelNative: 'Dendi' },
  { id: 'ps', label: 'PASTHU', labelNative: 'پښتو' },
  { id: 'fa', label: 'FARSI', labelNative: 'فارسی' },
  { id: 'ur', label: 'URDU', labelNative: 'اردو' },
  { id: 'es', label: 'SPAGNOLO', labelNative: 'español' },
  { id: 'fuc', label: 'PULAAR', labelNative: 'Pulaar' },
  { id: 'kri', label: 'KRIO', labelNative: 'Krio' },
  { id: 'zh', label: 'CINESE', labelNative: '中文' },
  { id: 'hi', label: 'HINDI', labelNative: 'हिन्दी' },
  { id: 'pt', label: 'PORTOGHESE', labelNative: 'Português' },
  { id: 'ru', label: 'RUSSO', labelNative: 'Русский' },
  { id: 'ind', label: 'INDONESIANO', labelNative: 'Bahasa Indonesia' },
  { id: 'de', label: 'TEDESCO', labelNative: 'Deutsch' },
  { id: 'ja', label: 'GIAPPONESE', labelNative: '日本語' },
  { id: 'sw', label: 'SWAHILI', labelNative: 'Kiswahili' },
  { id: 'tr', label: 'TURCO', labelNative: 'Türkçe' },
  { id: 'pa', label: 'PUNJABI', labelNative: 'ਪੰਜਾਬੀ' },
  { id: 'gwe', label: 'GUÉRÉ', labelNative: 'Guéré' },
  { id: 'tw', label: 'TWI', labelNative: 'Twi' },
  { id: 'bete', label: 'BÉTÉ', labelNative: 'Bété' },
  { id: 'mos', label: 'MOORÉ', labelNative: 'Mooré' },
  { id: 'ro', label: 'ROMENO', labelNative: 'Română' }
];

const stableMergedLanguagesPool: any[] = [];
let lastCustomLangsPoolStr: string | null = null;

const getMergedLanguagesPool = () => {
  const custom = localStorage.getItem('custom_languages') || '';
  if (lastCustomLangsPoolStr !== custom) {
    lastCustomLangsPoolStr = custom;
    let merged = [...LANGUAGES_POOL_STATIC];
    if (custom) {
      try {
        const parsed = JSON.parse(custom);
        if (Array.isArray(parsed)) {
          const seenIds = new Set(LANGUAGES_POOL_STATIC.map((l: any) => l.id));
          const uniqueParsed: any[] = [];
          for (const l of parsed) {
            if (l && l.id && !seenIds.has(l.id)) {
              seenIds.add(l.id);
              uniqueParsed.push(l);
            }
          }
          merged = [...LANGUAGES_POOL_STATIC, ...uniqueParsed];
        }
      } catch(e) {}
    }
    stableMergedLanguagesPool.length = 0;
    stableMergedLanguagesPool.push(...merged);
  }
  return stableMergedLanguagesPool;
};

// Initial execution to populate stable target array
getMergedLanguagesPool();

export const LANGUAGES_POOL = new Proxy(stableMergedLanguagesPool, {
  get(target, prop) {
    getMergedLanguagesPool();
    return Reflect.get(target, prop);
  },
  ownKeys(target) {
    getMergedLanguagesPool();
    return Reflect.ownKeys(target);
  },
  getOwnPropertyDescriptor(target, prop) {
    getMergedLanguagesPool();
    return Reflect.getOwnPropertyDescriptor(target, prop);
  }
}) as any;

const LANGUAGE_SUPPORT_RAW: Record<string, 'high' | 'medium' | 'low'> = {
  it: 'high',
  en: 'high',
  ar: 'high',
  fr: 'high',
  es: 'high',
  zh: 'high',
  hi: 'high',
  pt: 'high',
  ru: 'high',
  ind: 'high',
  de: 'high',
  ja: 'high',
  tr: 'high',
  ro: 'high',
  
  bn: 'medium',
  uk: 'medium',
  ps: 'medium',
  fa: 'medium',
  ur: 'medium',
  sw: 'medium',
  pa: 'medium',
  tw: 'medium',
  so: 'medium',
  ku: 'medium',
  
  bm: 'low',
  mnk: 'low',
  ddn: 'low',
  fuc: 'low',
  kri: 'low',
  gwe: 'low',
  bete: 'low',
  mos: 'low',
  wo: 'low'
};

export const LANGUAGE_SUPPORT = new Proxy(LANGUAGE_SUPPORT_RAW, {
  get(target, prop) {
    if (typeof prop === 'string') {
      const customSupport = localStorage.getItem('custom_language_support');
      if (customSupport) {
        try {
          const parsed = JSON.parse(customSupport);
          if (prop in parsed) {
            return parsed[prop];
          }
        } catch(e) {}
      }
    }
    return target[prop as keyof typeof target] || 'low';
  }
}) as any;

interface SavedSet {
  id: string;
  name: string;
  date: string;
  questions: Question[];
}

interface AdminPanelProps {
  activeQuestions: Question[];
  onUpdateActiveQuestions: (questions: Question[]) => void;
  enabledLanguages: string[];
  onUpdateEnabledLanguages: (languages: string[]) => void;
  questionArchives: SavedSet[];
  onUpdateQuestionArchives: (archives: SavedSet[]) => void;
  originalQuestions: Question[];
  onBack: () => void;
  onActivityInProgressChange?: (active: boolean) => void;
  
  // Testimonies Management
  archive?: any[];
  onEditTestimony?: (testimony: any) => void;
  onUpdateTestimony?: (testimony: any) => void;
  onViewTestimony?: (testimony: any) => void;
  onDeleteTestimony?: (id: string, e: React.MouseEvent) => void;
  onToggleFavoriteTestimony?: (id: string, e: React.MouseEvent) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  activeQuestions,
  onUpdateActiveQuestions,
  enabledLanguages,
  onUpdateEnabledLanguages,
  questionArchives,
  onUpdateQuestionArchives,
  originalQuestions,
  onBack,
  onActivityInProgressChange,
  
  archive = [],
  onEditTestimony,
  onUpdateTestimony,
  onViewTestimony,
  onDeleteTestimony,
  onToggleFavoriteTestimony
}) => {
  const [activeTab, setActiveTab] = useState<'questions' | 'languages' | 'archives' | 'upload' | 'audio' | 'testimonies' | 'answers' | 'guide'>('questions');
  const [searchQuery, setSearchQuery] = useState('');
  const [testimonySearchQuery, setTestimonySearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<Category | 'All'>('All');
  
  // Answers Tab State
  const [selectedAnswerIndex, setSelectedAnswerIndex] = useState<number>(0);
  const [answersSearchQuery, setAnswersSearchQuery] = useState<string>('');
  
  // Fluent Editing Fields
  const [editAnswerDomanda, setEditAnswerDomanda] = useState('');
  const [editAnswerRisposta, setEditAnswerRisposta] = useState('');
  const [editAnswerParola, setEditAnswerParola] = useState('');
  const [editAnswerCategoria, setEditAnswerCategoria] = useState('');

  // Filtered list of items for the answers view
  const filteredAnswers = (archive || []).filter(item => {
    if (!answersSearchQuery) return true;
    const q = answersSearchQuery.toLowerCase();
    return (
      (item.domanda_proposta || '').toLowerCase().includes(q) ||
      (item.traduzione_italiano || '').toLowerCase().includes(q) ||
      (item.parola_chiave || '').toLowerCase().includes(q) ||
      (item.lingua_originale || '').toLowerCase().includes(q)
    );
  });

  const activeAnswerItem = filteredAnswers[selectedAnswerIndex] !== undefined
    ? filteredAnswers[selectedAnswerIndex]
    : filteredAnswers[0] || null;

  // Sync edits when switching cards
  useEffect(() => {
    if (activeAnswerItem) {
      setEditAnswerDomanda(activeAnswerItem.domanda_proposta || '');
      setEditAnswerRisposta(activeAnswerItem.traduzione_italiano || '');
      setEditAnswerParola(activeAnswerItem.parola_chiave || '');
      setEditAnswerCategoria(activeAnswerItem.category || 'Presente');
    } else {
      setEditAnswerDomanda('');
      setEditAnswerRisposta('');
      setEditAnswerParola('');
      setEditAnswerCategoria('Presente');
    }
  }, [activeAnswerItem?.id]);

  // Reset selected index if it is out of range
  useEffect(() => {
    if (selectedAnswerIndex >= filteredAnswers.length && filteredAnswers.length > 0) {
      setSelectedAnswerIndex(0);
    }
  }, [filteredAnswers.length, selectedAnswerIndex]);

  const hasUnsavedChanges = activeAnswerItem && (
    editAnswerDomanda !== (activeAnswerItem.domanda_proposta || '') ||
    editAnswerRisposta !== (activeAnswerItem.traduzione_italiano || '') ||
    editAnswerParola !== (activeAnswerItem.parola_chiave || '') ||
    editAnswerCategoria !== (activeAnswerItem.category || 'Presente')
  );

  const handleSaveAnswer = (itemToSave: any) => {
    if (!itemToSave || !onUpdateTestimony) return;
    const updated = {
      ...itemToSave,
      domanda_proposta: editAnswerDomanda,
      traduzione_italiano: editAnswerRisposta,
      parola_chiave: editAnswerParola,
      category: editAnswerCategoria
    };
    onUpdateTestimony(updated);
  };
  
  // Question CRUD Forms
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newQuestion, setNewQuestion] = useState<Partial<Question>>({
    category: 'Presente',
    it: '',
    en: '',
    fr: '',
    ar: '',
    bn: ''
  });

  // Archive Name Form
  const [archiveSetName, setArchiveSetName] = useState('');
  const [renamingSetId, setRenamingSetId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Drag and drop state
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadToast, setUploadToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [uploadedPreview, setUploadedPreview] = useState<{ questions: Question[]; fileName: string } | null>(null);
  const [archiveOptionOnUpload, setArchiveOptionOnUpload] = useState(true);
  const [customUploadSetName, setCustomUploadSetName] = useState('');

  // Translation States
  const [isTranslatingNew, setIsTranslatingNew] = useState(false);
  const [isTranslatingEdit, setIsTranslatingEdit] = useState(false);
  const [isFileParsing, setIsFileParsing] = useState(false);
  const [autoTranslateEnabled, setAutoTranslateEnabled] = useState(true);
  const [bulkTranslationStatus, setBulkTranslationStatus] = useState<{
    total: number;
    current: number;
  } | null>(null);

  // Custom Languages states
  const [customLanguageInput, setCustomLanguageInput] = useState('');
  const [isProcessingCustomLanguage, setIsProcessingCustomLanguage] = useState(false);
  const [customLanguageProgress, setCustomLanguageProgress] = useState<{ total: number; current: number; status: string } | null>(null);

  // Local state for notification toasts
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const triggerToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Audio / Microphone Setup States & Effects
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedMic, setSelectedMic] = useState<string>(() => localStorage.getItem('preferred_mic_id') || 'default');
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [isTestingMic, setIsTestingMic] = useState(false);
  const [testVolume, setTestVolume] = useState(0);
  const testAnalyserRef = useRef<AnalyserNode | null>(null);
  const testAnimationFrameRef = useRef<number | null>(null);

  // Synchronize dynamic activity status to prevent admin inactivity timeout
  useEffect(() => {
    if (onActivityInProgressChange) {
      const active = !!(
        isTranslatingNew ||
        isTranslatingEdit ||
        bulkTranslationStatus ||
        isProcessingCustomLanguage ||
        isTestingMic
      );
      onActivityInProgressChange(active);
    }
  }, [
    isTranslatingNew,
    isTranslatingEdit,
    bulkTranslationStatus,
    isProcessingCustomLanguage,
    isTestingMic,
    onActivityInProgressChange
  ]);

  const loadAudioDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(d => d.kind === 'audioinput');
      setAudioDevices(audioInputs);
    } catch (e) {
      console.error("Error loading audio devices:", e);
    }
  };

  useEffect(() => {
    if (activeTab === 'audio') {
      loadAudioDevices();
      // Listen for hardware changes (plugging/unplugging external microphones)
      navigator.mediaDevices.addEventListener('devicechange', loadAudioDevices);
      return () => {
        navigator.mediaDevices.removeEventListener('devicechange', loadAudioDevices);
      };
    }
  }, [activeTab]);

  const requestMicLabelPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      await loadAudioDevices();
      triggerToast("Permesso concesso e lista aggiornata!", 'success');
    } catch (err) {
      console.error("Error granting mic permission:", err);
      triggerToast("Impossibile accedere al microfono. Verifica i permessi nel browser.", 'error');
    }
  };

  const startMicTest = async () => {
    if (isTestingMic) {
      stopMicTest();
      return;
    }

    try {
      const constraints: any = { audio: true };
      if (selectedMic !== 'default') {
        constraints.audio = { deviceId: { exact: selectedMic } };
      }
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setAudioStream(stream);
      setIsTestingMic(true);

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      testAnalyserRef.current = analyser;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateMeter = () => {
        if (!testAnalyserRef.current) return;
        testAnalyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        // Normalize value between 0 and 100
        setTestVolume(Math.min(100, Math.round((average / 128) * 100)));
        testAnimationFrameRef.current = requestAnimationFrame(updateMeter);
      };

      testAnimationFrameRef.current = requestAnimationFrame(updateMeter);
    } catch (e) {
      console.error("Error testing mic:", e);
      triggerToast("Errore durante l'attivazione del test. Permetti l'uso del microfono o riprova.", 'error');
    }
  };

  const stopMicTest = () => {
    if (testAnimationFrameRef.current) {
      cancelAnimationFrame(testAnimationFrameRef.current);
      testAnimationFrameRef.current = null;
    }
    if (audioStream) {
      audioStream.getTracks().forEach(track => track.stop());
      setAudioStream(null);
    }
    setIsTestingMic(false);
    setTestVolume(0);
    testAnalyserRef.current = null;
  };

  useEffect(() => {
    return () => {
      if (testAnimationFrameRef.current) {
        cancelAnimationFrame(testAnimationFrameRef.current);
      }
      if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [audioStream]);

  const handleSelectMic = (id: string) => {
    setSelectedMic(id);
    localStorage.setItem('preferred_mic_id', id);
    const selectedDevice = audioDevices.find(d => d.deviceId === id);
    if (selectedDevice) {
      localStorage.setItem('preferred_mic_label', selectedDevice.label || "Microfono esterno/integrato");
    } else if (id === 'default') {
      localStorage.setItem('preferred_mic_label', 'Predefinito di sistema');
    }
    triggerToast("Configurazione microfono salvata!", 'success');
  };

  const handleToggleLanguage = async (langId: string) => {
    // IT is the default/primary language, handle carefully but allow toggle if at least one language remains
    if (enabledLanguages.length === 1 && enabledLanguages.includes(langId)) {
      triggerToast("Devi mantenere attiva almeno una lingua!", 'error');
      return;
    }
    
    if (enabledLanguages.includes(langId)) {
      onUpdateEnabledLanguages(enabledLanguages.filter(id => id !== langId));
      triggerToast("Configurazione lingue aggiornata", 'success');
    } else {
      onUpdateEnabledLanguages([...enabledLanguages, langId]);
      triggerToast(`Lingua abilitata. Traduzione automatica di tutte le domande per "${getNiceLanguageLabel(langId)}" in corso...`, 'success');
      // Trigger auto-translation for this newly added language!
      setTimeout(() => {
        translateQuestionsForLanguages([langId]);
      }, 300);
    }
  };

  const handleEnableAllLanguages = () => {
    const allIds = LANGUAGES_POOL.map(l => l.id);
    onUpdateEnabledLanguages(allIds);
    triggerToast("Tutte le lingue sono state abilitate. Traduzione di tutte le domande in corso...", 'success');
    setTimeout(() => {
      translateQuestionsForLanguages(allIds);
    }, 300);
  };

  const handleDisableAllExceptIt = () => {
    onUpdateEnabledLanguages(['it']);
    triggerToast("Abilitato solo l'Italiano", 'success');
  };

  // Custom languages handlers
  const handleAutoCreateAndTranslateLanguage = async () => {
    const requested = customLanguageInput.trim();
    if (!requested) {
      triggerToast("Digita un nome di lingua (es. Svedese)!", "error");
      return;
    }

    setIsProcessingCustomLanguage(true);
    setCustomLanguageProgress({
      total: 100,
      current: 5,
      status: `Rilevamento delle specifiche per "${requested}" con Gemini AI...`
    });

    try {
      // 1. Detect specifications using Gemini
      const details = await detectLanguageDetails(requested);
      const { id, label, labelNative, support, dir } = details;

      if (!id || !labelNative) {
        throw new Error("Specifiche della lingua incomplete restituite da Gemini");
      }

      setCustomLanguageProgress({
        total: 100,
        current: 25,
        status: `Rilevata lingua: ${labelNative} (${label}) [Codice: ${id}, Direzione: ${dir.toUpperCase()}]. Traduzione dell'interfaccia utente in corso...`
      });

      // Check if it's already a static system language
      if (LANGUAGES_POOL_STATIC.some(l => l.id === id)) {
        // Already exists in system, just make sure it's enabled!
        if (!enabledLanguages.includes(id)) {
          onUpdateEnabledLanguages([...enabledLanguages, id]);
        }
        setCustomLanguageInput('');
        triggerToast(`La lingua "${labelNative}" è già integrata nel sistema ed è stata abilitata!`, "success");
        setIsProcessingCustomLanguage(false);
        setCustomLanguageProgress(null);
        return;
      }

      // Check if it's already in custom_languages
      const customLangsStr = localStorage.getItem('custom_languages');
      let customLangs = [];
      if (customLangsStr) {
        try {
          customLangs = JSON.parse(customLangsStr);
        } catch (e) {}
      }

      // Save custom language definition
      const newLangEntry = { id, label, labelNative };
      customLangs = customLangs.filter((l: any) => l.id !== id);
      customLangs.push(newLangEntry);
      localStorage.setItem('custom_languages', JSON.stringify(customLangs));

      // Save support level
      const customSupportStr = localStorage.getItem('custom_language_support');
      let customSupport: Record<string, string> = {};
      if (customSupportStr) {
        try {
          customSupport = JSON.parse(customSupportStr);
        } catch (e) {}
      }
      customSupport[id] = support;
      localStorage.setItem('custom_language_support', JSON.stringify(customSupport));

      // 2. Translate UI phrases
      const italianPhrases: Record<string, string> = {
        greeting: "Ciao! Grazie di aver scelto di giocare con noi. Ti va di rispondere a una semplice domanda? Noi te la facciamo in {language} ma tu potrai rispondere nella tua lingua madre. La tua risposta resterà anonima. Sentiti libero di rispondere quello che vuoi!",
        readyButton: "Sono pronto",
        nativeLanguagePrompt: "Ricorda che puoi rispondere nella tua lingua madre",
        processingText: "Grazie! Stiamo traducendo con cura le tue parole.",
        processingTitle: "Elaborazione in corso...",
        errorText: "Scusa ma non ho sentito molto. Riproviamo",
        audioTooLowError: "Mi dispiace ma non ho sentito bene.",
        processingError: "Mi dispiace ma qualcosa è andato storto.",
        timeoutError: "L'elaborazione sta impiegando troppo tempo. Riprova.",
        changeQuestionPrompt: "Vuoi cambiare domanda?",
        changeQuestionLastPrompt: "Anche questa non ti piace? Ok. Cambiamo per l'ultima volta",
        tryAgainButton: "Riprova",
        noThanksButton: "No grazie",
        stopButton: "STOP"
      };

      const translatedUi = await translateUiPhrases(italianPhrases, labelNative);
      const uiPayload = {
        ...translatedUi,
        languageName: labelNative,
        dir
      };

      const customUiStr = localStorage.getItem('custom_ui_translations');
      let customUi: Record<string, any> = {};
      if (customUiStr) {
        try {
          customUi = JSON.parse(customUiStr);
        } catch (e) {}
      }
      customUi[id] = uiPayload;
      localStorage.setItem('custom_ui_translations', JSON.stringify(customUi));

      // Save recording status phrases
      const statusPhrases = {
        status: "Registrazione in corso... Ti stiamo ascoltando"
      };
      const translatedStatus = await translateUiPhrases(statusPhrases, labelNative);
      
      const customRecStr = localStorage.getItem('custom_recording_status');
      let customRec: Record<string, any> = {};
      if (customRecStr) {
        try {
          customRec = JSON.parse(customRecStr);
        } catch (e) {}
      }
      customRec[id] = {
        native: translatedStatus.status || "Registrazione in corso...",
        it: "Registrazione in corso... Ti stiamo ascoltando"
      };
      localStorage.setItem('custom_recording_status', JSON.stringify(customRec));

      // 3. Translate all current questions in activeQuestions in a single bulk call
      const questionsToTranslate = [...activeQuestions];
      const totalQ = questionsToTranslate.length;
      
      setCustomLanguageProgress({
        total: totalQ,
        current: Math.round(totalQ / 2),
        status: `Traduzione automatica di tutte le ${totalQ} domande in "${labelNative}" in corso...`
      });

      const validQuestions = questionsToTranslate.filter(q => q.it?.trim());
      const questionsPayload = validQuestions.map(q => ({ id: String(q.id), it: q.it }));

      try {
        const translationsMap = await geminiTranslateQuestionsBulk(questionsPayload, labelNative);
        
        // Merge translations back to our questionsToTranslate array
        for (let i = 0; i < questionsToTranslate.length; i++) {
          const q = questionsToTranslate[i];
          if (translationsMap[q.id]) {
            questionsToTranslate[i] = {
              ...q,
              [id]: translationsMap[q.id]
            };
          } else if (q.it?.trim()) {
            questionsToTranslate[i] = {
              ...q,
              [id]: q.it // Fallback to Italian if translator skipped this ID
            };
          }
        }
      } catch (err) {
        console.error("Bulk questions translation failed, falling back to Italian:", err);
      }

      // Save translated questions
      onUpdateActiveQuestions(questionsToTranslate);

      // Enable the language
      if (!enabledLanguages.includes(id)) {
        onUpdateEnabledLanguages([...enabledLanguages, id]);
      } else {
        onUpdateEnabledLanguages([...enabledLanguages]);
      }

      setCustomLanguageInput('');
      triggerToast(`Lingua ${labelNative} configurata, tradotta e abilitata con successo!`, "success");
    } catch (e) {
      console.error("Auto creation/translation failed:", e);
      triggerToast("Errore durante la creazione automatica della lingua.", "error");
    } finally {
      setIsProcessingCustomLanguage(false);
      setCustomLanguageProgress(null);
    }
  };

  const handleDeleteCustomLanguage = (e: React.MouseEvent, langId: string) => {
    e.stopPropagation();
    
    // Remove from custom_languages
    const customLangsStr = localStorage.getItem('custom_languages');
    if (customLangsStr) {
      try {
        const customLangs = JSON.parse(customLangsStr);
        const filtered = customLangs.filter((l: any) => l.id !== langId);
        localStorage.setItem('custom_languages', JSON.stringify(filtered));
      } catch (e) {}
    }

    // Remove support
    const customSupportStr = localStorage.getItem('custom_language_support');
    if (customSupportStr) {
      try {
        const customSupport = JSON.parse(customSupportStr);
        delete customSupport[langId];
        localStorage.setItem('custom_language_support', JSON.stringify(customSupport));
      } catch (e) {}
    }

    // Remove UI translation
    const customUiStr = localStorage.getItem('custom_ui_translations');
    if (customUiStr) {
      try {
        const customUi = JSON.parse(customUiStr);
        delete customUi[langId];
        localStorage.setItem('custom_ui_translations', JSON.stringify(customUi));
      } catch (e) {}
    }

    // Remove status
    const customRecStr = localStorage.getItem('custom_recording_status');
    if (customRecStr) {
      try {
        const customRec = JSON.parse(customRecStr);
        delete customRec[langId];
        localStorage.setItem('custom_recording_status', JSON.stringify(customRec));
      } catch (e) {}
    }

    onUpdateEnabledLanguages(enabledLanguages.filter(id => id !== langId));
    triggerToast("Lingua personalizzata eliminata con successo.", "success");
  };

  // Question handlers
  const handleEditQuestion = (q: Question) => {
    setEditingQuestion({ ...q });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleTranslateNewQuestion = async () => {
    if (!newQuestion.it?.trim()) {
      triggerToast("Digita prima il testo in Italiano per poterlo tradurre!", 'error');
      return;
    }
    setIsTranslatingNew(true);
    triggerToast("Generazione traduzioni con Gemini...", 'success');
    try {
      const targetLangs = LANGUAGES_POOL.filter(lang => lang.id !== 'it');
      const translations = await translateToAllLanguages(newQuestion.it, targetLangs);
      
      setNewQuestion(prev => {
        const updated = { ...prev };
        targetLangs.forEach(lang => {
          if (translations[lang.id]) {
            (updated as any)[lang.id] = translations[lang.id];
          }
        });
        return updated;
      });
      triggerToast("Traduzioni generate ed applicate!", 'success');
    } catch (err) {
      console.error("Single adding translate error:", err);
      triggerToast("Errore durante la traduzione con Gemini.", 'error');
    } finally {
      setIsTranslatingNew(false);
    }
  };

  const handleTranslateEditingQuestion = async () => {
    if (!editingQuestion || !editingQuestion.it?.trim()) {
      triggerToast("Digita prima il testo in Italiano per poterlo tradurre!", 'error');
      return;
    }
    setIsTranslatingEdit(true);
    triggerToast("Generazione traduzioni con Gemini...", 'success');
    try {
      const targetLangs = LANGUAGES_POOL.filter(lang => lang.id !== 'it');
      const translations = await translateToAllLanguages(editingQuestion.it, targetLangs);
      
      setEditingQuestion(prev => {
        if (!prev) return null;
        const updated = { ...prev };
        targetLangs.forEach(lang => {
          if (translations[lang.id]) {
            (updated as any)[lang.id] = translations[lang.id];
          }
        });
        return updated as Question;
      });
      triggerToast("Traduzioni generate ed applicate!", 'success');
    } catch (err) {
      console.error("Single editing translate error:", err);
      triggerToast("Errore durante la traduzione con Gemini.", 'error');
    } finally {
      setIsTranslatingEdit(false);
    }
  };

  const translateQuestionsBulk = async (questionsToTranslate: Question[]): Promise<Question[]> => {
    const targetLangs = LANGUAGES_POOL.filter(lang => lang.id !== 'it');
    
    setBulkTranslationStatus({
      total: questionsToTranslate.length,
      current: 0
    });

    const translatedQuestions: Question[] = new Array(questionsToTranslate.length);
    let completedCount = 0;

    // Use a lightweight worker pool with concurrency 3 to process questions in parallel
    const CONCURRENCY = 3;
    let nextIndex = 0;

    const worker = async () => {
      while (nextIndex < questionsToTranslate.length) {
        const currentIndex = nextIndex++;
        const q = questionsToTranslate[currentIndex];
        const missingLangs = targetLangs.filter(lang => !q[lang.id as keyof Question]);

        if (missingLangs.length === 0 || !q.it?.trim()) {
          translatedQuestions[currentIndex] = q;
        } else {
          try {
            const translations = await translateToAllLanguages(q.it, missingLangs);
            translatedQuestions[currentIndex] = {
              ...q,
              ...translations
            };
          } catch (error) {
            console.error(`Error translating bulk question ID ${q.id}:`, error);
            translatedQuestions[currentIndex] = q;
          }
        }

        completedCount++;
        setBulkTranslationStatus(prev => {
          if (!prev) return null;
          return {
            ...prev,
            current: completedCount
          };
        });

        // Small break to respect rate limits gently across workers
        if (nextIndex < questionsToTranslate.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
    };

    const workers = Array.from({ length: Math.min(CONCURRENCY, questionsToTranslate.length) }, worker);
    await Promise.all(workers);

    setBulkTranslationStatus(null);
    return translatedQuestions;
  };

  const translateQuestionsForLanguages = async (langIds: string[], notifyIfAllDone: boolean = true) => {
    const targets = LANGUAGES_POOL.filter(lang => lang.id !== 'it' && langIds.includes(lang.id));
    if (targets.length === 0) return;

    // Find questions missing at least one translation in target languages
    const questionsToTranslate = activeQuestions.filter(q => {
      if (!q.it?.trim()) return false;
      return targets.some(lang => !q[lang.id as keyof Question]);
    });

    if (questionsToTranslate.length === 0) {
      if (notifyIfAllDone) {
        triggerToast("Tutte le domande sono già tradotte nelle lingue indicate!", "success");
      }
      return;
    }

    setBulkTranslationStatus({
      total: questionsToTranslate.length,
      current: 0
    });

    const updatedQuestions = [...activeQuestions];
    let completedCount = 0;

    // Use a worker pool of size 3 to run target translations in parallel
    const CONCURRENCY = 3;
    let nextIndex = 0;

    const worker = async () => {
      while (nextIndex < questionsToTranslate.length) {
        const currentIndex = nextIndex++;
        const q = questionsToTranslate[currentIndex];
        const missingLangsForThisQ = targets.filter(lang => !q[lang.id as keyof Question]);

        if (missingLangsForThisQ.length > 0) {
          try {
            const translations = await translateToAllLanguages(q.it, missingLangsForThisQ);
            const updatedQ = {
              ...q,
              ...translations
            };
            const idx = updatedQuestions.findIndex(item => item.id === q.id);
            if (idx !== -1) {
              updatedQuestions[idx] = updatedQ;
            }
          } catch (error) {
            console.error(`Errore traduzione in bulk per la domanda ${q.id}:`, error);
          }
        }

        completedCount++;
        setBulkTranslationStatus(prev => {
          if (!prev) return null;
          return {
            ...prev,
            current: completedCount
          };
        });

        // Small break to respect rate limits gently across workers
        if (nextIndex < questionsToTranslate.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
    };

    const workers = Array.from({ length: Math.min(CONCURRENCY, questionsToTranslate.length) }, worker);
    await Promise.all(workers);

    onUpdateActiveQuestions(updatedQuestions);
    setBulkTranslationStatus(null);
    triggerToast("Traduzione completata con successo!", 'success');
  };

  const handleSaveEditedQuestion = async () => {
    if (!editingQuestion) return;
    if (!editingQuestion.it.trim()) {
      triggerToast("La domanda in Italiano è obbligatoria!", 'error');
      return;
    }

    let questionData = { ...editingQuestion };
    const targetLangs = LANGUAGES_POOL.filter(lang => lang.id !== 'it');
    const missingLangs = targetLangs.filter(lang => !questionData[lang.id as keyof Question]?.trim());

    if (missingLangs.length > 0) {
      setIsTranslatingEdit(true);
      triggerToast("Generazione traduzioni mancanti automatica...", 'success');
      try {
        const translations = await translateToAllLanguages(questionData.it, missingLangs);
        targetLangs.forEach(lang => {
          if (translations[lang.id] && !questionData[lang.id as keyof Question]) {
            (questionData as any)[lang.id] = translations[lang.id];
          }
        });
      } catch (err) {
        console.error("Auto-translate in single save edit failed:", err);
      } finally {
        setIsTranslatingEdit(false);
      }
    }
    
    const updated = activeQuestions.map(q => q.id === questionData.id ? questionData : q);
    onUpdateActiveQuestions(updated);
    setEditingQuestion(null);
    triggerToast("Domanda salvata e tradotta automaticamente", 'success');
  };

  const handleDeleteQuestion = (id: string) => {
    if (window.confirm("Sei sicuro di voler eliminare questa domanda?")) {
      const updated = activeQuestions.filter(q => q.id !== id);
      onUpdateActiveQuestions(updated);
      triggerToast("Domanda eliminata con successo", 'success');
    }
  };

  const handleAddQuestion = async () => {
    if (!newQuestion.it?.trim()) {
      triggerToast("Il testo in Italiano è obbligatoria!", 'error');
      return;
    }

    let questionData = { ...newQuestion };
    const targetLangs = LANGUAGES_POOL.filter(lang => lang.id !== 'it');
    const missingLangs = targetLangs.filter(lang => !questionData[lang.id as keyof Question]?.trim());

    if (missingLangs.length > 0) {
      setIsTranslatingNew(true);
      triggerToast("Generazione traduzioni mancanti automatica...", 'success');
      try {
        const translations = await translateToAllLanguages(questionData.it || '', missingLangs);
        targetLangs.forEach(lang => {
          if (translations[lang.id] && !questionData[lang.id as keyof Question]) {
            (questionData as any)[lang.id] = translations[lang.id];
          }
        });
      } catch (err) {
        console.error("Auto-translate in single save add failed:", err);
      } finally {
        setIsTranslatingNew(false);
      }
    }

    // Generate clean unique ID
    const categoryLetter = questionData.category === 'Passato' ? 'p' : questionData.category === 'Presente' ? 'pr' : 'f';
    const existingNums = activeQuestions
      .filter(q => q.id.startsWith(categoryLetter))
      .map(q => parseInt(q.id.replace(categoryLetter, ''), 10))
      .filter(num => !isNaN(num));
    
    const nextNum = existingNums.length > 0 ? Math.max(...existingNums) + 1 : 1;
    const generatedId = `${categoryLetter}${nextNum}`;

    const completeQuestion: Question = {
      id: generatedId,
      category: questionData.category as Category,
      it: questionData.it || '',
      en: questionData.en || '',
      fr: questionData.fr || '',
      ar: questionData.ar || '',
      bn: questionData.bn || '',
    };

    // Copy all other language keys from questionData
    LANGUAGES_POOL.forEach(lang => {
      if (lang.id !== 'it') {
        const val = (questionData as any)[lang.id];
        if (val) {
          (completeQuestion as any)[lang.id] = val;
        }
      }
    });

    // Also copy legacy keys if any are present
    const legacyKeys = ['ku', 'wo'] as const;
    legacyKeys.forEach(key => {
      const val = (questionData as any)[key];
      if (val) {
        (completeQuestion as any)[key] = val;
      }
    });

    onUpdateActiveQuestions([completeQuestion, ...activeQuestions]);
    setShowAddForm(false);
    setNewQuestion({
      category: 'Presente',
      it: '',
      en: '',
      fr: '',
      ar: '',
      bn: ''
    });
    triggerToast(`Nuova domanda aggiunta e tradotta in tutte le lingue col codice ID ${generatedId}`, 'success');
  };

  // Archive Operations
  const handleArchiveCurrentSet = () => {
    const name = archiveSetName.trim();
    if (!name) {
      triggerToast("Inserisci un nome descrittivo per l'archivio!", 'error');
      return;
    }

    const newSet: SavedSet = {
      id: `set_${Date.now()}`,
      name: name,
      date: new Date().toLocaleDateString('it-IT'),
      questions: [...activeQuestions]
    };

    onUpdateQuestionArchives([newSet, ...questionArchives]);
    setArchiveSetName('');
    triggerToast("Set di domande archiviato con successo!", 'success');
  };

  const handleLoadFromArchive = (set: SavedSet) => {
    if (window.confirm(`Sei sicuro di voler sostituire il set di domande attivo corrente con l'archivio "${set.name}"?`)) {
      onUpdateActiveQuestions(set.questions);
      triggerToast(`Caricato con successo il set "${set.name}"`, 'success');
      setActiveTab('questions');
      
      // Automatic backup/fill translations for any currently active enabled languages in the loaded set
      setTimeout(() => {
        translateQuestionsForLanguages(enabledLanguages, false);
      }, 500);
    }
  };

  const handleDeleteArchive = (id: string, name: string) => {
    if (id === 'original_set') {
      triggerToast("Impossibile eliminare il set originale predefinito!", 'error');
      return;
    }
    if (window.confirm(`Sei sicuro di voler eliminare definitivamente l'archivio "${name}"?`)) {
      onUpdateQuestionArchives(questionArchives.filter(set => set.id !== id));
      triggerToast("Archivio eliminato con successo", 'success');
    }
  };

  const handleStartRename = (id: string, currentName: string) => {
    setRenamingSetId(id);
    setRenameValue(currentName);
  };

  const handleSaveRename = (id: string) => {
    if (!renameValue.trim()) return;
    onUpdateQuestionArchives(questionArchives.map(set => set.id === id ? { ...set, name: renameValue.trim() } : set));
    setRenamingSetId(null);
    triggerToast("Archivio rinominato con successo", 'success');
  };

  const handleResetToDefault = () => {
    if (window.confirm("Attenzione: questa azione sostituirà l'intero set di domande attivo corrente con le domande originali dell'applicazione. Procedere?")) {
      onUpdateActiveQuestions(originalQuestions);
      triggerToast("Ripristinate le domande predefinite del Centro Padre Marella", 'success');
      setActiveTab('questions');

      // Automatic backup/fill translations for any currently active enabled languages in the reset set
      setTimeout(() => {
        translateQuestionsForLanguages(enabledLanguages, false);
      }, 500);
    }
  };

  const handleExportQuestionsJSON = (questionsToExport: Question[], filename: string) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(questionsToExport, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${filename}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    triggerToast("Esportazione JSON completata", 'success');
  };

  const handleExportQuestionsPDF = () => {
    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Margins and dimensions
      const margin = 20;
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const maxLineWidth = pageWidth - (margin * 2);

      let yPos = 25;

      const drawPageHeader = () => {
        // Thin grey line at the top
        pdf.setDrawColor(220, 220, 220);
        pdf.setLineWidth(0.2);
        pdf.line(margin, 18, pageWidth - margin, 18);

        // Header text
        pdf.setFont("Helvetica", "italic");
        pdf.setFontSize(8);
        pdf.setTextColor(110, 110, 110);
        pdf.text("Botta & Risposta — Elenco delle Domande Attive", margin, 14);
        pdf.text("Configurazione Sottofondo", pageWidth - margin, 14, { align: 'right' });
      };

      const checkPageOverflow = (neededHeight: number) => {
        if (yPos + neededHeight > pageHeight - 20) {
          pdf.addPage();
          drawPageHeader();
          yPos = 30;
        }
      };

      // --- PAGE 1: COVER PAGE ---
      pdf.setDrawColor(0, 102, 102); // Primary Teal Color of the App
      pdf.setLineWidth(1);
      pdf.rect(15, 15, pageWidth - 30, pageHeight - 30);

      pdf.setFillColor(0, 102, 102);
      pdf.rect(25, 45, 12, pageHeight - 90, "F");

      pdf.setFont("Helvetica", "bold");
      pdf.setFontSize(28);
      pdf.setTextColor(0, 102, 102); // Teal
      pdf.text("BOTTA & RISPOSTA", 45, 75);

      pdf.setFont("Helvetica", "normal");
      pdf.setFontSize(16);
      pdf.setTextColor(120, 110, 100); // Warm Gray
      const titleLines = pdf.splitTextToSize("Archivio Completo delle Domande in Italiano", maxLineWidth - 30);
      pdf.text(titleLines, 45, 87);

      pdf.setFontSize(11);
      pdf.setTextColor(80, 80, 80);
      const descText = "Questo documento racchiude tutte le domande attive configurate per l'installazione interattiva 'Botta & Risposta'. Le domande sono suddivise in base alle tre categorie temporali (Passato, Presente, Futuro) e vengono proposte agli utenti per raccogliere le loro preziose testimonianze e memorie di vita.";
      const descLines = pdf.splitTextToSize(descText, maxLineWidth - 40);
      pdf.text(descLines, 45, 125);

      pdf.setFont("Helvetica", "bold");
      pdf.setFontSize(11);
      pdf.setTextColor(0, 102, 102);
      pdf.text("DETTAGLI DI CONFIGURAZIONE:", 45, 175);

      pdf.setFont("Helvetica", "normal");
      pdf.setFontSize(10);
      pdf.setTextColor(100, 100, 100);
      pdf.text(`Domande Attive:  ${activeQuestions.length}`, 45, 184);
      pdf.text(`Lingue Abilitate nel Sistema:  ${enabledLanguages ? enabledLanguages.length : 0} lingue`, 45, 191);
      pdf.text(`Data Generazione:  ${new Date().toLocaleDateString('it-IT')}`, 45, 198);

      pdf.setFont("Helvetica", "italic");
      pdf.setFontSize(11);
      pdf.setTextColor(214, 158, 46); // Accent Gold
      pdf.text("- Opera di Padre Marella -", pageWidth / 2, pageHeight - 35, { align: 'center' });

      // --- QUESTIONS CONTENT ---
      pdf.addPage();
      drawPageHeader();
      yPos = 30;

      const categories: Category[] = ['Passato', 'Presente', 'Futuro'];

      categories.forEach((cat) => {
        const catQuestions = activeQuestions.filter(q => q.category === cat);
        if (catQuestions.length === 0) return;

        // Check overflow for Category Title band
        checkPageOverflow(25);

        pdf.setFillColor(242, 240, 235); // Light warm grey
        pdf.rect(margin - 2, yPos, maxLineWidth + 4, 12, "F");

        pdf.setFont("Helvetica", "bold");
        pdf.setFontSize(13);
        pdf.setTextColor(0, 102, 102); // Teal
        pdf.text(`CATEGORIA: ${cat.toUpperCase()}`, margin + 2, yPos + 8.5);

        yPos += 18;

        catQuestions.forEach((q, idx) => {
          const questionText = `${idx + 1}. ${q.it}`;
          const wrappedText = pdf.splitTextToSize(questionText, maxLineWidth - 6);
          const blockHeight = (wrappedText.length * 6) + 4;

          checkPageOverflow(blockHeight);

          pdf.setFont("Helvetica", "normal");
          pdf.setFontSize(11);
          pdf.setTextColor(40, 40, 40);

          pdf.text(wrappedText, margin + 2, yPos);

          yPos += blockHeight;
        });

        yPos += 8; // Extra padding between categories
      });

      // Loop over pages (except Cover Page, i.e., index 1) to stamp page numbers
      const totalPages = pdf.internal.pages.length - 1; 
      for (let i = 2; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFont("Helvetica", "normal");
        pdf.setFontSize(8);
        pdf.setTextColor(150, 150, 150);
        pdf.text(`Pagina ${i - 1} di ${totalPages - 1}`, pageWidth / 2, pageHeight - 12, { align: 'center' });
      }

      pdf.save("domande_italiano_botta_e_risposta.pdf");
      triggerToast("File PDF delle domande generato con successo!", 'success');
    } catch (error) {
      console.error("Errore nella generazione del PDF delle domande:", error);
      triggerToast("Errore durante la creazione del PDF.", 'error');
    }
  };

  // Upload parser helpers
  const processUploadedFile = (file: File) => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    const reader = new FileReader();

    if (extension === 'json') {
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].id && parsed[0].it) {
            setUploadedPreview({
              questions: parsed,
              fileName: file.name
            });
            setCustomUploadSetName(file.name.replace('.json', ''));
            setUploadToast(null);
          } else {
            setUploadToast({ message: "Formato JSON non valido. Deve essere un array di domande con campi 'id' e 'it'.", type: 'error' });
          }
        } catch (err) {
          setUploadToast({ message: "Impossibile decodificare il file JSON.", type: 'error' });
        }
      };
      reader.readAsText(file);
    } else if (extension === 'csv') {
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const rows = customCSVParse(content);
          if (rows.length > 0) {
            setUploadedPreview({
              questions: rows,
              fileName: file.name
            });
            setCustomUploadSetName(file.name.replace('.csv', ''));
            setUploadToast(null);
          } else {
            setUploadToast({ message: "Nessun dato valido trovato nel CSV.", type: 'error' });
          }
        } catch (err) {
          setUploadToast({ message: "Errore nella lettura del file CSV.", type: 'error' });
        }
      };
      reader.readAsText(file);
    } else if (extension === 'xlsx' || extension === 'xls') {
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const rawRows = XLSX.utils.sheet_to_json(worksheet) as Record<string, any>[];
          
          if (rawRows.length > 0) {
            const mappedQuestions = mapRawRowsToQuestions(rawRows);
            if (mappedQuestions.length > 0) {
              setUploadedPreview({
                questions: mappedQuestions,
                fileName: file.name
              });
              setCustomUploadSetName(file.name.replace(/\.[^/.]+$/, ""));
              setUploadToast(null);
            } else {
              setUploadToast({ message: "Nessuna colonna riconosciuta come 'id' o 'it/italiano' nelle righe dell'Excel.", type: 'error' });
            }
          } else {
            setUploadToast({ message: "Il foglio di calcolo Excel è vuoto.", type: 'error' });
          }
        } catch (err) {
          setUploadToast({ message: "Errore nella decodifica del file Excel.", type: 'error' });
        }
      };
      reader.readAsArrayBuffer(file);
    } else if (extension === 'pdf') {
      reader.onload = async (e) => {
        try {
          setIsFileParsing(true);
          setUploadToast({ message: "Analisi ed estrazione delle domande dal PDF con Gemini in corso...", type: 'success' });
          const dataUrl = e.target?.result as string;
          const base64pdf = dataUrl.split(',')[1];
          const extracted = await extractQuestionsFromPdf(base64pdf);
          if (extracted && extracted.length > 0) {
            const mappedQuestions = extracted.map((q, idx) => {
              const prefix = q.category === 'Passato' ? 'p' : q.category === 'Futuro' ? 'f' : 'pr';
              const generatedId = `${prefix}_pdf_${Date.now()}_${idx}`;
              return {
                id: q.id || generatedId,
                category: q.category || 'Presente',
                it: q.it,
                en: q.en || '',
                fr: q.fr || '',
                ar: q.ar || '',
                bn: q.bn || '',
              } as Question;
            });

            setUploadedPreview({
              questions: mappedQuestions,
              fileName: file.name
            });
            setCustomUploadSetName(file.name.replace('.pdf', ''));
            setUploadToast(null);
          } else {
            setUploadToast({ message: "Nessuna domanda estratta dal file PDF. Verifica che contenga del testo leggibile.", type: 'error' });
          }
        } catch (err: any) {
          console.error(err);
          const errMsg = String(err?.message || err || "").toLowerCase();
          const isQuotaError = errMsg.includes("quota") || errMsg.includes("resource_exhausted") || errMsg.includes("429") || errMsg.includes("limit") || errMsg.includes("exceeded");
          
          if (isQuotaError) {
            setUploadToast({ 
              message: "Quota Gemini Esaurita! (L'addebito di budget su Google Cloud può impiegare fino a 24 ore per registrarsi). Soluzione immediata: salva le domande in Excel (.xlsx) o CSV ed esegui il caricamento, che avverrà all'istante e in modo 100% LOCALE senza alcuna chiamata API!", 
              type: 'error' 
            });
          } else {
            setUploadToast({ 
              message: "Errore nell'estrazione delle domande dal PDF. Ti consigliamo di convertire il file in Excel (.xlsx) o CSV per caricarlo istantaneamente e gratis in locale!", 
              type: 'error' 
            });
          }
        } finally {
          setIsFileParsing(false);
        }
      };
      reader.readAsDataURL(file);
    } else {
      setUploadToast({ message: "Formato file non supportato. Carica un file .json, .csv, excel (.xlsx/.xls) oppure un documento .pdf", type: 'error' });
    }
  };

  const customCSVParse = (content: string): Question[] => {
    const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length === 0) return [];

    const parseLine = (line: string): string[] => {
      const result: string[] = [];
      let inQuotes = false;
      let current = '';
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') {
          if (inQuotes && line[j+1] === '"') {
            current += '"';
            j++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseLine(lines[0]);
    const rawRows: Record<string, string>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseLine(lines[i]);
      if (values.length === 0) continue;
      const rowObj: Record<string, string> = {};
      for (let h = 0; h < headers.length; h++) {
        if (h < values.length) {
          rowObj[headers[h]] = values[h];
        }
      }
      rawRows.push(rowObj);
    }

    return mapRawRowsToQuestions(rawRows);
  };

  const mapRawRowsToQuestions = (rawRows: Record<string, any>[]): Question[] => {
    // Standard mapper helper
    const columnMapping: Record<string, keyof Question> = {
      id: 'id', ID: 'id', Id: 'id',
      categoria: 'category', Categoria: 'category', category: 'category', Category: 'category',
      it: 'it', italiano: 'it', Italiano: 'it', italian: 'it',
      en: 'en', inglese: 'en', Inglese: 'en', english: 'en',
      fr: 'fr', francese: 'fr', Francese: 'fr', french: 'fr',
      ar: 'ar', arabo: 'ar', Arabo: 'ar', arabic: 'ar',
      bn: 'bn', bengalese: 'bn', Bengalese: 'bn', bengali: 'bn',
      uk: 'uk', ucraino: 'uk', Ucraino: 'uk', ukraine: 'uk',
      ku: 'ku', curdo: 'ku', Curdo: 'ku', kurdish: 'ku',
      so: 'so', somalo: 'so', Somalo: 'so', somali: 'so',
      wo: 'wo', wolof: 'wo', Wolof: 'wo',
      fa: 'fa', farsi: 'fa', Farsi: 'fa', persian: 'fa'
    };

    const result: Question[] = [];

    rawRows.forEach((row, index) => {
      const mapped: Partial<Question> = {};
      
      // Look for standard column matches
      Object.keys(row).forEach(colName => {
        const cleanCol = colName.trim();
        const targetField = columnMapping[cleanCol] || columnMapping[cleanCol.toLowerCase()];
        if (targetField) {
          mapped[targetField] = String(row[colName]) as any;
        }
      });

      // Validations
      if (!mapped.id) {
        mapped.id = `q_${Date.now()}_${index}`;
      }
      if (!mapped.category) {
        mapped.category = 'Presente';
      } else {
        const catClean = mapped.category.trim();
        if (['Passato', 'Presente', 'Futuro'].includes(catClean)) {
          mapped.category = catClean as Category;
        } else if (catClean.toLowerCase().startsWith('pas')) {
          mapped.category = 'Passato';
        } else if (catClean.toLowerCase().startsWith('fut')) {
          mapped.category = 'Futuro';
        } else {
          mapped.category = 'Presente';
        }
      }

      if (mapped.it) {
        result.push(mapped as Question);
      }
    });

    return result;
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (isFileParsing) return;

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processUploadedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isFileParsing) return;
    if (e.target.files && e.target.files[0]) {
      processUploadedFile(e.target.files[0]);
    }
  };

  const handleApplyUpload = async (actionType: 'overwrite' | 'append') => {
    if (!uploadedPreview) return;

    let finalQuestionsList: Question[] = [];
    let newQuestionsToTranslate: Question[] = [];
    
    if (actionType === 'overwrite') {
      newQuestionsToTranslate = [...uploadedPreview.questions];
    } else {
      // Append, filter duplicates by id
      const existingIds = new Set(activeQuestions.map(q => q.id));
      newQuestionsToTranslate = uploadedPreview.questions.filter(q => !existingIds.has(q.id));
    }

    let processedNewQuestions = newQuestionsToTranslate;

    if (autoTranslateEnabled && newQuestionsToTranslate.length > 0) {
      triggerToast("Traduzione automatica del set in corso su Gemini...", 'success');
      processedNewQuestions = await translateQuestionsBulk(newQuestionsToTranslate);
    }

    if (actionType === 'overwrite') {
      finalQuestionsList = processedNewQuestions;
    } else {
      finalQuestionsList = [...activeQuestions, ...processedNewQuestions];
    }

    onUpdateActiveQuestions(finalQuestionsList);

    // Archive if chosen
    if (archiveOptionOnUpload) {
      const name = (customUploadSetName || uploadedPreview.fileName).trim();
      const newSet: SavedSet = {
        id: `set_${Date.now()}`,
        name: name || "File Caricato",
        date: new Date().toLocaleDateString('it-IT'),
        questions: processedNewQuestions
      };
      onUpdateQuestionArchives([newSet, ...questionArchives]);
    }

    triggerToast(
      actionType === 'overwrite' 
        ? "Nuovo set applicato, vecchie domande cancellate con traduzioni complete." 
        : `Aggiunte ${newQuestionsToTranslate.length} nuove domande tradotte e unite a quelle attive.`,
      'success'
    );

    setUploadedPreview(null);
    setActiveTab('questions');
  };

  // Filtering questions for the UI table
  const filteredQuestions = activeQuestions.filter(q => {
    const matchesSearch = 
      q.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.it.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (q.en && q.en.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = categoryFilter === 'All' || q.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  // Filtering testimonies for the search tab
  const filteredTestimonies = (archive || []).filter(item => {
    if (!testimonySearchQuery.trim()) return true;
    const query = testimonySearchQuery.toLowerCase();
    
    return (
      (item.trascrizione_originale || '').toLowerCase().includes(query) ||
      (item.traduzione_italiano || '').toLowerCase().includes(query) ||
      (item.domanda_proposta || '').toLowerCase().includes(query) ||
      (item.domanda_proposta_lingua_originale || '').toLowerCase().includes(query) ||
      (item.parola_chiave || '').toLowerCase().includes(query) ||
      (item.parola_chiave_lingua_originale || '').toLowerCase().includes(query) ||
      (item.lingua_originale || '').toLowerCase().includes(query) ||
      (item.category || '').toLowerCase().includes(query)
    );
  });

  return (
    <div className="min-h-screen bg-[#f7f6f2] text-ink pb-24 relative font-sans">
      
      {/* Toast Alert */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className={`fixed top-4 left-1/2 -translate-x-1/2 z-[9999] px-6 py-4 rounded-full shadow-2xl flex items-center gap-3 w-max max-w-sm md:max-w-md ${
              toast.type === 'success' ? 'bg-primary text-white' : 'bg-red-600 text-white'
            }`}
          >
            {toast.type === 'success' ? <Check className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            <span className="text-sm font-bold uppercase tracking-wider">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk Translation Overlay */}
      <AnimatePresence>
        {bulkTranslationStatus && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/65 backdrop-blur-md z-[10000] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl p-8 max-w-md w-full border border-olive/30 shadow-2xl flex flex-col items-center text-center space-y-6"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-amber-100 rounded-full blur-xl opacity-75 animate-pulse" />
                <div className="relative bg-[#fbfaf7] p-5 rounded-full border border-amber-250 animate-bounce">
                  <Sparkles className="w-10 h-10 text-amber-600" />
                </div>
              </div>
              
              <div className="space-y-2">
                <h3 className="font-serif text-xl font-bold text-primary italic">Traduzione Intelligente</h3>
                <p className="text-sm text-ink/75">
                  Stiamo traducendo automaticamente le domande caricate in tutte le {enabledLanguages.length} lingue abilitate tramite il modello <strong>Gemini 3.5 Flash</strong>.
                </p>
              </div>

              {/* Progress bar */}
              <div className="w-full space-y-2">
                <div className="flex justify-between text-xs font-bold text-accent uppercase tracking-wider">
                  <span>Traduzione in corso</span>
                  <span>{bulkTranslationStatus.current} di {bulkTranslationStatus.total}</span>
                </div>
                <div className="h-3 bg-[#e8e6e0] rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${(bulkTranslationStatus.current / bulkTranslationStatus.total) * 100}%` }}
                    transition={{ duration: 0.3 }}
                    className="h-full bg-gradient-to-r from-amber-500 to-olive" 
                  />
                </div>
                <p className="text-[10px] text-ink/40 font-bold uppercase tracking-widest animate-pulse">
                  Si prega di non chiudere o ricaricare la pagina...
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Gestione */}
      <header className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-ink/10 py-5 px-6 z-50 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-3 hover:bg-bg-main rounded-full transition-colors group"
            title="Indietro"
          >
            <ArrowLeft className="w-6 h-6 text-olive group-hover:-translate-x-1 transition-transform" />
          </button>
          <div>
            <span className="text-[10px] uppercase tracking-[0.25em] font-bold text-accent">Pannello Amministratore</span>
            <h1 className="font-serif text-2xl md:text-3xl font-black text-primary italic leading-none">Configurazione Sottofondo</h1>
          </div>
        </div>

        {/* Action Controls for Quick Reset / Export */}
        <div className="flex items-center gap-3 flex-wrap justify-center md:justify-end">
          <button
            onClick={() => handleExportQuestionsJSON(activeQuestions, 'set_domande_attive')}
            className="px-4 py-2 bg-primary/5 hover:bg-primary/10 text-primary border border-primary/20 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Scarica Salva JSON Set Attivo
          </button>
          <button
            onClick={handleExportQuestionsPDF}
            className="px-4 py-2 bg-olive/10 hover:bg-olive/20 text-olive border border-olive/20 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-2"
          >
            <FileText className="w-4 h-4" />
            Esporta PDF Domande (IT)
          </button>
          <button
            onClick={handleResetToDefault}
            className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Ripristina Originali (Marella)
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 mt-8">
        
        {/* Info Area */}
        <div className="bg-white rounded-3xl p-6 border border-ink/5 shadow-md flex flex-col md:flex-row gap-6 items-center justify-between mb-8">
          <div className="flex items-start gap-4">
            <div className="p-4 bg-olive/10 rounded-2xl shrink-0">
              <Sparkles className="w-6 h-6 text-olive" />
            </div>
            <div>
              <h2 className="font-serif text-lg md:text-xl font-bold text-primary italic">Personalizza il Totem interattivo autonomamente</h2>
              <p className="text-sm text-ink/65 max-w-2xl mt-1 leading-relaxed">
                Da queste sezioni puoi cambiare le lingue disponibili all'accesso e il pool di domande che vengono poste agli utenti del centro. Nessuna modifica richiede programmazione: le impostazioni si riflettono istantaneamente sul Totem!
              </p>
            </div>
          </div>
          <div className="flex flex-row gap-6 md:border-l border-ink/10 md:pl-8 py-2 shrink-0 self-stretch justify-around">
            <div className="text-center">
              <span className="block text-[10px] text-accent font-bold uppercase tracking-widest">Domande Attive</span>
              <span className="text-4xl font-serif font-black text-olive italic leading-none">{activeQuestions.length}</span>
            </div>
            <div className="text-center">
              <span className="block text-[10px] text-accent font-bold uppercase tracking-widest">Lingue Abilitate</span>
              <span className="text-4xl font-serif font-black text-primary italic leading-none">{enabledLanguages.length} <span className="text-sm text-ink/40 font-sans">/ {LANGUAGES_POOL.length}</span></span>
            </div>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-ink/10 gap-2 mb-8 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTab('questions')}
            className={`px-5 py-3 rounded-t-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 border-b-2 whitespace-nowrap ${
              activeTab === 'questions' 
                ? 'bg-white text-olive border-olive shadow-sm' 
                : 'text-ink/60 border-transparent hover:text-ink hover:bg-white/50'
            }`}
          >
            <FileText className="w-4 h-4" />
            Gestisci Domande ({filteredQuestions.length})
          </button>
          <button
            onClick={() => setActiveTab('answers')}
            className={`px-5 py-3 rounded-t-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 border-b-2 whitespace-nowrap ${
              activeTab === 'answers' 
                ? 'bg-white text-olive border-olive shadow-sm' 
                : 'text-ink/60 border-transparent hover:text-ink hover:bg-white/50'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            Gestisci risposte ({archive?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('languages')}
            className={`px-5 py-3 rounded-t-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 border-b-2 whitespace-nowrap ${
              activeTab === 'languages' 
                ? 'bg-white text-olive border-olive shadow-sm' 
                : 'text-ink/60 border-transparent hover:text-ink hover:bg-white/50'
            }`}
          >
            <Languages className="w-4 h-4" />
            Seleziona Lingue Abilitate
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-5 py-3 rounded-t-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 border-b-2 whitespace-nowrap ${
              activeTab === 'upload' 
                ? 'bg-white text-olive border-olive shadow-sm' 
                : 'text-ink/60 border-transparent hover:text-ink hover:bg-white/50'
            }`}
          >
            <Upload className="w-4 h-4" />
            Carica File set domande
          </button>
          <button
            onClick={() => setActiveTab('archives')}
            className={`px-5 py-3 rounded-t-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 border-b-2 whitespace-nowrap ${
              activeTab === 'archives' 
                ? 'bg-white text-olive border-olive shadow-sm' 
                : 'text-ink/60 border-transparent hover:text-ink hover:bg-white/50'
            }`}
          >
            <Database className="w-4 h-4" />
            Archivio Set Precedenti
          </button>
          <button
            onClick={() => setActiveTab('audio')}
            className={`px-5 py-3 rounded-t-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 border-b-2 whitespace-nowrap ${
              activeTab === 'audio' 
                ? 'bg-white text-olive border-olive shadow-sm' 
                : 'text-ink/60 border-transparent hover:text-ink hover:bg-white/50'
            }`}
          >
            <Mic className="w-4 h-4" />
            Configura Microfono (iPad / Esterno)
          </button>
          <button
            onClick={() => setActiveTab('testimonies')}
            className={`px-5 py-3 rounded-t-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 border-b-2 whitespace-nowrap ${
              activeTab === 'testimonies' 
                ? 'bg-white text-olive border-olive shadow-sm' 
                : 'text-ink/60 border-transparent hover:text-ink hover:bg-white/50'
            }`}
          >
            <Search className="w-4 h-4" />
            Cerca & Gestisci Schede ({archive?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('guide')}
            className={`px-5 py-3 rounded-t-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 border-b-2 whitespace-nowrap ${
              activeTab === 'guide' 
                ? 'bg-white text-olive border-olive shadow-sm' 
                : 'text-ink/60 border-transparent hover:text-ink hover:bg-white/50'
            }`}
          >
            <BookOpen className="w-4 h-4 text-accent animate-pulse" />
            Guida d'Uso & Personalizzazioni
          </button>
        </div>

        {/* Tab 0: Guida & Personalizzazioni */}
        {activeTab === 'guide' && (
          <UserGuideTab />
        )}

        {/* Tab 1: Questions Management */}
        {activeTab === 'questions' && (
          <div className="space-y-6">
            
            {/* Show Edit Question form if selected */}
            {editingQuestion && (
              <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-3xl p-6 md:p-8 border border-olive/30 shadow-xl space-y-4"
              >
                <div className="flex justify-between items-center pb-4 border-b border-ink/10">
                  <h3 className="font-serif text-lg md:text-xl font-bold text-olive italic flex items-center gap-2">
                    <Edit2 className="w-5 h-5 text-olive" />
                    Modifica Domanda #{editingQuestion.id}
                  </h3>
                  <button 
                    onClick={() => setEditingQuestion(null)}
                    className="p-1.5 hover:bg-bg-main rounded-full"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-accent uppercase tracking-wider mb-2">Categoria</label>
                    <select
                      value={editingQuestion.category}
                      onChange={(e) => setEditingQuestion({ ...editingQuestion, category: e.target.value as Category })}
                      className="w-full bg-[#f8f6f2] border border-ink/10 rounded-2xl px-4 py-3 font-sans text-sm outline-none focus:border-olive transition-colors"
                    >
                      <option value="Passato">Passato</option>
                      <option value="Presente">Presente</option>
                      <option value="Futuro">Futuro</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-xs font-bold text-accent uppercase tracking-wider">Italiano (it - Obbligatorio)</label>
                      <button
                        onClick={handleTranslateEditingQuestion}
                        disabled={isTranslatingEdit || !editingQuestion.it?.trim()}
                        className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed border border-amber-200 rounded-lg text-amber-800 text-[11px] font-bold uppercase tracking-wider transition-colors"
                      >
                        {isTranslatingEdit ? (
                          <Loader2 className="w-3 h-3 animate-spin text-amber-800" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                        )}
                        Traduci con IA (Gemini)
                      </button>
                    </div>
                    <input
                      type="text"
                      className="w-full bg-[#f8f6f2] border border-ink/10 rounded-2xl px-4 py-3 font-sans text-sm outline-none focus:border-olive transition-colors"
                      value={editingQuestion.it}
                      onChange={(e) => setEditingQuestion({ ...editingQuestion, it: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 max-h-96 overflow-y-auto pr-2 border-t border-ink/5 mt-2">
                  {LANGUAGES_POOL.filter(lang => lang.id !== 'it').map(lang => {
                    const isRtl = ['ar', 'fa', 'bn', 'ur', 'ps'].includes(lang.id);
                    return (
                      <div key={lang.id}>
                        <label className="block text-xs font-bold text-accent/70 uppercase tracking-wider mb-1">
                          {lang.labelNative} ({lang.id.toUpperCase()})
                        </label>
                        <input
                          type="text"
                          dir={isRtl ? 'rtl' : 'ltr'}
                          className={`w-full bg-[#f8f6f2]/60 border border-ink/5 rounded-xl px-3 py-1.5 text-sm outline-none focus:border-olive transition-colors ${
                            isRtl ? 'text-right' : 'text-left'
                          }`}
                          value={(editingQuestion as any)[lang.id] || ''}
                          onChange={(e) => setEditingQuestion({ ...editingQuestion, [lang.id]: e.target.value })}
                        />
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    onClick={() => setEditingQuestion(null)}
                    className="px-5 py-3 border border-ink/20 hover:bg-bg-main rounded-2xl font-bold text-xs uppercase tracking-wider"
                  >
                    Annulla
                  </button>
                  <button
                    onClick={handleSaveEditedQuestion}
                    className="px-5 py-3 bg-olive text-white hover:bg-olive-dark rounded-2xl font-bold text-xs uppercase tracking-wider shadow-md"
                  >
                    Salva Domanda
                  </button>
                </div>
              </motion.div>
            )}

            {/* Show Add Question Form */}
            {showAddForm && (
              <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-3xl p-6 md:p-8 border border-olive/30 shadow-xl space-y-4"
              >
                <div className="flex justify-between items-center pb-4 border-b border-ink/10">
                  <h3 className="font-serif text-lg md:text-xl font-bold text-primary italic flex items-center gap-2">
                    <Plus className="w-5 h-5 text-primary" />
                    Aggiungi Nuova Domanda
                  </h3>
                  <button 
                    onClick={() => setShowAddForm(false)}
                    className="p-1.5 hover:bg-bg-main rounded-full"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-accent uppercase tracking-wider mb-2">Categoria</label>
                    <select
                      value={newQuestion.category}
                      onChange={(e) => setNewQuestion({ ...newQuestion, category: e.target.value as Category })}
                      className="w-full bg-[#f8f6f2] border border-ink/10 rounded-2xl px-4 py-3 font-sans text-sm outline-none focus:border-olive transition-colors"
                    >
                      <option value="Passato">Passato</option>
                      <option value="Presente">Presente</option>
                      <option value="Futuro">Futuro</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-xs font-bold text-accent uppercase tracking-wider">Italiano (it - Obbligatorio)</label>
                      <button
                        onClick={handleTranslateNewQuestion}
                        disabled={isTranslatingNew || !newQuestion.it?.trim()}
                        className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed border border-amber-200 rounded-lg text-amber-800 text-[11px] font-bold uppercase tracking-wider transition-colors"
                      >
                        {isTranslatingNew ? (
                          <Loader2 className="w-3 h-3 animate-spin text-amber-800" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                        )}
                        Traduci con IA (Gemini)
                      </button>
                    </div>
                    <input
                      type="text"
                      className="w-full bg-[#f8f6f2] border border-ink/10 rounded-2xl px-4 py-3 font-sans text-sm outline-none focus:border-olive transition-colors"
                      value={newQuestion.it || ''}
                      onChange={(e) => setNewQuestion({ ...newQuestion, it: e.target.value })}
                      placeholder="scrivi la domanda in lingua italiana..."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 max-h-96 overflow-y-auto pr-2 border-t border-ink/5 mt-2">
                  {LANGUAGES_POOL.filter(lang => lang.id !== 'it').map(lang => {
                    const isRtl = ['ar', 'fa', 'bn', 'ur', 'ps'].includes(lang.id);
                    return (
                      <div key={lang.id}>
                        <label className="block text-xs font-bold text-accent/75 uppercase tracking-wider mb-1">
                          {lang.labelNative} ({lang.id.toUpperCase()})
                        </label>
                        <input
                          type="text"
                          dir={isRtl ? 'rtl' : 'ltr'}
                          className={`w-full bg-[#f8f6f2]/60 border border-ink/5 rounded-xl px-3 py-1.5 text-sm outline-none focus:border-olive transition-colors ${
                            isRtl ? 'text-right' : 'text-left'
                          }`}
                          value={(newQuestion as any)[lang.id] || ''}
                          onChange={(e) => setNewQuestion({ ...newQuestion, [lang.id]: e.target.value })}
                          placeholder={`${lang.labelNative} translation...`}
                        />
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    onClick={() => setShowAddForm(false)}
                    className="px-5 py-3 border border-ink/20 hover:bg-bg-main rounded-2xl font-bold text-xs uppercase tracking-wider"
                  >
                    Annulla
                  </button>
                  <button
                    onClick={handleAddQuestion}
                    className="px-5 py-3 bg-primary text-white hover:bg-primary-dark rounded-2xl font-bold text-xs uppercase tracking-wider shadow-md"
                  >
                    Crea Domanda
                  </button>
                </div>
              </motion.div>
            )}

            {/* Questions Table Filter Bar */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-3xl border border-ink/5 shadow-sm">
              <div className="flex items-center gap-3 w-full md:max-w-md">
                <div className="relative w-full">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-ink/40">
                    <Search className="w-5 h-5" />
                  </span>
                  <input
                    type="text"
                    className="bg-[#f8f6f2] border border-ink/10 rounded-2xl pl-10 pr-4 py-2.5 w-full font-sans text-sm outline-none focus:border-olive transition-colors"
                    placeholder="Cerca domanda per testo o codice id..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center gap-4 shrink-0 w-full md:w-auto overflow-x-auto justify-end">
                <div className="flex gap-1.5 p-1 bg-[#f8f6f2] rounded-2xl border border-ink/5">
                  {(['All', 'Passato', 'Presente', 'Futuro'] as const).map(cat => (
                    <button
                      key={cat}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                        categoryFilter === cat 
                          ? 'bg-white text-olive shadow-sm' 
                          : 'text-ink/60 hover:text-ink'
                      }`}
                      onClick={() => setCategoryFilter(cat)}
                    >
                      {cat === 'All' ? 'Tutte' : cat}
                    </button>
                  ))}
                </div>

                {!showAddForm && (
                  <>
                    <button
                      className="bg-primary/10 text-primary hover:bg-primary/20 px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shrink-0 border border-primary/10 cursor-pointer"
                      onClick={() => translateQuestionsForLanguages(enabledLanguages)}
                      title="Traduci o completa le domande attive non ancora tradotte per tutte le lingue attualmente abilitate nel Totem"
                    >
                      <Sparkles className="w-4 h-4 text-amber-650 animate-pulse" />
                      Traduci Domande Mancanti
                    </button>
                    <button
                      className="bg-accent text-white hover:bg-accent-light px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-colors flex items-center gap-2 shrink-0 shadow-md cursor-pointer"
                      onClick={() => {
                        setShowAddForm(true);
                        setEditingQuestion(null);
                        window.scrollTo({ top: 300, behavior: 'smooth' });
                      }}
                    >
                      <Plus className="w-4 h-4" />
                      Nuova Domanda
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Questions list table view */}
            <div className="bg-white rounded-3xl border border-ink/5 shadow-sm overflow-hidden">
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full text-left border-collapse table-auto">
                  <thead>
                    <tr className="bg-bg-main border-b border-ink/10 text-accent font-bold text-[10px] tracking-[0.15em] uppercase">
                      <th className="px-6 py-4 w-20">ID</th>
                      <th className="px-6 py-4 w-32">Categoria</th>
                      <th className="px-6 py-4 min-w-[300px]">Testo Domanda (Italiano / Inglese)</th>
                      <th className="px-6 py-4 w-32 text-center">Lingue Tradotte</th>
                      <th className="px-6 py-4 w-28 text-right">Azioni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink/5">
                    {filteredQuestions.length > 0 ? (
                      filteredQuestions.map(q => {
                        // Count translated fields that have non-empty values
                        const checkableLanguages = Array.from(new Set([
                          ...LANGUAGES_POOL.filter(l => l.id !== 'it').map(l => l.id),
                          'ku', 'wo'
                        ]));
                        const translateFieldsCount = checkableLanguages
                          .filter(langCode => q[langCode as keyof Question])
                          .length;
                        
                        return (
                          <tr key={q.id} className="hover:bg-bg-main/50 transition-colors">
                            <td className="px-6 py-4 text-xs font-mono font-bold text-accent">{q.id}</td>
                            <td className="px-6 py-4">
                              <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                                q.category === 'Passato' 
                                  ? 'bg-amber-100 text-amber-800' 
                                  : q.category === 'Presente' 
                                  ? 'bg-blue-100 text-blue-800' 
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}>
                                {q.category}
                              </span>
                            </td>
                            <td className="px-6 py-4 space-y-1">
                              <p className="text-sm font-semibold leading-relaxed text-primary">{q.it}</p>
                              {q.en && <p className="text-xs text-ink/50 italic leading-snug">EN: {q.en}</p>}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <div className="flex flex-col items-center gap-1">
                                <span className="text-xs font-black text-ink/75">{translateFieldsCount + 1} <span className="text-[10px] text-ink/40 font-normal">lingue</span></span>
                                <div className="flex gap-1 max-w-[150px] flex-wrap justify-center">
                                  {enabledLanguages.filter(langId => langId !== 'it').map(langCode => {
                                    const available = !!q[langCode as keyof Question];
                                    const support = LANGUAGE_SUPPORT[langCode] || 'high';
                                    return (
                                      <span 
                                        key={langCode} 
                                        className={`inline-block text-[7px] font-black w-[18px] h-[18px] rounded flex items-center justify-center uppercase relative ${
                                          available ? 'bg-olive/15 text-olive font-black' : 'bg-gray-100 text-gray-300'
                                        }`}
                                        title={`${langCode}: ${available ? 'Tradotto' : 'Vuoto'} (Affidabilità: ${
                                          support === 'high' ? 'Alta' : support === 'medium' ? 'Media' : 'Bassa'
                                        })`}
                                      >
                                        {langCode}
                                        {/* Tiny indicator dot */}
                                        <span className={`absolute -bottom-0.5 right-0.5 w-[3.5px] h-[3.5px] rounded-full border-[0.5px] border-white ${
                                          support === 'high' 
                                            ? 'bg-emerald-500' 
                                            : support === 'medium'
                                            ? 'bg-amber-400'
                                            : 'bg-rose-500'
                                        }`} />
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex justify-end items-center gap-1.5">
                                <button
                                  onClick={() => handleEditQuestion(q)}
                                  className="p-2 hover:bg-olive/10 text-olive hover:text-olive-dark rounded-xl transition-colors"
                                  title="Modifica"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteQuestion(q.id)}
                                  className="p-2 hover:bg-red-50 text-red-600 hover:text-red-700 rounded-xl transition-colors"
                                  title="Cancella"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-ink/40">
                           Nessuna domanda trovata con i filtri inseriti.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Enabled Languages Selector */}
        {activeTab === 'languages' && (
          <div className="space-y-6">
            {/* Sezione Crea Lingua Personalizzata (IN ALTO) */}
            <div className="bg-white rounded-3xl p-6 md:p-8 border border-ink/5 shadow-sm space-y-4">
              <div className="flex items-center gap-2.5 pb-2">
                <Sparkles className="w-5 h-5 text-accent animate-pulse" />
                <div>
                  <h3 className="font-serif text-lg font-bold text-primary italic">Crea Lingua Personalizzata con Gemini AI</h3>
                  <p className="text-sm text-ink/60 mt-0.5">
                    Inserisci il nome di qualsiasi lingua desideri aggiungere (es. <em>Spagnolo, Giapponese, Rumeno, Svedese, Catalano</em>).
                    Gemini verificherà la lingua, tradurrà automaticamente l'intera interfaccia del totem e <strong>tutte le domande salvandole direttamente nel browser</strong>.
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    placeholder="Scrivi qui la lingua da creare (es. Romeno, Svedese, Norvegese...)"
                    value={customLanguageInput}
                    onChange={(e) => setCustomLanguageInput(e.target.value)}
                    disabled={isProcessingCustomLanguage}
                    className="w-full bg-[#f8f6f2]/40 border border-ink/10 rounded-2xl px-4 py-3 text-sm focus:border-olive focus:bg-white outline-none font-sans transition-all pr-10"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleAutoCreateAndTranslateLanguage();
                      }
                    }}
                  />
                  {customLanguageInput && !isProcessingCustomLanguage && (
                    <button
                      type="button"
                      onClick={() => setCustomLanguageInput('')}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink/40 hover:text-ink/70"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleAutoCreateAndTranslateLanguage}
                  disabled={isProcessingCustomLanguage || !customLanguageInput.trim()}
                  className="sm:px-6 py-3 bg-olive hover:bg-olive-light disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-black uppercase tracking-wider rounded-2xl shadow-md flex items-center justify-center gap-2 transition-all shrink-0 h-11"
                >
                  {isProcessingCustomLanguage ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <Sparkles className="w-4 h-4 text-white" />
                  )}
                  Genera e Traduci Domande
                </button>
              </div>

              {/* Progress / Status display */}
              {isProcessingCustomLanguage && customLanguageProgress && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-2xl bg-olive/5 border border-olive/15 space-y-2"
                >
                  <div className="flex items-center justify-between text-xs font-bold text-olive">
                    <span className="flex items-center gap-1.5 leading-relaxed">
                      <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                      {customLanguageProgress.status}
                    </span>
                    {customLanguageProgress.total > 0 && (
                      <span className="shrink-0 text-[10px] font-mono whitespace-nowrap">
                        {customLanguageProgress.current} / {customLanguageProgress.total}
                      </span>
                    )}
                  </div>
                  {customLanguageProgress.total > 0 && (
                    <div className="w-full h-1.5 bg-olive/10 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-olive rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${(customLanguageProgress.current / customLanguageProgress.total) * 100}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                  )}
                </motion.div>
              )}
            </div>

            <div className="bg-white rounded-3xl p-6 md:p-8 border border-ink/5 shadow-sm space-y-4">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h3 className="font-serif text-xl font-bold text-primary italic">Filtra Lingue del Menu d'Ingresso</h3>
                  <p className="text-sm text-ink/60 mt-1">
                    Trascina l'interruttore o seleziona le lingue che desideri abilitare sul prompt d'ingresso. Il Totem mostrerà unicamente le lingue con la spunta abilitata.
                  </p>
                </div>
                <div className="flex gap-2.5 shrink-0 self-stretch md:self-auto">
                  <button
                    onClick={handleEnableAllLanguages}
                    className="flex-1 md:flex-none justify-center px-4 py-2 border border-ink/10 hover:bg-bg-main rounded-xl text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-2"
                  >
                    <Check className="w-4 h-4 text-olive" />
                    Abilita Tutte
                  </button>
                  <button
                    onClick={handleDisableAllExceptIt}
                    className="flex-1 md:flex-none justify-center px-4 py-2 border border-ink/10 hover:bg-red-50 hover:text-red-600 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    Solo Italiano
                  </button>
                </div>
              </div>

              {/* Languages Grid Selector */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 pt-6">
                {LANGUAGES_POOL.map(lang => {
                  const isEnabled = enabledLanguages.includes(lang.id);
                  return (
                    <button
                      key={lang.id}
                      onClick={() => handleToggleLanguage(lang.id)}
                      className={`p-4 rounded-2xl border transition-all text-left flex flex-col justify-between h-28 relative group cursor-pointer ${
                        isEnabled 
                          ? 'bg-white border-olive/35 shadow-md ring-1 ring-olive/5' 
                          : 'bg-[#f8f6f2]/40 border-ink/10 opacity-60 hover:opacity-100 hover:bg-white hover:scale-[1.01]'
                      }`}
                    >
                      {/* Flag Indicator badge */}
                      <div className="flex justify-between items-start w-full">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-black tracking-widest uppercase px-2 py-0.5 rounded ${
                            isEnabled ? 'bg-olive/10 text-olive' : 'bg-gray-100 text-gray-400'
                          }`}>
                            {lang.id}
                          </span>
                          <span 
                            className={`w-2 h-2 rounded-full ${
                              LANGUAGE_SUPPORT[lang.id] === 'high' 
                                ? 'bg-emerald-500' 
                                : LANGUAGE_SUPPORT[lang.id] === 'medium'
                                ? 'bg-amber-400'
                                : 'bg-rose-500'
                            }`}
                            title={
                              LANGUAGE_SUPPORT[lang.id] === 'high' 
                                ? 'Affidabilità Traduzione: Alta (Lingua Centrale)' 
                                : LANGUAGE_SUPPORT[lang.id] === 'medium'
                                ? 'Affidabilità Traduzione: Media (Sotto test)' 
                                : 'Affidabilità Traduzione: Bassa (Lingua Rara / Sperimentale)'
                            }
                          />
                        </div>
                        
                        {/* Circle Check or Delete Button */}
                        <div className="flex items-center gap-1.5 relative z-10">
                          {LANGUAGES_POOL_STATIC.every(l => l.id !== lang.id) && (
                            <button
                              type="button"
                              onClick={(e) => handleDeleteCustomLanguage(e, lang.id)}
                              className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                              title="Elimina lingua personalizzata"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all ${
                            isEnabled 
                              ? 'bg-olive border-olive text-white shadow-sm' 
                              : 'border-ink/25 text-transparent'
                          }`}>
                            <Check className="w-3 h-3 stroke-[3px]" />
                          </div>
                        </div>
                      </div>

                      {/* Info & Labels */}
                      <div className="space-y-0.5">
                        <p className={`font-sans font-black text-base transition-colors ${
                          isEnabled ? 'text-primary' : 'text-ink/60'
                        }`}>
                          {lang.labelNative}
                        </p>
                        <p className="text-[10px] text-accent uppercase tracking-wider font-bold leading-none">
                          {lang.label}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Upload question sets */}
        {activeTab === 'upload' && (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-6 md:p-8 border border-ink/5 shadow-sm space-y-6">
              
              {!uploadedPreview ? (
                <>
                  <div>
                    <h3 className="font-serif text-xl font-bold text-primary italic">Importa nuovo set di domande</h3>
                    <p className="text-sm text-ink/65 mt-1 leading-relaxed">
                      Puoi caricare un file Excel (<code>.xlsx</code> / <code>.xls</code>), un file Comma Separated Values (<code>.csv</code>), un file <code>.json</code> oppure un documento <code>.pdf</code>.
                      Il file deve contenere almeno una colonna / campo per identificare l'ID, la Categoria (Passato, Presente, Futuro) e il testo visivo (Italiano / it). Gli altri campi tradotti verranno mappati automaticamente. 
                      Per i file <strong>PDF</strong>, l'IA di Gemini leggerà ed estrarrà automaticamente la lista delle domande raggruppandole per categoria temporale!
                    </p>
                  </div>

                  {/* Drag and Drop Zone */}
                  <div
                    onDragEnter={isFileParsing ? undefined : handleDrag}
                    onDragOver={isFileParsing ? undefined : handleDrag}
                    onDragLeave={isFileParsing ? undefined : handleDrag}
                    onDrop={isFileParsing ? undefined : handleDrop}
                    onClick={isFileParsing ? undefined : () => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-3xl p-10 md:p-14 text-center transition-all flex flex-col items-center justify-center gap-4 ${
                      isFileParsing
                        ? 'border-olive bg-olive/5 cursor-wait'
                        : dragActive 
                          ? 'border-olive bg-olive/5 scale-[1.01] cursor-pointer' 
                          : 'border-ink/15 hover:border-olive/50 hover:bg-bg-main/30 cursor-pointer'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      accept=".json,.csv,.xlsx,.xls,.pdf"
                      disabled={isFileParsing}
                      onChange={handleFileChange}
                    />

                    {isFileParsing ? (
                      <>
                        <div className="p-4 bg-olive/10 text-olive rounded-full animate-pulse">
                          <Loader2 className="w-10 h-10 animate-spin" />
                        </div>
                        <div className="space-y-1.5 max-w-md">
                          <h4 className="font-serif text-lg font-bold text-primary italic">Analisi PDF in corso...</h4>
                          <p className="text-xs text-ink/65 leading-relaxed">
                            L'IA di Gemini sta leggendo, scansionando ed estraendo le domande strutturate dal tuo documento PDF. Potrebbe volerci qualche secondo, attendi un istante...
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="p-4 bg-olive/10 text-olive rounded-full">
                          <FileSpreadsheet className="w-10 h-10" />
                        </div>

                        <div className="space-y-1.5">
                          <h4 className="font-serif text-lg font-bold text-primary italic">Trascina qui il tuo file di domande</h4>
                          <p className="text-xs text-ink/50 uppercase tracking-widest font-bold">Oppure clicca per sfogliare il dispositivo</p>
                        </div>

                        <div className="flex flex-wrap gap-2 pt-2 justify-center">
                          <span className="text-[10px] font-black uppercase tracking-wider bg-gray-100 text-gray-600 px-3 py-1 rounded">XLSX (Excel)</span>
                          <span className="text-[10px] font-black uppercase tracking-wider bg-gray-100 text-gray-600 px-3 py-1 rounded">CSV (Semplice)</span>
                          <span className="text-[10px] font-black uppercase tracking-wider bg-gray-100 text-gray-600 px-3 py-1 rounded">JSON (Dati)</span>
                          <span className="text-[10px] font-black uppercase tracking-wider bg-olive-light/20 text-olive px-3 py-1 rounded font-bold shadow-sm">PDF (Estrazione IA)</span>
                        </div>
                      </>
                    )}
                  </div>

                  {uploadToast && (
                    <div className={`${uploadToast.type === 'success' ? 'bg-olive/10 text-olive border-olive/20' : 'bg-red-50 text-red-600 border-red-200'} border p-4 rounded-2xl flex items-start gap-3`}>
                      {uploadToast.type === 'success' ? (
                        <Loader2 className="w-5 h-5 shrink-0 mt-0.5 animate-spin" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                      )}
                      <p className="text-sm font-semibold">{uploadToast.message}</p>
                    </div>
                  )}

                  <div className="bg-[#f8f6f2] p-5 rounded-2xl border border-ink/5 space-y-2">
                    <h5 className="text-xs font-black uppercase tracking-widest text-accent flex items-center gap-1.5">
                      <Info className="w-4 h-4" />
                      Requisito tracciamento Colonne/Campi:
                    </h5>
                    <ul className="text-xs text-ink/65 list-disc pl-5 space-y-1.5 leading-relaxed">
                      <li><strong>id / ID / Id</strong> (Facoltativo): Identificativo univoco della domanda (es: p1, f32). Se omesso verrà calcolato automaticamente.</li>
                      <li><strong>it / Italiano / italiano</strong> (Obbligatorio per Excel/CSV/JSON): Il testo della domanda in lingua italiana.</li>
                      <li><strong>categoria / Categoria / category</strong>: Specifica 'Passato', 'Presente' o 'Futuro'. Se l'ID comincia con 'p', 'pr' o 'f', la categoria verrà dedotta automaticamente se omessa.</li>
                      <li><strong>en / Inglese, fr / Francese, ar / Arabo, bn / Bengalese, so / Somalo, wo / Wolof, uk / Ucraino, ku / Curdo, fa / Farsi</strong>: Traduzioni facoltative nei canali corrispondenti.</li>
                      <li><strong>Documenti PDF</strong>: Nessuna formattazione specifica richiesta! Il PDF può contenere elenchi numerati, paragrafi o un testo colloquiale contente domande; Gemini identificherà autonomamente i testi adatti da importare.</li>
                    </ul>
                  </div>
                </>
              ) : (
                <div className="space-y-6">
                  
                  {/* Upload Preview & Action choices */}
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-ink/10">
                    <div>
                      <span className="inline-block px-3 py-1 bg-olive text-white text-[10px] font-black uppercase tracking-widest rounded-full mb-1">Preview File Caricato</span>
                      <h3 className="font-serif text-xl font-bold text-primary italic">File: "{uploadedPreview.fileName}"</h3>
                      <p className="text-xs text-ink/50 mt-1">
                        Trovate <strong>{uploadedPreview.questions.length}</strong> domande valide da importare nel pool del Totem.
                      </p>
                    </div>
                    <button
                      onClick={() => setUploadedPreview(null)}
                      className="px-4 py-2 border border-ink/10 hover:bg-bg-main rounded-xl text-xs font-bold uppercase tracking-wider"
                    >
                      Annulla Caricamento
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Setup Save / Append details prior to applying */}
                    <div className="space-y-4">
                      <h4 className="text-sm font-bold uppercase tracking-wider text-accent border-b pb-1.5">Opzioni d'Installazione</h4>
                      
                      <div className="space-y-3">
                        <label className="flex items-start gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={autoTranslateEnabled}
                            onChange={(e) => setAutoTranslateEnabled(e.target.checked)}
                            className="mt-1 accent-olive w-4 h-4"
                          />
                          <div>
                            <span className="text-sm font-bold text-primary block leading-tight flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                              Traduci automaticamente i campi vuoti
                            </span>
                            <span className="text-xs text-ink/55 font-sans">Scansiona tutte le nuove domande importate e traduce con Gemini le lingue mancanti prima di salvare il set.</span>
                          </div>
                        </label>

                        <label className="flex items-start gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={archiveOptionOnUpload}
                            onChange={(e) => setArchiveOptionOnUpload(e.target.checked)}
                            className="mt-1 accent-olive w-4 h-4"
                          />
                          <div>
                            <span className="text-sm font-bold text-primary block leading-tight">Archivia automaticamente questo set</span>
                            <span className="text-xs text-ink/55">Salvala permanentemente nell'archivio interno per poterla ripristinare con un click in futuro.</span>
                          </div>
                        </label>

                        {archiveOptionOnUpload && (
                          <div className="pl-7">
                            <label className="block text-xs font-bold text-accent uppercase tracking-widest mb-1.5">Nome dell'Archivio</label>
                            <input
                              type="text"
                              className="w-full bg-[#f8f6f2] border border-ink/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-olive"
                              value={customUploadSetName}
                              onChange={(e) => setCustomUploadSetName(e.target.value)}
                              placeholder="Nome set esempio: Domande Estate 2026"
                            />
                          </div>
                        )}
                      </div>

                      {/* Execution triggers */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4">
                        <button
                          onClick={() => handleApplyUpload('overwrite')}
                          className="w-full py-3.5 bg-[#ce2b37] text-white rounded-2xl font-black text-xs uppercase tracking-[0.15em] shadow-lg hover:scale-[1.01] transition-transform"
                        >
                          Sovrascrivi Domande Attive
                        </button>
                        <button
                          onClick={() => handleApplyUpload('append')}
                          className="w-full py-3.5 bg-olive text-white rounded-2xl font-black text-xs uppercase tracking-[0.15em] shadow-lg hover:scale-[1.01] transition-transform"
                        >
                          Unisci a Domande Esistenti
                        </button>
                      </div>

                      <div className="bg-amber-50 text-amber-800 border border-amber-200 p-4 rounded-2xl flex gap-3 text-xs">
                        <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold uppercase tracking-wider">Note sulle azioni:</p>
                          <p className="mt-1 leading-relaxed">
                            - <strong>Sovrascrivi</strong>: Elimina tutte le domande attive sul totem e inserisce solo queste {uploadedPreview.questions.length}.<br/>
                            - <strong>Unisci</strong>: Mantieni le domande attive presenti sul totem ed integra le nuove. I codici ID uguali non verranno duplicati.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Preview Table of first 10 questions */}
                    <div className="bg-[#f8f6f2] p-5 rounded-2xl border border-ink/5 flex flex-col gap-3">
                      <h4 className="text-xs font-black uppercase tracking-wider text-accent">Anteprima prime 10 domande trovate:</h4>
                      <div className="divide-y divide-ink/10 overflow-y-auto max-h-[350px] pr-2 space-y-2.5">
                        {uploadedPreview.questions.slice(0, 10).map((q, idx) => (
                          <div key={idx} className="pt-2 text-xs">
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-mono font-bold text-accent">{q.id}</span>
                              <span className="bg-white px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border">{q.category}</span>
                            </div>
                            <p className="font-semibold text-primary">{q.it}</p>
                            {q.en && <p className="text-ink/50 italic mt-0.5">EN: {q.en}</p>}
                          </div>
                        ))}
                        {uploadedPreview.questions.length > 10 && (
                          <div className="text-center pt-3 text-[10px] text-ink/40 font-bold uppercase tracking-widest">
                            ... e altre {uploadedPreview.questions.length - 10} domande
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 4: Archive management */}
        {activeTab === 'archives' && (
          <div className="space-y-6">
            
            {/* Form to Archive Current Set */}
            <div className="bg-white rounded-3xl p-6 md:p-8 border border-ink/5 shadow-sm space-y-4">
              <div>
                <h3 className="font-serif text-lg font-bold text-primary italic">Salva l'asset corrente di domande</h3>
                <p className="text-xs text-ink/60 mt-1">
                  Vuoi mettere in cassaforte le domande attive configurate in questo preciso momento? Gli assegneremo un nome e potrai ripristinarle in qualsiasi istante.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 max-w-xl">
                <input
                  type="text"
                  className="bg-[#f8f6f2] border border-ink/10 rounded-2xl px-4 py-3 font-sans text-sm outline-none focus:border-olive transition-colors flex-1"
                  placeholder="Es: Domande Centro Marella Inverno 2026..."
                  value={archiveSetName}
                  onChange={(e) => setArchiveSetName(e.target.value)}
                />
                <button
                  onClick={handleArchiveCurrentSet}
                  className="bg-olive hover:bg-olive-dark text-white px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2 shrink-0 shadow-md"
                >
                  <Save className="w-4 h-4" />
                  Salva Set Corrente
                </button>
              </div>
            </div>

            {/* List of Archived sets */}
            <div className="bg-white rounded-3xl border border-ink/5 shadow-sm overflow-hidden p-6 md:p-8 space-y-6">
              <div>
                <h3 className="font-serif text-lg font-bold text-primary italic">Set di domande in archivio</h3>
                <p className="text-xs text-ink/60 mt-1">
                  Questo è l'elenco dei set di domande archiviati. Fai clic su "Applica" per rimpiazzare l'intero set attivo del Totem con quello selezionato.
                </p>
              </div>

              <div className="space-y-4">
                {questionArchives.map(set => (
                  <div 
                    key={set.id} 
                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-2xl border border-ink/5 bg-bg-main/30 hover:bg-white hover:border-olive/20 transition-all gap-4"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-olive/15 rounded-xl text-olive">
                        <Database className="w-5 h-5" />
                      </div>
                      <div className="space-y-1">
                        
                        {/* Renaming mode / normal mode */}
                        {renamingSetId === set.id ? (
                          <div className="flex gap-2 items-center">
                            <input
                              type="text"
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              className="bg-white border rounded px-2 py-1 text-sm shrink-0 outline-none"
                              autoFocus
                            />
                            <button onClick={() => handleSaveRename(set.id)} className="p-1 hover:bg-olive/10 text-olive text-xs rounded font-bold uppercase">Ok</button>
                            <button onClick={() => setRenamingSetId(null)} className="p-1 hover:bg-gray-100 text-ink/40 text-xs rounded">Annulla</button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-primary leading-tight">{set.name}</h4>
                            <button onClick={() => handleStartRename(set.id, set.name)} className="p-1 text-accent hover:text-olive hover:bg-white rounded transition-colors" title="Rinomina">
                              <Edit2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink/50">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {set.date}
                          </span>
                          <span className="font-extrabold text-accent">
                            {set.questions.length} domande
                          </span>
                          {set.id === 'original_set' && (
                            <span className="bg-primary/10 text-primary text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded">
                              Default
                            </span>
                          )}
                        </div>

                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0 justify-end">
                      <button
                        onClick={() => handleExportQuestionsJSON(set.questions, set.name)}
                        className="px-3 py-2 border border-ink/10 hover:bg-white rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5 text-accent"
                        title="Scarica file JSON di questo set"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Esporta JSON
                      </button>
                      <button
                        onClick={() => handleLoadFromArchive(set)}
                        className="px-4 py-2 bg-olive text-white hover:bg-olive-dark rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors flex items-center gap-1.5 shadow-sm"
                        title="Render attiva sul Totem"
                      >
                        Applica Set
                      </button>
                      
                      {set.id !== 'original_set' && (
                        <button
                          onClick={() => handleDeleteArchive(set.id, set.name)}
                          className="p-2 hover:bg-red-50 text-red-600 rounded-xl transition-colors shrink-0"
                          title="Elimina dall'archivio"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: Microphone Configuration */}
        {activeTab === 'audio' && (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-6 md:p-8 border border-ink/5 shadow-sm space-y-6">
              
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-ink/10">
                <div>
                  <h3 className="font-serif text-lg font-bold text-primary italic">Sorgente Audio del Totem</h3>
                  <p className="text-xs text-ink/60 mt-1">
                    Seleziona il microfono da cui acquisire le registrazioni. Puoi scegliere fra i microfoni integrati di iPad o schede audio e microfoni USB esterni.
                  </p>
                </div>
                
                <button
                  onClick={requestMicLabelPermission}
                  className="bg-primary/10 hover:bg-primary/20 text-primary px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Rileva Nomi Dispositivi
                </button>
              </div>

              {/* Informative alert about iOS Iframe limitations */}
              <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200 text-xs text-amber-800 space-y-1.5 leading-relaxed">
                <span className="font-black uppercase tracking-wider flex items-center gap-1.5 text-[10px]">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  Nota Critica per iPad Air & Safari:
                </span>
                <p>
                  Su iPad, per ragioni di sicurezza della privacy introdotte da Apple, <strong>i microfoni esterni ed interni non possono essere selezionati o utilizzati se l'applicazione è visualizzata all'interno di un iFrame</strong> (come nell'anteprima dell'editor).
                </p>
                <p>
                  Per assicurare il perfetto funzionamento e rilevamento di microfoni esterni, fai sempre clic sul pulsante <strong>"Apri in nuova scheda"</strong> in alto a destra! Solo in una scheda autonoma il browser concede piene autorizzazioni ai microfoni aggiuntivi.
                </p>
              </div>

              {/* Microphone dropdown selector */}
              <div className="space-y-3">
                <label className="block text-[10px] font-black uppercase tracking-widest text-ink/50">
                  Scegli Microfono Attivo
                </label>
                
                <div className="relative max-w-xl">
                  <select
                    value={selectedMic}
                    onChange={(e) => handleSelectMic(e.target.value)}
                    className="w-full bg-[#f8f6f2] border border-ink/10 rounded-2xl px-4 py-3.5 font-sans text-sm outline-none focus:border-olive appearance-none transition-colors"
                  >
                    <option value="default">Predefinito di sistema</option>
                    {audioDevices.map((device, idx) => (
                      <option key={device.deviceId || idx} value={device.deviceId}>
                        {device.label || `Microfono ${idx + 1} (${device.deviceId.slice(0, 8)}...)`}
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-ink/40">
                    <ChevronRight className="w-4 h-4 rotate-90" />
                  </div>
                </div>

                <div className="text-xs text-ink/50">
                  Stato impostato: <strong className="text-olive">{localStorage.getItem('preferred_mic_label') || "Predefinito di sistema"}</strong>
                </div>
              </div>

              {/* Live VU Meter & Audio Testing panel */}
              <div className="bg-[#f8f6f2] p-6 rounded-3xl border border-ink/5 space-y-4">
                <div>
                  <h4 className="text-sm font-bold text-primary flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-olive" />
                    Testa il segnale microfonico live
                  </h4>
                  <p className="text-xs text-ink/65 mt-0.5">
                    Attiva un test in tempo reale per verificare visivamente se il microfono selezionato sta catturando la voce degli intervistati in modo impeccabile.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
                  <button
                    onClick={startMicTest}
                    className={`px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shrink-0 ${
                      isTestingMic 
                        ? 'bg-state-error text-white shadow-lg shadow-state-error/20' 
                        : 'bg-olive text-white shadow-lg shadow-olive/20 hover:scale-[1.02]'
                    }`}
                  >
                    <Mic className="w-4 h-4" />
                    {isTestingMic ? 'Interrompi Test' : 'Inizia Test Audio'}
                  </button>

                  {/* Level meter */}
                  <div className="flex-1 w-full space-y-1.5">
                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider text-ink/40">
                      <span>Livello segnale in ingresso</span>
                      <span>{testVolume}%</span>
                    </div>

                    <div className="h-4 bg-white/80 rounded-full overflow-hidden border border-ink/5 p-0.5 flex relative">
                      <div 
                        className="h-full rounded-full transition-all duration-75 max-w-full bg-gradient-to-r from-emerald-500 via-amber-500 to-red-500" 
                        style={{ width: `${testVolume}%` }}
                      />
                      
                      {/* Scale Indicators */}
                      <div className="absolute inset-0 flex justify-between px-4 text-[7px] font-light text-ink/30 pointer-events-none items-center">
                        <span>Min (Silenzio)</span>
                        <span>Ottimale</span>
                        <span>Saturato</span>
                      </div>
                    </div>
                  </div>
                </div>

                {isTestingMic && (
                  <div className="text-[10px] text-ink/40 font-bold uppercase tracking-widest text-center animate-pulse">
                    ● Trasmissione segnale audio attiva in tempo reale
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* Tab 6: Gestione & Ricerca Schede (Testimonianze) */}
        {activeTab === 'testimonies' && (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-6 md:p-8 border border-ink/5 shadow-sm space-y-6">
              
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-ink/10">
                <div>
                  <h3 className="font-serif text-lg font-bold text-primary italic">Ricerca & Gestione Schede Testimonianze</h3>
                  <p className="text-xs text-ink/60 mt-1">
                    Cerca e filtra le registrazioni e i feedback salvati sulla base di qualsiasi parola contenuta nei testi (risposte tradotte, originali, parole chiave o domande).
                  </p>
                </div>
                
                <div className="flex items-center gap-2 font-black uppercase tracking-wider text-[10px] bg-zinc-100 px-3 py-1.5 rounded-xl text-ink/70">
                  Trovate: <strong className="text-olive">{filteredTestimonies.length}</strong> su {archive?.length || 0}
                </div>
              </div>

              {/* Search Bar */}
              <div className="flex flex-col sm:flex-row items-stretch gap-3">
                <div className="relative flex-1">
                  <span className="absolute inset-y-0 left-4 flex items-center text-ink/40">
                    <Search className="w-5 h-5" />
                  </span>
                  <input
                    type="text"
                    placeholder="Digita parole chiavi, testi, lingue o frammenti di risposte..."
                    value={testimonySearchQuery}
                    onChange={(e) => setTestimonySearchQuery(e.target.value)}
                    className="w-full bg-[#f8f6f2] border border-ink/10 rounded-2xl pl-12 pr-10 py-3.5 font-sans text-sm outline-none focus:border-olive transition-colors"
                  />
                  {testimonySearchQuery && (
                    <button
                      onClick={() => setTestimonySearchQuery('')}
                      className="absolute inset-y-0 right-3 flex items-center text-ink/40 hover:text-ink"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Testimonies Table / List */}
              {filteredTestimonies.length === 0 ? (
                <div className="text-center py-16 bg-[#fbfaf7] border border-dashed border-ink/10 rounded-2xl">
                  <span className="text-4xl block mb-2">🔍</span>
                  <p className="font-serif text-base text-ink/50">Nessuna scheda corrisponde ai criteri di ricerca impostati.</p>
                  <p className="text-xs text-ink/45 mt-1">Prova a digitare parole diverse o cancella la richiesta.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-ink/5">
                  <table className="w-full text-left border-collapse table-auto">
                    <thead>
                      <tr className="border-b border-ink/10 text-ink/40 text-[10px] font-black uppercase tracking-widest bg-[#fdfdfc]">
                        <th className="px-6 py-4">Mood & Lingua</th>
                        <th className="px-6 py-4">Categoria/Data</th>
                        <th className="px-6 py-4 max-w-lg">Contenuti della Scheda (Domanda & Risposta)</th>
                        <th className="px-6 py-4 text-right">Azioni Cliniche e Controllo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink/5 bg-white">
                      {filteredTestimonies.map((item) => (
                        <tr key={item.id} className="hover:bg-bg-main/30 transition-colors">
                          {/* Mood & Language */}
                          <td className="px-6 py-4 align-top">
                            <div className="flex flex-col gap-1.5">
                              <span className="font-serif text-lg italic text-olive font-bold tracking-tight">
                                {item.parola_chiave || 'Senza Parola'}
                              </span>
                              {item.parola_chiave_lingua_originale && item.parola_chiave_lingua_originale !== item.parola_chiave && (
                                <span className="text-[10px] text-zinc-400 italic">
                                  ({item.parola_chiave_lingua_originale})
                                </span>
                              )}
                              <span className="text-[10px] font-black uppercase tracking-widest text-[#9c1c1c] bg-red-50/70 border border-red-100 px-2.5 py-0.5 rounded-full w-max mt-0.5">
                                {item.lingua_originale || 'Rilevamento'}
                              </span>
                            </div>
                          </td>

                          {/* Categoria / Data */}
                          <td className="px-6 py-4 align-top">
                            <div className="flex flex-col gap-1 items-start">
                              <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                                item.category === 'Passato' 
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200/50' 
                                  : item.category === 'Presente' 
                                  ? 'bg-blue-100 text-blue-800 border border-blue-200/50' 
                                  : 'bg-emerald-100 text-emerald-800 border border-emerald-250/50'
                              }`}>
                                {item.category || 'Presente'}
                              </span>
                              <span className="text-[10px] font-mono font-medium text-ink/40 mt-1.5 block">
                                {item.date ? new Date(item.date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}
                              </span>
                              <span className="text-[9px] font-mono text-ink/30">
                                {item.date ? new Date(item.date).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : ''}
                              </span>
                            </div>
                          </td>

                          {/* Contenuti scheda */}
                          <td className="px-6 py-4 max-w-lg align-top">
                            <div className="space-y-3 py-1">
                              {/* Domanda */}
                              <div className="text-xs text-ink/50 bg-[#fbfaf7] p-2.5 rounded-xl border border-ink/5">
                                <strong className="text-ink/65 block text-[8px] uppercase tracking-widest font-black mb-0.5">Domanda Visualizzata:</strong>
                                <p className="font-medium text-ink/70 leading-relaxed">{item.domanda_proposta || '-'}</p>
                              </div>
                              
                              {/* Risposta Italiana */}
                              <div className="text-sm">
                                <strong className="text-olive block text-[8px] uppercase tracking-widest font-black mb-0.5">Risposta Tradotta (In Italiano):</strong>
                                <p className="text-ink/80 leading-relaxed font-sans font-medium">{item.traduzione_italiano || '-'}</p>
                              </div>

                              {/* Trascrizione Originale */}
                              {item.trascrizione_originale && item.trascrizione_originale !== item.traduzione_italiano && (
                                <div className="text-xs bg-amber-50/10 p-2.5 rounded-xl border border-dashed border-ink/10">
                                  <strong className="text-ink/40 block text-[8px] uppercase tracking-widest font-black mb-0.5">Trascrizione Originale ({item.lingua_originale}):</strong>
                                  <p className="text-ink/60 italic leading-relaxed">"{item.trascrizione_originale}"</p>
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Azioni */}
                          <td className="px-6 py-4 text-right align-top">
                            <div className="flex items-center justify-end gap-2.5 py-1">
                              {/* Favorite star */}
                              <button
                                onClick={(e) => onToggleFavoriteTestimony && onToggleFavoriteTestimony(item.id, e)}
                                className={`p-2.5 rounded-xl transition-all cursor-pointer hover:scale-105 active:scale-95 flex items-center justify-center border shrink-0 ${
                                  item.favorite 
                                    ? 'bg-accent-light text-accent border-accent/20' 
                                    : 'bg-white text-ink/30 border-ink/10 hover:bg-warm-bg'
                                }`}
                                title={item.favorite ? "Rimuovi dai Preferiti" : "Segna come Preferito"}
                              >
                                <Star className={`w-4 h-4 ${item.favorite ? 'fill-accent' : ''}`} />
                              </button>

                              {/* Open & Correct */}
                              <button
                                onClick={() => onEditTestimony && onEditTestimony(item)}
                                className="p-2.5 bg-zinc-100 text-olive hover:bg-olive hover:text-white border border-ink/10 rounded-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center shadow-xs cursor-pointer shrink-0"
                                title="Apri e Correggi"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>

                              {/* View Postcard */}
                              <button
                                onClick={() => onViewTestimony && onViewTestimony(item)}
                                className="p-2.5 bg-primary text-white hover:bg-primary-light rounded-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center shadow-sm cursor-pointer shrink-0"
                                title="Visualizza Cartolina Finale"
                              >
                                <Search className="w-4 h-4" />
                              </button>

                              {/* Delete */}
                              <button
                                onClick={(e) => onDeleteTestimony && onDeleteTestimony(item.id, e)}
                                className="p-2.5 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white border border-red-100 rounded-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center shadow-xs cursor-pointer shrink-0"
                                title="Elimina"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

            </div>
          </div>
        )}

        {/* Tab 7: Gestisci risposte (Rapid Answers Correction List/Editor) */}
        {activeTab === 'answers' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* LEFT Column: Fast Navigator List (span-4) */}
            <div className="lg:col-span-4 space-y-4">
              <div className="bg-white rounded-3xl p-5 border border-ink/5 shadow-sm space-y-4">
                <div>
                  <h3 className="font-serif text-base font-bold text-primary italic">Scorrimento Risposte</h3>
                  <p className="text-[11px] text-ink/50 mt-1">Seleziona una cartolina per correggerla istantaneamente.</p>
                </div>

                {/* Search in responses */}
                <div className="relative">
                  <span className="absolute inset-y-0 left-3.5 flex items-center text-ink/40">
                    <Search className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    placeholder="Cerca per parola, risposta, lingua..."
                    value={answersSearchQuery}
                    onChange={(e) => {
                      setAnswersSearchQuery(e.target.value);
                      setSelectedAnswerIndex(0);
                    }}
                    className="w-full bg-[#f8f6f2] border border-ink/10 rounded-xl pl-10 pr-8 py-2.5 font-sans text-xs outline-none focus:border-olive transition-colors"
                  />
                  {answersSearchQuery && (
                    <button
                      onClick={() => {
                        setAnswersSearchQuery('');
                        setSelectedAnswerIndex(0);
                      }}
                      className="absolute inset-y-0 right-3 flex items-center text-ink/40 hover:text-ink text-xs"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Vertical list of items */}
                <div className="space-y-2 max-h-[550px] overflow-y-auto pr-1">
                  {filteredAnswers.length === 0 ? (
                    <div className="text-center py-8 text-xs text-ink/40 border border-dashed border-ink/5 rounded-xl bg-warm-bg/20">
                      Nessun risultato
                    </div>
                  ) : (
                    filteredAnswers.map((item, idx) => {
                      const isActive = activeAnswerItem?.id === item.id;
                      const isUnsaved = item.id === activeAnswerItem?.id && hasUnsavedChanges;
                      
                      return (
                        <button
                          key={item.id}
                          onClick={() => setSelectedAnswerIndex(idx)}
                          className={`w-full text-left p-3.5 rounded-2xl border transition-all flex flex-col gap-1.5 focus:outline-none relative group ${
                            isActive 
                              ? 'bg-olive/10 border-olive/35 text-olive shadow-sm' 
                              : 'bg-white border-ink/5 text-ink hover:bg-[#fcfbf9] hover:border-ink/10'
                          }`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="font-serif font-bold text-sm tracking-tight text-primary italic">
                              {item.parola_chiave || 'Senza Parola'}
                            </span>
                            <span className="font-mono text-[9px] text-ink/35 font-semibold">
                              #{idx + 1}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider ${
                              item.category === 'Passato' 
                                ? 'bg-amber-100/75 text-amber-850' 
                                : item.category === 'Presente' 
                                ? 'bg-blue-100/75 text-blue-850' 
                                : 'bg-emerald-100/75 text-emerald-850'
                            }`}>
                              {item.category || 'Presente'}
                            </span>
                            <span className="px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider bg-red-1050/5 text-red-700/85 border border-red-100/40">
                              {item.lingua_originale || 'it'}
                            </span>
                          </div>

                          <p className="text-[11px] text-ink/65 line-clamp-2 leading-relaxed">
                            {item.traduzione_italiano || '(Nessuna risposta)'}
                          </p>

                          {/* Unsaved Badge indicator */}
                          {isUnsaved && (
                            <span className="absolute top-2 right-6 flex items-center justify-center">
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                              </span>
                            </span>
                          )}
                          {item.favorite && (
                            <span className="absolute top-2 right-2 text-accent">
                              ★
                            </span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT Column: Editor (span-8) */}
            <div className="lg:col-span-8">
              {activeAnswerItem ? (
                <div className="bg-white rounded-3xl p-6 md:p-8 border border-ink/5 shadow-sm space-y-6">
                  
                  {/* Active Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-ink/10">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-black uppercase tracking-widest text-[#9c1c1c] bg-red-50 border border-red-105 rounded-md">
                          Lingua Originale: {activeAnswerItem.lingua_originale || 'Italiano'}
                        </span>
                        <span className="text-[9px] font-black uppercase tracking-widest text-ink/40 font-mono">
                          ID: {activeAnswerItem.id.substring(0, 8)}
                        </span>
                      </div>
                      <h3 className="font-serif text-lg font-bold text-primary italic mt-1 flex items-center gap-2">
                        <Edit2 className="w-5 h-5 text-olive shrink-0" />
                        Modifica Rapida: {activeAnswerItem.parola_chiave || 'Senza Parola'}
                      </h3>
                      {activeAnswerItem.date && (
                        <p className="text-[10px] text-ink/40 font-mono mt-0.5">
                          Registrata il: {new Date(activeAnswerItem.date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-center">
                      <button
                        onClick={() => {
                          if (selectedAnswerIndex > 0) {
                            setSelectedAnswerIndex(prev => prev - 1);
                          }
                        }}
                        disabled={selectedAnswerIndex === 0}
                        className="p-2.5 bg-zinc-100 hover:bg-zinc-200 disabled:opacity-40 disabled:hover:bg-zinc-100 rounded-xl transition-all cursor-pointer text-ink text-xs font-black text-center"
                        title="Precedente"
                      >
                        ◀ PRECEDENTE
                      </button>
                      <button
                        onClick={() => {
                          if (selectedAnswerIndex < filteredAnswers.length - 1) {
                            setSelectedAnswerIndex(prev => prev + 1);
                          }
                        }}
                        disabled={selectedAnswerIndex === filteredAnswers.length - 1}
                        className="p-2.5 bg-zinc-100 hover:bg-zinc-200 disabled:opacity-40 disabled:hover:bg-zinc-100 rounded-xl transition-all cursor-pointer text-ink text-xs font-black text-center"
                        title="Successivo"
                      >
                        SUCCESSIVO ▶
                      </button>
                    </div>
                  </div>

                  {/* Form fields */}
                  <div className="space-y-5">
                    
                    {/* Word and Category Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-black uppercase tracking-widest text-ink/50">Parola Chiave (Italiano)</label>
                        <input
                          type="text"
                          value={editAnswerParola}
                          onChange={(e) => setEditAnswerParola(e.target.value)}
                          className="w-full bg-[#f8f6f2] border border-ink/10 rounded-xl px-4 py-3 font-sans text-sm outline-none focus:border-olive transition-colors font-medium text-ink/80"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-black uppercase tracking-widest text-ink/50">Tempo / Categoria</label>
                        <select
                          value={editAnswerCategoria}
                          onChange={(e) => setEditAnswerCategoria(e.target.value)}
                          className="w-full bg-[#f8f6f2] border border-ink/10 rounded-xl px-4 py-3 font-sans text-sm outline-none focus:border-olive transition-colors appearance-none font-medium text-ink/80"
                        >
                          <option value="Passato">Passato</option>
                          <option value="Presente">Presente</option>
                          <option value="Futuro">Futuro</option>
                        </select>
                      </div>

                    </div>

                    {/* Domanda Proposta in Italiano */}
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-black uppercase tracking-widest text-ink/50">Domanda in Italiano</label>
                      <textarea
                        value={editAnswerDomanda}
                        onChange={(e) => setEditAnswerDomanda(e.target.value)}
                        className="w-full bg-[#f8f6f2] border border-ink/10 rounded-xl px-4 py-2.5 font-sans text-sm outline-none focus:border-olive transition-colors h-20 resize-y leading-relaxed text-ink/80 font-medium"
                      />
                    </div>

                    {/* Risposta Tradotta in Italiano */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <label className="block text-[10px] font-black uppercase tracking-widest text-olive">Risposta in Italiano (Cartolina/PDF)</label>
                        {hasUnsavedChanges && (
                          <span className="text-[10px] text-amber-600 font-bold uppercase tracking-wider animate-pulse flex items-center gap-1">
                            <Info className="w-3.5 h-3.5" /> Modifiche pendenti
                          </span>
                        )}
                      </div>
                      <textarea
                        value={editAnswerRisposta}
                        onChange={(e) => setEditAnswerRisposta(e.target.value)}
                        className="w-full bg-[#f8f6f2] border border-olive/20 rounded-2xl px-5 py-4 font-sans text-sm outline-none focus:border-olive focus:ring-1 focus:ring-olive transition-shadow min-h-[150px] leading-relaxed text-ink font-semibold"
                        placeholder="Scrivi la risposta tradotta/corretta in italiano..."
                      />
                    </div>

                    {/* Display original fields if non-Italian */}
                    {activeAnswerItem.lingua_originale && activeAnswerItem.lingua_originale.toLowerCase() !== 'italiano' && (
                      <div className="p-4 bg-amber-50/50 rounded-2xl border border-dashed border-ink/10 space-y-3">
                        <h4 className="text-[10px] font-black uppercase tracking-wider text-accent">Testi Originali di Riferimento</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                          <div className="space-y-1">
                            <span className="font-bold text-ink/45 block">Domanda Originale ({activeAnswerItem.lingua_originale}):</span>
                            <p className="text-ink/75 italic">"{activeAnswerItem.domanda_proposta_lingua_originale || '(Non disponibile)'}"</p>
                          </div>
                          <div className="space-y-1">
                            <span className="font-bold text-ink/45 block">Trascrizione Originale ({activeAnswerItem.lingua_originale}):</span>
                            <p className="text-ink/75 italic">"{activeAnswerItem.trascrizione_originale || '(Non disponibile)'}"</p>
                          </div>
                        </div>
                      </div>
                    )}

                  </div>

                  {/* Actions buttons */}
                  <div className="pt-4 border-t border-ink/10 flex flex-col md:flex-row gap-3">
                    <button
                      onClick={(e) => {
                        if (onDeleteTestimony && activeAnswerItem) {
                          onDeleteTestimony(activeAnswerItem.id, e);
                        }
                      }}
                      className="py-3 px-5 bg-red-50 hover:bg-red-100 text-[#9c1c1c] border border-red-200/50 rounded-2xl font-black text-xs uppercase tracking-widest transition-all text-center cursor-pointer flex items-center justify-center gap-2 shrink-0 order-last md:order-first"
                      title="Elimina questa scheda definitivamente"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Elimina</span>
                    </button>

                    <div className="flex-1" />

                    <button
                      onClick={() => {
                        // Reset fields to original
                        setEditAnswerDomanda(activeAnswerItem.domanda_proposta || '');
                        setEditAnswerRisposta(activeAnswerItem.traduzione_italiano || '');
                        setEditAnswerParola(activeAnswerItem.parola_chiave || '');
                        setEditAnswerCategoria(activeAnswerItem.category || 'Presente');
                      }}
                      disabled={!hasUnsavedChanges}
                      className="py-3 px-5 bg-zinc-50 hover:bg-zinc-100 disabled:opacity-40 disabled:hover:bg-zinc-50 text-ink/70 border border-ink/10 rounded-2xl font-black text-xs uppercase tracking-widest transition-all text-center cursor-pointer"
                    >
                      Annulla Modifiche
                    </button>
                    
                    <button
                      onClick={() => {
                        handleSaveAnswer(activeAnswerItem);
                      }}
                      disabled={!hasUnsavedChanges}
                      className={`py-3 px-5 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all text-center cursor-pointer shadow-md ${
                        hasUnsavedChanges 
                          ? 'bg-olive hover:bg-olive-dark' 
                          : 'bg-zinc-300 cursor-not-allowed text-zinc-500 shadow-none'
                      }`}
                    >
                      Salva Modifiche
                    </button>

                    <button
                      onClick={() => {
                        // Save current item
                        handleSaveAnswer(activeAnswerItem);
                        // Move to next if possible
                        if (selectedAnswerIndex < filteredAnswers.length - 1) {
                          setTimeout(() => {
                            setSelectedAnswerIndex(prev => prev + 1);
                          }, 100);
                        }
                      }}
                      className="py-3 px-5 bg-accent text-[#855307] hover:bg-accent-light border border-accent/20 rounded-2xl font-black text-xs uppercase tracking-widest transition-all text-center cursor-pointer shadow-md flex items-center justify-center gap-1.5 font-bold"
                    >
                      <span>Salva e Successiva ➔</span>
                    </button>
                  </div>

                </div>
              ) : (
                <div className="bg-white rounded-3xl p-16 border border-ink/5 shadow-sm text-center">
                  <span className="text-4xl block mb-2">📬</span>
                  <p className="font-serif text-base text-ink/50">Nessuna risposta disponibile da correggere.</p>
                  <p className="text-xs text-ink/40 mt-1">Crea alcune registrazioni o prova a resettare la ricerca.</p>
                </div>
              )}
            </div>

          </div>
        )}

      </main>

    </div>
  );
};
