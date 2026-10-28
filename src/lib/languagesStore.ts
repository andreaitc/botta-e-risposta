export interface LanguageItem {
  id: string;
  label: string;
  labelNative: string;
}

export const DEFAULT_LANGUAGES: LanguageItem[] = [
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

export const DEFAULT_SUPPORT: Record<string, 'high' | 'medium' | 'low'> = {
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

export function getLanguagesPool(): LanguageItem[] {
  const saved = localStorage.getItem('custom_languages');
  if (saved) {
    try {
      const parsed = JSON.parse(saved) as LanguageItem[];
      // Filter out any duplicates just in case
      const ids = new Set(DEFAULT_LANGUAGES.map(l => l.id));
      const customFiltered = parsed.filter(l => !ids.has(l.id));
      return [...DEFAULT_LANGUAGES, ...customFiltered];
    } catch (e) {
      console.error("Failed to parse custom_languages", e);
    }
  }
  return DEFAULT_LANGUAGES;
}

export function getLanguageSupportMap(): Record<string, 'high' | 'medium' | 'low'> {
  const saved = localStorage.getItem('custom_language_support');
  if (saved) {
    try {
      const parsed = JSON.parse(saved) as Record<string, 'high' | 'medium' | 'low'>;
      return { ...DEFAULT_SUPPORT, ...parsed };
    } catch (e) {
      console.error("Failed to parse custom_language_support", e);
    }
  }
  return DEFAULT_SUPPORT;
}

export function saveCustomLanguage(lang: LanguageItem, support: 'high' | 'medium' | 'low' = 'low') {
  // Save custom language
  const current = getLanguagesPool();
  if (current.some(l => l.id === lang.id)) {
    return; // Already exists
  }
  
  const savedStr = localStorage.getItem('custom_languages');
  let savedList: LanguageItem[] = [];
  if (savedStr) {
    try {
      savedList = JSON.parse(savedStr) as LanguageItem[];
    } catch (e) {}
  }
  savedList.push(lang);
  localStorage.setItem('custom_languages', JSON.stringify(savedList));

  // Save custom support level
  const savedSupportStr = localStorage.getItem('custom_language_support');
  let savedSupport: Record<string, 'high' | 'medium' | 'low'> = {};
  if (savedSupportStr) {
    try {
      savedSupport = JSON.parse(savedSupportStr) as Record<string, 'high' | 'medium' | 'low'>;
    } catch (e) {}
  }
  savedSupport[lang.id] = support;
  localStorage.setItem('custom_language_support', JSON.stringify(savedSupport));
}

export function getNiceLanguageLabel(lang: string | undefined): string {
  if (!lang) return 'Trascrizione';
  const norm = lang.trim().toLowerCase();
  if (norm === 'italiano' || norm === 'it') return 'Italiano';
  
  // Try to find by id, label or labelNative
  const pool = getLanguagesPool();
  const found = pool.find(l => 
    l.id.toLowerCase() === norm || 
    l.label.toLowerCase() === norm || 
    l.labelNative.toLowerCase() === norm
  );
  
  if (found) {
    return found.label.charAt(0).toUpperCase() + found.label.slice(1).toLowerCase();
  }
  
  // Heuristics for common variations / abbreviations
  if (norm === 'ar' || norm.includes('arab')) return 'Arabo';
  if (norm === 'en' || norm.includes('ingl') || norm.includes('engl')) return 'Inglese';
  if (norm === 'fr' || norm.includes('fran')) return 'Francese';
  if (norm === 'es' || norm.includes('spag') || norm.includes('span')) return 'Spagnolo';
  if (norm === 'ru' || norm.includes('russ')) return 'Russo';
  if (norm === 'de' || norm.includes('tede') || norm.includes('germ')) return 'Tedesco';
  if (norm === 'pt' || norm.includes('port')) return 'Portoghese';
  if (norm === 'uk' || norm.includes('ucra') || norm.includes('ukra')) return 'Ucraino';
  if (norm === 'zh' || norm.includes('cine') || norm.includes('chin')) return 'Cinese';
  if (norm === 'ja' || norm.includes('giapp') || norm.includes('japa')) return 'Giapponese';
  if (norm === 'ro' || norm.includes('rome') || norm.includes('rume') || norm.includes('roma')) return 'Romeno';
  if (norm === 'tr' || norm.includes('turc') || norm.includes('turk')) return 'Turco';
  if (norm === 'bn' || norm.includes('beng')) return 'Bengalese';
  if (norm === 'so' || norm.includes('soma')) return 'Somalo';
  if (norm === 'bm' || norm.includes('bamb')) return 'Bambara';
  if (norm === 'mnk' || norm.includes('mand')) return 'Mandinka';
  if (norm === 'ps' || norm.includes('past') || norm.includes('pash')) return 'Pasthu';
  if (norm === 'fa' || norm.includes('fars') || norm.includes('pers')) return 'Farsi';
  if (norm === 'ur' || norm.includes('undu') || norm.includes('urdu')) return 'Urdu';
  
  if (lang.length <= 3) return lang.toUpperCase();
  return lang.charAt(0).toUpperCase() + lang.slice(1).toLowerCase();
}

