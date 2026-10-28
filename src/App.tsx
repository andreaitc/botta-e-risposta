import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Mic, 
  Square, 
  ArrowRight, 
  Heart, 
  RefreshCcw, 
  Loader2, 
  BookOpen, 
  X, 
  Download, 
  FileAudio,
  FileDown,
  Star, 
  StarOff, 
  Trash2, 
  FileArchive, 
  FileSpreadsheet,
  Check,
  FileText,
  Settings,
  Pointer,
  Search,
  Globe,
  Music,
  Play,
  Pause,
  ArrowLeft,
  AlertCircle,
  Copy,
  ExternalLink,
  Home,
  Upload,
  RotateCcw,
  Volume2,
  ChevronRight,
  Edit2,
  IdCard
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { Question, questions, Category } from './data/questions';
import { processAudioTestimony, TestimonyResult, translateText } from './lib/gemini';
import { saveAudio, getAudio, deleteAudio, clearAllAudio } from './lib/audioStorage';
import { generateTappetoSonoro, convertBlobToWav } from './lib/tappetoSonoro';
import { createArchiveBackup, restoreArchiveBackup } from './lib/dataBackup';
import Studio from './components/Studio';
import { AdminPanel } from './components/AdminPanel';
import { getLanguagesPool, getLanguageSupportMap, getNiceLanguageLabel } from './lib/languagesStore';

type AppState = 'ONBOARDING' | 'HOME' | 'DOMANDA' | 'RECORDING' | 'ELABORAZIONE' | 'RISPOSTA' | 'ARCHIVIO' | 'SILENCE' | 'STUDIO' | 'ADMIN';

export interface SavedTestimony extends TestimonyResult {
  id: string;
  date: string;
  favorite?: boolean;
  audioId?: string;
  // Studio specific fields
  studioVolume?: number;
  studioTrimStart?: number;
  studioTrimEnd?: number;
  studioCrossfadeNext?: number;
}

const MAX_RECORDING_TIME = 45; // seconds

const getThankYouMessage = (language: string | undefined) => {
  const lang = language?.toLowerCase() || 'italiano';
  if (lang.includes('inglese') || lang.includes('english')) {
    return "Thank you. If you want to answer another question, click here";
  }
  if (lang.includes('francese') || lang.includes('french')) {
    return "Merci. Si vous souhaitez répondre à une autre question, cliquez ici";
  }
  if (lang.includes('arabo') || lang.includes('arabic')) {
    return "شكرا لك. إذا كنت ترغب في الإجابة على سؤال آخر، انقر هنا";
  }
  if (lang.includes('bengalese') || lang.includes('bengali')) {
    return "ধন্যবাদ। আপনি যদি অন্য একটি প্রশ্নের উত্তর দিতে চান, এখানে ক্লিক করুন";
  }
  if (lang.includes('somalo') || lang.includes('somali')) {
    return "Mahadsanid. Haddii aad rabto inaad ka jawaabto su'aal kale, riix halkaan";
  }
  if (lang.includes('bambara')) {
    return "I ni ce! Ni m'a bɛ fɛ ka jaabi di laaj wɛrɛ ma, digi dɔ ma yan";
  }
  if (lang.includes('mandinka')) {
    return "Baraka dun! Ni i lafita ansa la nyininkaro wole la, nying diike m'a bota fɛ";
  }
  if (lang.includes('ucraino') || lang.includes('ukrainian')) {
    return "Дякуємо. Якщо ви хочете відповісти на інше запитання, натисніть тут";
  }
  if (lang.includes('dendi')) {
    return "Albarka k'e jaba aỹyã bir-yeẽ hã suba ndayẽ";
  }
  if (lang.includes('pasthu') || lang.includes('pashto')) {
    return "مننه. که تاسو غواړئ بلې پوښتنې ته ځواب ووایاست، دلته کلیک وکړئ";
  }
  if (lang.includes('farsi') || lang.includes('persian')) {
    return "متشکرم. اگر می‌خواهید به سوال دیگری پاسخ دهید، اینجا کلیک کنید";
  }
  if (lang.includes('urdu')) {
    return "شکریہ۔ اگر آپ دوسرے سوال کا جواب دینا چاہتے ہیں تو یہاں کلک کریں";
  }
  if (lang.includes('spagnolo') || lang.includes('spanish')) {
    return "Gracias. Si quieres responder a otra question, haz clic aquí";
  }
  if (lang.includes('pulaar')) {
    return "Jarama. Ko a yiɗi jaabaade landal ballal kadi, ɓoornu ɗoo";
  }
  if (lang.includes('krio')) {
    return "Tenki. If yu want fɔ ansa ɔda kwɛstyɔn, de dɔŋ";
  }
  return "Grazie. Se vuoi rispondere a un'altra domanda clicca qui";
};

type SupportedLanguage = string;

const UI_TRANSLATIONS_RAW: Record<string, {
  languageName: string;
  greeting: string;
  readyButton: string;
  nativeLanguagePrompt: string;
  processingText: string;
  processingTitle: string;
  errorText: string;
  audioTooLowError: string;
  processingError: string;
  timeoutError: string;
  changeQuestionPrompt: string;
  changeQuestionLastPrompt: string;
  tryAgainButton: string;
  noThanksButton: string;
  stopButton: string;
  dir: 'ltr' | 'rtl';
}> = {
  it: {
    languageName: "italiano",
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
    stopButton: "STOP",
    dir: 'ltr'
  },
  en: {
    languageName: "English",
    greeting: "Hello! Thank you for choosing to play with us. Would you like to answer a simple question? We'll ask it in {language} but you can answer in your native language. Your answer will remain anonymous. Feel free to answer whatever you want!",
    readyButton: "I'm ready",
    nativeLanguagePrompt: "You can answer in your native language",
    processingText: "Thank you! We are carefully translating your words.",
    processingTitle: "Processing...",
    errorText: "Sorry, I didn't hear much. Let's try again",
    audioTooLowError: "I'm sorry but I didn't hear well.",
    processingError: "I'm sorry but something went wrong.",
    timeoutError: "Processing is taking too long. Please try again.",
    changeQuestionPrompt: "Do you want to change the question?",
    changeQuestionLastPrompt: "Don't like this one either? Okay. Let's change for the last time",
    tryAgainButton: "Try again",
    noThanksButton: "No thanks",
    stopButton: "STOP",
    dir: 'ltr'
  },
  ar: {
    languageName: "العربية",
    greeting: "مرحباً! شكراً لاختيارك اللعب معنا. هل ترغب في الإجابة على سؤال بسيط؟ سنطرحه بـ {language} ولكن يمكنك الإجابة بلغتك الأم. ستبقى إجابتك مجهولة المصدر. لا تتردد في الإجابة بما تريد!",
    readyButton: "أنا مستعد",
    nativeLanguagePrompt: "يمكنك الإجابة بلغتك الأم",
    processingText: "شكرا لك! نحن نترجم كلماتك بعناية.",
    processingTitle: "جاري المعالجة...",
    errorText: "عذراً، لم أسمع جيداً. دعنا نحاول مرة أخرى",
    audioTooLowError: "آسف ولكن لم أسمع جيداً.",
    processingError: "آسف ولكن حدث خطأ ما.",
    timeoutError: "تستغرق المعالجة وقتاً طويلاً. يرجى المحاولة مرة أخرى.",
    changeQuestionPrompt: "هل تريد تغيير السؤال؟",
    changeQuestionLastPrompt: "ألم يعجبك هذا السؤال أيضاً؟ حسناً. لنغيره للمرة الأخيرة",
    tryAgainButton: "حاول مرة أخرى",
    noThanksButton: "لا شكرا",
    stopButton: "توقف",
    dir: 'rtl'
  },
  fr: {
    languageName: "français",
    greeting: "Bonjour ! Merci d'avoir choisi de jouer avec nous. Voulez-vous répondre à une question simple ? Nous vous la posons en {language} mais vous pourrez répondre dans votre langue maternelle. Votre réponse restera anonyme. N'hésitez pas à répondre ce que vous voulez !",
    readyButton: "Je suis prêt",
    nativeLanguagePrompt: "Vous pouvez répondre dans votre langue maternelle",
    processingText: "Merci ! Nous traduisons soigneusement vos mots.",
    processingTitle: "Traitement en cours...",
    errorText: "Désolé, je n'ai pas bien entendu. Réessayons",
    audioTooLowError: "Désolé mais je n'ai pas bien entendu.",
    processingError: "Désolé mais quelque chose s'est mal passé.",
    timeoutError: "Le traitement prend trop de temps. Veuillez réessayer.",
    changeQuestionPrompt: "Voulez-vous changer de question ?",
    changeQuestionLastPrompt: "Celle-ci ne vous plaît pas non plus ? D'accord. Changeons pour la dernière fois",
    tryAgainButton: "Réessayer",
    noThanksButton: "Non merci",
    stopButton: "STOP",
    dir: 'ltr'
  },
  bn: {
    languageName: "বাংলা",
    greeting: "হ্যালো! আমাদের সাথে খেলার জন্য ধন্যবাদ। আপনি কি একটি সহজ প্রশ্নের উত্তর দিতে চান? আমরা এটি {language} ভাষায় জিজ্ঞাসা করব কিন্তু আপনি আপনার মাতৃভাষায় উত্তর দিতে পারেন। আপনার উত্তর বেনামী থাকবে। আপনি যা চান তা নির্দ্বিধায় উত্তর দিন!",
    readyButton: "আমি প্রস্তুত",
    nativeLanguagePrompt: "আপনি আপনার মাতৃভাষায় উত্তর দিতে পারেন",
    processingText: "ধন্যবাদ! আমরা যত্ন সহকারে আপনার শব্দ অনুবাদ করছি।",
    processingTitle: "প্রক্রিয়াকরণ চলছে...",
    errorText: "দুঃখিত, আমি ভালো শুনতে পাইনি। আবার চেষ্টা করি",
    audioTooLowError: "দুঃখিত কিন্তু আমি ভালো শুনতে পাইনি।",
    processingError: "দুঃখিত কিন্তু কিছু ভুল হয়েছে।",
    timeoutError: "প্রক্রিয়াকরণে খুব বেশি সময় লাগছে। অনুগ্রহ করে আবার চেষ্টা করুন।",
    changeQuestionPrompt: "আপনি কি প্রশ্ন পরিবর্তন করতে চান?",
    changeQuestionLastPrompt: "এটিও আপনার পছন্দ নয়? ঠিক আছে। শেষবারের মতো পরিবর্তন করা যাক",
    tryAgainButton: "আবার চেষ্টা করুন",
    noThanksButton: "না ধন্যবাদ",
    stopButton: "বন্ধ করুন",
    dir: 'ltr'
  },
  so: {
    languageName: "Soomaali",
    greeting: "Waad salaaman tahay! Waad ku mahadsan tahay inaad dooratay inaad nala ciyaarto. Ma jeclaan lahayd inaad ka jawaabto su'aal fudud? Waxaan kugu weydiin doonaa {language} laakiin waxaad ku jawaabi kartaa afkaaga hooyo. Jawaabtaadu waxay ahaan doontaa qarsoodi. Xor u noqo inaad ka jawaabto waxaad rabto!",
    readyButton: "Waan diyaar ahay",
    nativeLanguagePrompt: "Xusuusnow inaad ku jawaabi karto afkaaga hooyo",
    processingText: "Mahadsanid! Waxaan si taxadar leh u tarjumeynaa erayadaada.",
    processingTitle: "Waa la shaqeynayaa...",
    errorText: "Waan ka xumahay, si fiican uma maqal. Aan mar kale isku dayno",
    audioTooLowError: "Waan ka xumahay laakiin si fiican uma maqal.",
    processingError: "Waan ka xumahay laakiin wax baa qaldamay.",
    timeoutError: "Habayntu waxay qaadanaysaa wakhti aad u dheer. Fadlan mar kale isku day.",
    changeQuestionPrompt: "Ma rabtaa inaad bedesho su'aasha?",
    changeQuestionLastPrompt: "Tanna miyaadan jeclayn? Hagaag. Aan bedelno markii ugu dambaysay",
    tryAgainButton: "Mar kale isku day",
    noThanksButton: "Maya mahadsanid",
    stopButton: "JOOJI",
    dir: 'ltr'
  },
  bm: {
    languageName: "Bamanankan",
    greeting: "I ni ce! An b'a ladon e fɛ ka jaabi di laaj nɔgɔman dɔ ma. An b'a laaj e fɛ ni {language} ye, nka e be se ka jaabi di e bangokan na. E ka jaabi bɛ to dogolenya la. Safee jaabi de lase e b'a fɛ cogo o cogo!",
    readyButton: "N bɛ sɔn",
    nativeLanguagePrompt: "Hakili to a la e be se ka jaabi di e bangokan na",
    processingText: "I ni ce! An b'a bayɛlɛma nɔgɔya la.",
    processingTitle: "Bayɛlɛmali lase...",
    errorText: "M'a mɛn koɲuman. An k'a ɲini tuun.",
    audioTooLowError: "M'a mɛn koɲuman.",
    processingError: "Taaɲasirbaga gɛlɛya dɔ bɛ senna.",
    timeoutError: "Bayɛlɛmali jara tuma banya. Hakɛto e k'a ɲini tuun.",
    changeQuestionPrompt: "E b'a fɛ ka laaj yɛlɛma?",
    changeQuestionLastPrompt: "Bii fana b'a fɛ k'a yɛlɛma? Laban ye ni ye.",
    tryAgainButton: "K'a ɲini tuun",
    noThanksButton: "Ayi, i ni ce",
    stopButton: "STOP",
    dir: 'ltr'
  },
  mnk: {
    languageName: "Mandin'ka",
    greeting: "Hera bee be! Kontong tole ye moolu la. I lafita ansa la nyanila nyininkaro dula la? N be i nyininkara la {language} la, bari i be se k'ansa la i fang bong kango la. I la kango be to dogorinya la. I be se k'ansa la feng-o-feng m'a bota fɛ.",
    readyButton: "N parata le",
    nativeLanguagePrompt: "Mirandi i be se k'ansa la i bang kango la",
    processingText: "Baraka dun! N b'i la kango bayelema la nyanila.",
    processingTitle: "Bayelemaro be senna...",
    errorText: "N m'i kan moi ko-nying. Han-tuun bang.",
    audioTooLowError: "N m'i kan moi ko-nying.",
    processingError: "Fengo bang fiti.",
    timeoutError: "A ma tara tuma jaba-ring la. Bang han-tuun.",
    changeQuestionPrompt: "I lafita nyininkaro yelema la bang?",
    changeQuestionLastPrompt: "Nying fana nene? Labango ye nying ye.",
    tryAgainButton: "Bang han-tuun",
    noThanksButton: "Hani, baraka",
    stopButton: "STOP",
    dir: 'ltr'
  },
  uk: {
    languageName: "українською",
    greeting: "Привіт! Дякуємо, що вирішили пограти з нами. Бажаєте відповісти на просте запитання? Ми поставимо його {language}, але ви можете відповісти своєю рідною мовою. Ваша відповідь залишиться анонімною. Будьте вільні відповісти все, що захочете!",
    readyButton: "Я готовий",
    nativeLanguagePrompt: "Пам'ятайте, що ви можете відповісти своєю рідною мовою",
    processingText: "Дякуємо! Ми дбайливо перекладаємо ваші слова.",
    processingTitle: "Обробка...",
    errorText: "Вибачте, але я майже нічого не почув. Спробуймо ще раз",
    audioTooLowError: "Вибачте, але я погано почув.",
    processingError: "Вибачте, але щось пішло не так.",
    timeoutError: "Обробка триває занадто довго. Спробуйте ще раз.",
    changeQuestionPrompt: "Бажаєте змінити запитання?",
    changeQuestionLastPrompt: "Це також вам не подобається? Добре. Змінимо востаннє",
    tryAgainButton: "Спробувати ще раз",
    noThanksButton: "Ні, дякую",
    stopButton: "СТОП",
    dir: 'ltr'
  },
  ddn: {
    languageName: "Dendi",
    greeting: "Fofo! Albarka k'e suba k'e goy nd'ay. I cace k'e jaba mmahala dɛndɛ? Ay g'a hã hã {language} gaa, amma i bã k'e jaba nd'i cinde-nyã bumbo gaa. I jaba k'goye cina-chinã. Sentiti free k'e jaba hã k'e baa k'goy!",
    readyButton: "Ay go tɛy",
    nativeLanguagePrompt: "Hagalkũ k'e jaba nd'i cinde-nyã gaa",
    processingText: "Albarka! Ĩ gõõ cindẽ goy handu-handũ.",
    processingTitle: "Goỹ go dindĩ...",
    errorText: "M'ã maã gũ. Bir-yeẽ.",
    audioTooLowError: "M'ã maã gũ bumbõ.",
    processingError: "Boro gaã goỹ saba hã.",
    timeoutError: "Goy gaa hay du-du gura. Bir-yeẽ.",
    changeQuestionPrompt: "I baa hã hã yɛlɛmã?",
    changeQuestionLastPrompt: "Nyi fana mĩ bano gã? Yee-labañ.",
    tryAgainButton: "Bir-yeẽ hã",
    noThanksButton: "Aỹyã hã, albarka",
    stopButton: "STOP",
    dir: 'ltr'
  },
  ps: {
    languageName: "پښتو",
    greeting: "سلام! له موږ سره د لوبې کولو لپاره مننه. ایا تاسو غواړئ یوې ساده پوښتنې ته ځواب ووایاست؟ موږ به یې په {language} وپوښتو مګر تاسو کولی شئ په خپله مورنۍ ژبه ځواب ورکړئ. ستاسو ځواب به پټ پاتې شي. هغه څه چې غواړئ ځواب ورکړئ!",
    readyButton: "زه چمتو یم",
    nativeLanguagePrompt: "یاد وساتئ چې تاسو کولی شئ په خپله غږیزه ژبه ځواب ورکړئ",
    processingText: "مننه! موږ ستاسو ټکي په پوره پاملرنې سره ژباړو.",
    processingTitle: "د پروسس کولو په حال کې...",
    errorText: "بخښنه غواړم، ما ډیر څه ونه اوریدل. راځئ بیا هڅه وکړو",
    audioTooLowError: "بخښنه غواړم مګر ما ښه ونه اوریدل.",
    processingError: "بخښنه غواړم مګر یو څه خراب شول.",
    timeoutError: "پروسس ډیر وخت نیسي. مهرباني وکړئ بیا هڅه وکړئ.",
    changeQuestionPrompt: "ایا غواړئ پوښتنه بدله کړئ؟",
    changeQuestionLastPrompt: "دا هم نه خوښوئ؟ سمه ده. راځئ د وروستي ځل لپاره یې بدل کړو",
    tryAgainButton: "بیا هڅه وکړئ",
    noThanksButton: "نه مننه",
    stopButton: "درول",
    dir: 'rtl'
  },
  fa: {
    languageName: "فارسی",
    greeting: "سلام! ممنون که انتخاب کردید با ما بازی کنید. آیا دوست دارید به یک سوال ساده پاسخ دهید؟ ما آن را به {language} می‌پرسیم اما شما می‌توانید به زبان مادری خود پاسخ دهید. پاسخ شما ناشناس خواهد ماند. راحت باشید و هر چه می‌خواهید پاسخ دهید!",
    readyButton: "من آماده‌ام",
    nativeLanguagePrompt: "به یاد داشته باشید که می‌توانید به زبان مادری خود پاسخ دهید",
    processingText: "متشکرم! ما با دقت کلمات شما را ترجمه می‌کنیم.",
    processingTitle: "در حال پردازش...",
    errorText: "ببخشید، خوب نشنیدم. بیایید دوباره امتحان کنیم",
    audioTooLowError: "ببخشید اما خوب نشنیدم.",
    processingError: "ببخشید اما مشکلی پیش آمد.",
    timeoutError: "پردازش خیلی طول می‌کشد. لطفا دوباره امتحان کنید.",
    changeQuestionPrompt: "آیا می‌خواهید سوال را تغییر دهید؟",
    changeQuestionLastPrompt: "این یکی را هم دوست ندارید؟ بسیار خب. برای آخرین بار تغییر می‌دهیم",
    tryAgainButton: "دوباره امتحان کنید",
    noThanksButton: "نه ممنون",
    stopButton: "ایست",
    dir: 'rtl'
  },
  ur: {
    languageName: "اردو",
    greeting: "ہیلو! ہمارے ساتھ کھیلنے کا انتخاب کرنے کا شکریہ۔ کیا آپ ایک آسان سوال کا جواب دینا چاہیں گے؟ ہم آپ سے {language} میں پوچھیں گے لیکن آپ اپنی مادری زبان میں جواب دے سکتے ہیں۔ آپ کا جواب گمنام رہے گا۔ جو چاہیں جواب دینے کے لیے بلا جھجھک محسوس کریں!",
    readyButton: "میں تیار ہوں",
    nativeLanguagePrompt: "یاد رکھیں کہ آپ اپنی مادری زبان میں جواب دے سکتے ہیں",
    processingText: "شکریہ! ہم آپ کے الفاظ کا تندہی سے ترجمہ کر رہے ہیں۔",
    processingTitle: "پروسیسنگ ہو رہی ہے...",
    errorText: "معذرت، میں ٹھیک سے سن نہیں سکا۔ آئیے دوبارہ کوشش کرتے ہیں",
    audioTooLowError: "معذرت لیکن میں ٹھیک سے سن نہیں سکا۔",
    processingError: "معذرت لیکن کچھ غلط ہو گیا۔",
    timeoutError: "پروسیسنگ میں بہت وقت لگ رہا ہے۔ براہ کرم دوبارہ کوشش کریں۔",
    changeQuestionPrompt: "کیا آپ سوال بدلنا چاہتے ہیں؟",
    changeQuestionLastPrompt: "یہ بھی پسند نہیں آیا؟ ٹھیک ہے۔ آئیے آخری بار بدلتے ہیں",
    tryAgainButton: "دوباره کوشش کریں",
    noThanksButton: "نہیں شکریہ",
    stopButton: "روکیں",
    dir: 'rtl'
  },
  es: {
    languageName: "español",
    greeting: "¡Hola! Gracias por elegir jugar con nosotros. ¿Te apetece responder a una pregunta sencilla? Te la haremos en {language} pero podrás responder en tu lengua materna. Tu respuesta seguirá siendo anónima. ¡Siéntete libre de responder lo que quieras!",
    readyButton: "Estoy listo",
    nativeLanguagePrompt: "Recuerda que puedes responder en tu lengua materna",
    processingText: "¡Gracias! Estamos traduciendo con cuidado tus palabras.",
    processingTitle: "Procesando...",
    errorText: "Lo siento, no he oído gran cosa. Intentémoslo de nuevo",
    audioTooLowError: "Lo siento, no he oído bien.",
    processingError: "Lo siento, pero algo ha salido mal.",
    timeoutError: "El procesamiento está tardando demasiado. Vuelve a intentarlo.",
    changeQuestionPrompt: "¿Quieres cambiar de pregunta?",
    changeQuestionLastPrompt: "¿Tampoco te gusta esta? Vale. Cambiemos por última vez",
    tryAgainButton: "Reintentar",
    noThanksButton: "No, gracias",
    stopButton: "PARAR",
    dir: 'ltr'
  },
  fuc: {
    languageName: "Pulaar",
    greeting: "Mbalen ma! Jarama subagol fiide meen. A yiɗi jaabaade landal ballal? Ko e ɗemngal {language} ndandinte-ɗaa, kono aɗa waawi jaabaade e ɗemngal yumma maa. Jaabol maa ko njiilaagu. Wonaa e huunde jooteteendi, jaabo ko njiɗ-ɗaa fof!",
    readyButton: "Mi hebiima",
    nativeLanguagePrompt: "Hantoro jaabaade e ɗemngal yumma maa",
    processingText: "Jarama! Miɗen mbinnda konngol maa feewde e njiilaagu.",
    processingTitle: "Fuɗɗitgol jaawngol...",
    errorText: "Yaafunoomi, mi nani fof. Mballen mar go’o",
    audioTooLowError: "Yaafunoomi mi nani mbel.",
    processingError: "Masi gure wonaa jam.",
    timeoutError: "Kugal ngal fof refti heewde kura. Fuɗɗitor kadi.",
    changeQuestionPrompt: "A yiɗi waylude landal ngal?",
    changeQuestionLastPrompt: "Ngol kadi a yiɗaa? Jam. Miɗen wayla sakkitorgal.",
    tryAgainButton: "Gooto kadi",
    noThanksButton: "O'o, jarama",
    stopButton: "DARO",
    dir: 'ltr'
  },
  kri: {
    languageName: "Krio",
    greeting: "Kushio! Tenki fɔ we yu tɛl we yu de ple wit wi. Yu want fɔ ansa wan simpul kwɛstyɔn? Wi go aks yu am na {language} bɔt yu kin ansa na yu yon mami tɔŋ. wetin yu go ansa go de pan aynitit. kler fɔ ansa ɛnitin we yu want!",
    readyButton: "A rɛdi",
    nativeLanguagePrompt: "Mɛmbɛ se yu go waawi de ansa na yu mami tɔŋ",
    processingText: "Tenki! Wi de wet fɔ tranzlet yu tɔk de na fayn fashin.",
    processingTitle: "Tranzleshn de wok...",
    errorText: "Sɔri bɔt a nɔ mɛn bɔku fɔ tɔk. Mek wi kadi una kado",
    audioTooLowError: "Sɔri bɔt a nɔ hɛri yu fayn.",
    processingError: "Sɔri bɔt sɔmtin go rɔŋ.",
    timeoutError: "dis tin de tek tu bɔku tɛm fɔ wok. Mek wi kadi de",
    changeQuestionPrompt: "Yu want fɔ chensh di kwɛstyɔn?",
    changeQuestionLastPrompt: "Dis wan sɛf yu nɔ lek am? we-wi. Mek wi chensh las tɛm.",
    tryAgainButton: "Gooto kadi",
    noThanksButton: "Nɔ tenki",
    stopButton: "STOP",
    dir: 'ltr'
  },
  ind: {
    languageName: "Bahasa Indonesia",
    greeting: "Halo! Terima kasih telah memilih untuk bermain dengan kami. Apakah Anda ingin menjawab pertanyaan sederhana? Kami akan menanyakannya dalam bahasa {language} tetapi Anda dapat menjawab dalam bahasa ibu Anda. Jawaban Anda akan tetap anonim. Jangan ragu untuk menjawab apa pun yang Anda inginkan!",
    readyButton: "Saya siap",
    nativeLanguagePrompt: "Ingatlah bahwa Anda dapat menjawab dalam bahasa ibu Anda",
    processingText: "Terima kasih! Kami sedang menerjemahkan kata-kata Anda dengan cermat.",
    processingTitle: "Sedang diproses...",
    errorText: "Maaf, saya tidak mendengar banyak. Mari kita coba lagi",
    audioTooLowError: "Maaf, tetapi saya tidak mendengar dengan baik.",
    processingError: "Maaf, tetapi ada yang salah.",
    timeoutError: "Pemrosesan memakan waktu terlalu lama. Silakan coba lagi.",
    changeQuestionPrompt: "Apakah Anda ingin mengganti pertanyaan?",
    changeQuestionLastPrompt: "Tidak suka yang ini juga? Oke. Mari kita ganti untuk terakhir kalinya",
    tryAgainButton: "Coba lagi",
    noThanksButton: "Tidak, terima kasih",
    stopButton: "BERHENTI",
    dir: 'ltr'
  },
  de: {
    languageName: "Deutsch",
    greeting: "Hallo! Vielen Dank, dass Sie sich entschieden haben, mit uns zu spielen. Möchten Sie eine einfache Frage beantworten? Wir stellen sie auf {language}, aber Sie können in Ihrer Muttersprache antworten. Ihre Antwort bleibt anonym. Antworten Sie ganz unbefangen, was Sie möchten!",
    readyButton: "Ich bin bereit",
    nativeLanguagePrompt: "Denken Sie daran, dass Sie in Ihrer Muttersprache antworten können",
    processingText: "Vielen Dank! Wir übersetzen Ihre Worte sorgfältig.",
    processingTitle: "In Bearbeitung...",
    errorText: "Entschuldigung, ich habe fast nichts gehört. Versuchen wir es noch einmal",
    audioTooLowError: "Es tut mir leid, aber ich habe Sie nicht gut verstanden.",
    processingError: "Es tut mir leid, aber da ist etwas schiefgelaufen.",
    timeoutError: "Die Verarbeitung dauert zu lange. Bitte versuchen Sie es erneut.",
    changeQuestionPrompt: "Möchten Sie die Frage ändern?",
    changeQuestionLastPrompt: "Gefällt Ihnen diese auch nicht? Okay. Wir wechseln ein letztes Mal",
    tryAgainButton: "Erneut versuchen",
    noThanksButton: "Nein, danke",
    stopButton: "STOPP",
    dir: 'ltr'
  },
  ja: {
    languageName: "日本語",
    greeting: "こんにちは！一緒に遊んでいただきありがとうございます。シンプルな質問に答えてみませんか？質問は{language}で行いますが、ご自身の母国語で答えていただけます。回答は匿名です。どうぞ自由に何でもお答えください！",
    readyButton: "準備ができました",
    nativeLanguagePrompt: "母国語で答えられることを忘れないでくださいね",
    processingText: "ありがとうございます！言葉を丁寧に翻訳しています。",
    processingTitle: "処理中...",
    errorText: "申し訳ありません、よく聞き取れませんでした。もう一度試してみましょう",
    audioTooLowError: "ごめんなさい、よく聞き取れませんでした。",
    processingError: "申し訳ありません、何かがうまくいかなかったようです。",
    timeoutError: "処理に時間がかかりすぎています。もう一度お試しください。",
    changeQuestionPrompt: "質問を変更しますか？",
    changeQuestionLastPrompt: "これも気に入りませんか？わかりました。これで最後に変更しましょう",
    tryAgainButton: "もう一度試す",
    noThanksButton: "いいえ、結構です",
    stopButton: "停止",
    dir: 'ltr'
  },
  sw: {
    languageName: "Kiswahili",
    greeting: "Jambo! Asante kwa kuchagua kucheza nasi. Je, ungependa kujibu swali rahisi? Tutaliuliza kwa {language} lakini unaweza kujibu kwa lugha yako ya asili. Majibu yako yatabaki bila kutambuliwa. Jisikie huru kujibu chochote unachotaka!",
    readyButton: "Niko tayari",
    nativeLanguagePrompt: "Kumbuka unaweza kujibu kwa lugha yako ya asili",
    processingText: "Asante! Tunatafsiri maneno yako kwa uangalifu.",
    processingTitle: "Inasindika...",
    errorText: "Samahani, sikusikia mengi. Hebu tujaribu tena",
    audioTooLowError: "Samahani, lakini sikusikia vizuri.",
    processingError: "Samahani, kuna kitu kimeenda vibaya.",
    timeoutError: "Usindikaji unachukua muda mrefu sana. Tafadhali jaribu tena.",
    changeQuestionPrompt: "Je, ungependa kubadilisha swali?",
    changeQuestionLastPrompt: "Hukupenda hii pia? Sawa. Hebu tubadilishe kwa mara ya mwisho",
    tryAgainButton: "Jaribu tena",
    noThanksButton: "Hapana, asante",
    stopButton: "SIMAMA",
    dir: 'ltr'
  },
  tr: {
    languageName: "Türkçe",
    greeting: "Merhaba! Bizimle oynamayı tercih ettiğiniz için teşekkür ederiz. Basit bir soruyu yanıtlamak ister misiniz? Soruyu {language} dilinde soracağız ancak siz kendi ana dilinizde yanıtlayabilirsiniz. Yanıtınız anonim kalacaktır. İstediğinizi yanıtlamakta özgürsünüz!",
    readyButton: "Hazırım",
    nativeLanguagePrompt: "Kendi ana dilinizde yanıtlayabileceğinizi unutmayın",
    processingText: "Teşekkürler! Sözlerinizi özenle çeviriyoruz.",
    processingTitle: "İşleniyor...",
    errorText: "Üzgünüm, pek bir şey duyamadım. Tekrar deneyelim",
    audioTooLowError: "Üzgünüm, sizi iyi duyamadım.",
    processingError: "Üzgünüm, bir şeyler ters gitti.",
    timeoutError: "İşlem çok uzun sürüyor. Lütfen tekrar deneyin.",
    changeQuestionPrompt: "Soruyu değiştirmek ister misiniz?",
    changeQuestionLastPrompt: "Bunu da mı beğenmediniz? Pekâla. Son bir kez değiştirelim",
    tryAgainButton: "Tekrar dene",
    noThanksButton: "Hayır, teşekkürler",
    stopButton: "DURDUR",
    dir: 'ltr'
  },
  pa: {
    languageName: "ਪੰਜਾਬੀ",
    greeting: "ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ! ਸਾਡੇ ਨਾਲ ਖੇਡਣ ਲਈ ਧੰਨਵਾਦ। ਕੀ ਤੁਸੀਂ ਇੱਕ ਸਧਾਰਨ ਸਵਾਲ ਦਾ ਜਵਾਬ ਦੇਣਾ ਚਾਹੋਗੇ? ਅਸੀਂ ਇਸਨੂੰ {language} ਵਿੱਚ ਪੁੱਛਾਂਗੇ ਪਰ ਤੁਸੀਂ ਆਪਣੀ ਮਾਂ-ਬੋਲੀ ਵਿੱਚ ਜਵਾਬ ਦੇ ਸਕਦੇ ਹੋ। ਤੁਹਾਡਾ ਜਵਾਬ ਗੁਮਨਾਮ ਰਹੇਗਾ। ਤੁਸੀਂ ਜੋ ਚਾਹੋ ਜਵਾਬ ਦੇਣ ਲਈ ਪੂਰੀ ਤਰ੍ਹਾਂ ਸੁਤੰਤਰ ਹੋ!",
    readyButton: "ਮੈਂ ਤਿਆਰ ਹਾਂ",
    nativeLanguagePrompt: "ਯਾਦ ਰੱਖੋ ਕਿ ਤੁਸੀਂ ਆਪਣੀ ਮਾਂ-ਬੋਲੀ ਵਿੱਚ ਜਵਾਬ ਦੇ ਸਕਦੇ ਹੋ",
    processingText: "ਧੰਨਵਾਦ! ਅਸੀਂ ਤੁਹਾਡੇ ਸ਼ਬਦਾਂ ਦਾ ਧਿਆਨ ਨਾਲ ਅਨੁਵਾਦ ਕਰ ਰਹੇ ਹਾਂ।",
    processingTitle: "ਪ੍ਰੋਸੈਸਿੰਗ ਹੋ ਰਹੀ ਹੈ...",
    errorText: "ਮਾਫ਼ ਕਰਨਾ, ਮੈਨੂੰ ਕੁਝ ਸੁਣਿਆ ਨਹੀਂ। ਆਓ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੀਏ",
    audioTooLowError: "ਮਾਫ਼ ਕਰਨਾ, ਪਰ ਮੈਂ ਠੀਕ ਤਰ੍ਹਾਂ ਸੁਣ ਨਹੀਂ ਸਕਿਆ।",
    processingError: "ਮਾਫ਼ ਕਰਨਾ, ਕੁਝ ਗਲਤ ਹੋ ਗਿਆ ਹੈ।",
    timeoutError: "ਪ੍ਰੋਸੈਸਿੰਗ ਵਿੱਚ ਬਹੁਤ ਸਮਾਂ ਲੱਗ ਰਿਹਾ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।",
    changeQuestionPrompt: "ਕੀ ਤੁਸੀਂ ਸਵਾਲ ਬਦਲਣਾ ਚਾਹੁੰਦੇ ਹੋ?",
    changeQuestionLastPrompt: "ਇਹ ਵੀ ਪਸੰਦ ਨਹੀਂ ਆਇਆ? ਕੋਈ ਗੱਲ ਨਹੀਂ। ਆਓ ਆਖਰੀ ਵਾਰ ਬਦਲੀਏ",
    tryAgainButton: "ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ",
    noThanksButton: "ਨਹੀਂ, ਧੰਨਵਾਦ",
    stopButton: "ਰੋਕੋ",
    dir: 'ltr'
  },


gwe: {
    languageName: "guéré",
    greeting: "Aho! An bha sran-o ɓha dɛɛn kpon. E mu mɔɔ kpa se e ɓa hlo bhaye dɔɔ sran we dɛɛn? E ɓa hlo gweh e po kpa, sɔ e bha dɛɛn sran e gbeeh ɓe sɔ, e ɓa sran gbeh bɛ. E ɓe kpa gba e ɓa hlo gweh ya ye i po. I ni ce!",
    readyButton: "An po kpa",
    nativeLanguagePrompt: "E ɓe kpa gba e ɓa hlo gweh bha",
    processingText: "I ni ce! An ya e ɓa hlo gweh ya pɛɛn.",
    processingTitle: "E bɛ gbeh ni...",
    errorText: "An po kpee, an se bhɛɛn sran. An po ya kpa tuun.",
    audioTooLowError: "An po kpee, an se bhɛɛn sran.",
    processingError: "An po kpee, sɔ dɛɛ bɛ ye bhaa.",
    timeoutError: "Sɔ dɛɛ bɛ ye bhaa dɔɔn. An po ya kpa tuun.",
    changeQuestionPrompt: "E mu dɔɔ sran bɛ gbeh ɓe ye?",
    changeQuestionLastPrompt: "E mu ye sye? Sɔ we, an gbɛ dɔɔ sran bɛ ye ya kpa kpee.",
    tryAgainButton: "An po tuun",
    noThanksButton: "An po dɛɛn",
    stopButton: "STOP",
    dir: 'ltr'
  },
  tw: {
    languageName: "Twi",
    greeting: "Mema wo aha! Yɛda wo ase sɛ woasane ayɛ yen fapem biom. Wo pɛ sɛ wobua asɛm mmerɛ dɛ yi? Yɛbɛbisa wo asɛm wɔ {language} mu, nanso wobɛtumi abua asɛm no wɔ wo nkasae mmeae mu nso. Wo mmuae bɛyɛ kokoamu asɛm. Feel free sɛ wobɛbua biara wo pɛ!",
    readyButton: "Masiesie me ho",
    nativeLanguagePrompt: "Kae sɛ wobɛtumi abua asɛm no wɔ wo kasamum nkasae mu",
    processingText: "Yɛda wo ase! Yɛnam gyina asiesie wo nkasae mu.",
    processingTitle: "Akyerɛaseɛ mu kɔ so...",
    errorText: "Kose, me nte wo nne yie. Sane bɔ mmɔden bio",
    audioTooLowError: "Kose, me nte wo kasamum yie.",
    processingError: "Kose, mfomsoɔ bi asie.",
    timeoutError: "Sukuu kakra no kɔ so dodo. Sane bɔ mmɔden bio.",
    changeQuestionPrompt: "Wo pɛ sɛ wosesa asɛm no?",
    changeQuestionLastPrompt: "Eyi nso nnɛ wo kɔn dɔ mu? Yɛbɛsesa ne mprempren a ɛtwatoɔ.",
    tryAgainButton: "Sane bɔ mmɔden bio",
    noThanksButton: "Dabi Medase",
    stopButton: "STOP",
    dir: 'ltr'
  },
  bete: {
    languageName: "Bété",
    greeting: "Ahougoua! S’eza a jé tée. E poun i kô a nian lé dza ti sô? Kpa we e nia we {language}, kpa e bɛ ya e ghoc dja la gbi dja sô. E dja dji na, e kpa e dji ga. Ahougoua dja yié e poun!",
    readyButton: "N'gbe",
    nativeLanguagePrompt: "Kpa sô ka e ya e ghoc dja la we kpa",
    processingText: "S’eza! A djé i gbö dja la we a zizirié.",
    processingTitle: "A nia we ya...",
    errorText: "Kossé, na djee i kô yie. A gbe a nian.",
    audioTooLowError: "Kossé, na djee i kô yie.",
    processingError: "Kossé, dza dji na djee zo.",
    timeoutError: "Dza dji na djee kpa ya dodo. A gbe a nian.",
    changeQuestionPrompt: "E mu dja la we laka?",
    changeQuestionLastPrompt: "E nia sô zé tée? A kpa we laban.",
    tryAgainButton: "A gbe a nian",
    noThanksButton: "N'gbe, s’eza",
    stopButton: "STOP",
    dir: 'ltr'
  },
  mos: {
    languageName: "Mooré",
    greeting: "Ne y windiga! Barka ne f koom n ya we. F m'bôôg n leoke sokr ya? Tɔnd n soke f sokr {language} pûgẽ, tãb f tõe n leok tɔnd bãng kôb pûgẽ. F leokr ya n solge yé. Sẽn pûg yé m'bôôg n leoke!",
    readyButton: "M segame",
    nativeLanguagePrompt: "Tẽeg t'f tõe n leok f bãng kôb pûgẽ",
    processingText: "Barka! Tɔnd n gẽeg f leokr kôb ya n tɩla.",
    processingTitle: "Gẽegeri n kɔ so...",
    errorText: "Sugri, m n ya wum f kok yé. Leob n gẽeg biom",
    audioTooLowError: "Sugri, m n ya wum f kok yé.",
    processingError: "Sugri, dẽeb ye n ya dodo.",
    timeoutError: "Gẽegeri ya wakat n dɩla dodo. Leob n gẽeg biom.",
    changeQuestionPrompt: "F m'bôôg n lek sokr ya?",
    changeQuestionLastPrompt: "Selek f sũur ye? Tɔnd n lek sokr ya rẽ n paos.",
    tryAgainButton: "Leob n gẽeg biom",
    noThanksButton: "Ayo, barka",
    stopButton: "STOP",
    dir: 'ltr'
  }
};

const UI_TRANSLATIONS = new Proxy(UI_TRANSLATIONS_RAW, {
  get(target, prop) {
    if (typeof prop === 'string') {
      const customUi = localStorage.getItem('custom_ui_translations');
      if (customUi) {
        try {
          const parsed = JSON.parse(customUi);
          if (prop in parsed) {
            return parsed[prop];
          }
        } catch(e) {}
      }
      if (!(prop in target)) {
        return target['en'] || target['it'];
      }
    }
    return target[prop as keyof typeof target];
  }
}) as any;

const isSpecialScript = (lang: string | null) => lang && ['ar', 'fa', 'bn', 'ur', 'ps', 'zh', 'ja', 'hi', 'pa'].includes(lang);

const KEYWORD_TRANSLATIONS: Record<string, string> = {
  it: "Parola Chiave",
  en: "Keyword",
  ar: "الكلمة المفتاحية",
  fr: "Mot-clé",
  bn: "মূলশব্দ",
  so: "Eray fure",
  bm: "Kuma fanga",
  mnk: "Kuma fano",
  uk: "Ключове слово",
  ddn: "Calbe kure",
  ps: "کلیدي کلمه",
  fa: "کلیدواژه",
  ur: "کلیدی لفظ",
  es: "Palabra clave",
  fuc: "Konngol baawal",
  kri: "Kler tɔk",
  ind: "Kata kunci",
  de: "Schlüsselwort",
  ja: "キーワード",
  sw: "Neno la msingi",
  tr: "Anahtar kelime",
  pa: "ਮੁੱਖ ਸ਼ਬਦ",
};

const getKeywordTranslation = (langCode: string): string => {
  return KEYWORD_TRANSLATIONS[langCode] || KEYWORD_TRANSLATIONS.en || "Keyword";
};

const RECORDING_STATUS_TRANSLATIONS_RAW: Record<string, { native: string, it: string }> = {
  it: { native: "Registrazione in corso... Ti stiamo ascoltando", it: "Registrazione in corso... Ti stiamo ascoltando" },
  en: { native: "Recording in progress... We are listening", it: "Registrazione in corso... Ti stiamo ascoltando" },
  ar: { native: "جاري التسجيل... نحن نستمع إليك", it: "Registrazione in corso... Ti stiamo ascoltando" },
  fr: { native: "Enregistrement en cours... Nous vous écoutons", it: "Registrazione in corso... Ti stiamo ascoltando" },
  bn: { native: "রেকর্ডিং চলছে... আমরা আপনাকে শুনছি", it: "Registrazione in corso... Ti stiamo ascoltando" },
  so: { native: "Duubistu waxay ku jirtaa socod... Waan ku dhegeysaneynaa", it: "Registrazione in corso... Ti stiamo ascoltando" },
  bm: { native: "Jaabi-lase bɛ sen na... An b'e lamiɲɛ", it: "Registrazione in corso... Ti stiamo ascoltando" },
  mnk: { native: "Dandisoo be sen na... N'be i la kango lamɛ l'le", it: "Registrazione in corso... Ti stiamo ascoltando" },
  uk: { native: "Триває запис... Ми вас слухаємо", it: "Registrazione in corso... Ti stiamo ascoltando" },
  ddn: { native: "A gooro tuka dandi... I go ni kango haseyi", it: "Registrazione in corso... Ti stiamo ascoltando" },
  ps: { native: "ثبت روان دی... موږ غوږ یو", it: "Registrazione in corso... Ti stiamo ascoltando" },
  fa: { native: "در حال ضبط... ما به شما گوش می‌دهیم", it: "Registrazione in corso... Ti stiamo ascoltando" },
  ur: { native: "ریکارڈنگ جاری ہے... ہم آپ کو سن رہے ہیں", it: "Registrazione in corso... Ti stiamo ascoltando" },
  es: { native: "Grabación en progreso... Te estamos escuchando", it: "Registrazione in corso... Ti stiamo ascoltando" },
  fuc: { native: "Winndugol ina yahra yeeso... Emen kedoo haala maa", it: "Registrazione in corso... Ti stiamo ascoltando" },
  kri: { native: "Di rekɔd de go on... Wi de lisin to yu", it: "Registrazione in corso... Ti stiamo ascoltando" },
  zh: { native: "正在录音... 我们正在倾听您的声音", it: "Registrazione in corso... Ti stiamo ascoltando" },
  hi: { native: "रिकॉर्डिंग चल रही है... हम आपकी बात सुन रहे हैं", it: "Registrazione in corso... Ti stiamo ascoltando" },
  pt: { native: "Gravação em progresso... Estamos ouvindo você", it: "Registrazione in corso... Ti stiamo ascoltando" },
  ru: { native: "Идет запись... Мы вас слушаем", it: "Registrazione in corso... Ti stiamo ascoltando" },
  ind: { native: "Perekaman sedang berlangsung... Kami mendengarkan Anda", it: "Registrazione in corso... Ti stiamo ascoltando" },
  de: { native: "Aufnahme läuft... Wir hören Ihnen zu", it: "Registrazione in corso... Ti stiamo ascoltando" },
  ja: { native: "録音中... あなたの声を聞いています", it: "Registrazione in corso... Ti stiamo ascoltando" },
  sw: { native: "Kurekodi kunaendelea... Tunakusikiliza", it: "Registrazione in corso... Ti stiamo ascoltando" },
  tr: { native: "Kayıt devam ediyor... Sizi dinliyoruz", it: "Registrazione in corso... Ti stiamo ascoltando" },
  pa: { native: "ਰਿਕਾਰਡਿੰਗ ਚੱਲ ਰਹੀ ਹੈ... ਅਸੀਂ ਤੁਹਾਨੂੰ ਸੁਣ ਰਹे ਹਾਂ", it: "Registrazione in corso... Ti stiamo ascoltando" },
  gwe: { native: "An ya e ɓi dɔɔ sran... An lamiɲɛ e ya sran", it: "Registrazione in corso... Ti stiamo ascoltando" },
  tw: { native: "Yɛrekasa gu so... Yɛretie wo", it: "Registrazione in corso... Ti stiamo ascoltando" },
  bete: { native: "A ghoc li gbe dja... A lamiɲɛ e ya sran", it: "Registrazione in corso... Ti stiamo ascoltando" },
  mos: { native: "Gẽegeri n ya pûgẽ... Tɔnd n wumdo e", it: "Registrazione in corso... Ti stiamo ascoltando" }
};

const RECORDING_STATUS_TRANSLATIONS = new Proxy(RECORDING_STATUS_TRANSLATIONS_RAW, {
  get(target, prop) {
    if (typeof prop === 'string') {
      const customStatus = localStorage.getItem('custom_recording_status');
      if (customStatus) {
        try {
          const parsed = JSON.parse(customStatus);
          if (prop in parsed) {
            return parsed[prop];
          }
        } catch(e) {}
      }
      if (!(prop in target)) {
        return { native: "Registrazione in corso... Ti stiamo ascoltando", it: "Registrazione in corso... Ti stiamo ascoltando" };
      }
    }
    return target[prop as keyof typeof target];
  }
}) as any;

const VuMeter = ({ analyser, isRecording }: { analyser: AnalyserNode | null; isRecording: boolean }) => {
  const [volume, setVolume] = useState(0);

  useEffect(() => {
    if (!isRecording || !analyser) {
      setVolume(0);
      return;
    }

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    let animationId: number;

    const updateVolume = () => {
      animationId = requestAnimationFrame(updateVolume);
      analyser.getByteFrequencyData(dataArray);

      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const average = sum / dataArray.length;
      
      // Mappa il volume medio su una scala normalizzata da 0 a 100
      const normalized = Math.min(100, Math.round((average / 100) * 100));
      setVolume(normalized);
    };

    updateVolume();

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, [analyser, isRecording]);

  const segmentsCount = 18;
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 w-full mt-1 shrink-0" id="vu-meter-container">
      <div className="flex gap-[3px] items-center h-4 px-2 py-0.5 bg-black/40 rounded-md border border-white/5">
        {Array.from({ length: segmentsCount }).map((_, idx) => {
          const threshold = (idx / segmentsCount) * 100;
          const isActive = volume >= threshold;
          
          let colorClass = "bg-neutral-800/60";
          if (isActive) {
            if (idx > segmentsCount * 0.82) {
              colorClass = "bg-rose-500 shadow-[0_0_8px_#f43f5e]";
            } else if (idx > segmentsCount * 0.55) {
              colorClass = "bg-amber-400 shadow-[0_0_8px_#fbbf24]";
            } else {
              colorClass = "bg-emerald-400 shadow-[0_0_8px_#34d399]";
            }
          }
          
          return (
            <div 
              key={idx} 
              className={`w-[6px] h-2.5 rounded-[2px] transition-all duration-75 ${colorClass}`}
            />
          );
        })}
      </div>
      <span className="text-[10px] font-mono font-bold text-state-recording/50 uppercase tracking-widest leading-none">VU LEVEL</span>
    </div>
  );
};

const AudioWaveform = ({ analyser, isRecording }: { analyser: AnalyserNode | null, isRecording: boolean }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!isRecording || !analyser || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.fftSize;
    const dataArray = new Uint8Array(bufferLength);
    let animationId: number;

    const draw = () => {
      animationId = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw centered baseline
      ctx.beginPath();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(214, 158, 46, 0.15)'; 
      ctx.moveTo(0, canvas.height / 2);
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();

      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#D69E2E'; 
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();

      const sliceWidth = canvas.width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = v * canvas.height / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
    };

    draw();

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, [analyser, isRecording]);

  return (
    <div className="w-full h-12 flex items-center justify-center -mt-2 -mb-2 overflow-hidden">
      <canvas 
        ref={canvasRef} 
        width={300} 
        height={80} 
        className="w-full h-full pointer-events-none" 
      />
    </div>
  );
};

const generateHtmlForCard = (item: SavedTestimony | TestimonyResult, overrideFontSize?: number) => {
  const isItalian = item.lingua_originale?.toLowerCase() === 'italiano';
  
  // Fixed sizes for Header (Domanda) and Footer (Parola Chiave)
  const titleFontSize = 34;
  const keywordFontSize = 32;

  // Dynamic font size for the middle content (reduced by ~15% to give more air)
  let contentFontSize = 28; 
  if (overrideFontSize !== undefined) {
    contentFontSize = overrideFontSize;
  } else {
    const itLength = item.traduzione_italiano?.length || 0;
    const origLength = item.trascrizione_originale?.length || 0;
    const maxChars = isItalian ? itLength : Math.max(itLength, origLength);
    const multiplier = isItalian ? 1 : 1.6;
    const calcChars = maxChars * multiplier;

    if (calcChars > 100) contentFontSize = 24;
    if (calcChars > 250) contentFontSize = 20;
    if (calcChars > 450) contentFontSize = 16;
    if (calcChars > 750) contentFontSize = 14;
    if (calcChars > 1100) contentFontSize = 12;
    if (calcChars > 1500) contentFontSize = 10;
    if (calcChars > 2000) contentFontSize = 9;
  }

  return `
<div style="width: 1123px; height: 794px; padding: 40px 50px; background: white; color: #1a365d; font-family: 'Source Sans 3', sans-serif; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; border: 1px solid #e2e8f0;">
  <!-- Header: Domanda (Fixed Size) -->
  <div style="font-family: 'Libre Baskerville', serif; text-align: center; line-height: 1.2; margin-bottom: 40px;">
    ${!isItalian && item.domanda_proposta_lingua_originale ? `
      <div style="font-size: ${titleFontSize}px; margin-bottom: 12px; font-weight: bold; color: #1a365d;" dir="auto">${item.domanda_proposta_lingua_originale}</div>
      <div style="font-size: ${Math.round(titleFontSize * 0.85)}px; color: #d69e2e; font-style: italic;">${item.domanda_proposta}</div>
    ` : `
      <div style="font-size: ${titleFontSize}px; margin-bottom: 8px; font-weight: bold; color: #d69e2e;">${item.domanda_proposta || ''}</div>
    `}
  </div>
  
  <!-- Middle Section: Content (Dynamic Font Size, Fills Space) -->
  <div id="pdf-middle-section" style="flex: 1; min-height: 0; display: flex; flex-direction: column; width: 100%; padding: 40px 0; box-sizing: border-box;">
    ${isItalian ? `
    <div id="pdf-middle-content" style="flex: 1; min-height: 0; width: 100%; max-width: 900px; margin: 0 auto; display: flex; flex-direction: column; justify-content: flex-start;">
      <div class="pdf-text-measure" style="text-align: center; width: 100%;">
        <span style="text-transform: uppercase; letter-spacing: 2px; font-size: 11px; color: #d69e2e; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 20px; display: block; text-align: center;">Italiano</span>
        <div style="font-size: ${contentFontSize}px; font-family: 'Libre Baskerville', serif; color: #d69e2e; line-height: 1.4; font-weight: bold; white-space: pre-wrap; word-wrap: break-word; overflow-wrap: break-word; word-break: break-word;">"${item.traduzione_italiano || ''}"</div>
      </div>
    </div>
    ` : `
    <div id="pdf-middle-content" style="flex: 1; min-height: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 60px; width: 100%;">
      <div style="min-width: 0; height: 100%; display: flex; flex-direction: column; justify-content: flex-start;">
        <div class="pdf-text-measure" style="text-align: center; width: 100%;">
          <span style="text-transform: uppercase; letter-spacing: 2px; font-size: 11px; color: #d69e2e; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 20px; display: block; text-align: center;">Italiano</span>
          <div style="font-size: ${contentFontSize}px; font-family: 'Libre Baskerville', serif; color: #d69e2e; line-height: 1.4; font-style: italic; white-space: pre-wrap; word-wrap: break-word; overflow-wrap: break-word; word-break: break-word;">"${item.traduzione_italiano || ''}"</div>
        </div>
      </div>
      <div style="min-width: 0; height: 100%; display: flex; flex-direction: column; justify-content: flex-start;">
        <div class="pdf-text-measure" style="text-align: center; width: 100%;">
          <span style="text-transform: uppercase; letter-spacing: 2px; font-size: 11px; color: #1a365d; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 20px; display: block; text-align: center;">${getNiceLanguageLabel(item.lingua_originale)}</span>
          <div style="font-size: ${contentFontSize * 1.15}px; font-family: 'Libre Baskerville', serif; color: #1a365d; line-height: 1.4; font-style: italic; font-weight: bold; white-space: pre-wrap; word-wrap: break-word; overflow-wrap: break-word; word-break: break-word;" dir="auto">"${item.trascrizione_originale || ''}"</div>
        </div>
      </div>
    </div>
    `}
  </div>

  <!-- Footer: Parola Chiave (Fixed Size) -->
  <div style="display: flex; justify-content: center; border-top: 1px solid #e2e8f0; padding-top: 35px; margin-top: 40px;">
    <div style="text-align: center;">
      <span style="text-transform: uppercase; letter-spacing: 2px; font-size: 11px; margin-bottom: 8px; display: block;">
        ${!isItalian && item.etichetta_parola_chiave_lingua_originale ? `<span style="color: #1a365d;">${item.etichetta_parola_chiave_lingua_originale}</span> <span style="color: #cbd5e1;">/</span> ` : ''}<span style="color: #d69e2e;">Parola Chiave</span>
      </span>
      <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
        ${!isItalian && item.parola_chiave_lingua_originale ? `
        <div style="font-size: ${keywordFontSize}px; font-family: 'Libre Baskerville', serif; font-style: italic; color: #1a365d; font-weight: bold;">
          ${item.parola_chiave_lingua_originale}
        </div>
        ` : ''}
        <div style="font-size: ${!isItalian ? keywordFontSize * 0.7 : keywordFontSize}px; font-family: 'Libre Baskerville', serif; font-style: italic; color: #d69e2e; ${isItalian ? 'font-weight: bold;' : 'opacity: 0.8;'}">
          ${item.parola_chiave || ''}
        </div>
      </div>
    </div>
  </div>
</div>`;
};

const generateHtmlForBusinessCardSide = (
  item: SavedTestimony | TestimonyResult,
  side: 'ITA' | 'LINGUA',
  overrideFontSize?: number
) => {
  const isItalianLanguage = item.lingua_originale?.toLowerCase() === 'italiano';
  
  const titleFontSize = 34;
  const keywordFontSize = 32;

  let contentFontSize = 28;
  if (overrideFontSize !== undefined) {
    contentFontSize = overrideFontSize;
  } else {
    const textToMeasure = side === 'ITA' 
      ? (item.traduzione_italiano || '') 
      : (item.trascrizione_originale || item.traduzione_italiano || '');
    const chars = textToMeasure.length;
    if (chars > 1200) contentFontSize = 10;
    else if (chars > 800) contentFontSize = 12;
    else if (chars > 500) contentFontSize = 14;
    else if (chars > 300) contentFontSize = 16;
    else if (chars > 150) contentFontSize = 20;
    else if (chars > 80) contentFontSize = 24;
  }

  if (side === 'ITA') {
    // Elegant Gold / Soft Orange Theme for Italian
    return `
<div style="width: 1123px; height: 794px; padding: 40px 50px; background: white; color: #1a365d; font-family: 'Source Sans 3', sans-serif; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; border: 1px solid #e2e8f0;">
  <!-- Header: Domanda (Gold style) -->
  <div style="font-family: 'Libre Baskerville', serif; text-align: center; line-height: 1.2; margin-bottom: 40px;">
    <div style="font-size: ${titleFontSize}px; margin-bottom: 8px; font-weight: bold; color: #d69e2e;">${item.domanda_proposta || ''}</div>
  </div>
  
  <!-- Middle Section: Content (Centered Italian text) -->
  <div id="pdf-middle-section" style="flex: 1; min-height: 0; display: flex; flex-direction: column; width: 100%; padding: 40px 0; box-sizing: border-box;">
    <div id="pdf-middle-content" style="flex: 1; min-height: 0; width: 100%; max-width: 900px; margin: 0 auto; display: flex; flex-direction: column; justify-content: flex-start;">
      <div class="pdf-text-measure" style="text-align: center; width: 100%;">
        <span style="text-transform: uppercase; letter-spacing: 2px; font-size: 11px; color: #d69e2e; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 20px; display: block; text-align: center;">Italiano</span>
        <div style="font-size: ${contentFontSize}px; font-family: 'Libre Baskerville', serif; color: #d69e2e; line-height: 1.4; font-weight: bold; font-style: italic; white-space: pre-wrap; word-wrap: break-word; overflow-wrap: break-word; word-break: break-word;">"${item.traduzione_italiano || ''}"</div>
      </div>
    </div>
  </div>

  <!-- Footer: Parola Chiave -->
  <div style="display: flex; justify-content: center; border-top: 1px solid #e2e8f0; padding-top: 35px; margin-top: 40px;">
    <div style="text-align: center;">
      <span style="text-transform: uppercase; letter-spacing: 2px; font-size: 11px; margin-bottom: 8px; display: block; color: #d69e2e;">
        Parola Chiave
      </span>
      <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
        <div style="font-size: ${keywordFontSize}px; font-family: 'Libre Baskerville', serif; font-style: italic; color: #d69e2e; font-weight: bold;">
          ${item.parola_chiave || ''}
        </div>
      </div>
    </div>
  </div>
</div>`;
  } else {
    // Deep Blue Theme for Native Language
    const nativeQuestion = item.domanda_proposta_lingua_originale || item.domanda_proposta || '';
    const nativeLabel = isItalianLanguage ? 'Italiano (Retro)' : getNiceLanguageLabel(item.lingua_originale);
    const nativeText = item.trascrizione_originale || item.traduzione_italiano || '';
    const nativeKeywordLabel = item.etichetta_parola_chiave_lingua_originale || 'Parola Chiave';
    const nativeKeyword = item.parola_chiave_lingua_originale || item.parola_chiave || '';

    return `
<div style="width: 1123px; height: 794px; padding: 40px 50px; background: white; color: #1a365d; font-family: 'Source Sans 3', sans-serif; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; border: 1px solid #e2e8f0;">
  <!-- Header: Domanda (Blue style) -->
  <div style="font-family: 'Libre Baskerville', serif; text-align: center; line-height: 1.2; margin-bottom: 40px;">
    <div style="font-size: ${titleFontSize}px; margin-bottom: 8px; font-weight: bold; color: #1a365d;">${nativeQuestion}</div>
  </div>
  
  <!-- Middle Section: Content (Centered Original text) -->
  <div id="pdf-middle-section" style="flex: 1; min-height: 0; display: flex; flex-direction: column; width: 100%; padding: 40px 0; box-sizing: border-box;">
    <div id="pdf-middle-content" style="flex: 1; min-height: 0; width: 100%; max-width: 900px; margin: 0 auto; display: flex; flex-direction: column; justify-content: flex-start;">
      <div class="pdf-text-measure" style="text-align: center; width: 100%;">
        <span style="text-transform: uppercase; letter-spacing: 2px; font-size: 11px; color: #1a365d; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 20px; display: block; text-align: center;">${nativeLabel}</span>
        <div style="font-size: ${contentFontSize}px; font-family: 'Libre Baskerville', serif; color: #1a365d; line-height: 1.4; font-weight: bold; font-style: italic; white-space: pre-wrap; word-wrap: break-word; overflow-wrap: break-word; word-break: break-word;" dir="auto">"${nativeText}"</div>
      </div>
    </div>
  </div>

  <!-- Footer: Parola Chiave -->
  <div style="display: flex; justify-content: center; border-top: 1px solid #e2e8f0; padding-top: 35px; margin-top: 40px;">
    <div style="text-align: center;">
      <span style="text-transform: uppercase; letter-spacing: 2px; font-size: 11px; margin-bottom: 8px; display: block; color: #1a365d;">
        ${nativeKeywordLabel}
      </span>
      <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
        <div style="font-size: ${keywordFontSize}px; font-family: 'Libre Baskerville', serif; font-style: italic; color: #1a365d; font-weight: bold;">
          ${nativeKeyword}
        </div>
      </div>
    </div>
  </div>
</div>`;
  }
};

const TestimonyPrintPreview = ({ item }: { item: SavedTestimony }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  
  useEffect(() => {
    const updateScale = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth;
        // The reference width for the PDF is 1123px
        setScale(width / 1123);
      }
    };
    
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  const [htmlContent, setHtmlContent] = useState('');

  useEffect(() => {
    // Generate the HTML and run the same font-shrinking logic as the actual PDF
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '-9999px';
    
    let currentFontSize = 64;
    container.innerHTML = generateHtmlForCard(item, currentFontSize);
    document.body.appendChild(container);

    const adjustFontSize = async () => {
      await document.fonts.ready;
      await new Promise(resolve => setTimeout(resolve, 50));

      let middleContent = container.querySelector('#pdf-middle-content') as HTMLElement;
      
      const isOverflowing = (size: number) => {
        if (!middleContent) return false;
        const measures = Array.from(container.querySelectorAll('.pdf-text-measure')) as HTMLElement[];
        const availableHeight = middleContent.clientHeight;
        const ratio = size > 16 ? 0.8 : 1.0;
        for (const m of measures) {
          if (m.offsetHeight > availableHeight * ratio) return true;
        }
        return false;
      };

      while (isOverflowing(currentFontSize) && currentFontSize > 8) {
        currentFontSize -= 1;
        container.innerHTML = generateHtmlForCard(item, currentFontSize);
        middleContent = container.querySelector('#pdf-middle-content') as HTMLElement;
      }

      setHtmlContent(container.innerHTML);
      document.body.removeChild(container);
    };

    adjustFontSize();
  }, [item]);

  return (
    <div 
      ref={containerRef}
      className="bg-white shadow-2xl mx-auto aspect-[1.414/1] w-full max-w-[1123px] rounded-sm overflow-hidden relative"
    >
      <div 
        style={{
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          width: '1123px',
          height: '794px'
        }}
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />
    </div>
  );
};

const GREETINGS_LIST = [
  { text: "Ciao", lang: "it" },
  { text: "Hello", lang: "en" },
  { text: "Bonjour", lang: "fr" },
  { text: "مرحباً", lang: "ar" },
  { text: "হ্যালো", lang: "bn" },
  { text: "Waad salaaman tahay", lang: "so" },
  { text: "I ni ce", lang: "bm" },
  { text: "Hera bee be", lang: "mnk" },
  { text: "Привіт", lang: "uk" },
  { text: "Fofo", lang: "ddn" },
  { text: "سلام", lang: "ps" },
  { text: "سلام", lang: "fa" },
  { text: "ہیلو", lang: "ur" },
  { text: "¡Hola!", lang: "es" },
  { text: "Mbalen ma", lang: "fuc" },
  { text: "Kushio", lang: "kri" },
  { text: "你好", lang: "zh" },
  { text: "नमस्ते", lang: "hi" },
  { text: "Olá", lang: "pt" },
  { text: "Привет", lang: "ru" },
  { text: "Halo", lang: "ind" },
  { text: "Hallo", lang: "de" },
  { text: "こんにちは", lang: "ja" },
  { text: "Jambo", lang: "sw" },
  { text: "Merhaba", lang: "tr" },
  { text: "ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ", lang: "pa" },
  { text: "Aho", lang: "gwe" },
  { text: "Akwaaba", lang: "tw" },
  { text: "Ahougoua", lang: "bete" },
  { text: "Ne y windiga", lang: "mos" }
];

const LANGUAGES_CONFIG_STATIC = [
  { id: 'it', label: 'ITALIANO', labelNative: 'Italiano', countries: ['Italia', 'Svizzera', 'Vaticano', 'San Marino', 'Italy', 'Switzerland', 'Vatican'], countriesDisplay: ['Italia', 'Svizzera', 'Vaticano', 'San Marino'] },
  { id: 'en', label: 'INGLESE', labelNative: 'English', countries: ['Regno Unito', 'Stati Uniti', 'Ghana', 'Gana', 'Nigeria', 'Canada', 'Australia', 'Irlanda', 'Nuova Zelanda', 'Sudafrica', 'India', 'Pakistan', 'Uganda', 'Kenya', 'Tanzania', 'Gambia', 'Sierra Leone', 'Filippine', 'Singapore', 'Camerun', 'Rwanda', 'Ruanda', 'Burundi', 'Zimbabwe', 'Zambia', 'United Kingdom', 'United States', 'Ireland', 'South Africa'], countriesDisplay: ['Regno Unito', 'Stati Uniti', 'Canada', 'Ghana', 'Nigeria', 'Uganda', 'Kenya', 'Sudafrica'] },
  { id: 'ar', label: 'ARABO', labelNative: 'العربية', countries: ['Egitto', 'Arabia Saudita', 'Algeria', 'Marocco', 'Iraq', 'Sudan', 'Yemen', 'Siria', 'Tunisia', 'Libia', 'Giordania', 'Emirati Arabi Uniti', 'Libano', 'Kuwait', 'Oman', 'Qatar', 'Bahrein', 'Egypt', 'Saudi Arabia', 'Morocco', 'Syria', 'Tunisia', 'Libya'], countriesDisplay: ['Egitto', 'Arabia Saudita', 'Marocco', 'Siria', 'Tunisia'] },
  { id: 'fr', label: 'FRANCESE', labelNative: 'Français', countries: ['Francia', 'Belgio', 'Svizzera', 'Canada', 'Senegal', 'Costa d\'Avorio', 'Côte d\'Ivoire', 'Ivory Coast', 'Camerun', 'Madagascar', 'Mali', 'Burkina Faso', 'Niger', 'Guinea', 'Ciad', 'Burundi', 'Benin', 'Togo', 'Haiti', 'Congo', 'Repubblica Democratica del Congo', 'Democratic Republic of the Congo', 'Rwanda', 'Ruanda', 'Gibuti', 'Gabon', 'France', 'Belgium', 'Switzerland', 'Mali', 'Canada'], countriesDisplay: ['Francia', 'Senegal', 'Costa d\'Avorio', 'Mali', 'Burkina Faso', 'Camerun', 'Congo'] },
  { id: 'bn', label: 'BENGALESE', labelNative: 'বাংলা', countries: ['Bangladesh', 'India'], countriesDisplay: ['Bangladesh', 'India'] },
  { id: 'so', label: 'SOMALO', labelNative: 'Soomaali', countries: ['Somalia', 'Etiopia', 'Kenya', 'Gibuti', 'Ethiopia', 'Djibouti'], countriesDisplay: ['Somalia', 'Etiopia', 'Kenya', 'Gibuti'] },
  { id: 'bm', label: 'BAMBARA', labelNative: 'Bamanankan', countries: ['Mali'], countriesDisplay: ['Mali'] },
  { id: 'mnk', label: 'MANDINKA', labelNative: "Mandin'ka", countries: ['Gambia', 'Senegal', 'Guinea'], countriesDisplay: ['Gambia', 'Senegal', 'Guinea'] },
  { id: 'uk', label: 'UCRAINO', labelNative: 'українською', countries: ['Ucraina', 'Ukraine'], countriesDisplay: ['Ucraina'] },
  { id: 'ddn', label: 'DENDI', labelNative: 'Dendi', countries: ['Benin', 'Niger'], countriesDisplay: ['Benin', 'Niger'] },
  { id: 'ps', label: 'PASTHU', labelNative: 'پښتو', countries: ['Afghanistan', 'Pakistan'], countriesDisplay: ['Afghanistan', 'Pakistan'] },
  { id: 'fa', label: 'FARSI', labelNative: 'Farsi / فارسی', countries: ['Iran', 'Afghanistan', 'Tagikistan', 'Tajikistan'], countriesDisplay: ['Iran', 'Afghanistan', 'Tagikistan'] },
  { id: 'ur', label: 'URDU', labelNative: 'اردو', countries: ['Pakistan', 'India'], countriesDisplay: ['Pakistan', 'India'] },
  { id: 'es', label: 'SPAGNOLO', labelNative: 'español', countries: ['Spagna', 'Messico', 'Colombia', 'Argentina', 'Perù', 'Venezuela', 'Cile', 'Ecuador', 'Guatemala', 'Cuba', 'Bolivia', 'Repubblica Dominicana', 'Honduras', 'Paraguay', 'El Salvador', 'Nicaragua', 'Costa Rica', 'Panama', 'Uruguay', 'Guinea Equatoriale', 'Spain', 'Mexico', 'Peru', 'Chile'], countriesDisplay: ['Spagna', 'Messico', 'Argentina', 'Colombia'] },
  { id: 'fuc', label: 'PULAAR', labelNative: 'Pulaar', countries: ['Senegal', 'Mauritania', 'Mali', 'Gambia', 'Guinea'], countriesDisplay: ['Senegal', 'Mauritania', 'Mali', 'Guinea'] },
  { id: 'kri', label: 'KRIO', labelNative: 'Krio', countries: ['Sierra Leone'], countriesDisplay: ['Sierra Leone'] },
  { id: 'zh', label: 'CINESE', labelNative: '中文', countries: ['Cina', 'Taiwan', 'Singapore', 'China'], countriesDisplay: ['Cina', 'Taiwan', 'Singapore'] },
  { id: 'hi', label: 'HINDI', labelNative: 'हिन्दी', countries: ['India'], countriesDisplay: ['India'] },
  { id: 'pt', label: 'PORTOGHESE', labelNative: 'Português', countries: ['Portogallo', 'Brasile', 'Angola', 'Mozambico', 'Capo Verde', 'Guinea-Bissau', 'São Tomé e Príncipe', 'Timor Est', 'Portugal', 'Brazil'], countriesDisplay: ['Portogallo', 'Brasile', 'Angola', 'Mozambico'] },
  { id: 'ru', label: 'RUSSO', labelNative: 'Русский', countries: ['Russia', 'Kazakistan', 'Bielorussia', 'Kirghizistan', 'Kazakhstan', 'Belarus', 'Kyrgyzstan'], countriesDisplay: ['Russia', 'Bielorussia', 'Kazakistan'] },
  { id: 'ind', label: 'INDONESIANO', labelNative: 'Bahasa Indonesia', countries: ['Indonesia'], countriesDisplay: ['Indonesia'] },
  { id: 'de', label: 'TEDESCO', labelNative: 'Deutsch', countries: ['Germania', 'Austria', 'Svizzera', 'Liechtenstein', 'Lussemburgo', 'Belgio', 'Germany', 'Switzerland', 'Belgium'], countriesDisplay: ['Germania', 'Austria', 'Svizzera', 'Lussemburgo'] },
  { id: 'ja', label: 'GIAPPONESE', labelNative: '日本語', countries: ['Giappone', 'Japan'], countriesDisplay: ['Giappone'] },
  { id: 'sw', label: 'SWAHILI', labelNative: 'Kiswahili', countries: ['Kenya', 'Tanzania', 'Uganda', 'Ruanda', 'Burundi', 'Repubblica Democratica del Congo', 'Democratic Republic of the Congo', 'Rwanda', 'Congo'], countriesDisplay: ['Kenya', 'Tanzania', 'Uganda', 'Ruanda', 'Burundi'] },
  { id: 'tr', label: 'TURCO', labelNative: 'Türkçe', countries: ['Turchia', 'Cipro', 'Turkey', 'Cyprus'], countriesDisplay: ['Turchia', 'Cipro'] },
  { id: 'pa', label: 'PUNJABI', labelNative: 'ਪੰਜਾਬੀ', countries: ['India', 'Pakistan'], countriesDisplay: ['India', 'Pakistan'] },
  { id: 'gwe', label: 'GUÉRÉ', labelNative: 'Guéré', countries: ['Costa d\'Avorio', 'Côte d\'Ivoire', 'Ivory Coast'], countriesDisplay: ['Costa d\'Avorio'] },
  { id: 'tw', label: 'TWI', labelNative: 'Twi', countries: ['Ghana', 'Gana'], countriesDisplay: ['Ghana'] },
  { id: 'bete', label: 'BÉTÉ', labelNative: 'Bété', countries: ['Costa d\'Avorio', 'Côte d\'Ivoire', 'Ivory Coast'], countriesDisplay: ['Costa d\'Avorio'] },
  { id: 'mos', label: 'MOORÉ', labelNative: 'Mooré', countries: ['Burkina Faso'], countriesDisplay: ['Burkina Faso'] },
  { id: 'ro', label: 'ROMENO', labelNative: 'Română', countries: ['Romania', 'Moldavia', 'Moldova', 'Moldavia', 'Macedonia', 'Macedonia del Nord'], countriesDisplay: ['Romania', 'Moldavia'] }
];

const stableMergedLanguages: any[] = [];
let lastCustomLangsStr: string | null = null;

const getMergedLanguages = () => {
  const custom = localStorage.getItem('custom_languages') || '';
  if (lastCustomLangsStr !== custom) {
    lastCustomLangsStr = custom;
    let merged = [...LANGUAGES_CONFIG_STATIC];
    if (custom) {
      try {
        const parsed = JSON.parse(custom);
        if (Array.isArray(parsed)) {
          const seenIds = new Set(LANGUAGES_CONFIG_STATIC.map((l: any) => l.id));
          const uniqueParsed: any[] = [];
          for (const l of parsed) {
            if (l && l.id && !seenIds.has(l.id)) {
              seenIds.add(l.id);
              uniqueParsed.push(l);
            }
          }
          merged = [...LANGUAGES_CONFIG_STATIC, ...uniqueParsed];
        }
      } catch(e) {}
    }
    stableMergedLanguages.length = 0;
    stableMergedLanguages.push(...merged);
  }
  return stableMergedLanguages;
};

// Initial execution to populate the stable target array
getMergedLanguages();

export const LANGUAGES_CONFIG = new Proxy(stableMergedLanguages, {
  get(target, prop) {
    getMergedLanguages();
    return Reflect.get(target, prop);
  },
  ownKeys(target) {
    getMergedLanguages();
    return Reflect.ownKeys(target);
  },
  getOwnPropertyDescriptor(target, prop) {
    getMergedLanguages();
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

const FlagIcon = ({ lang, className = "w-full h-full" }: { lang: SupportedLanguage, className?: string }) => {
  return (
    <svg viewBox="-30 -20 60 40" className={className} preserveAspectRatio="xMidYMid meet">
      <defs>
        <clipPath id={`flag-clip-${lang}`}>
          <rect x="-30" y="-20" width="60" height="40" rx="4" />
        </clipPath>
      </defs>
      <g clipPath={`url(#flag-clip-${lang})`}>
        {lang === 'it' && (
          <>
            <rect x="-30" y="-20" width="20" height="40" fill="#009246" />
            <rect x="-10" y="-20" width="20" height="40" fill="#ffffff" />
            <rect x="10" y="-20" width="20" height="40" fill="#ce2b37" />
          </>
        )}
        {lang === 'fr' && (
          <>
            <rect x="-30" y="-20" width="20" height="40" fill="#002395" />
            <rect x="-10" y="-20" width="20" height="40" fill="#ffffff" />
            <rect x="10" y="-20" width="20" height="40" fill="#ed2939" />
          </>
        )}
        {lang === 'en' && (
          <g transform="scale(1.1)">
            <rect x="-30" y="-20" width="60" height="40" fill="#012169" />
            <path d="M -30 -20 L 30 20 M -30 20 L 30 -20" stroke="#ffffff" strokeWidth="6" />
            <path d="M -30 -20 L 30 20 M -30 20 L 30 -20" stroke="#c8102e" strokeWidth="2" />
            <path d="M 0 -20 L 0 20 M -30 0 L 30 0" stroke="#ffffff" strokeWidth="10" />
            <path d="M 0 -20 L 0 20 M -30 0 L 30 0" stroke="#c8102e" strokeWidth="6" />
          </g>
        )}
        {lang === 'ar' && (
          <>
            <rect x="-30" y="-20" width="60" height="13.3" fill="#00732f" />
            <rect x="-30" y="-6.7" width="60" height="13.3" fill="#ffffff" />
            <rect x="-30" y="6.7" width="60" height="13.3" fill="#000000" />
            <polygon points="-30,-20 -10,0 -30,20" fill="#ff0000" />
          </>
        )}
        {lang === 'bn' && (
          <>
            <rect x="-30" y="-20" width="60" height="40" fill="#006a4e" />
            <circle cx="-5" cy="0" r="10" fill="#f42a41" />
          </>
        )}
        {lang === 'so' && (
          <>
            <rect x="-30" y="-20" width="60" height="40" fill="#418fde" />
            <polygon points="0,-10 2.5,-3 10,-3 4,2 6,10 0,6 -6,10 -4,2 -10,-3 -2.5,-3" fill="#ffffff" />
          </>
        )}
        {lang === 'bm' && (
          <>
            <rect x="-30" y="-20" width="20" height="40" fill="#14B53A" />
            <rect x="-10" y="-20" width="20" height="40" fill="#FCD116" />
            <rect x="10" y="-20" width="20" height="40" fill="#CE1126" />
          </>
        )}
        {lang === 'mnk' && (
          <>
            <rect x="-30" y="-20" width="60" height="12" fill="#E51836" />
            <rect x="-30" y="-8" width="60" height="16" fill="#FFFFFF" />
            <rect x="-30" y="-5" width="60" height="10" fill="#0C1C8C" />
            <rect x="-30" y="8" width="60" height="12" fill="#3A7E24" />
          </>
        )}
        {lang === 'uk' && (
          <>
            <rect x="-30" y="-20" width="60" height="20" fill="#0057B7" />
            <rect x="-30" y="0" width="60" height="20" fill="#FFD700" />
          </>
        )}
        {lang === 'ddn' && (
          <>
            <rect x="-30" y="-20" width="24" height="40" fill="#008751" />
            <rect x="-6" y="-20" width="36" height="20" fill="#FCD116" />
            <rect x="-6" y="0" width="36" height="20" fill="#E30A17" />
          </>
        )}
        {lang === 'ps' && (
          <>
            <rect x="-30" y="-20" width="20" height="40" fill="#000000" />
            <rect x="-10" y="-20" width="20" height="40" fill="#CE1126" />
            <rect x="10" y="-20" width="20" height="40" fill="#007A3E" />
          </>
        )}
        {lang === 'fa' && (
          <>
            <rect x="-30" y="-20" width="60" height="13.3" fill="#239f40" />
            <rect x="-30" y="-6.7" width="60" height="13.3" fill="#ffffff" />
            <rect x="-30" y="6.7" width="60" height="13.3" fill="#da0000" />
            <circle cx="0" cy="0" r="3" fill="#da0000" />
          </>
        )}
        {lang === 'ur' && (
          <>
            <rect x="-30" y="-20" width="60" height="40" fill="#00501F" />
            <rect x="-30" y="-20" width="15" height="40" fill="#FFFFFF" />
            <circle cx="10" cy="0" r="10" fill="#FFFFFF" />
            <circle cx="13" cy="-2" r="9" fill="#00501F" />
            <g transform="scale(0.8) translate(5, -5)">
              <polygon points="17,-7 14,0 20,-3 12,-3 18,0" fill="#FFFFFF" />
            </g>
          </>
        )}
        {lang === 'es' && (
          <>
            <rect x="-30" y="-20" width="60" height="10" fill="#AA151B" />
            <rect x="-30" y="-10" width="60" height="20" fill="#F1BF00" />
            <rect x="-30" y="10" width="60" height="10" fill="#AA151B" />
          </>
        )}
        {lang === 'fuc' && (
          <>
            <rect x="-30" y="-20" width="20" height="40" fill="#CE1126" />
            <rect x="-10" y="-20" width="20" height="40" fill="#FCD116" />
            <rect x="10" y="-20" width="20" height="40" fill="#009460" />
          </>
        )}
        {lang === 'kri' && (
          <>
            <rect x="-30" y="-20" width="60" height="13.3" fill="#1EB53A" />
            <rect x="-30" y="-6.7" width="60" height="13.3" fill="#FFFFFF" />
            <rect x="-30" y="6.7" width="60" height="13.3" fill="#0072C6" />
          </>
        )}
        {lang === 'zh' && (
          <>
            <rect x="-30" y="-20" width="60" height="40" fill="#DE2910" />
            {/* Main star */}
            <polygon points="-18,-14 -14.6,-14 -13.5,-17.3 -12.4,-14 -9,-14 -11.8,-11.9 -10.7,-8.6 -13.5,-10.7 -16.3,-8.6 -15.2,-11.9" fill="#FFDE00" />
            {/* 4 small stars */}
            <g transform="translate(-10, -17) scale(0.4) rotate(23)">
              <polygon points="0,-5 1.5,-1 5,-1 2,1.5 3,5 0,2.5 -3,5 -2,1.5 -5,-1 -1.5,-1" fill="#FFDE00" />
            </g>
            <g transform="translate(-6, -13) scale(0.4) rotate(45)">
              <polygon points="0,-5 1.5,-1 5,-1 2,1.5 3,5 0,2.5 -3,5 -2,1.5 -5,-1 -1.5,-1" fill="#FFDE00" />
            </g>
            <g transform="translate(-6, -8) scale(0.4) rotate(0)">
              <polygon points="0,-5 1.5,-1 5,-1 2,1.5 3,5 0,2.5 -3,5 -2,1.5 -5,-1 -1.5,-1" fill="#FFDE00" />
            </g>
            <g transform="translate(-10, -4) scale(0.4) rotate(15)">
              <polygon points="0,-5 1.5,-1 5,-1 2,1.5 3,5 0,2.5 -3,5 -2,1.5 -5,-1 -1.5,-1" fill="#FFDE00" />
            </g>
          </>
        )}
        {lang === 'hi' && (
          <>
            <rect x="-30" y="-20" width="60" height="13.3" fill="#FF9933" />
            <rect x="-30" y="-6.7" width="60" height="13.3" fill="#FFFFFF" />
            <rect x="-30" y="6.7" width="60" height="13.3" fill="#138808" />
            {/* Ashoka Chakra */}
            <circle cx="0" cy="0" r="4.5" fill="none" stroke="#000080" strokeWidth="0.8" />
            <circle cx="0" cy="0" r="0.8" fill="#000080" />
            <path d="M 0 0 L 0 -4.5 M 0 0 L 0 4.5 M 0 0 L -4.5 0 M 0 0 L 4.5 0 M 0 0 L -3.18 -3.18 M 0 0 L 3.18 3.18 M 0 0 L -3.18 3.18 M 0 0 L 3.18 -3.18" stroke="#000080" strokeWidth="0.3" />
          </>
        )}
        {lang === 'pt' && (
          <>
            <rect x="-30" y="-20" width="24" height="40" fill="#006600" />
            <rect x="-6" y="-20" width="36" height="40" fill="#FF0000" />
            {/* Portuguese Shield Base */}
            <circle cx="-6" cy="0" r="6" fill="#FFFF00" stroke="#000000" strokeWidth="0.5" />
            <rect x="-9" y="-4" width="6" height="8" fill="#FFFFFF" stroke="#FF0000" strokeWidth="1" />
          </>
        )}
        {lang === 'ru' && (
          <>
            <rect x="-30" y="-20" width="60" height="13.3" fill="#FFFFFF" />
            <rect x="-30" y="-6.7" width="60" height="13.3" fill="#0039A6" />
            <rect x="-30" y="6.7" width="60" height="13.3" fill="#D52B1E" />
          </>
        )}
        {lang === 'ind' && (
          <>
            <rect x="-30" y="-20" width="60" height="20" fill="#FF0000" />
            <rect x="-30" y="0" width="60" height="20" fill="#FFFFFF" />
          </>
        )}
        {lang === 'de' && (
          <>
            <rect x="-30" y="-20" width="60" height="13.3" fill="#000000" />
            <rect x="-30" y="-6.7" width="60" height="13.3" fill="#FF0000" />
            <rect x="-30" y="6.7" width="60" height="13.3" fill="#FFCC00" />
          </>
        )}
        {lang === 'ja' && (
          <>
            <rect x="-30" y="-20" width="60" height="40" fill="#FFFFFF" />
            <circle cx="0" cy="0" r="12" fill="#BC002D" />
          </>
        )}
        {lang === 'sw' && (
          <>
            <rect x="-30" y="-20" width="60" height="40" fill="#1EB53A" />
            <polygon points="-30,-20 30,20 -30,20" fill="#FFD100" />
            <polygon points="-30,-20 30,20 30,-20" fill="#00A3DD" />
            <path d="M-30,20 L30,-20" stroke="#000000" strokeWidth="8" />
            <path d="M-30,20 L30,-20" stroke="#FFD100" strokeWidth="2" />
          </>
        )}
        {lang === 'tr' && (
          <>
            <rect x="-30" y="-20" width="60" height="40" fill="#E30A17" />
            <circle cx="-5" cy="0" r="10" fill="#FFFFFF" />
            <circle cx="-2" cy="0" r="8" fill="#E30A17" />
            <polygon points="6,-3 8,2 13,2 9,5 11,10 6,7 1,10 3,5 -1,2 4,2" fill="#FFFFFF" transform="scale(0.8) translate(5, -2)" />
          </>
        )}
        {lang === 'pa' && (
          <>
            <rect x="-30" y="-20" width="60" height="40" fill="#FF9933" />
            <path d="M-30,0 Q0,15 30,0 T60,0" fill="none" stroke="#FFFFFF" strokeWidth="2" />
            <circle cx="0" cy="-5" r="8" fill="none" stroke="#004830" strokeWidth="2.5" />
            <line x1="-12" y1="-5" x2="12" y2="-5" stroke="#004830" strokeWidth="2.5" />
            <line x1="0" y1="-17" x2="0" y2="7" stroke="#004830" strokeWidth="2.5" />
          </>
        )}
        {lang === 'gwe' && (
          <>
            <rect x="-30" y="-20" width="20" height="40" fill="#f77f00" />
            <rect x="-10" y="-20" width="20" height="40" fill="#ffffff" />
            <rect x="10" y="-20" width="20" height="40" fill="#009e60" />
          </>
        )}
        {lang === 'tw' && (
          <>
             <rect x="-30" y="-20" width="60" height="13.3" fill="#E8112D" />
             <rect x="-30" y="-6.7" width="60" height="13.3" fill="#FCD116" />
             <rect x="-30" y="6.7" width="60" height="13.3" fill="#006B3F" />
             <polygon points="0,-4 1.2,-0.4 4.8,-0.4 1.8,1.6 3,5.2 0,2.8 -3,5.2 -1.8,1.6 -4.8,-0.4 -1.2,-0.4" fill="#000000" />
          </>
        )}
        {lang === 'bete' && (
          <>
            <rect x="-30" y="-20" width="20" height="40" fill="#f77f00" />
            <rect x="-10" y="-20" width="20" height="40" fill="#ffffff" />
            <rect x="10" y="-20" width="20" height="40" fill="#009e60" />
          </>
        )}
        {lang === 'mos' && (
          <>
             <rect x="-30" y="-20" width="60" height="20" fill="#EF2B2D" />
             <rect x="-30" y="0" width="60" height="20" fill="#009E49" />
             <polygon points="0,-6 1.8,-1 6,-1 2.5,1.8 4,6.2 0,3.5 -4,6.2 -2.5,1.8 -6,-1 -1.8,-1" fill="#FFD700" />
          </>
        )}
        {lang === 'ro' && (
          <>
            <rect x="-30" y="-20" width="20" height="40" fill="#002B7F" />
            <rect x="-10" y="-20" width="20" height="40" fill="#FCD116" />
            <rect x="10" y="-20" width="20" height="40" fill="#CE1126" />
          </>
        )}
        {!['it', 'fr', 'en', 'ar', 'bn', 'so', 'bm', 'mnk', 'uk', 'ddn', 'ps', 'fa', 'ur', 'es', 'fuc', 'kri', 'zh', 'hi', 'pt', 'ru', 'ind', 'de', 'ja', 'sw', 'tr', 'pa', 'gwe', 'tw', 'bete', 'mos', 'ro'].includes(lang.toLowerCase()) && (() => {
          const getHash = (str: string) => {
            let h = 0;
            for (let i = 0; i < str.length; i++) {
              h = str.charCodeAt(i) + ((h << 5) - h);
            }
            return Math.abs(h);
          };
          const hVal = getHash(lang);
          const PALETTE = ['#E30A17', '#002B7F', '#FCD116', '#008751', '#FF9933', '#9C27B0', '#00BCD4', '#1E293B', '#FF4081', '#4CAF50', '#3F51B5'];
          const color1 = PALETTE[hVal % PALETTE.length];
          const color2 = PALETTE[(hVal + 3) % PALETTE.length];
          const color3 = PALETTE[(hVal + 7) % PALETTE.length];
          const patternType = hVal % 4;
          const labelCode = lang.slice(0, 3).toUpperCase();
          
          return (
            <>
              {patternType === 0 && (
                <>
                  <rect x="-30" y="-20" width="20" height="40" fill={color1} />
                  <rect x="-10" y="-20" width="20" height="40" fill={color2} />
                  <rect x="10" y="-20" width="20" height="40" fill={color3 === color1 ? '#FFFFFF' : color3} />
                </>
              )}
              {patternType === 1 && (
                <>
                  <rect x="-30" y="-20" width="60" height="13.3" fill={color1} />
                  <rect x="-30" y="-6.7" width="60" height="13.3" fill={color2} />
                  <rect x="-30" y="6.7" width="60" height="13.3" fill={color3 === color1 ? '#FFFFFF' : color3} />
                </>
              )}
              {patternType === 2 && (
                <>
                  <rect x="-30" y="-20" width="60" height="40" fill={color1} />
                  <polygon points="-30,-20 -30,20 10,0" fill={color2} />
                </>
              )}
              {patternType === 3 && (
                <>
                  <rect x="-30" y="-20" width="60" height="40" fill={color1} />
                  <rect x="-30" y="-20" width="22" height="40" fill={color2} />
                  <circle cx="11" cy="0" r="5" fill={color3 === color1 || color3 === color2 ? '#FFFFFF' : color3} />
                </>
              )}
              {/* Emblem center */}
              <g transform="translate(0, 0)">
                <circle cx="0" cy="0" r="10" fill="#1E293B" opacity="0.9" stroke="#FFFFFF" strokeWidth="1" />
                <text x="0" y="2.5" fill="#FFFFFF" fontSize="7" fontWeight="bold" fontFamily="monospace" textAnchor="middle">
                  {labelCode}
                </text>
              </g>
            </>
          );
        })()}
      </g>
      <rect x="-30" y="-20" width="60" height="40" rx="4" fill="none" stroke="#e2e8f0" strokeWidth="0.5" />
    </svg>
  );
};

const WordCloudGreeting = () => {
  const [cloudData, setCloudData] = useState<any[]>([]);

  useEffect(() => {
    // Rotation order of the 27 languages
    const rotationOrder = [
      "it", "ar", "bn", "fr", "en", "so", "bm", "mnk", "uk", "ddn", 
      "ps", "fa", "ur", "es", "fuc", "kri", "zh", "hi", "pt", "ru", 
      "ind", "de", "ja", "sw", "tr", "pa", "gwe"
    ];
    
    // Get current index from localStorage or start at 0
    const storedIndex = localStorage.getItem('greeting_rotation_index');
    const currentIndex = storedIndex ? parseInt(storedIndex, 10) : 0;
    
    // Get the language code for the current rotation
    const targetLang = rotationOrder[currentIndex % rotationOrder.length];
    
    // Find the center word based on the rotation
    const centerWord = GREETINGS_LIST.find(g => g.lang === targetLang) || GREETINGS_LIST[0];
    
    // Filter out the center word from the others list
    const others = GREETINGS_LIST.filter(g => g !== centerWord);
    
    // Increment and save index for next time
    localStorage.setItem('greeting_rotation_index', ((currentIndex + 1) % rotationOrder.length).toString());

    const positions = [
      // Center - predominant and on top (Random language)
      { ...centerWord, size: "text-2xl md:text-3xl lg:text-4.5xl", color: "text-[#006666]", font: "font-serif font-bold", x: "0%", y: "0%", zIndex: 100, blur: "blur(0px)", delay: 5.0 },
      
      // SHARP WORDS (Ai lati / On the sides)
      { ...others[0], size: "text-lg md:text-xl", color: "text-[#d69e2e]", font: "font-sans font-medium", x: "-75%", y: "-15%", zIndex: 40, blur: "blur(0px)", delay: 1.0 },
      { ...others[1], size: "text-xl md:text-2xl", color: "text-[#8B4513]", font: "font-cursive", x: "80%", y: "15%", zIndex: 40, blur: "blur(0px)", delay: 1.6 },
      { ...others[2], size: "text-md md:text-lg", color: "text-[#2E8B57]", font: "font-sans font-bold", x: "90%", y: "-25%", zIndex: 40, blur: "blur(0px)", delay: 2.2 },
      { ...others[3], size: "text-sans md:text-md", color: "text-[#CD853F]", font: "font-serif", x: "-85%", y: "25%", zIndex: 40, blur: "blur(0px)", delay: 2.8 },
      
      // SLIGHTLY BLURRED WORDS (Per legare / To tie things together)
      { ...others[4], size: "text-sm md:text-base", color: "text-[#20B2AA]", font: "font-sans", x: "-40%", y: "-70%", zIndex: 30, blur: "blur(2px)", delay: 0.6 },
      { ...others[5], size: "text-base md:text-lg", color: "text-[#DAA520]", font: "font-serif", x: "45%", y: "65%", zIndex: 30, blur: "blur(2px)", delay: 1.2 },
      { ...others[6], size: "text-xs md:text-sm", color: "text-[#556B2F]", font: "font-sans", x: "0%", y: "-90%", zIndex: 30, blur: "blur(1px)", delay: 1.8 },
      { ...others[7], size: "text-xs md:text-sm", color: "text-[#A0522D]", font: "font-cursive", x: "0%", y: "85%", zIndex: 30, blur: "blur(2px)", delay: 2.4 },

      // VERY BLURRED WORDS (Sfondo profondo per legare / Deep background to tie)
      { text: "Hello", lang: "en", size: "text-2xl md:text-3xl", color: "text-[#d69e2e]/40", font: "font-serif", x: "35%", y: "-45%", zIndex: 10, blur: "blur(5px)", delay: 0.2 },
      { text: "Bonjour", lang: "fr", size: "text-3xl md:text-4xl", color: "text-[#2E8B57]/30", font: "font-sans font-bold", x: "-45%", y: "35%", zIndex: 10, blur: "blur(6px)", delay: 0.4 },
      { text: "Ciao", lang: "it", size: "text-4xl md:text-5xl", color: "text-[#CD853F]/20", font: "font-cursive", x: "25%", y: "25%", zIndex: 10, blur: "blur(8px)", delay: 0.8 },
      { text: "مرحباً", lang: "ar", size: "text-2xl md:text-3xl", color: "text-[#008080]/30", font: "font-sans", x: "-25%", y: "-35%", zIndex: 10, blur: "blur(5px)", delay: 1.4 },
      
      // EXTRA SMALL SHARP WORDS (Estremi lati / Extreme sides)
      { text: "Kushio", lang: "kri", size: "text-[9px] md:text-[11px]", color: "text-[#228B22]", font: "font-sans", x: "-100%", y: "0%", zIndex: 20, blur: "blur(0px)", delay: 3.6 },
      { text: "سلام", lang: "fa", size: "text-xs md:text-sm", color: "text-[#B8860B]", font: "font-serif", x: "75%", y: "-60%", zIndex: 20, blur: "blur(0px)", delay: 2.6 },
      { text: "হ্যালো", lang: "bn", size: "text-[10px] md:text-xs", color: "text-[#48D1CC]", font: "font-sans", x: "-70%", y: "65%", zIndex: 20, blur: "blur(0px)", delay: 3.4 },
    ];
    setCloudData(positions);
  }, []);

  if (cloudData.length === 0) return <div className="h-[90px] md:h-[120px] mb-1" />;

  return (
    <div className="relative w-full max-w-5xl h-[90px] md:h-[120px] flex items-center justify-center overflow-visible mb-1 mx-auto">
      {cloudData.map((word, i) => {
        const isRtl = ['ar', 'fa', 'ur', 'ps'].includes(word.lang);
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.5, x: 0, y: 0, filter: "blur(10px)" }}
            animate={{ 
              opacity: 1, 
              scale: 1, 
              x: word.x, 
              y: word.y, 
              filter: word.blur 
            }}
            transition={{ 
              duration: 4, 
              delay: word.delay, 
              ease: [0.16, 1, 0.3, 1]
            }}
            className={`absolute ${word.size} ${word.color} ${word.font} whitespace-nowrap drop-shadow-sm`}
            style={{ zIndex: word.zIndex }}
            dir={isRtl ? 'rtl' : 'ltr'}
          >
            <motion.span
              animate={{
                y: ["0%", "-5%", "0%"],
              }}
              transition={{
                duration: 8 + (i % 3), // doubled duration
                repeat: Infinity,
                ease: "easeInOut",
                delay: word.delay + 4
              }}
              className="inline-block"
            >
              {word.text}
            </motion.span>
          </motion.div>
        );
      })}
    </div>
  );
};


const PlayAudioIcon = ({ audioId, className, onError, iconSize = "w-7 h-7" }: { audioId: string, className?: string, onError?: (msg: string) => void, iconSize?: string }) => {
  const [loading, setLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const togglePlay = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      return;
    }

    setLoading(true);
    try {
      let currentBlob: Blob | null = null;
      
      // Check if we need to load the blob
      if (!audio.src || audio.src === window.location.href || !audio.src.startsWith('blob:')) {
        currentBlob = await getAudio(audioId);
        if (currentBlob) {
          const url = URL.createObjectURL(currentBlob);
          setAudioUrl(url);
          audio.src = url;
        } else {
          throw new Error("Audio not found");
        }
      }
      
      try {
        audio.load();
        await audio.play();
      } catch (playErr: any) {
        console.error('Initial play failed:', playErr);
        // If play fails, it might be because the blob's MIME type is not supported
        // or because of a transient error.
        if (playErr.name === 'NotSupportedError' || playErr.name === 'NotFoundError' || playErr.message?.toLowerCase().includes('supported') || playErr.message?.toLowerCase().includes('found')) {
          if (!currentBlob) currentBlob = await getAudio(audioId);
          if (currentBlob) {
            // Try "cleaning" the blob by removing the MIME type
            // This often helps browsers that are picky about MIME types in Blob URLs
            const fallbackBlob = currentBlob.slice(0, currentBlob.size, '');
            const fallbackUrl = URL.createObjectURL(fallbackBlob);
            setAudioUrl(fallbackUrl);
            audio.src = fallbackUrl;
            audio.load();
            try {
              await audio.play();
            } catch (secondErr: any) {
              console.error('Fallback play failed:', secondErr);
              throw secondErr;
            }
          } else {
            throw playErr;
          }
        } else {
          throw playErr;
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError' || err.message?.includes('aborted') || err.message?.includes('signal is aborted') || err.message?.includes('without reason')) return;
      console.error('Playback error:', err);
      if (err.name === 'NotAllowedError') {
        console.warn("Playback not allowed by browser policy");
        if (onError) onError("Clicca di nuovo per riprodurre (permesso browser richiesto).");
      } else {
        const isNotFound = err.message === "Audio not found" || err.name === 'NotFoundError' || err.message?.toLowerCase().includes('found');
        const msg = isNotFound ? "File audio non trovato su questo dispositivo." : "Errore durante la riproduzione dell'audio: " + (err.message || "formato non supportato");
        if (onError) onError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={togglePlay}
        disabled={loading}
        className={className || "p-2.5 bg-white/50 rounded-full hover:bg-white transition-colors text-ink/40 hover:text-olive cursor-pointer pointer-events-auto flex items-center justify-center"}
        title="Ascolta"
      >
        {loading ? <Loader2 className={`${iconSize} animate-spin`} /> : isPlaying ? <Pause className={iconSize} /> : <Play className={iconSize} />}
      </button>
      <audio 
        ref={audioRef} 
        onEnded={() => setIsPlaying(false)} 
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        className="hidden" 
      />
    </>
  );
};

export default function App() {
  const [appState, setAppState] = useState<AppState>('ONBOARDING');
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [langSearchQuery, setLangSearchQuery] = useState("");
  const [dynamicTranslations, setDynamicTranslations] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('dynamic_translations');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Errore nel caricamento delle traduzioni dinamiche", e);
      }
    }
    return {};
  });
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [result, setResult] = useState<TestimonyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAdminActivityInProgress, setIsAdminActivityInProgress] = useState(false);
  const [archive, setArchive] = useState<SavedTestimony[]>([]);
  const [selectedArchiveItem, setSelectedArchiveItem] = useState<SavedTestimony | null>(null);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [isDownloadingAllCombined, setIsDownloadingAllCombined] = useState(false);
  const [isDownloadingBusinessCards, setIsDownloadingBusinessCards] = useState(false);
  const [currentLangIndex, setCurrentLangIndex] = useState(0);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showClearNonFavoritesConfirm, setShowClearNonFavoritesConfirm] = useState(false);
  const [testimonyToDelete, setTestimonyToDelete] = useState<string | null>(null);
  const [showOriginalLang, setShowOriginalLang] = useState(false);
  const [rotatingIndex, setRotatingIndex] = useState(0);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingText, setProcessingText] = useState('');
  const [isGeneratingTappeto, setIsGeneratingTappeto] = useState(false);
  const [tappetoProgress, setTappetoProgress] = useState(0);
  const [tappetoMessage, setTappetoMessage] = useState('');
  const [questionChangeCount, setQuestionChangeCount] = useState(0);

  // Hidden 5-tap search box states & refs
  const [searchBoxVisible, setSearchBoxVisible] = useState(false);
  const [cornerClickTimes, setCornerClickTimes] = useState<number[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleCornerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const now = Date.now();
    const recentClicks = [...cornerClickTimes, now].filter(t => now - t < 2000);
    setCornerClickTimes(recentClicks);
    if (recentClicks.length >= 5) {
      setSearchBoxVisible(true);
      setCornerClickTimes([]);
    }
  };

  // Keyboard auto-focus for iPad / tablets when search unlocked
  useEffect(() => {
    if (searchBoxVisible) {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
      const t = setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 120);
      return () => clearTimeout(t);
    }
  }, [searchBoxVisible]);

  // Handle returning to ONBOARDING and the 30 seconds idle reset timer
  useEffect(() => {
    if (appState !== 'ONBOARDING') {
      setLangSearchQuery("");
      setSearchBoxVisible(false);
      setCornerClickTimes([]);
      return;
    }

    if (searchBoxVisible || langSearchQuery !== "") {
      const timer = setTimeout(() => {
        setLangSearchQuery("");
        setSearchBoxVisible(false);
        setCornerClickTimes([]);
      }, 30000); // 30 seconds inactivity
      return () => clearTimeout(timer);
    }
  }, [appState, langSearchQuery, searchBoxVisible]);

  // Microphone Configuration modal state
  const [showMicModal, setShowMicModal] = useState(false);
  const [homeMics, setHomeMics] = useState<MediaDeviceInfo[]>([]);
  const [selectedHomeMic, setSelectedHomeMic] = useState<string>(() => localStorage.getItem('preferred_mic_id') || 'default');
  const [isTestingHomeMic, setIsTestingHomeMic] = useState(false);
  const [homeMicVolume, setHomeMicVolume] = useState(0);
  const homeStreamRef = useRef<MediaStream | null>(null);
  const homeAnalyserRef = useRef<AnalyserNode | null>(null);
  const homeAnimationFrameRef = useRef<number | null>(null);

  const loadHomeMics = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setHomeMics(devices.filter(d => d.kind === 'audioinput'));
    } catch (e) {
      console.error("Error loading mics on home:", e);
    }
  };

  useEffect(() => {
    if (showMicModal) {
      loadHomeMics();
      navigator.mediaDevices.addEventListener('devicechange', loadHomeMics);
      return () => {
        navigator.mediaDevices.removeEventListener('devicechange', loadHomeMics);
      };
    }
  }, [showMicModal]);

  const requestHomeMicLabelPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      await loadHomeMics();
      showToast("Lista dei microfoni aggiornata!", 'success');
    } catch (err) {
      console.error("Error securing label permission:", err);
      showToast("Permesso non concesso. Abilita l'uso del microfono.", 'error');
    }
  };

  const handleSelectHomeMic = (id: string) => {
    setSelectedHomeMic(id);
    localStorage.setItem('preferred_mic_id', id);
    const matched = homeMics.find(d => d.deviceId === id);
    if (matched) {
      localStorage.setItem('preferred_mic_label', matched.label || "Microfono esterno/integrato");
    } else if (id === 'default') {
      localStorage.setItem('preferred_mic_label', 'Predefinito di sistema');
    }
    showToast("Microfono impostato!", 'success');
  };

  const startHomeMicTest = async () => {
    if (isTestingHomeMic) {
      stopHomeMicTest();
      return;
    }

    try {
      const constraints: any = { audio: true };
      if (selectedHomeMic !== 'default') {
        constraints.audio = { deviceId: { exact: selectedHomeMic } };
      }
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      homeStreamRef.current = stream;
      setIsTestingHomeMic(true);

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      homeAnalyserRef.current = analyser;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateMeter = () => {
        if (!homeAnalyserRef.current) return;
        homeAnalyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        setHomeMicVolume(Math.min(100, Math.round((average / 128) * 100)));
        homeAnimationFrameRef.current = requestAnimationFrame(updateMeter);
      };

      homeAnimationFrameRef.current = requestAnimationFrame(updateMeter);
    } catch (e) {
      console.error("Error starting home mic test:", e);
      showToast("Impossibile attivare il test audio.", 'error');
    }
  };

  const stopHomeMicTest = () => {
    if (homeAnimationFrameRef.current) {
      cancelAnimationFrame(homeAnimationFrameRef.current);
      homeAnimationFrameRef.current = null;
    }
    if (homeStreamRef.current) {
      homeStreamRef.current.getTracks().forEach(track => track.stop());
      homeStreamRef.current = null;
    }
    setIsTestingHomeMic(false);
    setHomeMicVolume(0);
    homeAnalyserRef.current = null;
  };

  useEffect(() => {
    return () => {
      if (homeAnimationFrameRef.current) {
        cancelAnimationFrame(homeAnimationFrameRef.current);
      }
      if (homeStreamRef.current) {
        homeStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);
  const [toastMessage, setToastMessage] = useState<{message: string, type: 'error' | 'success'} | null>(null);
  const [audioInDBCount, setAudioInDBCount] = useState<number | null>(null);
  const [storageInfo, setStorageInfo] = useState<{ usage: number; quota: number } | null>(null);
  const [studioTracks, setStudioTracks] = useState<SavedTestimony[]>([]);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [showRestoreModal, setShowRestoreModal] = useState(false);

  const [archivePage, setArchivePage] = useState(1);
  
  // Customizable Questions and Languages states
  const [activeQuestions, setActiveQuestions] = useState<Question[]>(() => {
    const saved = localStorage.getItem('active_questions_list');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Question[];
        return parsed.map((q: Question) => {
          const staticQ = questions.find(sq => sq.id === q.id);
          if (staticQ) {
            const merged = { ...staticQ, ...q };
            Object.keys(staticQ).forEach(key => {
              const k = key as keyof Question;
              if (staticQ[k] && !q[k]) {
                (merged as any)[k] = staticQ[k];
              }
            });
            return merged;
          }
          return q;
        });
      } catch (e) {
        console.error("Errore nel caricamento delle domande salvate", e);
      }
    }
    return questions;
  });

  const [enabledLanguages, setEnabledLanguages] = useState<string[]>(() => {
    const savedDisabled = localStorage.getItem('disabled_languages');
    const allIds = LANGUAGES_CONFIG.map(l => l.id);
    
    if (savedDisabled) {
      try {
        const disabled = JSON.parse(savedDisabled) as string[];
        return allIds.filter(id => !disabled.includes(id));
      } catch (e) {
        console.error("Errore nel caricamento delle lingue disabilitate", e);
      }
    }
    
    // Migrazione dal vecchio formato enabled_languages
    const oldEnabled = localStorage.getItem('enabled_languages');
    if (oldEnabled) {
      try {
        const parsed = JSON.parse(oldEnabled) as string[];
        const old16Langs = ["it", "ar", "bn", "fr", "en", "so", "bm", "mnk", "uk", "ddn", "ps", "fa", "ur", "es", "fuc", "kri"];
        const disabledFromOld16 = old16Langs.filter(id => !parsed.includes(id));
        
        localStorage.setItem('disabled_languages', JSON.stringify(disabledFromOld16));
        return allIds.filter(id => !disabledFromOld16.includes(id));
      } catch (e) {
        console.error("Errore nella migrazione delle lingue abilitate", e);
      }
    }
    
    return allIds;
  });

  const [questionArchives, setQuestionArchives] = useState<{ id: string; name: string; date: string; questions: Question[] }[]>(() => {
    const saved = localStorage.getItem('question_archives');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Errore nel caricamento dell'archivio domande", e);
      }
    }
    return [
      {
        id: 'original_set',
        name: 'Set Originale (Padre Marella)',
        date: '2026-06-01',
        questions: questions
      }
    ];
  });

  // Sync with localStorage
  useEffect(() => {
    localStorage.setItem('active_questions_list', JSON.stringify(activeQuestions));
  }, [activeQuestions]);

  useEffect(() => {
    localStorage.setItem('enabled_languages', JSON.stringify(enabledLanguages));
    const allIds = LANGUAGES_CONFIG.map(l => l.id);
    const disabled = allIds.filter(id => !enabledLanguages.includes(id));
    localStorage.setItem('disabled_languages', JSON.stringify(disabled));
  }, [enabledLanguages]);

  useEffect(() => {
    localStorage.setItem('question_archives', JSON.stringify(questionArchives));
  }, [questionArchives]);

  useEffect(() => {
    localStorage.setItem('dynamic_translations', JSON.stringify(dynamicTranslations));
  }, [dynamicTranslations]);

  const CATEGORY_SEQUENCE: Category[] = ['Passato', 'Presente', 'Futuro'];

  const getNextCategory = (): Category => {
    const lastCat = localStorage.getItem('last_question_category') as Category;
    if (!lastCat || !CATEGORY_SEQUENCE.includes(lastCat)) {
      return 'Passato';
    }
    const currentIndex = CATEGORY_SEQUENCE.indexOf(lastCat);
    const nextIndex = (currentIndex + 1) % CATEGORY_SEQUENCE.length;
    return CATEGORY_SEQUENCE[nextIndex];
  };

  const getRandomQuestionFromActive = (category?: Category): Question => {
    const pool = category ? activeQuestions.filter(q => q.category === category) : activeQuestions;
    
    if (pool.length === 0) {
      const defaultFiltered = category ? questions.filter(q => q.category === category) : questions;
      return defaultFiltered[Math.floor(Math.random() * defaultFiltered.length)];
    }

    const storageKey = `asked_questions_${category || 'general'}`;
    let askedIds: string[] = [];
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        askedIds = JSON.parse(saved) as string[];
      }
    } catch (e) {
      console.error("Errore nel caricamento della cronologia delle domande", e);
    }

    // Filtra solo gli ID effettivamente presenti nell'attuale pool attivo
    const poolIds = pool.map(q => q.id);
    askedIds = askedIds.filter(id => poolIds.includes(id));

    let unused = pool.filter(q => !askedIds.includes(q.id));

    // Se tutte le domande del pool sono state fatte, azzera la cronologia
    if (unused.length === 0) {
      const lastId = askedIds[askedIds.length - 1];
      askedIds = [];
      if (pool.length > 1 && lastId) {
        // Evita di riproporre immediatamente la stessa domanda all'inizio del nuovo ciclo
        unused = pool.filter(q => q.id !== lastId);
      } else {
        unused = pool;
      }
    }

    const selected = unused[Math.floor(Math.random() * unused.length)];
    askedIds.push(selected.id);
    
    try {
      localStorage.setItem(storageKey, JSON.stringify(askedIds));
    } catch (e) {
      console.error("Errore nel salvataggio della cronologia delle domande", e);
    }

    return selected;
  };

  // Clean 3x3 grid for archive
  const ARCHIVE_PAGE_SIZE = 9;

  const pendingTranslationsRef = useRef<Set<string>>(new Set());

  const refreshAudioCount = async () => {
    const { countAudioFiles, getStorageEstimate } = await import('./lib/audioStorage');
    const count = await countAudioFiles();
    setAudioInDBCount(count);
    
    const estimate = await getStorageEstimate();
    setStorageInfo(estimate);
  };

  useEffect(() => {
    if (!currentQuestion || !selectedLanguage) return;
    
    const hasBuiltIn = !!(currentQuestion as any)[selectedLanguage];
    if (hasBuiltIn) return;
    
    const cacheKey = `${currentQuestion.id}_${selectedLanguage}`;
    if (dynamicTranslations[cacheKey]) return;
    if (pendingTranslationsRef.current.has(cacheKey)) return;
    
    pendingTranslationsRef.current.add(cacheKey);
    
    const langConfig = LANGUAGES_CONFIG.find(l => l.id === selectedLanguage);
    if (!langConfig) return;
    
    translateText(currentQuestion.it, langConfig.labelNative)
      .then(translated => {
        setDynamicTranslations(prev => ({
          ...prev,
          [cacheKey]: translated
        }));
      })
      .catch(err => {
        console.error("Dynamic translation error:", err);
        pendingTranslationsRef.current.delete(cacheKey);
      });
  }, [currentQuestion, selectedLanguage]);

  useEffect(() => {
    refreshAudioCount();
  }, []);

  const showToast = (message: string, type: 'error' | 'success' = 'error') => {
    setToastMessage({ message, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const [testimonyToEdit, setTestimonyToEdit] = useState<SavedTestimony | TestimonyResult | null>(null);

  const updateTestimony = (updated: SavedTestimony | TestimonyResult) => {
    if ('id' in updated && updated.id) {
      setArchive(prev => {
        const next = prev.map(item => item.id === updated.id ? (updated as SavedTestimony) : item);
        localStorage.setItem('testimonies_archive', JSON.stringify(next));
        return next;
      });
      if (selectedArchiveItem && selectedArchiveItem.id === updated.id) {
        setSelectedArchiveItem(updated as SavedTestimony);
      }
    }
    
    if (result && ('id' in result ? (result as SavedTestimony).id === ('id' in updated ? (updated as SavedTestimony).id : undefined) : true)) {
      setResult(updated);
    }
    
    showToast("Modifiche salvate con successo!", "success");
  };

  const tapCountRef = useRef(0);
  const tapTimeoutRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | null>(null);
  const processingIntervalRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const silenceStartRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isSilenceTimeoutRef = useRef(false);
  const processingSessionRef = useRef<string | null>(null);
  const lastAudioBlobRef = useRef<Blob | null>(null);
  const visualizerBarsRef = useRef<(HTMLDivElement | null)[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processAbortControllerRef = useRef<AbortController | null>(null);

  const handleSecretTap = () => {
    if (appState !== 'ONBOARDING' && appState !== 'HOME') return;
    
    tapCountRef.current += 1;

    if (tapCountRef.current >= 5) {
      tapCountRef.current = 0;
      if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
      
      setArchivePage(1);
      setAppState('ARCHIVIO');
      return;
    }

    if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
    tapTimeoutRef.current = window.setTimeout(() => {
      tapCountRef.current = 0;
    }, 2000);
  };

  // Load archive from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem('testimonies_archive');
    if (saved) {
      try {
        setArchive(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse archive", e);
      }
    }
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(console.error);
      }
      if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
    };
  }, []);

  // Global inactivity timeout
  useEffect(() => {
    let inactivityTimer: number;

    const resetInactivityTimer = () => {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      
      // Do not timeout during active recording, processing, onboarding, or if in Admin with an activity in progress
      if (
        appState === 'RECORDING' || 
        (appState === 'ELABORAZIONE' && !error) || 
        appState === 'ONBOARDING' ||
        (appState === 'ADMIN' && isAdminActivityInProgress)
      ) {
        return;
      }

      // Different timeouts based on state
      let timeoutDuration = 60000; // Default 60 seconds
      if (appState === 'ADMIN') {
        timeoutDuration = 180000; // 3 minutes for Admin backend
      } else if (appState === 'ARCHIVIO' || appState === 'STUDIO') {
        timeoutDuration = 120000; // 2 minutes for archive and studio
      } else if (appState === 'RISPOSTA') {
        timeoutDuration = 30000; // 30 seconds for reading response
      }

      inactivityTimer = window.setTimeout(() => {
        console.log("Inactivity timeout reached, restarting...");
        handleRestart();
      }, timeoutDuration);
    };

    // Listen for user interactions with capturing phase to bypass any stopPropagation()
    window.addEventListener('touchstart', resetInactivityTimer, { capture: true, passive: true });
    window.addEventListener('click', resetInactivityTimer, { capture: true });
    window.addEventListener('mousedown', resetInactivityTimer, { capture: true });
    window.addEventListener('mousemove', resetInactivityTimer, { capture: true, passive: true });
    window.addEventListener('keydown', resetInactivityTimer, { capture: true });

    // Initial setup
    resetInactivityTimer();

    return () => {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      window.removeEventListener('touchstart', resetInactivityTimer, { capture: true });
      window.removeEventListener('click', resetInactivityTimer, { capture: true });
      window.removeEventListener('mousedown', resetInactivityTimer, { capture: true });
      window.removeEventListener('mousemove', resetInactivityTimer, { capture: true });
      window.removeEventListener('keydown', resetInactivityTimer, { capture: true });
    };
  }, [appState, error, isAdminActivityInProgress]);

  useEffect(() => {
    let timeout: number;
    if (appState === 'ELABORAZIONE') {
      timeout = window.setTimeout(() => {
        console.error("Processing timeout reached (150s)");
        setError("L'elaborazione sta impiegando troppo tempo. Controlla la connessione e riprova.");
        // We don't auto-restart here to allow the user to see the error or retry
      }, 150000);
    }
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [appState]);

  useEffect(() => {
    if (appState === 'RISPOSTA') {
      const interval = setInterval(() => {
        setShowOriginalLang((prev) => !prev);
      }, 4000);
      return () => clearInterval(interval);
    } else {
      setShowOriginalLang(false);
    }
  }, [appState]);

  useEffect(() => {
    let interval: number;
    if (appState === 'RECORDING') {
      const startTime = Date.now();
      interval = window.setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        setRecordingTime(elapsed);
      }, 50);
    } else {
      setRecordingTime(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [appState]);

  useEffect(() => {
    let timeout: number;
    
    if (appState === 'RECORDING' && recordingStartTime) {
      timeout = window.setTimeout(() => {
        stopRecording();
      }, MAX_RECORDING_TIME * 1000);
    }
    
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [appState, recordingStartTime]);

  // Removed language cycling useEffect

  useEffect(() => {
    let interval: number;
    
    if (appState === 'HOME' || appState === 'DOMANDA') {
      interval = window.setInterval(() => {
        setRotatingIndex((prev) => (prev + 1) % 5);
      }, 3000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [appState]);

  useEffect(() => {
    if (appState === 'SILENCE') {
      const timer = window.setTimeout(() => {
        setAppState('DOMANDA');
      }, 6000); // 6 seconds to read the message
      return () => clearTimeout(timer);
    }
  }, [appState]);

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setArchive(prevArchive => {
      const newArchive = prevArchive.map(item => 
        item.id === id ? { ...item, favorite: !item.favorite } : item
      );
      try {
        localStorage.setItem('testimonies_archive', JSON.stringify(newArchive));
      } catch (err) {
        console.error("LocalStorage error:", err);
      }
      return newArchive;
    });
    
    // Update selectedArchiveItem if it's the one being toggled
    if (selectedArchiveItem?.id === id) {
      setSelectedArchiveItem({ ...selectedArchiveItem, favorite: !selectedArchiveItem.favorite });
    }
  };

  const clearNonFavorites = () => {
    setArchive(prevArchive => {
      const nonFavorites = prevArchive.filter(item => !item.favorite);
      const favorites = prevArchive.filter(item => item.favorite);
      
      try {
        localStorage.setItem('testimonies_archive', JSON.stringify(favorites));
      } catch (err) {
        console.error("LocalStorage error:", err);
      }
      
      // Delete audio for non-favorites from IndexedDB
      nonFavorites.forEach(item => {
        deleteAudio(item.id).catch(err => console.error("Error deleting audio from IndexedDB:", err));
      });
      
      return favorites;
    });
    
    if (selectedArchiveItem && !selectedArchiveItem.favorite) {
      setSelectedArchiveItem(null);
    }
    setShowClearNonFavoritesConfirm(false);
    setArchivePage(1);
  };

  const deleteTestimony = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setTestimonyToDelete(id);
  };

  const downloadAudioFile = async (audioId: string, parolaChiave: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const originalBlob = await getAudio(audioId);
      if (!originalBlob) {
        showToast("File audio non trovato su questo dispositivo.", 'error');
        return;
      }
      
      // Convert to real WAV if it's not already (it's likely webm/mp4 from MediaRecorder)
      let wavBlob: Blob;
      try {
        wavBlob = await convertBlobToWav(originalBlob);
      } catch (wavError) {
        console.warn("WAV conversion failed during download, using original audio format:", wavError);
        wavBlob = originalBlob;
      }
      
      const url = window.URL.createObjectURL(wavBlob);
      const link = document.createElement('a');
      link.href = url;
      const fileExt = wavBlob.type?.split('/')[1] || 'wav';
      link.download = `audio_${parolaChiave.replace(/\s+/g, '_').toLowerCase()}.${fileExt === 'octet-stream' ? 'wav' : fileExt}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error downloading audio:", err);
      showToast("Errore durante il download dell'audio.", 'error');
    }
  };

  const confirmDeleteTestimony = () => {
    if (!testimonyToDelete) return;

    setArchive(prevArchive => {
      const newArchive = prevArchive.filter(item => item.id !== testimonyToDelete);
      try {
        localStorage.setItem('testimonies_archive', JSON.stringify(newArchive));
      } catch (e) {
        console.error("LocalStorage error:", e);
      }
      
      const newTotalPages = Math.ceil(newArchive.length / ARCHIVE_PAGE_SIZE);
      if (archivePage > newTotalPages && newTotalPages > 0) {
        setArchivePage(newTotalPages);
      } else if (newTotalPages === 0) {
        setArchivePage(1);
      }
      
      return newArchive;
    });
      
      // Delete audio from IndexedDB
      deleteAudio(testimonyToDelete).catch(err => console.error("Error deleting audio from IndexedDB:", err));

      if (selectedArchiveItem?.id === testimonyToDelete) {
        setSelectedArchiveItem(null);
      }
      setTestimonyToDelete(null);
  };

  const clearArchive = () => {
    setArchive([]);
    localStorage.removeItem('testimonies_archive');
    setSelectedArchiveItem(null);
    setShowClearConfirm(false);
    setArchivePage(1);
    
    // Clear all audio from IndexedDB
    clearAllAudio().catch(err => console.error("Error clearing audio from IndexedDB:", err));
  };

  const downloadSingleCard = async (item: TestimonyResult, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.top = '0';
      container.style.left = '0';
      container.style.width = '1123px';
      container.style.height = '794px';
      container.style.pointerEvents = 'none';
      container.style.zIndex = '-99999';
      
      let currentFontSize = 64;
      container.innerHTML = generateHtmlForCard(item as SavedTestimony, currentFontSize);
      document.body.appendChild(container);

      // Wait for fonts to be ready before calculating sizes
      await document.fonts.ready;
      await new Promise(resolve => setTimeout(resolve, 100));

      let middleContent = container.querySelector('#pdf-middle-content') as HTMLElement;
      
      const isOverflowing = (size: number) => {
        if (!middleContent) return false;
        const measures = Array.from(container.querySelectorAll('.pdf-text-measure')) as HTMLElement[];
        const availableHeight = middleContent.clientHeight;
        const ratio = size > 16 ? 0.8 : 1.0;
        for (const m of measures) {
          if (m.offsetHeight > availableHeight * ratio) return true;
        }
        return false;
      };

      while (isOverflowing(currentFontSize) && currentFontSize > 8) {
        currentFontSize -= 1;
        container.innerHTML = generateHtmlForCard(item as SavedTestimony, currentFontSize);
        middleContent = container.querySelector('#pdf-middle-content') as HTMLElement;
      }

      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        width: 1123,
        height: 794,
        x: 0,
        y: 0,
        scrollX: 0,
        scrollY: 0
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      pdf.addImage(imgData, 'PNG', 0, 0, pageWidth, pageHeight);
      
      const d = new Date((item as SavedTestimony).date || new Date());
      const dateStr = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
      const lang = (item.lingua_originale || 'sconosciuta').replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const kw = (item.parola_chiave || 'scheda').replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const fileName = `${dateStr}_${lang}_${kw}.pdf`;
      
      pdf.save(fileName);

      document.body.removeChild(container);
    } catch (err) {
      console.error("Error downloading PDF:", err);
      showToast("Si è verificato un errore durante la generazione del PDF.", 'error');
    }
  };

  const downloadAllAsPdf = async () => {
    if (archive.length === 0) return;
    setIsDownloadingAll(true);
    try {
      const zip = new JSZip();

      const sortedArchive = [...archive].sort((a, b) => {
        const aFav = a.favorite ? 1 : 0;
        const bFav = b.favorite ? 1 : 0;
        if (aFav !== bFav) return bFav - aFav;
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });

      for (let i = 0; i < sortedArchive.length; i++) {
        const item = sortedArchive[i];
        const container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.top = '0';
        container.style.left = '0';
        container.style.width = '1123px';
        container.style.height = '794px';
        container.style.pointerEvents = 'none';
        container.style.zIndex = '-99999';
        
        let currentFontSize = 64;
        container.innerHTML = generateHtmlForCard(item, currentFontSize);
        document.body.appendChild(container);

        try {
          // Wait for fonts to be ready before calculating sizes
          await document.fonts.ready;
          await new Promise(resolve => setTimeout(resolve, 80));

          let middleContent = container.querySelector('#pdf-middle-content') as HTMLElement;

          const isOverflowing = (size: number) => {
            if (!middleContent) return false;
            const measures = Array.from(container.querySelectorAll('.pdf-text-measure')) as HTMLElement[];
            const availableHeight = middleContent.clientHeight;
            const ratio = size > 16 ? 0.8 : 1.0;
            for (const m of measures) {
              if (m.offsetHeight > availableHeight * ratio) return true;
            }
            return false;
          };

          while (isOverflowing(currentFontSize) && currentFontSize > 8) {
            currentFontSize -= 1;
            container.innerHTML = generateHtmlForCard(item, currentFontSize);
            middleContent = container.querySelector('#pdf-middle-content') as HTMLElement;
          }

          await new Promise(resolve => setTimeout(resolve, 80));

          const canvas = await html2canvas(container, {
            scale: 1.5,
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false,
            width: 1123,
            height: 794,
            x: 0,
            y: 0,
            scrollX: 0,
            scrollY: 0
          });
          
          const imgData = canvas.toDataURL('image/jpeg', 0.85);
          
          const singlePdf = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a4'
          });

          const pageWidth = singlePdf.internal.pageSize.getWidth();
          const pageHeight = singlePdf.internal.pageSize.getHeight();
          singlePdf.addImage(imgData, 'JPEG', 0, 0, pageWidth, pageHeight);

          const pdfBlob = singlePdf.output('blob');
          
          const d = new Date((item as SavedTestimony).date || new Date());
          const dateStr = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
          const lang = (item.lingua_originale || 'sconosciuta').replace(/[^a-z0-9]/gi, '_').toLowerCase();
          const kw = (item.parola_chiave || 'scheda').replace(/[^a-z0-9]/gi, '_').toLowerCase();
          const fileName = `${dateStr}_${lang}_${kw}_${item.id.toLowerCase().substring(0, 5)}.pdf`;

          zip.file(fileName, pdfBlob);

        } finally {
          if (document.body.contains(container)) {
            document.body.removeChild(container);
          }
        }
        
        // Give the browser a moment to breathe and GC
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `testimonianze_pdf_${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      showToast("ZIP delle cartoline PDF generato con successo!", 'success');

    } catch (err) {
      console.error("Error generating PDF ZIP:", err);
      showToast("Si è verificato un errore durante la generazione del ZIP dei PDF.", 'error');
    } finally {
      setIsDownloadingAll(false);
    }
  };

  const downloadAllAsSingleCombinedPdf = async () => {
    if (archive.length === 0) return;
    setIsDownloadingAllCombined(true);
    try {
      const sortedArchive = [...archive].sort((a, b) => {
        const aFav = a.favorite ? 1 : 0;
        const bFav = b.favorite ? 1 : 0;
        if (aFav !== bFav) return bFav - aFav;
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });

      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      for (let i = 0; i < sortedArchive.length; i++) {
        const item = sortedArchive[i];
        
        if (i > 0) {
          pdf.addPage();
        }

        const container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.top = '0';
        container.style.left = '0';
        container.style.width = '1123px';
        container.style.height = '794px';
        container.style.pointerEvents = 'none';
        container.style.zIndex = '-99999';
        
        let currentFontSize = 64;
        container.innerHTML = generateHtmlForCard(item, currentFontSize);
        document.body.appendChild(container);

        try {
          // Wait for fonts to be ready
          await document.fonts.ready;
          await new Promise(resolve => setTimeout(resolve, 80));

          let middleContent = container.querySelector('#pdf-middle-content') as HTMLElement;

          const isOverflowing = (size: number) => {
            if (!middleContent) return false;
            const measures = Array.from(container.querySelectorAll('.pdf-text-measure')) as HTMLElement[];
            const availableHeight = middleContent.clientHeight;
            const ratio = size > 16 ? 0.8 : 1.0;
            for (const m of measures) {
              if (m.offsetHeight > availableHeight * ratio) return true;
            }
            return false;
          };

          while (isOverflowing(currentFontSize) && currentFontSize > 8) {
            currentFontSize -= 1;
            container.innerHTML = generateHtmlForCard(item, currentFontSize);
            middleContent = container.querySelector('#pdf-middle-content') as HTMLElement;
          }

          await new Promise(resolve => setTimeout(resolve, 80));

          const canvas = await html2canvas(container, {
            scale: 1.5,
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false,
            width: 1123,
            height: 794,
            x: 0,
            y: 0,
            scrollX: 0,
            scrollY: 0
          });
          
          const imgData = canvas.toDataURL('image/jpeg', 0.85);
          
          pdf.addImage(imgData, 'JPEG', 0, 0, pageWidth, pageHeight);

        } finally {
          if (document.body.contains(container)) {
            document.body.removeChild(container);
          }
        }
        
        // Give the browser a moment to breathe and GC
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const fileName = `archivio_completo_${new Date().toISOString().slice(0, 10)}.pdf`;
      pdf.save(fileName);
      
      showToast("PDF unico di tutte le cartoline generato con successo!", 'success');

    } catch (err) {
      console.error("Error generating single combined PDF:", err);
      showToast("Si è verificato un errore durante la generazione del PDF unico.", 'error');
    } finally {
      setIsDownloadingAllCombined(false);
    }
  };

  const downloadAllAsBusinessCardsPdf = async () => {
    if (archive.length === 0) return;
    setIsDownloadingBusinessCards(true);
    try {
      const sortedArchive = [...archive].sort((a, b) => {
        const aFav = a.favorite ? 1 : 0;
        const bFav = b.favorite ? 1 : 0;
        if (aFav !== bFav) return bFav - aFav;
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });

      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [148, 105] // A6 landscape dimensions explicitly in mm to avoid any jsPDF version lookup error
      });

      const pageWidth = 148;
      const pageHeight = 105;

      let pagesAdded = 0;

      for (let i = 0; i < sortedArchive.length; i++) {
        const item = sortedArchive[i];
        
        // Face 1: ITA
        if (pagesAdded > 0) {
          pdf.addPage([148, 105], 'landscape');
        }
        pagesAdded++;

        const containerFront = document.createElement('div');
        containerFront.style.position = 'fixed';
        containerFront.style.top = '0';
        containerFront.style.left = '0';
        containerFront.style.width = '1123px';
        containerFront.style.height = '794px';
        containerFront.style.pointerEvents = 'none';
        containerFront.style.zIndex = '-99999';
        
        // Calculate dynamic font size for Front Side
        let fontSizeF = 64;

        containerFront.innerHTML = generateHtmlForBusinessCardSide(item, 'ITA', fontSizeF);
        document.body.appendChild(containerFront);

        try {
          await document.fonts.ready;
          await new Promise(resolve => setTimeout(resolve, 80));

          let middleContent = containerFront.querySelector('#pdf-middle-content') as HTMLElement;
          const isOverflowing = (size: number) => {
            if (!middleContent) return false;
            const measures = Array.from(containerFront.querySelectorAll('.pdf-text-measure')) as HTMLElement[];
            const availableHeight = middleContent.clientHeight;
            const ratio = size > 16 ? 0.8 : 1.0;
            for (const m of measures) {
              if (m.offsetHeight > availableHeight * ratio) return true;
            }
            return false;
          };

          while (isOverflowing(fontSizeF) && fontSizeF > 8) {
            fontSizeF -= 1;
            containerFront.innerHTML = generateHtmlForBusinessCardSide(item, 'ITA', fontSizeF);
            middleContent = containerFront.querySelector('#pdf-middle-content') as HTMLElement;
          }

          await new Promise(resolve => setTimeout(resolve, 80));

          const canvasFront = await html2canvas(containerFront, {
            scale: 1.5,
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false,
            width: 1123,
            height: 794,
            x: 0,
            y: 0,
            scrollX: 0,
            scrollY: 0
          });
          
          const imgDataFront = canvasFront.toDataURL('image/jpeg', 0.85);
          pdf.addImage(imgDataFront, 'JPEG', 0, 0, pageWidth, pageHeight);

        } finally {
          if (document.body.contains(containerFront)) {
            document.body.removeChild(containerFront);
          }
        }

        await new Promise(resolve => setTimeout(resolve, 100));

        // Face 2: LINGUA
        pdf.addPage([148, 105], 'landscape');
        pagesAdded++;

        const containerBack = document.createElement('div');
        containerBack.style.position = 'fixed';
        containerBack.style.top = '0';
        containerBack.style.left = '0';
        containerBack.style.width = '1123px';
        containerBack.style.height = '794px';
        containerBack.style.pointerEvents = 'none';
        containerBack.style.zIndex = '-99999';
        
        // Calculate dynamic font size for Back Side
        let fontSizeB = 64;

        containerBack.innerHTML = generateHtmlForBusinessCardSide(item, 'LINGUA', fontSizeB);
        document.body.appendChild(containerBack);

        try {
          await document.fonts.ready;
          await new Promise(resolve => setTimeout(resolve, 80));

          let middleContent = containerBack.querySelector('#pdf-middle-content') as HTMLElement;
          const isOverflowing = (size: number) => {
            if (!middleContent) return false;
            const measures = Array.from(containerBack.querySelectorAll('.pdf-text-measure')) as HTMLElement[];
            const availableHeight = middleContent.clientHeight;
            const ratio = size > 16 ? 0.8 : 1.0;
            for (const m of measures) {
              if (m.offsetHeight > availableHeight * ratio) return true;
            }
            return false;
          };

          while (isOverflowing(fontSizeB) && fontSizeB > 8) {
            fontSizeB -= 1;
            containerBack.innerHTML = generateHtmlForBusinessCardSide(item, 'LINGUA', fontSizeB);
            middleContent = containerBack.querySelector('#pdf-middle-content') as HTMLElement;
          }

          await new Promise(resolve => setTimeout(resolve, 80));

          const canvasBack = await html2canvas(containerBack, {
            scale: 1.5,
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false,
            width: 1123,
            height: 794,
            x: 0,
            y: 0,
            scrollX: 0,
            scrollY: 0
          });
          
          const imgDataBack = canvasBack.toDataURL('image/jpeg', 0.85);
          pdf.addImage(imgDataBack, 'JPEG', 0, 0, pageWidth, pageHeight);

        } finally {
          if (document.body.contains(containerBack)) {
            document.body.removeChild(containerBack);
          }
        }

        // Give the browser a moment to breathe and GC
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const fileName = `biglietti_visita_A6_${new Date().toISOString().slice(0, 10)}.pdf`;
      pdf.save(fileName);
      
      showToast("PDF biglietti da visita A6 generato con successo!", 'success');

    } catch (err) {
      console.error("Error generating business cards PDF:", err);
      showToast("Si è verificato un errore durante la generazione dei biglietti da visita.", 'error');
    } finally {
      setIsDownloadingBusinessCards(false);
    }
  };

  const handleGeneraTappeto = async () => {
    setIsGeneratingTappeto(true);
    setTappetoProgress(0);
    setTappetoMessage('Inizializzazione...');
    try {
      // Recupera tutti i blob dall'archivio
      const clips = [];
      let loadedCount = 0;
      for (const item of archive) {
        if (item.audioId) {
          try {
            const blob = await getAudio(item.audioId);
            if (blob) clips.push({ 
              id: item.audioId, 
              language: item.lingua_originale || 'unknown', 
              blob,
              studioVolume: item.studioVolume,
              studioTrimStart: item.studioTrimStart,
              studioTrimEnd: item.studioTrimEnd,
              studioCrossfadeNext: item.studioCrossfadeNext
            });
          } catch (e) {
            console.warn(`Failed to load audio for clip ${item.audioId}:`, e);
          }
        }
        loadedCount++;
        setTappetoProgress(Math.round((loadedCount / archive.length) * 10));
        setTappetoMessage(`Recuperazione audio dall'archivio (${loadedCount}/${archive.length})...`);
      }
      if (clips.length === 0) {
        showToast('Nessun file audio trovato nel database. Prova a cliccare "Ripristina Audio" in fondo alla pagina.', 'error');
        return;
      }
      const wavBlob = await generateTappetoSonoro(
        clips,
        (p, msg) => { setTappetoProgress(p); setTappetoMessage(msg); }
      );
      // Download
      const url = URL.createObjectURL(wavBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tappeto_sonoro_${new Date().toISOString().slice(0,10)}.wav`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Tappeto sonoro generato con successo!', 'success');
    } catch (e: any) {
      console.error(e);
      const msg = e.message === "Nessun audio valido trovato." 
        ? "Impossibile decodificare i file audio. Formato non supportato dal browser." 
        : 'Errore durante la generazione del tappeto sonoro.';
      showToast(msg, 'error');
    } finally {
      setIsGeneratingTappeto(false);
    }
  };

  const handleGeneraTappetoPreferiti = async () => {
    const favorites = archive.filter(item => item.favorite);
    if (favorites.length === 0) {
      showToast('Nessun preferito disponibile nell\'archivio.', 'error');
      return;
    }
    setIsGeneratingTappeto(true);
    setTappetoProgress(0);
    setTappetoMessage('Inizializzazione Preferiti...');
    try {
      const clips = [];
      let loadedCount = 0;
      for (const item of favorites) {
        if (item.audioId) {
          try {
            const blob = await getAudio(item.audioId);
            if (blob) clips.push({ 
              id: item.audioId, 
              language: item.lingua_originale || 'unknown', 
              blob,
              studioVolume: item.studioVolume,
              studioTrimStart: item.studioTrimStart,
              studioTrimEnd: item.studioTrimEnd,
              studioCrossfadeNext: item.studioCrossfadeNext
            });
          } catch (e) {
            console.warn(`Failed to load audio for favorite clip ${item.audioId}:`, e);
          }
        }
        loadedCount++;
        setTappetoProgress(Math.round((loadedCount / favorites.length) * 10));
        setTappetoMessage(`Recuperazione audio preferiti dall'archivio (${loadedCount}/${favorites.length})...`);
      }
      if (clips.length === 0) {
        showToast('Nessun file audio trovato per i preferiti nel database.', 'error');
        return;
      }
      const wavBlob = await generateTappetoSonoro(
        clips,
        (p, msg) => { setTappetoProgress(p); setTappetoMessage(msg); }
      );
      const url = URL.createObjectURL(wavBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tappeto_preferiti_${new Date().toISOString().slice(0,10)}.wav`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Tappeto preferiti generato con successo!', 'success');
    } catch (e: any) {
      console.error(e);
      const msg = e.message === "Nessun audio valido trovato." 
        ? "Impossibile decodificare i file audio dei preferiti." 
        : 'Errore durante la generazione del tappeto preferiti.';
      showToast(msg, 'error');
    } finally {
      setIsGeneratingTappeto(false);
    }
  };

  const handleDownloadWavIntegrali = async () => {
    if (archive.length === 0) {
      showToast('L\'archivio è vuoto.', 'error');
      return;
    }
    setIsGeneratingTappeto(true); // Reuse loading state
    setTappetoProgress(0);
    setTappetoMessage('Preparazione ZIP...');
    try {
      const zip = new JSZip();
      const folder = zip.folder("audio_integrali");
      
      let processed = 0;
      let addedFiles = 0;
      for (const item of archive) {
        if (item.audioId) {
          try {
            const originalBlob = await getAudio(item.audioId);
            if (originalBlob) {
              // Convert to real WAV!
              let wavBlob: Blob;
              let fileExt = 'wav';
              try {
                wavBlob = await convertBlobToWav(originalBlob);
              } catch (wavError) {
                console.warn(`WAV conversion failed for ${item.audioId}, embedding original:`, wavError);
                wavBlob = originalBlob;
                fileExt = originalBlob.type?.split('/')[1] || 'webm';
                if (fileExt === 'octet-stream') fileExt = 'webm';
              }
              
              const dateStr = new Date(item.date).toISOString().slice(0,10);
              const kw = (item.parola_chiave || 'audio').replace(/\s+/g, '_').toLowerCase();
              const fileName = `${dateStr}_${kw}_${item.id.slice(0,5)}.${fileExt}`;
              folder?.file(fileName, wavBlob);
              addedFiles++;
            }
          } catch (e) {
            console.warn(`Failed to add audio to ZIP for ${item.audioId}:`, e);
          }
        }
        processed++;
        setTappetoProgress((processed / archive.length) * 100);
      }
      
      if (addedFiles === 0) {
        showToast('Nessun file audio trovato nel database per creare lo ZIP.', 'error');
        return;
      }

      setTappetoMessage('Generazione file ZIP...');
      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audio_integrali_${new Date().toISOString().slice(0,10)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`ZIP generato con successo (${addedFiles} file).`, 'success');
    } catch (e) {
      console.error(e);
      showToast('Errore durante la generazione dello ZIP.', 'error');
    } finally {
      setIsGeneratingTappeto(false);
    }
  };

  const cleanupAudioResources = () => {
    console.log("Performing deep audio cleanup...");
    
    // 1. Stop MediaRecorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        console.warn("Error stopping MediaRecorder during cleanup:", e);
      }
    }
    mediaRecorderRef.current = null;

    // 2. Stop all tracks in the media stream
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => {
        try {
          track.stop();
          track.enabled = false;
        } catch (e) {
          console.warn("Error stopping track:", e);
        }
      });
      mediaStreamRef.current = null;
    }

    // 3. Cancel animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // 4. Abort any ongoing processing
    if (processAbortControllerRef.current) {
      processAbortControllerRef.current.abort();
      processAbortControllerRef.current = null;
    }

    // 5. Clear intervals
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (processingIntervalRef.current) {
      window.clearInterval(processingIntervalRef.current);
      processingIntervalRef.current = null;
    }

    // 6. Reset silence detection
    silenceStartRef.current = null;
    audioChunksRef.current = [];
    
    // 7. Reset processing session
    processingSessionRef.current = null;
  };

  const handleStart = () => {
    cleanupAudioResources();
    const nextCat = getNextCategory();
    const q = getRandomQuestionFromActive(nextCat);
    setCurrentQuestion(q);
    localStorage.setItem('last_question_category', nextCat);
    setAppState('DOMANDA');
    setError(null);
  };

  const startRecording = async () => {
    if (appState !== 'DOMANDA') return;
    
    // Cleanup everything before starting a new one
    cleanupAudioResources();

    try {
      // Get preferred mic deviceId if any is stored
      const preferredMicId = localStorage.getItem('preferred_mic_id');
      let stream: MediaStream;

      if (preferredMicId && preferredMicId !== 'default') {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              deviceId: { exact: preferredMicId },
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            }
          });
        } catch (err) {
          console.warn("Could not load preferred microphone (it might be disconnected), falling back to default:", err);
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            }
          });
        }
      } else {
        stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          } 
        });
      }
      
      // Ensure tracks are enabled
      stream.getAudioTracks().forEach(track => {
        track.enabled = true;
      });

      mediaStreamRef.current = stream;
      
      setAppState('RECORDING');
      
      let mimeType = '';
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      
      if (isIOS) {
        // iOS/iPadOS prefers audio/mp4
        if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/aac')) {
          mimeType = 'audio/aac';
        }
      } else {
        mimeType = 'audio/webm;codecs=opus';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'audio/webm';
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'audio/mp4';
          }
        }
      }
      
      if (mimeType && !MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = ''; // Let the browser choose the default
      }
      
      let mediaRecorder: MediaRecorder;
      try {
        const options = mimeType ? { mimeType, audioBitsPerSecond: 48000 } : { audioBitsPerSecond: 48000 };
        mediaRecorder = new MediaRecorder(stream, options);
      } catch (e) {
        console.warn("MediaRecorder creation with preferred options failed, falling back to basic setup:", e);
        try {
          const simpleOptions = mimeType ? { mimeType } : undefined;
          mediaRecorder = new MediaRecorder(stream, simpleOptions);
        } catch (err2) {
          console.warn("MediaRecorder creation with mimeType failed, falling back to complete default:", err2);
          mediaRecorder = new MediaRecorder(stream);
        }
      }

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      isSilenceTimeoutRef.current = false;

      // Setup AudioContext for silence detection & VU Meter in a safe, non-blocking try-catch block
      let sourceNode: MediaStreamAudioSourceNode | null = null;
      try {
        let audioContext = audioContextRef.current;
        if (!audioContext || audioContext.state === 'closed') {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          audioContext = new AudioContextClass();
          audioContextRef.current = audioContext;
        }
        
        // Resume context if suspended (common in some browsers)
        if (audioContext.state === 'suspended') {
          await audioContext.resume();
        }

        // Final check for AudioContext state
        if (audioContext.state !== 'running') {
          try {
            await audioContext.resume();
          } catch (e) {
            console.error("Failed to resume AudioContext:", e);
          }
        }

        console.log("AudioContext state:", audioContext.state);

        sourceNode = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        sourceNode.connect(analyser);
        analyserRef.current = analyser;
        silenceStartRef.current = Date.now();

        const checkSilence = () => {
          if (!analyserRef.current || !mediaStreamRef.current || !mediaStreamRef.current.active) {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
            return;
          }
          
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);
          
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const average = sum / dataArray.length;
          
          if (average > 1.5) { // Further lowered threshold for sound
            silenceStartRef.current = Date.now();
          } else {
            if (silenceStartRef.current && Date.now() - silenceStartRef.current > 30000) {
              isSilenceTimeoutRef.current = true;
              if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                mediaRecorderRef.current.stop();
              }
              return;
            }
          }

          animationFrameRef.current = requestAnimationFrame(checkSilence);
        };
        
        checkSilence();
      } catch (audioCtxError) {
        console.warn("Non-blocking issue setting up AudioContext, proceeding with standard audio recording:", audioCtxError);
      }

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const actualMimeType = mediaRecorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: actualMimeType });
        
        // Cleanup
        stream.getTracks().forEach(track => track.stop());
        try {
          if (sourceNode) {
            sourceNode.disconnect();
          }
        } catch (e) {
          console.warn("Source already disconnected");
        }
        
        analyserRef.current = null;
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
        
        setRecordingStartTime(null);
        
        if (isSilenceTimeoutRef.current) {
          isSilenceTimeoutRef.current = false;
          handleRestart();
        } else {
          await handleAudioProcessing(audioBlob);
        }
      };

      mediaRecorder.start(1000); // Send data every second for better reliability on mobile
      setAppState('RECORDING');
      setRecordingStartTime(Date.now());
    } catch (err) {
      console.error("Error accessing microphone:", err);
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      const isInIframe = window.self !== window.top;
      
      if (isInIframe) {
        setError("L'accesso al microfono è bloccato perché l'app è aperta dentro un'altra finestra. Per favore, clicca sul pulsante 'APRI IN NUOVA SCHEDA' in alto a destra per farlo funzionare.");
      } else if (isIOS) {
        setError("Impossibile accedere al microfono. Controlla in Impostazioni -> Safari/Chrome -> Microfono e assicurati che sia attivo per questo sito.");
      } else {
        setError("Permesso negato. Clicca sull'icona del lucchetto nella barra degli indirizzi e imposta il Microfono su 'Consenti', poi ricarica la pagina.");
      }
      setAppState('DOMANDA');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
  };

  const handleAudioProcessing = async (audioBlob: Blob, retryCount = 0) => {
    console.log(`Processing audio blob (attempt ${retryCount + 1}):`, audioBlob.size, "bytes", audioBlob.type);
    lastAudioBlobRef.current = audioBlob;
    
    let sessionId = processingSessionRef.current;
    if (retryCount === 0) {
      sessionId = crypto.randomUUID();
      processingSessionRef.current = sessionId;
    }
    
    setAppState('ELABORAZIONE');
    setError(null);
    setProcessingProgress(retryCount > 0 ? 20 : 0);
    setProcessingText(retryCount > 0 ? "Nuovo tentativo in corso..." : "Analisi dell'audio...");
    
    // Check if the blob is too small (likely silent or error)
    // Increased threshold to 4000 bytes to filter out more invalid/empty recordings
    if (audioBlob.size < 4000) {
      console.warn("Audio blob too small, skipping processing:", audioBlob.size);
      if (processingIntervalRef.current) window.clearInterval(processingIntervalRef.current);
      
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      const isInIframe = window.self !== window.top;
      
      if (isIOS && isInIframe) {
        setError("Il microfono non ha registrato nulla. Su iPad l'app deve essere aperta in una NUOVA SCHEDA per funzionare correttamente.");
        setAppState('DOMANDA');
      } else {
        setAppState('SILENCE');
      }
      return;
    }

    if (processingIntervalRef.current) {
      window.clearInterval(processingIntervalRef.current);
    }
    processingIntervalRef.current = window.setInterval(() => {
      setProcessingProgress(prev => {
        // Much faster visual progress to match optimized processing
        let increment = 1;
        if (prev < 40) increment = Math.random() * 8 + 6; // Very fast at beginning
        else if (prev < 70) increment = Math.random() * 5 + 3; // Fast in middle
        else if (prev < 90) increment = Math.random() * 2 + 1; // Medium 
        else increment = Math.random() * 0.5 + 0.2; // Slow near the end but not too slow
        
        const next = prev + increment;
        if (retryCount === 0) {
          if (next > 30 && prev <= 30) setProcessingText("Trascrizione in corso...");
          if (next > 60 && prev <= 60) setProcessingText("Traduzione in italiano...");
          if (next > 85 && prev <= 85) setProcessingText("Comprensione contesto...");
        } else {
          if (next > 50 && prev <= 50) setProcessingText("Elaborazione avanzata...");
          if (next > 80 && prev <= 80) setProcessingText("Quasi completato...");
        }
        return next > 95 ? 95 : next;
      });
    }, 500);

    let controller: AbortController | null = null;
    try {
      // Opt-in: we skip local WAV conversion to significantly speed up processing time. Gemini understands WebM natively.
      let processedBlob = audioBlob;
      let processedMimeType = audioBlob.type || 'audio/webm';

      // Cancel any ongoing processing
      if (processAbortControllerRef.current) {
        processAbortControllerRef.current.abort();
      }
      
      controller = new AbortController();
      processAbortControllerRef.current = controller;
      const signal = controller.signal;

      const base64String = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        
        const onAbort = () => {
          reader.abort();
          reject(new Error("Aborted"));
        };
        signal.addEventListener('abort', onAbort);

        reader.onloadend = () => {
          signal.removeEventListener('abort', onAbort);
          const base64data = reader.result as string;
          if (typeof base64data === 'string') {
            resolve(base64data.split(',')[1]);
          } else {
            reject(new Error("Failed to read audio blob as base64"));
          }
        };
        reader.onerror = () => {
          signal.removeEventListener('abort', onAbort);
          reject(reader.error);
        };
        reader.readAsDataURL(processedBlob);
      });
      
      if (currentQuestion) {
        // Timeout esplicito molto lungo (120 secondi) per dare tempo a Gemini di processare file grandi o gestire periodi di congestione
        const timeoutPromise = new Promise<never>((_, reject) => {
          const timer = setTimeout(() => {
            controller?.abort();
            reject(new Error("TIMEOUT"));
          }, 120000);
          
          signal.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new Error("Aborted"));
          });
        });

        const testimony = await Promise.race([
          processAudioTestimony(base64String, processedMimeType, currentQuestion.it, signal),
          timeoutPromise
        ]);
        
        if (processingSessionRef.current !== sessionId) {
          if (processingIntervalRef.current) window.clearInterval(processingIntervalRef.current);
          return;
        }

        // Enrich the testimony with precise client-side translations to achieve maximum speed, accuracy, and offline-readiness
        const detectedLangLabel = (testimony.lingua_originale || "").toUpperCase().trim();
        const foundLang = getLanguagesPool().find(l => 
          l.label.toUpperCase() === detectedLangLabel || 
          l.labelNative.toUpperCase() === detectedLangLabel ||
          l.id.toUpperCase() === detectedLangLabel
        );
        const resolvedLangId = foundLang ? foundLang.id : selectedLanguage;
        const langTrans = UI_TRANSLATIONS[resolvedLangId] || UI_TRANSLATIONS[selectedLanguage] || UI_TRANSLATIONS.en;
        
        const enrichedTestimony: TestimonyResult = {
          ...testimony,
          domanda_proposta: currentQuestion.it,
          domanda_proposta_lingua_originale: currentQuestion[resolvedLangId as any] || 
                                             dynamicTranslations[`${currentQuestion.id}_${resolvedLangId}`] || 
                                             currentQuestion[selectedLanguage as any] ||
                                             dynamicTranslations[`${currentQuestion.id}_${selectedLanguage}`] ||
                                             testimony.domanda_proposta_lingua_originale ||
                                             currentQuestion.it,
          etichetta_parola_chiave_lingua_originale: getKeywordTranslation(resolvedLangId),
          invito_altra_domanda_lingua_originale: langTrans.changeQuestionPrompt || "Vuoi rispondere a un'altra domanda?",
          no_grazie_lingua_originale: langTrans.noThanksButton || "No grazie"
        };

        // Basic silence detection: if transcription is empty or just punctuation
        const isSilent = !enrichedTestimony.trascrizione_originale || 
                        enrichedTestimony.trascrizione_originale.trim().length < 2 ||
                        /^[\s.,!?;:]+$/.test(enrichedTestimony.trascrizione_originale) ||
                        enrichedTestimony.trascrizione_originale.includes('INCOMPRENSIBILE');

        if (isSilent) {
          if (processingIntervalRef.current) window.clearInterval(processingIntervalRef.current);
          setAppState('SILENCE');
          return;
        }

        // Save to archive
        const testimonyId = crypto.randomUUID();
        const savedTestimony: SavedTestimony = {
          ...enrichedTestimony,
          id: testimonyId,
          date: new Date().toISOString(),
          audioId: testimonyId,
          category: currentQuestion.category
        };
        
        setArchive(prevArchive => {
          const newArchive = [savedTestimony, ...prevArchive];
          localStorage.setItem('testimonies_archive', JSON.stringify(newArchive));
          return newArchive;
        });
        
        // Save audio to IndexedDB
        await saveAudio(testimonyId, audioBlob);

        if (processingIntervalRef.current) window.clearInterval(processingIntervalRef.current);
        setProcessingProgress(100);
        setProcessingText("Completato!");

        setTimeout(() => {
          if (processingSessionRef.current === sessionId) {
            setResult(savedTestimony);
            setAppState('RISPOSTA');
          }
        }, 500);
      } else {
        handleRestart();
      }
    } catch (err: any) {
      if (processingIntervalRef.current) window.clearInterval(processingIntervalRef.current);
      
      const errorMessage = err instanceof Error ? err.message : String(err);
      const isAbortError = err.name === 'AbortError' || 
                          errorMessage.toLowerCase().includes('aborted') || 
                          errorMessage.toLowerCase().includes('signal is aborted') ||
                          errorMessage.toLowerCase().includes('without reason');

      if (isAbortError || processingSessionRef.current !== sessionId) {
        // Silent ignore
        console.log("Processing aborted silently.");
        return;
      }

      console.error("Error processing audio:", err);
      
      const isConfigError = errorMessage.toLowerCase().includes("chiave api") || 
                            errorMessage.toLowerCase().includes("api key") || 
                            errorMessage.toLowerCase().includes("secret") || 
                            errorMessage.toLowerCase().includes("configurat");

      const isQuotaError = errorMessage.includes("429") || 
                           errorMessage.toLowerCase().includes("quota exceeded") || 
                           errorMessage.toLowerCase().includes("resource_exhausted");

      // Riprova automatica una volta se fallisce o va in timeout, MA NON se è un errore di configurazione/API key o Quota
      if (retryCount < 1 && !isConfigError && !isQuotaError) {
        console.log("Retrying audio processing...");
        handleAudioProcessing(audioBlob, retryCount + 1);
        return;
      }

      if (isConfigError) {
        setError(errorMessage);
      } else if (isQuotaError) {
        setError("Hai esaurito la quota gratuita di richieste API per oggi. Attendi oppure configura la tua chiave API personale nel menu Impostazioni in alto a destra per continuare senza limiti.");
      } else if (errorMessage === 'TIMEOUT') {
        setError(selectedLanguage ? UI_TRANSLATIONS[selectedLanguage].timeoutError : "L'elaborazione sta impiegando troppo tempo. Riprova.");
      } else {
        setError(selectedLanguage ? UI_TRANSLATIONS[selectedLanguage].processingError : "Si è verificato un errore durante l'elaborazione.");
      }
      // Stay in PROCESSING state but show error and retry button
    } finally {
      if (processAbortControllerRef.current === controller) {
        processAbortControllerRef.current = null;
      }
    }
  };

  const updateArchiveItem = (id: string, updates: Partial<SavedTestimony>) => {
    setArchive(prev => {
      const newArchive = prev.map(item => item.id === id ? { ...item, ...updates } : item);
      localStorage.setItem('testimonies_archive', JSON.stringify(newArchive));
      return newArchive;
    });
  };

  const handleRestoreBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setRestoreFile(file);
    setShowRestoreModal(true);
    // Reset input so it triggers again if same file selected
    event.target.value = '';
  };

  const confirmRestore = async (overwrite: boolean) => {
    if (!restoreFile) return;
    setShowRestoreModal(false);
    setIsRestoring(true);
    
    try {
      await restoreArchiveBackup(restoreFile, overwrite);
      
      // Reload archive
      const saved = localStorage.getItem('testimonies_archive');
      if (saved) {
        setArchive(JSON.parse(saved));
      }
      setArchivePage(1);
      
      // Refresh audio count after import
      await refreshAudioCount();

      showToast(overwrite ? "Archivio sovrascritto con successo!" : "Archivio unito con successo!", 'success');
    } catch (e) {
      console.error("Failed to restore backup:", e);
      showToast("Errore nel ripristino dell'archivio.", 'error');
    } finally {
      setIsRestoring(false);
      setRestoreFile(null);
    }
  };

  const handleSaveBackup = async () => {
    if (archive.length === 0) {
      showToast("Nessuna testimonianza da salvare.", 'error');
      return;
    }

    setIsBackingUp(true);
    try {
      const blob = await createArchiveBackup();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const date = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `backup_testimoni_botta_e_risposta_${date}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast("Backup creato con successo!", 'success');
    } catch (e) {
      console.error("Failed to create backup:", e);
      showToast("Errore nella creazione del backup.", 'error');
    } finally {
      setIsBackingUp(false);
    }
  };

  const closeArchive = () => {
    setSelectedArchiveItem(null);
    setQuestionChangeCount(0);
    // If we have a language, go to HOME (language selection), otherwise to ONBOARDING
    setAppState(selectedLanguage ? 'HOME' : 'ONBOARDING');
  };

  const handleRestart = () => {
    cleanupAudioResources();
    setAppState('ONBOARDING');
    setSelectedLanguage(null);
    setCurrentQuestion(null);
    setResult(null);
    setError(null);
    setSelectedArchiveItem(null);
    setQuestionChangeCount(0);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleDownloadExcel = () => {
    const data = questions.map((q) => ({
      ID: q.id,
      Categoria: q.category,
      Italiano: q.it,
      Inglese: q.en,
      Francese: q.fr,
      Arabo: q.ar,
      Bengalese: q.bn,
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Domande');

    XLSX.writeFile(workbook, 'domande_botta_e_risposta.xlsx');
  };

  const exportArchiveToExcel = () => {
    const data = archive.map(item => ({
      Data: new Date(item.date).toLocaleString('it-IT'),
      Domanda: item.domanda_proposta,
      'Lingua Originale': item.lingua_originale,
      Trascrizione: item.trascrizione_originale,
      Traduzione: item.traduzione_italiano,
      'Parola Chiave': item.parola_chiave,
      Preferito: item.favorite ? 'Sì' : 'No'
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Archivio');

    XLSX.writeFile(workbook, 'archivio_testimonianze.xlsx');
  };

  const isKioskMode = ['ONBOARDING', 'HOME', 'DOMANDA', 'RECORDING', 'SILENCE', 'ELABORAZIONE', 'RISPOSTA'].includes(appState);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-x-hidden overflow-y-auto print:p-0 print:block print:min-h-0 print:overflow-visible select-none">
      {/* iPad/Iframe Warning Banner */}
      {(() => {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        const isInIframe = window.self !== window.top;
        if (isIOS && isInIframe) {
          return (
            <div className="fixed top-0 left-0 w-full bg-amber-500 text-white px-4 py-3 text-[10px] md:text-xs font-bold text-center z-[10000] flex items-center justify-center gap-2 shadow-lg uppercase tracking-widest">
              <AlertCircle className="w-4 h-4" />
              <span>Su iPad il microfono funziona solo in una NUOVA SCHEDA. Clicca "Apri in nuova scheda" in alto a destra.</span>
            </div>
          );
        }
        return null;
      })()}

      {/* Bottom Progress Bar for Recording - REMOVED */}

      {/* Mobile Portrait Warning for Studio */}
      {appState === 'STUDIO' && (
        <div className="fixed inset-0 z-[99999] bg-bg-main flex-col items-center justify-center p-6 text-center flex sm:hidden landscape:hidden">
          <RotateCcw className="w-16 h-16 text-primary mb-6 -rotate-90 animate-[spin_2s_ease-in-out_infinite]" />
          <h2 className="text-2xl font-serif font-bold text-primary mb-4 leading-tight">Ruota il dispositivo</h2>
          <p className="text-text-secondary text-sm">
            Lo Studio di Regia richiede molto spazio orizzontale per mostrare le tracce audio in modo ottimale. <br/><br/>
            Per favore, <strong>ruota il tuo telefono in orizzontale</strong> per continuare.
          </p>
        </div>
      )}

      {/* Secret tap area for archive */}
      {(appState === 'ONBOARDING' || appState === 'HOME' || appState === 'DOMANDA' || appState === 'RISPOSTA') && (
        <div 
          className="absolute top-0 right-0 w-32 h-32 z-[9999] cursor-default" 
          onPointerDown={handleSecretTap}
        />
      )}

      {/* Home Button */}
      {appState !== 'ONBOARDING' && (
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={() => {
            setAppState('ONBOARDING');
            setSelectedLanguage(null);
            setResult(null);
            setError(null);
          }}
          className="absolute top-4 left-4 z-[1001] p-2 bg-white backdrop-blur-md rounded-full shadow-2xl border border-white/40 text-olive hover:bg-white hover:scale-110 transition-all group ring-1 ring-black/5"
          title="Torna alla Home"
        >
          <Home className="w-4 h-4" />
          <span className="absolute left-full ml-3 px-2 py-1 bg-ink text-white text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap uppercase tracking-widest">
            Home
          </span>
        </motion.button>
      )}

      {/* Decorative background elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-olive/5 blur-3xl print:hidden" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-olive/5 blur-3xl print:hidden" />

      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -50, x: '-50%' }}
            className={`fixed top-8 left-1/2 z-[9999] px-6 py-3 rounded-full shadow-xl flex items-center gap-3 ${
              toastMessage.type === 'error' ? 'bg-state-error text-white' : 'bg-state-success text-white'
            }`}
          >
            <span className="font-medium text-sm">{toastMessage.message}</span>
            <button onClick={() => setToastMessage(null)} className="p-1 hover:bg-white/20 rounded-full transition-colors">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Restore Confirmation Modal */}
      <AnimatePresence>
        {showRestoreModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[1000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[32px] p-8 md:p-10 max-w-lg w-full shadow-2xl flex flex-col gap-6"
            >
              <div className="flex items-center gap-4 text-accent">
                <div className="p-3 bg-accent/10 rounded-2xl">
                  <Upload className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-serif font-bold text-primary italic">Ripristino Archivio</h3>
              </div>
              
              <div className="space-y-4">
                <p className="text-ink/70 leading-relaxed">
                  Hai selezionato un file di backup. Come vuoi procedere con le testimonianze e le impostazioni presenti?
                </p>
                <div className="bg-bg-main/50 p-4 rounded-2xl border border-ink/5 space-y-2">
                  <p className="text-xs font-bold text-ink/40 uppercase tracking-widest">Opzioni:</p>
                  <ul className="text-sm text-ink/60 space-y-1">
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" />
                      <span><strong>Sovrascrivi</strong>: Cancella tutto quello che vedi ora e carica solo il backup.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                      <span><strong>Unisci</strong>: Aggiungi le tracce del backup a quelle già presenti.</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                <button
                  onClick={() => confirmRestore(true)}
                  className="w-full py-4 bg-accent text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-lg shadow-accent/20 hover:scale-[1.02] active:scale-95 transition-all"
                >
                  Sovrascrivi
                </button>
                <button
                  onClick={() => confirmRestore(false)}
                  className="w-full py-4 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
                >
                  Unisci Tracce
                </button>
                <button
                   onClick={() => {
                    setShowRestoreModal(false);
                    setRestoreFile(null);
                  }}
                  className="md:col-span-2 w-full py-3 bg-bg-main text-ink/40 rounded-2xl font-bold text-[10px] uppercase tracking-widest hover:text-ink/60 transition-all border border-ink/5"
                >
                  Annulla operazione
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showClearConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-[3000] flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl text-center"
            >
              <div className="w-16 h-16 bg-state-error/10 text-state-error rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-8 h-8" />
              </div>
              <h3 className="font-serif text-2xl mb-4 text-ink">Svuota Archivio?</h3>
              <p className="text-ink/60 mb-8">
                Sei sicuro di voler cancellare tutte le testimonianze? Questa azione non può essere annullata.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1 px-6 py-3 rounded-full border border-ink/10 text-ink font-medium hover:bg-warm-bg transition-colors"
                >
                  Annulla
                </button>
                <button
                  onClick={clearArchive}
                  className="flex-1 px-6 py-3 rounded-full bg-state-error text-white font-medium hover:bg-state-error/90 transition-colors shadow-lg shadow-state-error/20"
                >
                  Sì, Svuota
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showClearNonFavoritesConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-[3000] flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl text-center"
            >
              <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <StarOff className="w-8 h-8" />
              </div>
              <h3 className="font-serif text-2xl mb-4 text-ink">Svuota non preferiti?</h3>
              <p className="text-ink/60 mb-8">
                Sei sicuro di voler cancellare tutte le testimonianze tranne quelle contrassegnate come preferite?
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setShowClearNonFavoritesConfirm(false)}
                  className="flex-1 px-6 py-3 rounded-full border border-ink/10 text-ink font-medium hover:bg-warm-bg transition-colors"
                >
                  Annulla
                </button>
                <button
                  onClick={clearNonFavorites}
                  className="flex-1 px-6 py-3 rounded-full bg-amber-600 text-white font-medium hover:bg-amber-700 transition-colors shadow-lg shadow-amber-600/20"
                >
                  Sì, Svuota
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {testimonyToDelete && appState !== 'ARCHIVIO' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-[3000] flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl text-center"
            >
              <div className="w-16 h-16 bg-state-error/10 text-state-error rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-8 h-8" />
              </div>
              <h3 className="font-serif text-2xl mb-4 text-ink">Elimina Testimonianza?</h3>
              <p className="text-ink/60 mb-8">
                Sei sicuro di voler cancellare questa testimonianza? Questa azione non può essere annullata.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setTestimonyToDelete(null)}
                  className="flex-1 px-6 py-3 rounded-full border border-ink/10 text-ink font-medium hover:bg-warm-bg transition-colors"
                >
                  No, annulla
                </button>
                <button
                  onClick={confirmDeleteTestimony}
                  className="flex-1 px-6 py-3 rounded-full bg-state-error text-white font-medium hover:bg-state-error/90 transition-colors shadow-lg shadow-state-error/20"
                >
                  Sì, cancella
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Modal Overlay to Edit Cartolina Texts */}
        {testimonyToEdit && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-ink/60 backdrop-blur-md z-[3000] flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-white rounded-[32px] border border-ink/5 shadow-2xl p-6 md:p-8 max-w-2xl w-full space-y-6 my-8"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center pb-4 border-b border-ink/10">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-olive/10 text-olive rounded-2xl">
                    <Edit2 className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-xl font-serif font-extrabold text-primary italic">Modifica Testi Cartolina</h3>
                    <p className="text-xs text-ink/50 mt-0.5">Modifica i testi prima di salvare o esportare in PDF</p>
                  </div>
                </div>
                <button 
                  onClick={() => setTestimonyToEdit(null)}
                  className="p-2 hover:bg-bg-main rounded-full text-ink/40 hover:text-ink transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                {/* original language dropdown or info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5 col-span-2 sm:col-span-1">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-ink/50">Lingua Originale</label>
                    <input 
                      type="text"
                      value={testimonyToEdit.lingua_originale || ''}
                      onChange={(e) => setTestimonyToEdit({ ...testimonyToEdit, lingua_originale: e.target.value })}
                      className="w-full bg-[#f8f6f2] border border-ink/10 rounded-xl px-4 py-2.5 font-sans text-sm outline-none focus:border-olive"
                      placeholder="es. Giapponese, Inglese"
                    />
                  </div>
                  {/* Category */}
                  <div className="space-y-1.5 col-span-2 sm:col-span-1">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-ink/50">Tempo / Categoria</label>
                    <select
                      value={testimonyToEdit.category || ''}
                      onChange={(e) => setTestimonyToEdit({ ...testimonyToEdit, category: e.target.value })}
                      className="w-full bg-[#f8f6f2] border border-ink/10 rounded-xl px-4 py-2.5 font-sans text-sm outline-none focus:border-olive appearance-none"
                    >
                      <option value="Passato">Passato</option>
                      <option value="Presente">Presente</option>
                      <option value="Futuro">Futuro</option>
                    </select>
                  </div>
                </div>

                {/* DOMANDE */}
                <div className="space-y-3 pt-2 border-t border-ink/5">
                  <h4 className="text-xs font-black uppercase tracking-wider text-accent">Le Domande Proposte</h4>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-black uppercase tracking-widest text-ink/50">Domanda (Italiano)</label>
                      <textarea
                        value={testimonyToEdit.domanda_proposta || ''}
                        onChange={(e) => setTestimonyToEdit({ ...testimonyToEdit, domanda_proposta: e.target.value })}
                        className="w-full bg-[#f8f6f2] border border-ink/10 rounded-xl px-4 py-2 font-sans text-sm outline-none focus:border-olive h-16 resize-y"
                      />
                    </div>
                    {testimonyToEdit.lingua_originale?.toLowerCase() !== 'italiano' && (
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-black uppercase tracking-widest text-ink/50">Domanda ({testimonyToEdit.lingua_originale || 'Lingua Originale'})</label>
                        <textarea
                          value={testimonyToEdit.domanda_proposta_lingua_originale || ''}
                          onChange={(e) => setTestimonyToEdit({ ...testimonyToEdit, domanda_proposta_lingua_originale: e.target.value })}
                          className="w-full bg-[#f8f6f2] border border-ink/10 rounded-xl px-4 py-2 font-sans text-sm outline-none focus:border-olive h-16 resize-y"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* TESTI CONTENUTO */}
                <div className="space-y-3 pt-2 border-t border-ink/5">
                  <h4 className="text-xs font-black uppercase tracking-wider text-accent">I Testi di Risposta</h4>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-black uppercase tracking-widest text-ink/50">Traduzione (Italiano)</label>
                      <textarea
                        value={testimonyToEdit.traduzione_italiano || ''}
                        onChange={(e) => setTestimonyToEdit({ ...testimonyToEdit, traduzione_italiano: e.target.value })}
                        className="w-full bg-[#f8f6f2] border border-ink/10 rounded-xl px-4 py-3 font-sans text-sm outline-none focus:border-olive min-h-[90px] h-24 resize-y leading-relaxed"
                      />
                    </div>
                    {testimonyToEdit.lingua_originale?.toLowerCase() !== 'italiano' && (
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-black uppercase tracking-widest text-ink/50">Trascrizione Originale ({testimonyToEdit.lingua_originale || 'Lingua Originale'})</label>
                        <textarea
                          value={testimonyToEdit.trascrizione_originale || ''}
                          onChange={(e) => setTestimonyToEdit({ ...testimonyToEdit, trascrizione_originale: e.target.value })}
                          className="w-full bg-[#f8f6f2] border border-ink/10 rounded-xl px-4 py-3 font-sans text-sm outline-none focus:border-olive min-h-[90px] h-24 resize-y leading-relaxed"
                          dir="auto"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* PAROLE CHIAVE */}
                <div className="space-y-3 pt-2 border-t border-ink/5">
                  <h4 className="text-xs font-black uppercase tracking-wider text-accent">Le Parole Chiave</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5 col-span-2 sm:col-span-1">
                      <label className="block text-[10px] font-black uppercase tracking-widest text-ink/50">Parola Chiave (Italiano)</label>
                      <input 
                        type="text"
                        value={testimonyToEdit.parola_chiave || ''}
                        onChange={(e) => setTestimonyToEdit({ ...testimonyToEdit, parola_chiave: e.target.value })}
                        className="w-full bg-[#f8f6f2] border border-ink/10 rounded-xl px-4 py-2.5 font-sans text-sm outline-none focus:border-olive"
                      />
                    </div>
                    {testimonyToEdit.lingua_originale?.toLowerCase() !== 'italiano' && (
                      <div className="space-y-1.5 col-span-2 sm:col-span-1">
                        <label className="block text-[10px] font-black uppercase tracking-widest text-ink/50">Parola Chiave ({testimonyToEdit.lingua_originale || 'Lingua Originale'})</label>
                        <input 
                          type="text"
                          value={testimonyToEdit.parola_chiave_lingua_originale || ''}
                          onChange={(e) => setTestimonyToEdit({ ...testimonyToEdit, parola_chiave_lingua_originale: e.target.value })}
                          className="w-full bg-[#f8f6f2] border border-ink/10 rounded-xl px-4 py-2.5 font-sans text-sm outline-none focus:border-olive"
                          dir="auto"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-ink/10 flex gap-3">
                <button
                  onClick={() => setTestimonyToEdit(null)}
                  className="flex-1 py-3.5 bg-warm-bg hover:bg-ink/5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all text-ink/70 text-center"
                >
                  Annulla
                </button>
                <button
                  onClick={() => {
                    updateTestimony(testimonyToEdit);
                    setTestimonyToEdit(null);
                  }}
                  className="flex-1 py-3.5 bg-olive hover:bg-olive-dark text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-md text-center animate-pulse"
                >
                  Salva Modifiche
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {appState === 'ONBOARDING' && (
          <motion.div
            key="onboarding"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#f5f5f5] flex flex-col items-center justify-start z-[100] p-4 pb-6 overflow-y-auto md:p-8"
          >
            {/* Area invisibile per attivare il cerca con 5 click veloci nell'angolo in alto a sinistra */}
            <div 
              id="secret-corner-search-trigger"
              onClick={handleCornerClick}
              className="absolute top-0 left-0 w-24 h-24 z-[105] cursor-default bg-transparent"
              title="Attiva ricerca nascosta"
            />

            {/* Campo Cerca discretizzato in alto a sinistra, visibile solo se sbloccato */}
            {searchBoxVisible && (
              <div id="home-language-search-wrapper" className="absolute top-4 left-4 md:top-6 md:left-8 z-[110] w-[140px] sm:w-[180px] md:w-[220px] transition-all">
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-accent/60">
                    <Search className="w-3.5 h-3.5" />
                  </span>
                  <input
                    ref={searchInputRef}
                    id="home-language-search-input"
                    type="text"
                    value={langSearchQuery}
                    onChange={(e) => setLangSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setSearchBoxVisible(false);
                      }
                    }}
                    placeholder="Cerca lingua o paese..."
                    className="w-full bg-white text-primary placeholder-primary/35 border border-ink/10 hover:border-olive/30 focus:border-olive rounded-full pl-8 pr-7 py-1 md:py-1.5 text-[10px] md:text-xs outline-none transition-all shadow-sm focus:shadow-md font-sans font-medium"
                  />
                  {langSearchQuery && (
                    <button
                      id="home-language-clear-search"
                      onClick={() => setLangSearchQuery("")}
                      className="absolute inset-y-0 right-0 flex items-center pr-2 text-ink/35 hover:text-ink transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="w-full max-w-6xl flex flex-col items-center gap-2 md:gap-4 lg:gap-6 min-h-0 w-full flex-1 pb-12">
              <WordCloudGreeting />
              
              <div className="flex-1 w-full overflow-y-auto px-2 md:px-4 pb-20 md:pb-12 scrollbar-thin flex justify-center">
                {(() => {
                  const filteredLangs = LANGUAGES_CONFIG.filter(lang => enabledLanguages.includes(lang.id)).filter(lang => {
                    if (!langSearchQuery) return true;
                    const q = langSearchQuery.toLowerCase().trim();
                    const matchesBasic = lang.label.toLowerCase().includes(q) || 
                           lang.labelNative.toLowerCase().includes(q) ||
                           lang.id.toLowerCase().includes(q);
                    if (matchesBasic) return true;
                    if (lang.countries && Array.isArray(lang.countries)) {
                      return lang.countries.some((c: string) => c.toLowerCase().includes(q));
                    }
                    return false;
                  });

                  if (filteredLangs.length === 0) {
                    return (
                      <div id="no-filtered-languages" className="text-center py-12 px-4 space-y-3">
                        <p className="text-base md:text-lg font-serif font-bold text-primary max-w-md mx-auto leading-normal">
                          Nessuna lingua trovata per "<span className="text-olive">{langSearchQuery}</span>"
                        </p>
                        <p className="text-[10px] md:text-xs text-ink/40 tracking-wider uppercase font-black">
                          Prova con un altro nome o ripulisci il filtro
                        </p>
                        <button
                          id="no-filtered-languages-reset"
                          onClick={() => setLangSearchQuery("")}
                          className="px-5 py-2 bg-white border border-ink/10 rounded-full hover:bg-ink/5 mt-2 transition-all text-[10px] font-black uppercase tracking-widest cursor-pointer text-primary"
                        >
                          Ripristina Ricerca
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 max-w-5xl gap-3 md:gap-4 lg:gap-5 w-full">
                      {filteredLangs.map((lang, idx) => (
                        <motion.button
                          key={lang.id}
                          initial={{ opacity: 0, scale: 0.8, y: 20 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          transition={{ delay: 0.03 * idx, duration: 0.3 }}
                          onClick={() => { setSelectedLanguage(lang.id); setAppState('HOME'); setLangSearchQuery(""); }}
                          className="flex flex-col items-center group cursor-pointer"
                        >
                          <div className="w-full max-w-[70px] sm:max-w-[90px] md:max-w-[110px] lg:max-w-[125px] aspect-[3/2] mb-1.5 md:mb-2 rounded-xl overflow-hidden shadow-institutional group-hover:shadow-xl group-hover:scale-105 transition-all duration-300 ring-1 ring-black/5">
                            <FlagIcon lang={lang.id} />
                          </div>
                          
                          {/* Support level indicator dot */}
                          <div className="flex items-center gap-1 -mt-[4px] md:-mt-2 mb-1.5 md:mb-2 px-2 py-0.5 rounded-full bg-[#fcfbfa] border border-ink/5" title={
                            LANGUAGE_SUPPORT[lang.id] === 'high' 
                              ? 'Affidabilità Traduzione: Alta'
                              : LANGUAGE_SUPPORT[lang.id] === 'medium'
                              ? 'Affidabilità Traduzione: Media'
                              : 'Affidabilità Traduzione: Sperimentale / Bassa'
                          }>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              LANGUAGE_SUPPORT[lang.id] === 'high' 
                                ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)]' 
                                : LANGUAGE_SUPPORT[lang.id] === 'medium'
                                ? 'bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.7)]'
                                : 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.7)]'
                            }`} />
                            <span className="text-[6px] md:text-[8px] font-mono tracking-widest text-ink/40 font-black uppercase leading-none">
                              {lang.id}
                            </span>
                          </div>

                          <div className="flex flex-col items-center w-full">
                            <div className="h-6 md:h-8 lg:h-9 flex items-center justify-center text-center">
                              <span className={`font-sans font-black text-xs sm:text-xs md:text-md lg:text-lg text-primary tracking-tight md:tracking-normal leading-none ${['ar', 'fa', 'ur', 'ps'].includes(lang.id) ? 'text-xs md:text-lg' : ''}`}>
                                {lang.labelNative}
                              </span>
                            </div>
                            <div className="h-3 flex items-center justify-center text-center">
                              <span className="font-sans font-medium text-[6.5px] md:text-[8.5px] text-accent uppercase tracking-[0.05em] md:tracking-[0.12em] leading-none">
                                {lang.label}
                              </span>
                            </div>
                            {lang.countriesDisplay && (
                              <div className="mt-0.5 flex flex-wrap justify-center gap-0.5 max-w-[90px] sm:max-w-[110px] md:max-w-[130px] min-h-[12px]">
                                <span className="text-[6px] md:text-[8px] text-[#A29E91] font-semibold tracking-tight leading-tight text-center italic opacity-90">
                                  {lang.countriesDisplay.join(', ')}
                                </span>
                              </div>
                            )}
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
          </motion.div>
        )}

        {['HOME', 'DOMANDA', 'RECORDING', 'SILENCE', 'ELABORAZIONE'].includes(appState) && (
          <motion.div
            key="main-interaction"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className={`w-full max-w-5xl bg-white rounded-[32px] shadow-xl p-5 md:p-8 lg:p-10 z-10 flex flex-col items-center text-center transition-all duration-500 min-h-[50vh] lg:min-h-[70vh] justify-between ${appState === 'RECORDING' ? 'border-2 border-red-100' : 'border-2 border-transparent'}`}
          >
            {/* TEXT AREA */}
            <div className="flex-1 flex flex-col items-center justify-center w-full py-4 md:py-6">
              <AnimatePresence mode="wait">
                {appState === 'HOME' && selectedLanguage && (
                  <motion.div
                    key="home-text"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="flex flex-col items-center justify-center h-full relative w-full"
                  >
                    <h2 
                      className="font-serif text-2xl md:text-5xl font-bold text-olive text-center max-w-2xl leading-tight"
                      dir={UI_TRANSLATIONS[selectedLanguage].dir}
                    >
                      {UI_TRANSLATIONS[selectedLanguage].greeting.replace('{language}', UI_TRANSLATIONS[selectedLanguage].languageName)}
                    </h2>
                  </motion.div>
                )}

                {(appState === 'DOMANDA' || appState === 'RECORDING') && currentQuestion && selectedLanguage && (
                  <motion.div
                    key="question-text"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="w-full flex flex-col h-full justify-center items-center text-center"
                  >
                    <div className="flex-1 flex flex-col justify-center items-center">
                      <h2 
                        className="font-serif text-3xl sm:text-4xl md:text-5xl lg:text-6xl mb-4 leading-tight font-bold text-primary"
                        dir={UI_TRANSLATIONS[selectedLanguage].dir}
                      >
                        {currentQuestion[selectedLanguage as any] || 
                         dynamicTranslations[`${currentQuestion.id}_${selectedLanguage}`] || 
                         currentQuestion.it}
                      </h2>
                      {selectedLanguage !== 'it' && (
                        <>
                          {/* Sottile linea di pochi pixel colorata come livello di supporto */}
                          <div 
                            className={`h-[3px] w-12 my-5 rounded-full ${
                              LANGUAGE_SUPPORT[selectedLanguage] === 'high' 
                                ? 'bg-emerald-500/80 shadow-[0_0_4px_rgba(16,185,129,0.3)]' 
                                : LANGUAGE_SUPPORT[selectedLanguage] === 'medium'
                                ? 'bg-amber-400/80 shadow-[0_0_4px_rgba(245,158,11,0.3)]'
                                : 'bg-rose-500/80 shadow-[0_0_4px_rgba(244,63,94,0.3)]'
                            }`}
                            title={
                              LANGUAGE_SUPPORT[selectedLanguage] === 'high' 
                                ? 'Traduzione Altamente Affidabile' 
                                : LANGUAGE_SUPPORT[selectedLanguage] === 'medium'
                                ? 'Traduzione Affidabile' 
                                : 'Traduzione Sperimentale / Bassa'
                            }
                          />
                          <h3 className="font-serif text-lg sm:text-xl md:text-2xl lg:text-3xl mb-8 md:mb-12 leading-tight font-bold text-accent italic">
                            {currentQuestion.it}
                          </h3>
                        </>
                      )}
                      <div className="mt-4">
                        <p 
                          className="font-serif text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-primary via-primary-light to-accent bg-clip-text text-transparent pb-2"
                          dir={UI_TRANSLATIONS[selectedLanguage].dir}
                        >
                          {UI_TRANSLATIONS[selectedLanguage].nativeLanguagePrompt}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}

                {appState === 'SILENCE' && selectedLanguage && (
                  <motion.div
                    key="silence-text"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="flex flex-col items-center justify-center h-full text-center"
                  >
                    <div className="w-20 h-20 bg-olive/10 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Mic className="w-10 h-10 text-olive opacity-40" />
                    </div>
                    <h3 
                      className="font-serif text-3xl md:text-4xl text-ink font-bold leading-tight"
                      dir={UI_TRANSLATIONS[selectedLanguage].dir}
                    >
                      {UI_TRANSLATIONS[selectedLanguage].audioTooLowError}
                    </h3>
                  </motion.div>
                )}

                {appState === 'ELABORAZIONE' && selectedLanguage && (
                  <motion.div
                    key="processing-text"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-6"
                  >
                    {!error ? (
                      <>
                        <Loader2 className="w-16 h-16 mx-auto mb-8 text-olive animate-spin" />
                        <h3 
                          className="font-serif text-3xl mb-8 font-bold"
                          dir={UI_TRANSLATIONS[selectedLanguage].dir}
                        >
                          {UI_TRANSLATIONS[selectedLanguage].processingTitle}
                        </h3>
                        <div className="space-y-3 text-ink/60 font-serif flex flex-col items-center">
                          <p 
                            className="text-2xl md:text-3xl font-bold text-ink leading-tight mb-4"
                            dir={UI_TRANSLATIONS[selectedLanguage].dir}
                          >
                            {UI_TRANSLATIONS[selectedLanguage].processingText}
                          </p>
                        </div>
                      </>
                    ) : (
                      <div className="space-y-6">
                        <X className="w-12 h-12 mx-auto mb-6 text-state-error" />
                        <h3 
                          className="font-serif text-3xl md:text-4xl text-ink font-bold leading-tight"
                          dir={UI_TRANSLATIONS[selectedLanguage].dir}
                        >
                          {error}
                        </h3>
                        <div className="flex flex-col gap-4 items-center mt-8">
                          <button
                            onClick={() => lastAudioBlobRef.current && handleAudioProcessing(lastAudioBlobRef.current)}
                            className="bg-accent text-white px-8 py-4 rounded-full font-bold text-xl hover:bg-accent-light transition-colors shadow-lg flex items-center gap-3"
                          >
                            <RefreshCcw className="w-6 h-6" />
                            {UI_TRANSLATIONS[selectedLanguage].tryAgainButton}
                          </button>
                          <button
                            onClick={() => setAppState('DOMANDA')}
                            className="text-ink/60 hover:text-ink transition-colors font-medium"
                          >
                            {selectedLanguage === 'it' ? 'Torna alla domanda' : 'Back to question'}
                          </button>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* BUTTON AREA */}
            <div className="flex flex-col items-center justify-center w-full shrink-0">
              <div className="relative flex items-center justify-center w-80 h-80 scale-90 md:scale-100 select-none">
                {/* Circular Progress (Scale slightly larger than button) */}
                {appState === 'RECORDING' && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none md:scale-110">
                    <div className="relative w-80 h-80">
                      {/* SVG Circle progress */}
                      <svg className="absolute inset-0 w-full h-full -rotate-90">
                        <circle cx="160" cy="160" r="145" fill="none" stroke="currentColor" strokeWidth="4" className="text-ink/5" />
                        <motion.circle 
                          cx="160" cy="160" r="145" 
                          fill="none" stroke="currentColor" strokeWidth="12" 
                          pathLength="100" 
                          strokeDasharray="100"
                          animate={{ strokeDashoffset: 100 - (recordingTime / MAX_RECORDING_TIME) * 100 }}
                          transition={{ duration: 0.1, ease: "linear" }}
                          className="text-state-recording" 
                          strokeLinecap="round" 
                        />
                      </svg>
                    </div>
                  </div>
                )}

                {/* Main Button */}
                <button
                  onClick={() => {
                    if (appState === 'HOME') handleStart();
                    else if (appState === 'DOMANDA') startRecording();
                    else if (appState === 'RECORDING') stopRecording();
                    else if (appState === 'SILENCE') setAppState('DOMANDA');
                    else if (appState === 'ELABORAZIONE' && error && lastAudioBlobRef.current) handleAudioProcessing(lastAudioBlobRef.current);
                  }}
                  disabled={appState === 'ELABORAZIONE' && !error}
                  className={`relative rounded-full w-[180px] h-[180px] md:w-[252px] md:h-[252px] flex flex-col items-center justify-center shadow-institutional transition-all duration-300 hover:scale-105 active:scale-95 z-10
                    ${appState === 'RECORDING' ? 'bg-ink shadow-[0_0_80px_rgba(214,158,46,0.3)]' : 
                      appState === 'DOMANDA' ? 'bg-accent hover:bg-accent-light shadow-[0_0_50px_rgba(214,158,46,0.4)]' : 
                      'bg-primary hover:bg-primary-light shadow-[0_0_50px_rgba(26,54,93,0.4)]'}
                    ${(appState === 'ELABORAZIONE' && !error) ? 'cursor-not-allowed opacity-80' : 'opacity-100'}
                  `}
                  aria-label={appState === 'RECORDING' ? "Termina registrazione" : "Tocca per rispondere"}
                >
                  <AnimatePresence mode="wait">
                    {appState === 'HOME' && selectedLanguage && (
                      <motion.div key="home-btn" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-3">
                        <Pointer className="w-16 h-16 text-white" strokeWidth={1.5} />
                        <span className="text-sm font-semibold uppercase tracking-widest text-white px-4 text-center">
                          {UI_TRANSLATIONS[selectedLanguage].readyButton}
                        </span>
                      </motion.div>
                    )}
                    {appState === 'DOMANDA' && (
                      <motion.div key="mic-btn" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-2">
                        <Mic className="w-16 h-16 text-white" strokeWidth={1.5} />
                      </motion.div>
                    )}
                      {appState === 'RECORDING' && (
                        <motion.div key="rec-digital" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="flex flex-col items-center justify-center">
                          <div className="flex items-center gap-1.5 px-3 py-1 bg-state-recording/10 rounded-full border border-state-recording/20 mb-4 scale-75">
                            <div className="w-1.5 h-1.5 rounded-full bg-state-recording animate-pulse" />
                            <span className="text-[10px] font-bold text-state-recording tracking-widest uppercase">Recording</span>
                          </div>
                          
                          <AudioWaveform analyser={analyserRef.current} isRecording={appState === 'RECORDING'} />

                          {selectedLanguage && (
                            <span className={`font-black text-white uppercase tracking-widest mb-4 mt-2 transition-all duration-300 ${isSpecialScript(selectedLanguage) ? 'text-5xl md:text-6xl pt-2' : 'text-3xl md:text-4xl'}`}>
                              {UI_TRANSLATIONS[selectedLanguage].stopButton}
                            </span>
                          )}

                          <div className="flex items-baseline font-mono text-2xl md:text-3xl font-black text-state-recording/60 tabular-nums leading-none">
                            <span className="text-sm opacity-30 mr-1">-</span>
                            {Math.max(0, Math.ceil(MAX_RECORDING_TIME - recordingTime))}
                            <span className="text-sm ml-1 opacity-30">S</span>
                          </div>
                        </motion.div>
                      )}
                    {appState === 'SILENCE' && selectedLanguage && (
                      <motion.div key="retry-btn" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-2">
                        <RefreshCcw className="w-16 h-16 text-white" />
                        <span className="text-sm font-semibold uppercase tracking-widest text-white px-4 text-center">
                          {UI_TRANSLATIONS[selectedLanguage].tryAgainButton}
                        </span>
                      </motion.div>
                    )}
                    {appState === 'ELABORAZIONE' && error && selectedLanguage && (
                      <motion.div key="error-retry-btn" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-2">
                        <RefreshCcw className="w-16 h-16 text-white" />
                        <span className="text-sm font-semibold uppercase tracking-widest text-white px-4 text-center">
                          {UI_TRANSLATIONS[selectedLanguage].tryAgainButton}
                        </span>
                      </motion.div>
                    )}
                    {appState === 'ELABORAZIONE' && !error && (
                      <motion.div key="loading-btn" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center w-full h-full relative">
                        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                          <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="4" />
                          <motion.circle 
                            cx="50" cy="50" r="46" 
                            fill="none" stroke="white" strokeWidth="4" 
                            strokeDasharray="289"
                            animate={{ strokeDashoffset: 289 - (289 * processingProgress) / 100 }}
                            transition={{ duration: 0.5, ease: "easeOut" }}
                            strokeLinecap="round"
                          />
                        </svg>
                        <div className="flex flex-col items-center gap-2 z-10">
                          <span className="text-3xl font-bold text-white">{Math.round(processingProgress)}%</span>
                          <span className="text-[10px] font-medium uppercase tracking-widest text-white/80 text-center px-6 leading-tight">{processingText}</span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </button>
              </div>

              {/* Secondary Actions Area */}
              <div className="flex flex-col items-center justify-center min-h-[100px] md:min-h-[120px] w-full px-4 mb-2">
                {appState === 'DOMANDA' && (
                  <>
                    {selectedLanguage && questionChangeCount < 2 && (
                      <motion.button
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          const currentCat = currentQuestion ? currentQuestion.category : getNextCategory();
                          setCurrentQuestion(getRandomQuestionFromActive(currentCat));
                          setQuestionChangeCount(prev => prev + 1);
                        }}
                        className={`text-ink/40 hover:text-olive transition-colors px-4 py-1 mb-2 ${isSpecialScript(selectedLanguage) ? 'text-3xl font-bold not-italic' : 'font-serif italic text-lg'}`}
                        dir={UI_TRANSLATIONS[selectedLanguage].dir}
                      >
                        {questionChangeCount === 0 
                          ? UI_TRANSLATIONS[selectedLanguage].changeQuestionPrompt 
                          : UI_TRANSLATIONS[selectedLanguage].changeQuestionLastPrompt}
                      </motion.button>
                    )}
                  </>
                )}
                {appState === 'RECORDING' && selectedLanguage && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center gap-3 w-full max-w-md mx-auto"
                  >
                    <div className="flex flex-col items-center text-center gap-1">
                      <p 
                        className={`font-serif text-xl md:text-2xl font-bold bg-gradient-to-r from-state-recording/90 to-amber-500 bg-clip-text text-transparent pb-0.5`}
                        dir={UI_TRANSLATIONS[selectedLanguage].dir}
                      >
                        {RECORDING_STATUS_TRANSLATIONS[selectedLanguage]?.native || "Registrazione in corso..."}
                      </p>
                      {selectedLanguage !== 'it' && (
                        <p className="font-serif text-[11px] sm:text-[12px] md:text-xs font-semibold text-accent/85 italic">
                          ({RECORDING_STATUS_TRANSLATIONS[selectedLanguage]?.it || "Registrazione in corso... Ti stiamo ascoltando"})
                        </p>
                      )}
                    </div>
                    <VuMeter analyser={analyserRef.current} isRecording={appState === 'RECORDING'} />
                  </motion.div>
                )}
                {(appState === 'SILENCE' || (appState === 'ELABORAZIONE' && error)) && selectedLanguage && (
                  <button 
                    onClick={handleRestart} 
                    className={`text-ink/40 hover:text-ink transition-colors uppercase tracking-widest font-bold ${isSpecialScript(selectedLanguage) ? 'text-2xl' : 'text-sm'}`}
                  >
                    {UI_TRANSLATIONS[selectedLanguage].noThanksButton}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {appState === 'STUDIO' && (
          <Studio 
            initialTracks={studioTracks} 
            onBack={() => setAppState('ARCHIVIO')} 
            onUpdateTrack={(id, updates) => {
              updateArchiveItem(id, updates);
              setStudioTracks(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
            }}
            onReorderTracks={(newOrder) => {
              setArchive(newOrder);
              setStudioTracks(newOrder);
              localStorage.setItem('testimonies_archive', JSON.stringify(newOrder));
            }}
          />
        )}

        {appState === 'ADMIN' && (
          <motion.div
            key="admin-panel"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="fixed inset-0 bg-[#f7f6f2] z-[2000] overflow-y-auto"
          >
            <AdminPanel
              activeQuestions={activeQuestions}
              onUpdateActiveQuestions={setActiveQuestions}
              enabledLanguages={enabledLanguages}
              onUpdateEnabledLanguages={setEnabledLanguages}
              questionArchives={questionArchives}
              onUpdateQuestionArchives={setQuestionArchives}
              originalQuestions={questions}
              onBack={() => setAppState('ARCHIVIO')}
              onActivityInProgressChange={setIsAdminActivityInProgress}
              archive={archive}
              onEditTestimony={(item) => setTestimonyToEdit(item)}
              onUpdateTestimony={updateTestimony}
              onViewTestimony={(item) => {
                setSelectedArchiveItem(item);
                setAppState('ARCHIVIO');
              }}
              onDeleteTestimony={deleteTestimony}
              onToggleFavoriteTestimony={toggleFavorite}
            />
          </motion.div>
        )}

        {appState === 'ARCHIVIO' && (
          <motion.div
            key="archive"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="w-full max-w-5xl bg-white rounded-[32px] shadow-xl p-6 md:p-12 z-10 print:h-auto print:shadow-none print:p-0 print:rounded-none print:block"
          >
            {selectedArchiveItem ? (
              <div className="flex flex-col h-full overflow-hidden">
                <div className="flex justify-between items-center mb-6 pb-4 border-b border-ink/5 shrink-0 print:hidden">
                  <button
                    onClick={() => setSelectedArchiveItem(null)}
                    className="text-ink/30 hover:text-olive flex items-center gap-2 text-sm font-medium tracking-wide transition-colors"
                  >
                    <ArrowRight className="w-4 h-4 rotate-180" />
                    Torna all'Archivio
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto print:overflow-visible print:h-auto flex items-start justify-center p-6">
                  <div className="w-full max-w-5xl relative mt-12">
                    <div className="absolute -top-12 right-0 flex items-center gap-3 print:hidden z-30">
                      <AnimatePresence>
                        {testimonyToDelete === selectedArchiveItem.id && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.8, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.8, y: 10 }}
                            className="absolute right-12 -top-2 bg-white rounded-2xl shadow-xl border border-ink/10 p-3 flex flex-col items-center gap-2 z-50 min-w-[120px]"
                          >
                            <span className="text-[10px] font-bold uppercase tracking-wider text-ink/40">Eliminare?</span>
                            <div className="flex gap-2 w-full">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  confirmDeleteTestimony();
                                }}
                                className="flex-1 py-1.5 bg-state-success text-white rounded-lg text-[10px] font-bold hover:bg-state-success/90 transition-colors uppercase"
                              >
                                Sì
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setTestimonyToDelete(null);
                                }}
                                className="flex-1 py-1.5 bg-state-error text-white rounded-lg text-[10px] font-bold hover:bg-state-error/90 transition-colors uppercase"
                              >
                                No
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <button 
                        onClick={() => setSelectedArchiveItem(null)}
                        className="p-3 bg-white rounded-full shadow-md text-olive hover:bg-warm-bg transition-colors flex items-center justify-center"
                        title="Torna all'archivio"
                      >
                        <div className="flex flex-col items-center justify-center -space-y-0.5">
                          <ArrowLeft className="w-5 h-5" />
                          <span className="text-[8px] font-bold uppercase pointer-events-none">Back</span>
                        </div>
                      </button>
                      {selectedArchiveItem.audioId && (
                        <>
                          <PlayAudioIcon 
                            audioId={selectedArchiveItem.audioId} 
                            className="p-3 bg-white rounded-full shadow-md text-olive hover:bg-warm-bg transition-colors flex items-center justify-center"
                            onError={(msg) => showToast(msg, 'error')}
                          />
                          <button 
                            onClick={(e) => downloadAudioFile(selectedArchiveItem.audioId!, selectedArchiveItem.parola_chiave, e)}
                            className="p-3 bg-white rounded-full shadow-md hover:bg-warm-bg transition-colors text-ink/40 hover:text-olive flex items-center justify-center"
                            title="Scarica Audio WAV"
                          >
                            <div className="flex flex-col items-center justify-center -space-y-0.5">
                              <Download className="w-5 h-5" />
                              <span className="text-[8px] font-bold uppercase pointer-events-none">WAV</span>
                            </div>
                          </button>
                        </>
                      )}
                      <button 
                        onClick={(e) => downloadSingleCard(selectedArchiveItem, e)}
                        className="p-3 bg-white rounded-full shadow-md hover:bg-warm-bg transition-colors text-ink/40 hover:text-olive flex items-center justify-center"
                        title="Scarica PDF"
                      >
                        <div className="flex flex-col items-center justify-center -space-y-0.5">
                          <Download className="w-5 h-5" />
                          <span className="text-[8px] font-bold uppercase pointer-events-none">PDF</span>
                        </div>
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setTestimonyToEdit(selectedArchiveItem);
                        }}
                        className="p-3 bg-white rounded-full shadow-md hover:bg-warm-bg transition-colors text-ink/40 hover:text-olive flex items-center justify-center cursor-pointer"
                        title="Modifica Testi"
                      >
                        <div className="flex flex-col items-center justify-center -space-y-0.5">
                          <Edit2 className="w-5 h-5 text-olive animate-pulse" />
                          <span className="text-[8px] font-bold uppercase pointer-events-none">Edita</span>
                        </div>
                      </button>
                      <button 
                        onClick={(e) => deleteTestimony(selectedArchiveItem.id, e)}
                        className="p-3 bg-white rounded-full shadow-md hover:bg-warm-bg transition-colors text-ink/40 hover:text-red-500 flex items-center justify-center"
                        title="Elimina"
                      >
                        <Trash2 className="w-7 h-7" />
                      </button>
                      <button 
                        onClick={(e) => toggleFavorite(selectedArchiveItem.id, e)}
                        className={`p-3 rounded-full shadow-md transition-all hover:scale-110 active:scale-95 flex items-center justify-center ${selectedArchiveItem.favorite ? 'bg-accent-light' : 'bg-white hover:bg-warm-bg'}`}
                        title="Preferito"
                      >
                        <Star className={`w-7 h-7 ${selectedArchiveItem.favorite ? 'fill-accent text-accent' : 'text-ink/30'}`} />
                      </button>
                    </div>
                    
                    <div 
                      onClick={() => setSelectedArchiveItem(null)}
                      className="cursor-pointer hover:opacity-95 transition-opacity"
                    >
                      <TestimonyPrintPreview item={selectedArchiveItem} />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-col pb-4 border-b border-ink/10 shrink-0 pl-10 md:pl-0">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <h2 className="font-serif text-4xl md:text-5xl text-olive">Archivio Voci</h2>
                    </div>
                    <div className="flex items-center gap-3 w-full md:w-auto shrink-0 justify-end">
                      <button
                        onClick={() => setAppState('ADMIN')}
                        className="bg-olive hover:bg-olive-dark text-white rounded-full px-5 py-2.5 text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 shadow-md cursor-pointer hover:scale-105 active:scale-95"
                      >
                        <Settings className="w-4 h-4" />
                        Pannello Gestione Domande & Lingue
                      </button>
                      <button
                        onClick={closeArchive}
                        className="p-3 bg-warm-bg hover:bg-ink hover:text-white rounded-full transition-colors shrink-0 cursor-pointer"
                        aria-label="Chiudi archivio"
                      >
                        <X className="w-6 h-6" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="overflow-y-auto flex-1 pr-4 space-y-6 pt-6">
                  {/* Action Buttons moved here to scroll with postcards */}
                  {archive.length > 0 && (
                    <div className="flex flex-col gap-4 mb-8">
                      <div className="w-full flex justify-end">
                         <button
                           onClick={() => {
                             setStudioTracks([...archive]);
                             setAppState('STUDIO');
                           }}
                           className="bg-indigo-600 text-white hover:bg-indigo-700 rounded-full px-6 py-2.5 text-sm font-bold uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg hover:scale-105 active:scale-95"
                         >
                           <Music className="w-4 h-4" />
                           Apri Studio Regia (Mix Musicale)
                         </button>
                      </div>
                      
                      <div className="flex flex-wrap items-center justify-end gap-3">
                        <div className="flex flex-wrap items-center gap-2 bg-olive/5 p-2 rounded-2xl md:rounded-full border border-olive/10">
                          <button
                            onClick={handleSaveBackup}
                            disabled={isBackingUp || archive.length === 0}
                            className="flex-1 md:flex-none justify-center bg-primary text-white hover:bg-primary-light rounded-full px-4 py-2.5 text-[10px] md:text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-2 disabled:opacity-50 shadow-sm"
                          >
                            {isBackingUp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                            <span className="whitespace-nowrap">Salva Archivio</span>
                          </button>
                          <div className="relative flex-1 md:flex-none">
                            <input
                              type="file"
                              accept=".zip"
                              onChange={handleRestoreBackup}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
                              disabled={isRestoring}
                            />
                            <button
                              className="w-full bg-accent text-white hover:bg-accent-light rounded-full px-4 py-2.5 text-[10px] md:text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
                              disabled={isRestoring}
                            >
                              {isRestoring ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                              <span className="whitespace-nowrap">Carica Archivio</span>
                            </button>
                          </div>
                          <div className="hidden md:block w-px h-6 bg-olive/20 mx-1" />
                          <button
                            onClick={downloadAllAsPdf}
                            disabled={isDownloadingAll || isDownloadingAllCombined || isDownloadingBusinessCards || archive.length === 0}
                            className="flex-1 md:flex-none justify-center bg-white text-olive border border-olive/20 hover:bg-olive hover:text-white rounded-full px-4 py-2.5 text-[10px] md:text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-2 disabled:opacity-50 shadow-sm"
                            title="Scarica tutte le cartoline come file PDF singoli racchiusi in un file ZIP"
                          >
                            {isDownloadingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                            <span className="whitespace-nowrap">PDF Singoli (ZIP)</span>
                          </button>
                          <button
                            onClick={downloadAllAsSingleCombinedPdf}
                            disabled={isDownloadingAll || isDownloadingAllCombined || isDownloadingBusinessCards || archive.length === 0}
                            className="flex-1 md:flex-none justify-center bg-white text-olive border border-olive/20 hover:bg-olive hover:text-white rounded-full px-4 py-2.5 text-[10px] md:text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-2 disabled:opacity-50 shadow-sm"
                            title="Scarica un unico documento PDF contenente tutte le cartoline (una per pagina)"
                          >
                            {isDownloadingAllCombined ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BookOpen className="w-3.5 h-3.5" />}
                            <span className="whitespace-nowrap">PDF Unico</span>
                          </button>
                          <button
                            onClick={downloadAllAsBusinessCardsPdf}
                            disabled={isDownloadingAll || isDownloadingAllCombined || isDownloadingBusinessCards || archive.length === 0}
                            className="flex-1 md:flex-none justify-center bg-white text-olive border border-olive/20 hover:bg-olive hover:text-white rounded-full px-4 py-2.5 text-[10px] md:text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-2 disabled:opacity-50 shadow-sm"
                            title="Scarica un unico documento PDF con biglietti da visita A6 Fronte/Retro alternati"
                          >
                            {isDownloadingBusinessCards ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <IdCard className="w-3.5 h-3.5" />}
                            <span className="whitespace-nowrap">Biglietti Visita (A6)</span>
                          </button>
                          <button
                            onClick={exportArchiveToExcel}
                            disabled={archive.length === 0}
                            className="flex-1 md:flex-none justify-center bg-white text-olive border border-olive/20 hover:bg-olive hover:text-white rounded-full px-4 py-2.5 text-[10px] md:text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5" />
                            <span className="whitespace-nowrap">Excel</span>
                          </button>
                          <button
                            onClick={handleDownloadWavIntegrali}
                            disabled={isGeneratingTappeto || archive.length === 0}
                            className="flex-1 md:flex-none justify-center bg-white text-blue-600 border border-blue-200 hover:bg-blue-600 hover:text-white rounded-full px-4 py-2.5 text-[10px] md:text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-2 disabled:opacity-50 shadow-sm"
                          >
                            {isGeneratingTappeto 
                              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {Math.round(tappetoProgress)}%</>
                              : <><FileArchive className="w-3.5 h-3.5" /> <span className="whitespace-nowrap">WAV Integrali</span></>
                            }
                          </button>
                        </div>

                        <div className="flex items-center gap-2 bg-warm-bg p-1.5 rounded-full border border-ink/5">
                          <button
                            onClick={() => setShowClearConfirm(true)}
                            className="bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-2"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Elimina tutto
                          </button>
                          <button
                            onClick={() => setShowClearNonFavoritesConfirm(true)}
                            className="bg-amber-50 text-amber-700 hover:bg-amber-600 hover:text-white rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-2"
                          >
                            <StarOff className="w-3.5 h-3.5" />
                            elimina tutto NO preferiti
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {archive.length === 0 ? (
                    <div className="text-center text-ink/50 py-20 h-full flex flex-col items-center justify-center">
                      <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-20" />
                      <p className="text-xl font-serif">Nessuna testimonianza ancora registrata.</p>
                    </div>
                  ) : (
                    <>
                      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {[...archive].sort((a, b) => {
                            if (a.favorite && !b.favorite) return -1;
                            if (!a.favorite && b.favorite) return 1;
                            return new Date(b.date).getTime() - new Date(a.date).getTime();
                          })
                          .slice((archivePage - 1) * ARCHIVE_PAGE_SIZE, archivePage * ARCHIVE_PAGE_SIZE)
                          .map((item) => (
                            <div 
                              key={item.id} 
                              className="bg-warm-bg rounded-2xl p-6 border border-ink/5 hover:shadow-md transition-shadow flex flex-col group relative overflow-hidden transform-gpu"
                            >
                            {/* INLINE DELETE CONFIRMATION */}
                            <AnimatePresence>
                              {testimonyToDelete === item.id && (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.8 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={{ opacity: 0, scale: 0.8 }}
                                  className="absolute top-4 right-12 bg-white rounded-2xl shadow-xl border border-ink/10 p-3 flex flex-col items-center gap-2 z-50 min-w-[120px]"
                                >
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-ink/40">Eliminare?</span>
                                  <div className="flex gap-2 w-full">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        confirmDeleteTestimony();
                                      }}
                                      className="flex-1 py-1.5 bg-state-success text-white rounded-lg text-[10px] font-bold hover:bg-state-success/90 transition-colors uppercase"
                                    >
                                      Sì
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setTestimonyToDelete(null);
                                      }}
                                      className="flex-1 py-1.5 bg-state-error text-white rounded-lg text-[10px] font-bold hover:bg-state-error/90 transition-colors uppercase"
                                    >
                                      No
                                    </button>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>

                            <div className="flex flex-col gap-3 mb-4">
                              <div className="flex justify-between items-start gap-2">
                                <span className="font-serif text-2xl italic text-olive font-bold break-words flex-1">{item.parola_chiave}</span>
                                <div className="flex gap-2">
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedArchiveItem(item);
                                    }}
                                    className="p-3 bg-primary text-white rounded-full hover:bg-primary-light transition-all shadow-lg hover:scale-110 active:scale-95 flex items-center justify-center group/pdf z-40"
                                    title="Anteprima PDF"
                                  >
                                    <Search className="w-6 h-6" />
                                  </button>
                                </div>
                              </div>
                              <div className="flex flex-nowrap items-center justify-end gap-1.5 shrink-0 z-30">
                                {item.audioId && (
                                  <>
                                    <PlayAudioIcon 
                                      audioId={item.audioId} 
                                      onError={(msg) => showToast(msg, 'error')} 
                                      iconSize="w-[24px] h-[24px]"
                                    />
                                    <button 
                                      onClick={(e) => downloadAudioFile(item.audioId!, item.parola_chiave, e)}
                                      className="p-2 bg-white/50 rounded-full hover:bg-white transition-colors text-ink/40 hover:text-olive cursor-pointer pointer-events-auto flex items-center justify-center"
                                      title="Scarica Audio WAV"
                                    >
                                      <div className="flex flex-col items-center justify-center -space-y-0.5">
                                        <Download className="w-[18px] h-[18px]" />
                                        <span className="text-[7px] font-bold uppercase pointer-events-none">WAV</span>
                                      </div>
                                    </button>
                                  </>
                                )}
                                <button 
                                  onClick={(e) => downloadSingleCard(item, e)}
                                  className="p-2 bg-white/50 rounded-full hover:bg-white transition-colors text-ink/40 hover:text-olive cursor-pointer pointer-events-auto flex items-center justify-center"
                                  title="Scarica PDF"
                                >
                                  <div className="flex flex-col items-center justify-center -space-y-0.5">
                                    <Download className="w-[18px] h-[18px]" />
                                    <span className="text-[7px] font-bold uppercase pointer-events-none">PDF</span>
                                  </div>
                                </button>
                                <button 
                                  onClick={(e) => deleteTestimony(item.id, e)}
                                  className="p-2 bg-white/50 rounded-full hover:bg-white transition-colors text-ink/40 hover:text-red-500 cursor-pointer pointer-events-auto flex items-center justify-center"
                                  title="Elimina"
                                >
                                  <Trash2 className="w-[24px] h-[24px]" />
                                </button>
                                <button 
                                  onClick={(e) => toggleFavorite(item.id, e)}
                                  className={`p-2 rounded-full transition-all cursor-pointer pointer-events-auto flex items-center justify-center ${item.favorite ? 'bg-accent-light' : 'bg-white/50 hover:bg-white'}`}
                                  title="Preferito"
                                >
                                  <Star className={`w-[24px] h-[24px] ${item.favorite ? 'fill-accent text-accent' : 'text-ink/30'}`} />
                                </button>
                              </div>
                            </div>
                          
                            <div className="mb-4">
                              <span className="text-xs font-semibold uppercase tracking-widest text-olive/70 bg-olive/10 px-3 py-1 rounded-full inline-block mb-3">
                                {getNiceLanguageLabel(item.lingua_originale)}
                              </span>
                              <p className="font-serif text-lg text-ink/60 italic line-clamp-2 font-bold">
                                {item.domanda_proposta}
                              </p>
                            </div>

                          <p className="font-serif text-lg leading-relaxed text-ink mb-2 flex-1 line-clamp-3 font-bold">
                            "{item.traduzione_italiano}"
                          </p>
                          
                          <div className="pt-4 border-t border-ink/10 flex justify-between items-center mt-auto">
                            <span className="text-xs font-medium text-ink/40 uppercase tracking-wider">
                              {new Date(item.date).toLocaleDateString('it-IT')}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {archive.length > ARCHIVE_PAGE_SIZE && (
                      <div className="flex items-center justify-center gap-4 mt-8 pb-4">
                        <button
                          onClick={() => setArchivePage(prev => Math.max(1, prev - 1))}
                          disabled={archivePage === 1}
                          className="p-3 bg-white border border-ink/10 rounded-full disabled:opacity-30 hover:bg-warm-bg transition-colors shadow-sm"
                        >
                          <ArrowRight className="w-5 h-5 rotate-180" />
                        </button>
                        <div className="flex items-center gap-1">
                          {Array.from({ length: Math.ceil(archive.length / ARCHIVE_PAGE_SIZE) }, (_, i) => (
                            <button
                              key={i}
                              onClick={() => setArchivePage(i + 1)}
                              className={`w-8 h-8 rounded-full text-xs font-bold transition-all ${archivePage === i + 1 ? 'bg-olive text-white shadow-md' : 'bg-white text-ink/40 hover:bg-warm-bg'}`}
                            >
                              {i + 1}
                            </button>
                          ))}
                        </div>
                        <button
                          onClick={() => setArchivePage(prev => Math.min(Math.ceil(archive.length / ARCHIVE_PAGE_SIZE), prev + 1))}
                          disabled={archivePage === Math.ceil(archive.length / ARCHIVE_PAGE_SIZE)}
                          className="p-3 bg-white border border-ink/10 rounded-full disabled:opacity-30 hover:bg-warm-bg transition-colors shadow-sm"
                        >
                          <ArrowRight className="w-5 h-5" />
                        </button>
                      </div>
                    )}
                    </>
                  )}
                  <div className="mt-8 pt-6 border-t border-ink/5 flex flex-wrap gap-6 items-center justify-between text-[10px] uppercase tracking-widest font-bold text-ink/30">
                    <div className="flex gap-6 items-center">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-olive animate-pulse"></span>
                        {audioInDBCount !== null ? `${audioInDBCount} File Audio` : 'Analisi Audio...'}
                      </div>
                      
                      {storageInfo && (
                        <div className="flex items-center gap-3">
                          <div className="w-24 h-1.5 bg-ink/5 rounded-full overflow-hidden">
                            <div 
                              className={`h-full transition-all duration-500 ${
                                (storageInfo.usage / storageInfo.quota) > 0.8 ? 'bg-red-400' : 'bg-olive/40'
                              }`}
                              style={{ width: `${Math.min(100, (storageInfo.usage / storageInfo.quota) * 100)}%` }}
                            />
                          </div>
                          <span>
                            {(storageInfo.usage / (1024 * 1024)).toFixed(1)}MB / {(storageInfo.quota / (1024 * 1024 * 1024)).toFixed(1)}GB
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}

        {appState === 'RISPOSTA' && result && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-5xl bg-white rounded-[32px] shadow-xl p-5 md:p-8 lg:p-10 z-10 flex flex-col relative"
          >
            {/* DOMANDA */}
            <div className="text-center mb-6 md:mb-8 flex flex-col justify-center items-center gap-2">
              <h3 className="font-serif text-2xl md:text-3.5xl lg:text-4xl text-primary leading-tight w-full font-bold" dir="auto">
                {result.domanda_proposta_lingua_originale || result.domanda_proposta}
              </h3>
              <h4 className="font-serif text-md md:text-lg lg:text-xl text-primary-light leading-tight w-full font-medium">
                {result.domanda_proposta}
              </h4>
            </div>

            {/* TRADUZIONE & TRASCRIZIONE */}
            {result.lingua_originale?.toLowerCase() === 'italiano' ? (
              <div className="mb-8 md:mb-10 max-w-lg mx-auto">
                <span className="uppercase tracking-widest text-[10px] font-semibold text-accent block mb-3 border-b border-ink/10 pb-2">
                  Italiano
                </span>
                <p className="font-serif text-lg md:text-xl lg:text-2xl font-bold leading-relaxed text-accent text-left">
                  "{result.traduzione_italiano}"
                </p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-6 md:gap-10 mb-8 md:mb-10">
                <div>
                  <span className="uppercase tracking-widest text-[10px] font-semibold text-primary block mb-3 border-b border-ink/10 pb-2">
                    {getNiceLanguageLabel(result.lingua_originale)}
                  </span>
                  <p className="font-serif text-lg md:text-xl lg:text-2xl font-medium leading-relaxed text-primary" dir="auto">
                    "{result.trascrizione_originale}"
                  </p>
                </div>
                <div>
                  <span className="uppercase tracking-widest text-[10px] font-semibold text-accent block mb-3 border-b border-ink/10 pb-2">
                    Italiano
                  </span>
                  <p className="font-serif text-lg md:text-xl lg:text-2xl font-bold leading-relaxed text-accent">
                    "{result.traduzione_italiano}"
                  </p>
                </div>
              </div>
            )}

            {/* PAROLA CHIAVE */}
            <div className="flex justify-center items-center mb-8 md:mb-10 border-t border-ink/10 pt-4 h-24 relative">
              <AnimatePresence mode="wait">
                {!showOriginalLang ? (
                  <motion.div
                    key="kw-it"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1 }}
                    className="absolute text-center w-full"
                  >
                    <span className="uppercase tracking-widest text-[10px] font-semibold text-accent block mb-1">
                      Parola Chiave
                    </span>
                    <span className="font-serif text-2xl md:text-3.5xl lg:text-4xl italic text-accent font-bold">
                      {result.parola_chiave}
                    </span>
                  </motion.div>
                ) : (
                  <motion.div
                    key="kw-orig"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1 }}
                    className="absolute text-center w-full"
                    dir="auto"
                  >
                    <span className="uppercase tracking-widest text-[10px] font-semibold text-primary block mb-1">
                      {result.etichetta_parola_chiave_lingua_originale || 'Parola Chiave'}
                    </span>
                    <span className="font-serif text-2xl md:text-3.5xl lg:text-4xl italic font-medium text-primary leading-tight">
                      {result.parola_chiave_lingua_originale || result.parola_chiave}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* AZIONI CARTOLINA (EDIT & DOWNLOAD) RIMOSSE */}

            {/* BOTTONI */}
            <div className="flex flex-row justify-center items-center mt-8 mb-2 gap-6">
              <motion.button
                animate={{
                  scale: [1, 1.05, 1],
                  boxShadow: [
                    "0px 0px 30px rgba(214,158,46,0.3)",
                    "0px 0px 45px rgba(214,158,46,0.5)",
                    "0px 0px 30px rgba(214,158,46,0.3)"
                  ]
                }}
                transition={{
                  duration: 2.5,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  const nextCat = getNextCategory();
                  setCurrentQuestion(getRandomQuestionFromActive(nextCat));
                  localStorage.setItem('last_question_category', nextCat);
                  setAppState('DOMANDA');
                  setResult(null);
                  setError(null);
                }}
                className="bg-olive text-white hover:bg-olive-dark rounded-full w-[150px] h-[150px] md:w-[180px] md:h-[180px] flex flex-col items-center justify-center p-4 text-center gap-1.5"
                aria-label="Rispondi a un'altra domanda"
              >
                <span className="font-serif text-sm md:text-lg font-bold leading-tight" dir="auto">
                  {result.invito_altra_domanda_lingua_originale || "Vuoi rispondere a un'altra domanda?"}
                </span>
                <span className="font-serif text-[10px] md:text-xs opacity-75 leading-tight font-medium">
                  Vuoi rispondere a un'altra domanda?
                </span>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  handleRestart();
                }}
                className="bg-white border-2 border-olive/20 text-olive hover:bg-olive/5 rounded-full w-28 h-28 md:w-32 md:h-32 flex flex-col items-center justify-center p-3 text-center gap-1 shadow-lg"
                aria-label="No grazie, torna alla home"
              >
                <span className="font-serif text-sm md:text-base font-bold leading-tight" dir="auto">
                  {result.no_grazie_lingua_originale || "No grazie"}
                </span>
                <span className="font-serif text-[9px] md:text-xs opacity-75 leading-tight font-medium">
                  No grazie
                </span>
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
