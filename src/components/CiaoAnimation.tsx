import React, { useMemo } from 'react';
import { motion } from 'motion/react';

const CIAO_TRANSLATIONS = [
  { text: 'Ciao', lang: 'it' },
  { text: 'Hello', lang: 'en' },
  { text: 'Bonjour', lang: 'fr' },
  { text: 'Hola', lang: 'es' },
  { text: 'Hallo', lang: 'de' },
  { text: 'Olá', lang: 'pt' },
  { text: 'مرحباً', lang: 'ar' },
  { text: 'হ্যালো', lang: 'bn' },
  { text: 'Привіт', lang: 'uk' },
  { text: 'Silav', lang: 'ku' },
  { text: 'سلام', lang: 'fa' },
  { text: '你好', lang: 'zh' },
  { text: 'こんにちは', lang: 'ja' },
  { text: 'Привет', lang: 'ru' },
  { text: 'नमस्ते', lang: 'hi' },
  { text: 'Merhaba', lang: 'tr' },
  { text: 'Γεια', lang: 'el' },
  { text: 'שלום', lang: 'he' },
  { text: 'Jambo', lang: 'sw' },
  { text: 'Xin chào', lang: 'vi' },
  { text: 'สวัสดี', lang: 'th' },
  { text: '안녕하세요', lang: 'ko' },
  { text: 'Cześć', lang: 'pl' },
  { text: 'Hej', lang: 'sv' },
  { text: 'Szia', lang: 'hu' },
  { text: 'Ahoj', lang: 'cs' },
  { text: 'Bună', lang: 'ro' },
  { text: 'Здравей', lang: 'bg' },
  { text: 'Tere', lang: 'et' },
  { text: 'Sveiki', lang: 'lv' },
  { text: 'Labas', lang: 'lt' },
  { text: 'Halló', lang: 'is' },
  { text: 'Dia dhuit', lang: 'ga' },
  { text: 'Helo', lang: 'cy' },
  { text: 'Përshëndetje', lang: 'sq' },
  { text: 'გამარჯობა', lang: 'ka' },
  { text: 'Բարև', lang: 'hy' },
  { text: 'Salam', lang: 'az' },
  { text: 'Сәлем', lang: 'kk' },
  { text: 'Salom', lang: 'uz' },
  { text: 'Halo', lang: 'id' },
  { text: 'Kumusta', lang: 'tl' },
  { text: 'Kia ora', lang: 'mi' },
  { text: 'Aloha', lang: 'haw' },
  { text: 'Bula', lang: 'fj' },
  { text: 'Mauri', lang: 'gil' },
];

const COLORS = [
  'text-primary',
  'text-accent',
  'text-olive',
  'text-state-recording',
  'text-indigo-500',
  'text-rose-500',
  'text-emerald-500',
  'text-amber-500',
  'text-cyan-500',
  'text-violet-500',
];

interface FloatingWordProps {
  text: string;
  delay: number;
  duration: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  color: string;
  fontSize: string;
}

const FloatingWord: React.FC<FloatingWordProps> = ({ 
  text, 
  delay, 
  duration, 
  startX, 
  startY, 
  endX, 
  endY, 
  color,
  fontSize
}) => {
  const depth = useMemo(() => Math.random(), []);
  const blur = depth * 3;
  const zIndex = Math.floor(depth * 10);
  
  // Create a more organic path with intermediate points
  const midX = (startX + endX) / 2 + (Math.random() - 0.5) * 15;
  const midY = (startY + endY) / 2 + (Math.random() - 0.5) * 10;

  return (
    <motion.div
      initial={{ 
        opacity: 0, 
        x: `${startX}vw`, 
        y: `${startY}vh`,
        scale: 0.4 + depth * 0.4,
        rotate: -15 + Math.random() * 30,
        filter: `blur(${blur + 2}px)`
      }}
      animate={{ 
        opacity: [0, 0.1, 0.4 + depth * 0.2, 0.4 + depth * 0.2, 0.1, 0],
        x: [`${startX}vw`, `${midX}vw`, `${endX}vw`],
        y: [`${startY}vh`, `${midY}vh`, `${endY}vh`],
        scale: [0.4 + depth * 0.4, 0.8 + depth * 0.6, 0.4 + depth * 0.4],
        rotate: [ -15, 0, 15, 0, -15 ],
        filter: [`blur(${blur + 2}px)`, `blur(${blur}px)`, `blur(${blur + 2}px)`]
      }}
      transition={{
        duration: duration,
        delay: delay,
        repeat: Infinity,
        ease: "easeInOut",
      }}
      className={`absolute pointer-events-none font-serif font-bold whitespace-nowrap ${color} ${fontSize}`}
      style={{
        textShadow: '0 8px 24px rgba(0,0,0,0.03)',
        zIndex,
        willChange: 'transform, opacity'
      }}
    >
      {text}
    </motion.div>
  );
};

export const CiaoAnimation: React.FC = () => {
  const words = useMemo(() => {
    // Increase density for a more "airy" filled space
    return Array.from({ length: 80 }).map((_, i) => {
      const translation = CIAO_TRANSLATIONS[i % CIAO_TRANSLATIONS.length];
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      
      // Randomize movement
      // Focus on upper part but allow some drift
      const startX = Math.random() * 110 - 5; // Slightly outside bounds for smoother entry
      const startY = Math.random() * 60 - 5; 
      
      // Drift direction - mostly horizontal for "air" feel
      const driftX = (Math.random() > 0.5 ? 1 : -1) * (20 + Math.random() * 30);
      const driftY = (Math.random() - 0.5) * 15;
      
      const endX = startX + driftX;
      const endY = startY + driftY;
      
      const delay = Math.random() * -30; // Negative delay to start at different points in the loop
      const duration = 20 + Math.random() * 25;
      
      const fontSizes = ['text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl', 'text-2xl', 'text-3xl', 'text-4xl'];
      const fontSize = fontSizes[Math.floor(Math.random() * fontSizes.length)];

      return {
        id: i,
        text: translation.text,
        delay,
        duration,
        startX,
        startY,
        endX,
        endY,
        color,
        fontSize
      };
    });
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {/* Soft atmospheric glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(255,255,255,0.4)_0%,transparent_70%)] pointer-events-none" />
      
      {words.map((word) => (
        <FloatingWord key={word.id} {...word} />
      ))}
      
      {/* Subtle overlay to soften the edges */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-white/20 pointer-events-none" />
    </div>
  );
};
