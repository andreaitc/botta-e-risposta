import React, { useState, useEffect, useRef, memo, useMemo } from 'react';
import { motion, AnimatePresence, Reorder } from 'motion/react';
import { 
  Play, 
  Pause, 
  Volume2, 
  GripVertical, 
  Trash2, 
  Download, 
  Music, 
  ArrowLeft,
  ArrowRight,
  Settings2,
  Scissors,
  Plus,
  Minus,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ZoomIn,
  ZoomOut,
  RefreshCcw,
  RotateCcw,
  AlertCircle,
  Square,
  ArrowRightLeft,
  Star,
  Globe,
  Repeat
} from 'lucide-react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';
import { SavedTestimony } from '../App';
import { getAudio } from '../lib/audioStorage';
import { mixStudioTracks, StudioTrack } from '../lib/studioMixer';
import { getNiceLanguageLabel } from '../lib/languagesStore';

interface TrackItemProps {
  track: TrackConfig;
  index: number;
  displayIndex: number;
  totalTracks: number;
  isFirst: boolean;
  isLast: boolean;
  prevCrossfade: number;
  maxDuration: number;
  onUpdate: (u: Partial<TrackConfig>) => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onMoveTo?: (newIndex: number) => void;
  isMixing?: boolean;
}

const TrackItem = memo(({ track, index, displayIndex, totalTracks, isFirst, isLast, prevCrossfade, maxDuration, onUpdate, onRemove, onMoveUp, onMoveDown, onMoveTo, isMixing = false }: TrackItemProps) => {
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const regionsRef = useRef<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const trimStartRef = useRef(track.trimStart);
  const trimEndRef = useRef(track.trimEnd);

  useEffect(() => {
    trimStartRef.current = track.trimStart;
    trimEndRef.current = track.trimEnd;
  }, [track.trimStart, track.trimEnd]);

  const selectionDuration = useMemo(() => track.trimEnd - track.trimStart, [track.trimEnd, track.trimStart]);
  const crossfadeThreshold = useMemo(() => (isFirst ? 0 : prevCrossfade) + (isLast ? 0 : track.crossfadeNext), [isFirst, prevCrossfade, isLast, track.crossfadeNext]);
  const isUnusable = useMemo(() => selectionDuration < (crossfadeThreshold - 0.01), [selectionDuration, crossfadeThreshold]);

  const selectionStatus = useMemo(() => {
    if (isUnusable) return 'error';
    if (Math.abs(selectionDuration - 10) < 0.05) return 'perfect';
    if (selectionDuration < 10) return 'warning';
    return 'perfect';
  }, [isUnusable, selectionDuration]);

  useEffect(() => {
    if (!waveformRef.current || !track.blob) return;

    let ws: WaveSurfer | null = null;
    let regions: any = null;
    let resizeObserver: ResizeObserver | null = null;
    let isDestroyed = false;
    let url = "";

    const initWaveSurfer = async () => {
      // Small delay of 60ms to let any animations/transitions on parent containers settle down
      await new Promise(resolve => setTimeout(resolve, 60));
      if (isDestroyed || !waveformRef.current) return;

      ws = WaveSurfer.create({
        container: waveformRef.current,
        waveColor: isUnusable ? '#fee2e2' : '#cbd5e1',
        progressColor: isUnusable ? '#fee2e2' : '#cbd5e1', // Same as waveColor for background
        cursorColor: '#d69e2e',
        barWidth: 2,
        barGap: 1,
        height: 64,
        normalize: true,
        interact: true,
        hideScrollbar: true,
      });

      regions = ws.registerPlugin(RegionsPlugin.create());
      regionsRef.current = regions;

      url = URL.createObjectURL(track.blob!);
      ws.load(url).catch((err: any) => {
        if (err.name !== 'AbortError' && !err.message?.includes('abort')) {
          console.error("WaveSurfer load error:", err);
        }
      });
      wavesurferRef.current = ws;

      ws.on('ready', (d) => {
        if (isDestroyed || !regions) return;
        regions.clearRegions();
        const regionColor = selectionStatus === 'error' ? 'rgba(239, 68, 68, 0.2)' : 
                           selectionStatus === 'warning' ? 'rgba(245, 158, 11, 0.2)' : 
                           'rgba(16, 185, 129, 0.2)';
        regions.addRegion({
          id: 'selection',
          start: track.trimStart,
          end: Math.min(track.trimEnd || d, d),
          color: regionColor,
          drag: true,
          resize: true,
        });
      });

      regions.on('region-updated', (region: any) => {
        onUpdate({ trimStart: region.start, trimEnd: region.end });
      });

      let lastTime = 0;
      ws.on('timeupdate', (currentTime: number) => {
        if (ws && ws.isPlaying()) {
          const trimEndVal = trimEndRef.current;
          if (lastTime < trimEndVal && currentTime >= trimEndVal) {
            ws.pause();
            ws.setTime(trimEndVal);
          }
        }
        lastTime = currentTime;
      });

      ws.on('play', () => {
        setIsPlaying(true);
        window.dispatchEvent(new CustomEvent('studio-stop-all-audio', { detail: { emitterId: track.id } }));
      });
      ws.on('pause', () => setIsPlaying(false));
      ws.on('finish', () => setIsPlaying(false));

      // Force redraw when container changes size (e.g. animation end or window resizing)
      if (typeof ResizeObserver !== 'undefined' && waveformRef.current) {
        resizeObserver = new ResizeObserver(() => {
          if (ws && !isDestroyed) {
            try {
              ws.zoom(0);
            } catch (e) {
              // ignore
            }
          }
        });
        resizeObserver.observe(waveformRef.current);
      }
    };

    initWaveSurfer();

    const handleStopAll = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.emitterId !== track.id && ws) {
        ws.pause();
      }
    };
    window.addEventListener('studio-stop-all-audio', handleStopAll);

    return () => {
      isDestroyed = true;
      window.removeEventListener('studio-stop-all-audio', handleStopAll);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      try {
        if (ws) {
          if (ws.isPlaying()) {
            ws.pause();
          }
          ws.destroy();
        }
      } catch (err) {
        console.error("WaveSurfer cleanup error:", err);
      }
      if (url) {
        URL.revokeObjectURL(url);
      }
      wavesurferRef.current = null;
      regionsRef.current = null;
    };
  }, [track.blob]); // Re-init if blob changes

  // Update colors and regions when status changes
  useEffect(() => {
    if (!wavesurferRef.current || !regionsRef.current) return;
    
    const regionColor = selectionStatus === 'error' ? 'rgba(239, 68, 68, 0.2)' : 
                       selectionStatus === 'warning' ? 'rgba(245, 158, 11, 0.2)' : 
                       'rgba(16, 185, 129, 0.2)';

    wavesurferRef.current.setOptions({
      waveColor: selectionStatus === 'error' ? '#fee2e2' : '#cbd5e1',
      progressColor: selectionStatus === 'error' ? '#ef4444' : '#1a365d',
    });

    const region = regionsRef.current.getRegions()[0];
    if (region) {
      region.setOptions({
        color: regionColor,
      });
    }
  }, [selectionStatus]);

  // Sync region with external state changes (like Reset All)
  useEffect(() => {
    if (!wavesurferRef.current || !regionsRef.current) return;
    const region = regionsRef.current.getRegions()[0];
    if (region) {
      if (Math.abs(region.start - track.trimStart) > 0.01 || Math.abs(region.end - track.trimEnd) > 0.01) {
        region.setOptions({
          start: track.trimStart,
          end: track.trimEnd
        });
      }
    }
  }, [track.trimStart, track.trimEnd]);

  // Disable region modifications and interaction during playback
  useEffect(() => {
    if (wavesurferRef.current) {
      try {
        wavesurferRef.current.setOptions({ interact: !isPlaying });
      } catch (e) {
        console.error("Error updating WaveSurfer interact option:", e);
      }
    }
    if (regionsRef.current) {
      try {
        const region = regionsRef.current.getRegions()[0];
        if (region) {
          region.setOptions({
            drag: !isPlaying,
            resize: !isPlaying,
          });
        }
      } catch (e) {
        console.error("Error updating regions drag/resize options:", e);
      }
    }
  }, [isPlaying]);

  return (
    <div className="flex flex-col gap-3 w-full group/track relative">
      <div 
        className={`bg-white p-3 rounded-2xl shadow-sm border transition-all relative flex flex-col gap-3 ${
          isUnusable ? 'border-red-200 bg-red-50/10' : 'border-border hover:border-primary/30'
        }`}
      >
        <div className="flex flex-col gap-1 px-1">
          <div className="h-2 bg-bg-secondary rounded-full overflow-hidden relative w-full">
            <div 
              className="h-full bg-red-500 rounded-full transition-all duration-500"
              style={{ width: `${(track.duration / maxDuration) * 100}%` }}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-red-600 uppercase tracking-widest">Durata:</span>
            <span className="text-sm font-mono font-bold text-red-600 whitespace-nowrap">
              {track.duration.toFixed(1)}s
            </span>
          </div>
        </div>
        
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-4 w-full">
          <div className="flex items-center justify-between lg:justify-start gap-4 shrink-0">
            <div className="flex items-center gap-2">
              <div 
                className={`relative flex items-center justify-center w-8 h-8 rounded-full bg-bg-secondary text-[11px] font-black border border-border/50 shrink-0 shadow-inner group/pos-circle transition-all duration-200 ${
                  isMixing 
                    ? 'opacity-50 cursor-not-allowed text-primary/40' 
                    : 'text-primary select-none cursor-pointer hover:bg-accent/10 hover:text-accent hover:border-accent/40 active:scale-95'
                }`}
                title={isMixing ? "In caricamento..." : "Clicca per cambiare posizione"}
              >
                {!isMixing && (
                  <select
                    value={displayIndex}
                    onChange={(e) => {
                      const nextVal = parseInt(e.target.value, 10);
                      if (!isNaN(nextVal)) {
                        onMoveTo?.(nextVal);
                      }
                    }}
                    disabled={isMixing}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed appearance-none"
                  >
                    {Array.from({ length: totalTracks }, (_, idx) => (
                      <option key={idx + 1} value={idx + 1}>
                        Posizione {idx + 1}
                      </option>
                    ))}
                  </select>
                )}
                <span>{displayIndex}</span>
              </div>
              <div className="flex flex-col gap-1">
                <button 
                  onClick={onMoveUp}
                  disabled={isFirst}
                  className={`p-1 rounded-md transition-colors ${isFirst ? 'text-border cursor-not-allowed' : 'text-text-muted hover:bg-primary/10 hover:text-primary'}`}
                  title="Sposta su"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button 
                  onClick={onMoveDown}
                  disabled={isLast}
                  className={`p-1 rounded-md transition-colors ${isLast ? 'text-border cursor-not-allowed' : 'text-text-muted hover:bg-primary/10 hover:text-primary'}`}
                  title="Sposta giù"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>

              <button 
                onClick={() => wavesurferRef.current?.playPause()}
                disabled={isMixing}
                className={`p-2.5 rounded-xl transition-all shadow-md ${
                  isMixing ? 'bg-bg-secondary text-text-muted/40 cursor-not-allowed opacity-50' :
                  isUnusable ? 'bg-red-100 text-red-600 hover:scale-105 active:scale-95' : 'bg-primary text-white hover:scale-105 active:scale-95'
                }`}
                title={isMixing ? "In caricamento..." : "Play/Pause"}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
              </button>

              <button 
                onClick={() => {
                  if (isMixing) return;
                  if (!wavesurferRef.current) return;
                  wavesurferRef.current.setTime(track.trimStart);
                  wavesurferRef.current.play();
                }}
                disabled={isMixing}
                className={`p-2.5 rounded-xl transition-all shadow-md ${
                  isMixing ? 'bg-bg-secondary text-text-muted/40 cursor-not-allowed opacity-50' :
                  selectionStatus === 'error' 
                    ? 'bg-state-error text-white shadow-state-error/20 hover:scale-105 active:scale-95' 
                    : selectionStatus === 'warning' 
                    ? 'bg-state-recording text-white shadow-state-recording/20 hover:scale-105 active:scale-95' 
                    : 'bg-state-success text-white shadow-state-success/20 hover:scale-105 active:scale-95'
                }`}
                title={isMixing ? "In caricamento..." : "Riproduci dall'area selezionata"}
              >
                <Play className="w-4 h-4 fill-current" />
              </button>
            </div>
            
            <div className="flex flex-col items-center gap-0.5 min-w-[60px]">
              <span className="text-[9px] font-black text-text-muted uppercase tracking-tighter">Volume</span>
              <div className="flex items-center gap-2">
                <input 
                  type="range" 
                  min="0" max="1" step="0.01" 
                  value={track.volume}
                  onChange={(e) => onUpdate({ volume: parseFloat(e.target.value) })}
                  className="w-12 lg:w-16 accent-primary h-1"
                />
                <span className="text-[10px] font-mono font-bold text-primary">{(track.volume * 10).toFixed(0)}</span>
              </div>
            </div>
          </div>

          <div className="flex-1 flex flex-col gap-1 min-w-0">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2 truncate">
                <span className={`font-bold text-sm font-serif truncate ${isUnusable ? 'text-red-700' : 'text-primary'}`}>
                  {track.parola_chiave}
                </span>
                <span className="text-[8px] text-text-muted uppercase tracking-widest font-black bg-bg-secondary px-1.5 py-0.5 rounded shrink-0">
                  {getNiceLanguageLabel(track.lingua_originale)}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-mono font-black text-text-muted uppercase">Totale:</span>
                  <span className="text-[9px] font-mono font-black text-text-muted">{track.duration.toFixed(1)}s</span>
                </div>
                <div className="h-3 w-px bg-border/50" />
                <span className={`text-[9px] font-mono font-black px-2 py-0.5 rounded-lg transition-colors ${
                  selectionStatus === 'error' ? 'bg-red-100 text-red-600' : 
                  selectionStatus === 'warning' ? 'bg-amber-100 text-amber-600' : 
                  'bg-emerald-100 text-emerald-600'
                }`}>
                  SEL: {selectionDuration.toFixed(1)}s
                </span>
                
                <div className="flex items-center gap-1">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdate({ favorite: !track.favorite });
                    }}
                    className={`p-1.5 rounded-lg transition-all ${
                      track.favorite ? 'bg-accent-light text-accent shadow-sm' : 'bg-bg-secondary text-text-muted hover:bg-bg-secondary/80'
                    }`}
                    title={track.favorite ? "Rimuovi dai preferiti" : "Aggiungi ai preferiti"}
                  >
                    <Star className={`w-3 h-3 ${track.favorite ? 'fill-accent' : ''}`} />
                  </button>

                  <button 
                    onClick={onRemove} 
                    className="text-text-muted hover:text-white hover:bg-state-error transition-all p-1.5 bg-bg-secondary rounded-lg"
                    title="Rimuovi traccia"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>

                {isUnusable && (
                  <span className="text-[8px] text-red-500 font-bold uppercase tracking-tighter flex items-center gap-1">
                    <AlertCircle className="w-2 h-2" />
                    Min: {crossfadeThreshold.toFixed(1)}s
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Waveform Container */}
        <div className={`relative bg-bg-secondary/5 rounded-xl p-1 border border-border/20 min-h-[80px] flex items-center justify-center overflow-hidden`}>
          <div ref={waveformRef} className="w-full" />
        </div>
      </div>

      {/* Transition Zone - Linked to the next track */}
      {!isLast && (
        <div className="flex flex-col items-center justify-center pt-2 relative z-20">
          <div className="bg-olive/10 border border-olive/20 rounded-full px-4 py-1.5 flex items-center gap-4 shadow-sm hover:bg-olive/15 transition-all">
            <div className="flex items-center gap-2">
              <ArrowRightLeft className="w-3.5 h-3.5 text-olive animate-pulse" />
              <span className="text-[9px] font-black text-olive uppercase tracking-[0.2em] whitespace-nowrap opacity-60">Dissolvenza Incrociata (Voce {displayIndex} → {displayIndex + 1})</span>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => onUpdate({ crossfadeNext: Math.max(0, Math.floor(track.crossfadeNext - 1)) })}
                className="p-1 bg-white rounded-md border border-olive/30 text-olive hover:bg-olive hover:text-white transition-colors shadow-sm"
              >
                <Minus className="w-3 h-3" />
              </button>
              <div className="flex items-center gap-1 min-w-[2.5rem] justify-center text-olive font-mono font-black text-xs">
                {Math.floor(track.crossfadeNext)}s
              </div>
              <button 
                onClick={() => onUpdate({ crossfadeNext: Math.min(15, Math.floor(track.crossfadeNext + 1)) })}
                className="p-1 bg-white rounded-md border border-olive/30 text-olive hover:bg-olive hover:text-white transition-colors shadow-sm"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

interface StudioProps {
  initialTracks: SavedTestimony[];
  onBack: () => void;
  onUpdateTrack?: (id: string, updates: Partial<SavedTestimony>) => void;
  onReorderTracks?: (newTracks: SavedTestimony[]) => void;
}

interface TrackConfig extends SavedTestimony {
  volume: number;
  offset: number;
  duration: number;
  blob?: Blob;
  trimStart: number;
  trimEnd: number;
  crossfadeNext: number; // Duration of crossfade to the next track
}

const STANDARD_MUSIC = [
  { id: 'm1', name: 'Orchestral', path: '/audio/music/atlasaudio-orchestral-orchestral-music-507851.mp3' },
  { id: 'm2', name: 'Piano', path: '/audio/music/leberch-piano-513745.mp3' },
  { id: 'm3', name: 'Peaceful', path: '/audio/music/kaazoom-when-morning-comes-peaceful-orchestral-ambient-music-473427.mp3' },
];

export default function Studio({ initialTracks, onBack, onUpdateTrack, onReorderTracks }: StudioProps) {
  const [phase, setPhase] = useState<'VOICES' | 'FINAL'>('VOICES');
  const [tracks, setTracks] = useState<TrackConfig[]>([]);
  const maxDuration = Math.max(...tracks.map(t => t.duration || 0), 10);
  const [musicTrack, setMusicTrack] = useState<{ blob: Blob | string; name: string; volume: number } | null>(null);
  
  // Phase 2 state
  const [voicesMixBlob, setVoicesMixBlob] = useState<Blob | null>(null);
  const [voicesMixDuration, setVoicesMixDuration] = useState(0);
  
  // Load global settings from localStorage if they exist
  const getStoredGlobal = (key: string, defaultValue: number) => {
    const saved = localStorage.getItem(`studio_${key}`);
    return saved ? parseFloat(saved) : defaultValue;
  };

  const [voicesVolume, setVoicesVolume] = useState(() => getStoredGlobal('voices_volume', 0.7)); 
  const voicesOffset = 2; // Fixed 2s intro (Rule 1)
  
  const [musicVolume, setMusicVolume] = useState(() => getStoredGlobal('music_volume', 0.3));
  
  // Volume scaling factors as requested by user (+30% voices, -15% music)
  const PHASE2_VOICE_SCALE = 1.3 * 1.3; // Increase by another 30% to give more margin (total ~1.7)
  const PHASE2_MUSIC_SCALE = 0.85 * 0.85; // Decrease further to give more margin (total ~0.72)
  const [musicTrimStart, setMusicTrimStart] = useState(() => getStoredGlobal('music_trim_start', 0));
  const [musicTrimEnd, setMusicTrimEnd] = useState(() => getStoredGlobal('music_trim_end', 0));
  
  const [isMixing, setIsMixing] = useState(false);
  const [mixProgress, setMixProgress] = useState(0);
  const [mixMessage, setMixMessage] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isLooping, setIsLooping] = useState(() => {
    const saved = localStorage.getItem('studio_is_looping');
    return saved === 'true';
  });
  
  const [trackToDelete, setTrackToDelete] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [zoomedTrackIndex, setZoomedTrackIndex] = useState<number | null>(null);

  const confirmResetAll = () => {
    // Abort any ongoing operations before resetting
    if (mixAbortControllerRef.current) mixAbortControllerRef.current.abort('User Reset');
    if (musicAbortControllerRef.current) musicAbortControllerRef.current.abort('User Reset');
    
    // Reset global fades
    setInitialFadeIn(3);
    setFinalFadeOut(3);

    // Reset sort and filters
    setSortMethod('original');
    setShowFavoritesOnly(false);
    setCurrentPage(1);

    // Restore original recording order by sorting by date
    const sortedByDate = [...tracks].sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return (isNaN(dateA) ? 0 : dateA) - (isNaN(dateB) ? 0 : dateB);
    });

    const resetTracks = sortedByDate.map(t => {
      // Base rules for selection: 10s centered if duration > 10s, else full duration
      // Prevent creating negative values or out of bound values just in case
      let trimStart = 0;
      let trimEnd = t.duration || 0;
      
      if (trimEnd > 10) {
        trimStart = Math.max(0, trimEnd / 2 - 5);
        trimEnd = Math.min(t.duration, trimStart + 10); 
      }
      
      return {
        ...t,
        studioVolume: 0.8,
        studioTrimStart: trimStart,
        studioTrimEnd: trimEnd,
        studioCrossfadeNext: 2,
        // Internal UI state fields
        trimStart,
        trimEnd,
        crossfadeNext: 2,
        volume: 0.8
      };
    });

    setTracks(resetTracks);
    setShowResetConfirm(false);
    
    // Update parent archive with a single call
    if (onReorderTracks) {
      onReorderTracks(resetTracks);
    }
  };

  const [sortMethod, setSortMethod] = useState<'original' | 'preference' | 'mixed_languages'>(() => {
    return (localStorage.getItem('studio_sort_method') as any) || 'original';
  });
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(() => {
    return localStorage.getItem('studio_show_favorites_only') === 'true';
  });

  const [initialFadeIn, setInitialFadeIn] = useState(() => getStoredGlobal('initial_fade_in', 3));
  const [finalFadeOut, setFinalFadeOut] = useState(() => getStoredGlobal('final_fade_out', 3));

  // Persist globals
  useEffect(() => {
    localStorage.setItem('studio_voices_volume', voicesVolume.toString());
  }, [voicesVolume]);
  useEffect(() => {
    localStorage.setItem('studio_music_volume', musicVolume.toString());
  }, [musicVolume]);
  useEffect(() => {
    localStorage.setItem('studio_music_trim_start', musicTrimStart.toString());
  }, [musicTrimStart]);
  useEffect(() => {
    localStorage.setItem('studio_music_trim_end', musicTrimEnd.toString());
  }, [musicTrimEnd]);
  useEffect(() => {
    localStorage.setItem('studio_initial_fade_in', initialFadeIn.toString());
  }, [initialFadeIn]);
  useEffect(() => {
    localStorage.setItem('studio_final_fade_out', finalFadeOut.toString());
  }, [finalFadeOut]);
  useEffect(() => {
    localStorage.setItem('studio_is_looping', isLooping.toString());
  }, [isLooping]);
  useEffect(() => {
    localStorage.setItem('studio_sort_method', sortMethod);
  }, [sortMethod]);
  useEffect(() => {
    localStorage.setItem('studio_show_favorites_only', showFavoritesOnly.toString());
  }, [showFavoritesOnly]);

  // Persist music selection
  useEffect(() => {
    if (musicTrack) {
        // If it's standard, we save the id or path
        const standard = STANDARD_MUSIC.find(m => m.name === musicTrack.name);
        if (standard) {
            localStorage.setItem('studio_music_choice', JSON.stringify({
                type: 'standard',
                id: standard.id,
                name: standard.name,
                path: standard.path
            }));
        } else {
            // It's a custom upload. We can't easily save the blob in localStorage, 
            // but we can save the name
            localStorage.setItem('studio_music_choice', JSON.stringify({
                type: 'custom',
                name: musicTrack.name
            }));
        }
    } else {
        localStorage.removeItem('studio_music_choice');
    }
  }, [musicTrack]);

  const selectStandardMusic = async (m: typeof STANDARD_MUSIC[0]) => {
    // Cancel any ongoing music fetch
    if (musicAbortControllerRef.current) {
      musicAbortControllerRef.current.abort('New selection');
    }
    musicAbortControllerRef.current = new AbortController();

    try {
      const response = await fetch(m.path, { signal: musicAbortControllerRef.current.signal });
      if (!response.ok) throw new Error('File non trovato');
      const blob = await response.blob();
      setMusicTrack({ blob, name: m.name, volume: 0.3 });
      setMusicTrimStart(0);
      setMusicTrimEnd(0);
    } catch (err: any) {
      if (err.name === 'AbortError' || err.message === 'Aborted' || err.message?.includes('aborted') || err.message?.includes('signal is aborted') || err.message?.includes('without reason')) {
        console.log('Music fetch intentionally aborted');
      } else {
        // Fallback if file doesn't exist yet
        setMusicTrack({ blob: m.path, name: m.name, volume: 0.3 });
        setMusicTrimStart(0);
        setMusicTrimEnd(0);
      }
    } finally {
      musicAbortControllerRef.current = null;
    }
  };

  // Restore music selection
  useEffect(() => {
    const saved = localStorage.getItem('studio_music_choice');
    if (saved && !musicTrack) {
        const choice = JSON.parse(saved);
        if (choice.type === 'standard') {
            const standard = STANDARD_MUSIC.find(m => m.id === choice.id);
            if (standard) {
                selectStandardMusic(standard);
            }
        }
    }
  }, []);

  const timelineRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioRef2 = useRef<HTMLAudioElement>(null);
  const [activePlayer, setActivePlayer] = useState<1 | 2>(1);
  const isCrossfadingRef = useRef(false);
  const ITEMS_PER_PAGE = 5;
  const [currentPage, setCurrentPage] = useState(1);

  const sortedTracks = useMemo(() => {
    let result = [...tracks];

    // Apply Filters First
    if (showFavoritesOnly) {
      result = result.filter(t => t.favorite);
    }
    
    // Apply Sorting
    if (sortMethod === 'preference') {
      result.sort((a, b) => {
        if (a.favorite && !b.favorite) return -1;
        if (!a.favorite && b.favorite) return 1;
        return 0;
      });
    } else if (sortMethod === 'mixed_languages') {
      const groups: Record<string, TrackConfig[]> = {};
      result.forEach(t => {
        const lang = t.lingua_originale || 'Unknown';
        if (!groups[lang]) groups[lang] = [];
        groups[lang].push(t);
      });
      
      const languages = Object.keys(groups).sort((a, b) => groups[b].length - groups[a].length);
      const interleaved: TrackConfig[] = [];
      const totalCount = result.length;
      
      // Better interleaving algorithm: Always pick the language with most remaining tracks 
      // that is NOT the same as the last track's language (if possible).
      let lastLang: string | null = null;
      
      for (let i = 0; i < totalCount; i++) {
        let bestLang: string | null = null;
        let maxCount = -1;
        
        // Find best candidate
        for (const lang of languages) {
          const remaining = groups[lang].length;
          if (remaining > 0) {
            // Prefer different language
            if (lang !== lastLang) {
              if (remaining > maxCount) {
                maxCount = remaining;
                bestLang = lang;
              }
            }
          }
        }
        
        // If no alternative, pick the one with most remaining
        if (!bestLang) {
          for (const lang of languages) {
            if (groups[lang].length > 0) {
              if (groups[lang].length > maxCount) {
                maxCount = groups[lang].length;
                bestLang = lang;
              }
            }
          }
        }
        
        if (bestLang) {
          interleaved.push(groups[bestLang].shift()!);
          lastLang = bestLang;
        }
      }
      result = interleaved;
    }
    
    return result;
  }, [tracks, sortMethod, showFavoritesOnly]);

  const totalPages = Math.ceil(sortedTracks.length / ITEMS_PER_PAGE);
  const paginatedTracks = sortedTracks.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  useEffect(() => {
    if (timelineRef.current) {
      timelineRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentPage]);

  useEffect(() => {
    const handleStopAll = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.emitterId !== 'global-preview') {
        if (audioRef.current) audioRef.current.pause();
        if (audioRef2.current) audioRef2.current.pause();
        setIsPlayingPreview(false);
      }
    };
    window.addEventListener('studio-stop-all-audio', handleStopAll);
    return () => {
      window.removeEventListener('studio-stop-all-audio', handleStopAll);
    };
  }, []);

  // Mixer state
  const mixAbortControllerRef = useRef<AbortController | null>(null);
  const musicAbortControllerRef = useRef<AbortController | null>(null);
  const lastCompiledParamsRef = useRef<string>('');

  useEffect(() => {
    return () => {
      if (mixAbortControllerRef.current) mixAbortControllerRef.current.abort('Studio Unmount');
      if (musicAbortControllerRef.current) musicAbortControllerRef.current.abort('Studio Unmount');
    };
  }, []);

  const getCurrentParamsKey = () => {
    const trackInfo = tracks.map(t => `${t.id}:${(t.volume ?? 1).toFixed(2)}:${(t.trimStart ?? 0).toFixed(2)}:${(t.trimEnd ?? 0).toFixed(2)}:${(t.crossfadeNext ?? 0).toFixed(2)}`).join('|');
    const musicInfo = musicTrack ? `${musicTrack.name}:${musicVolume.toFixed(2)}:${musicTrimStart.toFixed(2)}:${musicTrimEnd.toFixed(2)}` : 'no_music';
    return `${phase}:${trackInfo}:${musicInfo}:${voicesVolume.toFixed(2)}:${initialFadeIn.toFixed(2)}:${finalFadeOut.toFixed(2)}:${sortMethod}:${showFavoritesOnly}`;
  };

  useEffect(() => {
    // Only proceed if we haven't loaded yet OR if the track list IDs have changed
    const currentIds = tracks.map(t => t.id).sort().join(',');
    const initialIds = initialTracks.map(t => t.id).sort().join(',');
    
    if (tracks.length > 0 && currentIds === initialIds) {
        return;
    }

    let isMounted = true;
    
    const loadBlobs = async () => {
      if (initialTracks.length === 0) return;
      
      setIsMixing(true);
      setMixProgress(0);
      setMixMessage("Caricamento tracce...");

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      let completedCount = 0;
      const totalTracks = initialTracks.length;
      
      try {
        const loadedTracks = await Promise.all(initialTracks.map(async (t) => {
          let blob: Blob | null = null;
          let retries = 3;
          
          while (retries > 0 && !blob) {
            blob = await getAudio(t.audioId || t.id);
            if (!blob) {
              await new Promise(resolve => setTimeout(resolve, 200));
              retries--;
            }
          }

          let trackDuration = 13; // Fallback
          
          if (blob) {
            try {
              const arrayBuffer = await blob.arrayBuffer();
              const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
              trackDuration = audioBuffer.duration;
            } catch (e) {
              console.error("Error decoding audio for duration", e);
            }
          }

          completedCount++;
          if (isMounted) {
            setMixProgress(Math.round((completedCount / totalTracks) * 100));
          }

          // Use existing studio fields if present
          const studioVolume = t.studioVolume ?? 0.8;
          const studioTrimStart = t.studioTrimStart;
          const studioTrimEnd = t.studioTrimEnd;
          const studioCrossfadeNext = t.studioCrossfadeNext ?? Math.min(3, trackDuration / 3);

          return { 
            ...t, 
            volume: studioVolume, 
            offset: 0, 
            duration: trackDuration, 
            blob: blob || undefined,
            trimStart: studioTrimStart ?? (trackDuration > 10 ? (trackDuration / 2 - 5) : 0),
            trimEnd: studioTrimEnd ?? (trackDuration > 10 ? (trackDuration / 2 + 5) : trackDuration),
            crossfadeNext: studioCrossfadeNext
          };
        }));

        if (isMounted) {
          setTracks(loadedTracks);
          setIsMixing(false);
          setMixMessage('');
        }
      } catch (err) {
        console.error("Error loading studio tracks in parallel", err);
        if (isMounted) {
          setIsMixing(false);
          setMixMessage('');
        }
      } finally {
        try {
          await audioCtx.close();
        } catch (e) {
          console.error("Error closing AudioContext", e);
        }
      }
    };

    loadBlobs();
    
    return () => {
      isMounted = false;
    };
  }, [initialTracks]);

  const handleMusicUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setMusicTrack({ blob: file, name: file.name, volume: 0.3 });
      setMusicTrimStart(0);
      setMusicTrimEnd(0); // Will be set when loaded
    }
  };

  const handleExportVoices = async () => {
    if (sortedTracks.length === 0) return;

    // Cancel any ongoing mix
    if (mixAbortControllerRef.current) {
      mixAbortControllerRef.current.abort('New Export');
    }
    mixAbortControllerRef.current = new AbortController();

    setIsMixing(true);
    setMixMessage('Generazione mix voci...');
    try {
      let currentStartTime = 0;
      const studioTracks: StudioTrack[] = sortedTracks.map((t, i) => {
        const duration = t.trimEnd - t.trimStart;
        const trackStartTime = currentStartTime;
        // Advance currentStartTime by duration minus the crossfade to the NEXT track
        currentStartTime += duration - t.crossfadeNext;
        
        return {
          id: t.id,
          blob: t.blob!,
          volume: t.volume,
          startTime: Math.max(0, trackStartTime),
          duration: duration,
          offset: t.trimStart,
          crossfadeNext: t.crossfadeNext,
          fadeIn: i === 0 ? initialFadeIn : 0,
          fadeOut: i === sortedTracks.length - 1 ? finalFadeOut : 0
        };
      });

      const result = await mixStudioTracks(
        studioTracks,
        null, // No music in phase 1
        0, Math.max(30, currentStartTime + 10), // Adjust range
        (p, m) => {
          setMixProgress(p);
          setMixMessage(m);
        },
        mixAbortControllerRef.current.signal
      );

      setVoicesMixBlob(result);
      setVoicesMixDuration(currentStartTime);
      setPhase('FINAL');
    } catch (err: any) {
      if (err.name === 'AbortError' || err.message === 'Aborted' || err.message?.includes('aborted') || err.message?.includes('signal is aborted') || err.message?.includes('without reason')) {
        // Silent ignore
      } else {
        console.error(err);
      }
    } finally {
      setIsMixing(false);
      mixAbortControllerRef.current = null;
    }
  };

  const handleFinalExport = async () => {
    if (!voicesMixBlob) return;

    // Cancel any ongoing mix
    if (mixAbortControllerRef.current) {
      mixAbortControllerRef.current.abort('New Final Export');
    }
    mixAbortControllerRef.current = new AbortController();

    setIsMixing(true);
    setMixMessage('Generazione mix finale...');
    try {
      // Phase 2 mixing: Voices Mix + Music
      const studioTracks: StudioTrack[] = [
        {
          id: 'voices_mix',
          blob: voicesMixBlob,
          volume: voicesVolume * PHASE2_VOICE_SCALE,
          startTime: voicesOffset,
          duration: voicesMixDuration,
          offset: 0,
          crossfadeNext: 0
        }
      ];

      // If music exists, we need to calculate its duration from trim
      const musicDuration = musicTrack ? (musicTrimEnd - musicTrimStart) : 0;
      if (musicTrack) {
        studioTracks.push({
          id: 'music_track',
          blob: musicTrack.blob,
          volume: musicVolume * PHASE2_MUSIC_SCALE,
          startTime: 0,
          duration: musicDuration,
          offset: musicTrimStart,
          crossfadeNext: 0
        });
      }

      const totalDuration = voicesMixDuration + 4; // Rule 1

      const result = await mixStudioTracks(
        studioTracks,
        null, // No background music loop here, we use the track
        0, totalDuration,
        (p, m) => {
          setMixProgress(p);
          setMixMessage(m);
        },
        mixAbortControllerRef.current.signal
      );

      const url = URL.createObjectURL(result);
      const link = document.createElement('a');
      link.href = url;
      link.download = `final_mix_${new Date().getTime()}.wav`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      if (err.name === 'AbortError' || err.message === 'Aborted' || err.message?.includes('aborted') || err.message?.includes('signal is aborted') || err.message?.includes('without reason')) {
        // Silent ignore
      } else {
        console.error(err);
      }
    } finally {
      setIsMixing(false);
      mixAbortControllerRef.current = null;
    }
  };

  useEffect(() => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setIsPlayingPreview(false);
      setIsPaused(false);
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ''; }
      if (audioRef2.current) { audioRef2.current.pause(); audioRef2.current.src = ''; }
    }

    // Auto-generate preview in background ONLY when page or phase changes
    const canGenerate = phase === 'VOICES' ? tracks.length > 0 : !!voicesMixBlob;
    if (canGenerate) {
      const timer = setTimeout(() => {
        handlePreview(false);
      }, 500); // 500ms debounce
      return () => clearTimeout(timer);
    }
  }, [phase]);

  const fadeAudio = (audio: HTMLAudioElement, targetVolume: number, duration: number) => {
    const startVolume = audio.volume;
    const startTime = performance.now();
    
    const animate = (now: number) => {
      const elapsed = (now - startTime) / 1000;
      const progress = Math.min(elapsed / duration, 1);
      audio.volume = startVolume + (targetVolume - startVolume) * progress;
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else if (targetVolume === 0) {
        audio.pause();
        audio.currentTime = 0;
      }
    };
    requestAnimationFrame(animate);
  };

  useEffect(() => {
    if (previewUrl && isPlayingPreview) {
      const active = activePlayer === 1 ? audioRef.current : audioRef2.current;
      if (active && active.paused) {
        active.play().catch(err => {
          if (err.name !== 'AbortError') console.error('Playback failed:', err);
        });
        setIsPaused(false);
      }
    }
  }, [previewUrl, isPlayingPreview, activePlayer]);

  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLAudioElement>) => {
    const audio = e.currentTarget;
    if (!isLooping || isMixing || !previewUrl || isCrossfadingRef.current) return;

    const fadeTime = 2.5; // Fixed 2.5s crossfade for loop
    if (audio.duration > fadeTime * 2 && audio.currentTime > audio.duration - fadeTime) {
      const nextPlayer = audio === audioRef.current ? audioRef2.current : audioRef.current;
      if (nextPlayer) {
        isCrossfadingRef.current = true;
        nextPlayer.currentTime = 0;
        nextPlayer.volume = 0;
        nextPlayer.play().then(() => {
          fadeAudio(audio, 0, fadeTime);
          fadeAudio(nextPlayer, 1, fadeTime);
          setActivePlayer(audio === audioRef.current ? 2 : 1);
          setTimeout(() => {
            isCrossfadingRef.current = false;
          }, fadeTime * 1000 + 100);
        }).catch(console.error);
      }
    }
  };

  const handlePreview = async (autoPlay: boolean = true) => {
    const paramsKey = getCurrentParamsKey();
    const active = activePlayer === 1 ? audioRef.current : audioRef2.current;

    // If we already have a compiled preview and the parameters haven't changed, just play it
    if (previewUrl && active && paramsKey === lastCompiledParamsRef.current) {
      if (active.paused) {
        if (autoPlay) {
          active.play().catch(err => {
            if (err.name !== 'AbortError') console.error('Playback failed:', err);
          });
          setIsPlayingPreview(true);
          setIsPaused(false);
        }
      }
      return;
    }

    // Cancel any ongoing mix
    if (mixAbortControllerRef.current) {
      mixAbortControllerRef.current.abort('New Preview');
    }
    mixAbortControllerRef.current = new AbortController();

    setIsMixing(true);
    setMixProgress(0);
    setMixMessage(autoPlay ? 'Preparazione anteprima...' : 'Aggiornamento anteprima...');
    
    try {
      let result: Blob;
      if (phase === 'VOICES') {
        let currentStartTime = 0;
        const studioTracks: StudioTrack[] = sortedTracks.map((t, i) => {
          const duration = t.trimEnd - t.trimStart;
          const trackStartTime = currentStartTime;
          currentStartTime += duration - t.crossfadeNext;
          return {
            id: t.id,
            blob: t.blob!,
            volume: t.volume,
            startTime: Math.max(0, trackStartTime),
            duration: duration,
            offset: t.trimStart,
            crossfadeNext: t.crossfadeNext,
            fadeIn: i === 0 ? initialFadeIn : 0,
            fadeOut: i === sortedTracks.length - 1 ? finalFadeOut : 0
          };
        });
        result = await mixStudioTracks(
          studioTracks, 
          null, 
          0, 
          Math.max(30, currentStartTime + 10), 
          (p, m) => {
            setMixProgress(p);
            setMixMessage(m);
          }, 
          mixAbortControllerRef.current.signal
        );
      } else {
        const studioTracks: StudioTrack[] = [
          {
            id: 'voices_mix',
            blob: voicesMixBlob!,
            volume: voicesVolume * PHASE2_VOICE_SCALE,
            startTime: voicesOffset,
            duration: voicesMixDuration,
            offset: 0,
            crossfadeNext: 0
          }
        ];
        
        const musicDuration = musicTrack ? (musicTrimEnd - musicTrimStart) : 0;
        if (musicTrack) {
          studioTracks.push({
            id: 'music_track',
            blob: musicTrack.blob,
            volume: musicVolume * PHASE2_MUSIC_SCALE,
            startTime: 0,
            duration: musicDuration,
            offset: musicTrimStart,
            crossfadeNext: 0
          });
        }

        result = await mixStudioTracks(
          studioTracks, 
          null, 
          0, 
          voicesMixDuration + 4, 
          (p, m) => {
            setMixProgress(p);
            setMixMessage(m);
          }, 
          mixAbortControllerRef.current.signal
        );
      }

      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const url = URL.createObjectURL(result);
      setPreviewUrl(url);
      lastCompiledParamsRef.current = paramsKey;
      if (autoPlay) {
        setIsPlayingPreview(true);
        setIsPaused(false);
      }
    } catch (err: any) {
      if (err.name === 'AbortError' || err.message === 'Aborted' || err.message?.includes('aborted') || err.message?.includes('signal is aborted') || err.message?.includes('without reason')) {
        // Silent ignore for aborts
      } else {
        console.error(err);
      }
    } finally {
      setIsMixing(false);
      mixAbortControllerRef.current = null;
    }
  };

  const handleGoBack = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (phase === 'FINAL') {
      if (mixAbortControllerRef.current) {
        mixAbortControllerRef.current.abort('Go Back');
      }
      setPhase('VOICES');
    } else {
      if (mixAbortControllerRef.current) mixAbortControllerRef.current.abort('Exit');
      onBack();
    }
  };

  return (
    <div className="min-h-[100dvh] h-screen bg-bg-main p-3 md:p-6 flex flex-col items-center font-sans relative overflow-hidden">
      <div className="w-full max-w-7xl flex flex-col h-full gap-4 md:gap-6">
      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          {phase === 'VOICES' ? (
            <motion.div 
              key="voices-phase"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex flex-col gap-6 h-full overflow-hidden"
            >
              {/* Phase 1: Voices */}
              <div ref={timelineRef} className="flex flex-col gap-6 overflow-y-auto pr-2 pb-12 pt-4">
                {/* Navigation and Title Row Phase 1 */}
                <div className="flex items-center justify-between gap-4 mb-4 bg-white/50 backdrop-blur-sm p-4 rounded-2xl border border-primary/5 sticky top-0 z-50">
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={handleGoBack} 
                      className="flex items-center gap-2 p-2 bg-white hover:bg-primary hover:text-white rounded-lg transition-all text-primary shadow-sm border border-primary/10 group px-3"
                    >
                      <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                      <span className="text-[9px] font-bold uppercase tracking-wider">Esci</span>
                    </button>
                    <h1 className="text-lg font-serif font-bold text-primary tracking-tight">Fase 1: Montaggio Voci</h1>
                  </div>
                  <div className="flex items-center gap-3">
                    {tracks.length > 0 && (
                      <button
                        onClick={() => setShowResetConfirm(true)}
                        className="px-3 py-2 bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-500 rounded-lg transition-all flex items-center gap-2 text-[10px] uppercase font-black tracking-widest border border-slate-200"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Reset
                      </button>
                    )}
                    <button 
                      onClick={handleExportVoices}
                      disabled={isMixing || tracks.length === 0}
                      className="flex items-center gap-2 px-4 py-2 bg-[#FFD700] text-primary rounded-lg hover:bg-[#FFC800] transition-all text-[10px] font-black uppercase tracking-widest shadow-sm border border-primary/10 group"
                    >
                      <span>Esporta Mix</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  </div>
                </div>

                {/* Global Mix Preview Controls */}
                <div className="flex flex-col items-center gap-4 py-6 bg-primary/5 rounded-3xl border border-primary/10">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-2 h-2 rounded-full ${isPlayingPreview ? 'bg-state-success animate-pulse' : 'bg-primary/30'}`} />
                    <span className="text-[10px] font-black text-primary uppercase tracking-[0.25em] whitespace-nowrap">Anteprima Mix Attuale</span>
                  </div>
                  
                  <div className="flex items-center gap-4 bg-white px-6 py-3 rounded-[2rem] border border-primary/20 shadow-xl">
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => setIsLooping(!isLooping)}
                        className={`p-2.5 rounded-xl transition-all border ${isLooping ? 'bg-state-success text-white border-state-success shadow-md' : 'bg-white text-primary/60 border-primary/10 hover:border-primary/30'}`}
                        title="Loop"
                      >
                        <Repeat className="w-5 h-5" />
                      </button>

                      <button 
                        onClick={() => handlePreview()}
                        disabled={isMixing}
                        className={`p-3 rounded-xl transition-all border ${isPlayingPreview ? 'bg-state-success text-white border-state-success shadow-md' : 'bg-white text-primary border-primary/10 hover:bg-primary/5'}`}
                      >
                        {isMixing ? <Loader2 className="w-6 h-6 animate-spin" /> : <Play className={`w-6 h-6 ${isPlayingPreview ? 'fill-white' : 'fill-current'}`} />}
                      </button>

                      <button 
                        onClick={() => {
                          const active = audioRef.current;
                          const second = audioRef2.current;
                          if (active) { active.pause(); setIsPlayingPreview(false); setIsPaused(true); }
                          if (second) { second.pause(); setIsPlayingPreview(false); setIsPaused(true); }
                        }}
                        disabled={!isPlayingPreview}
                        className={`p-3 rounded-xl transition-all border ${isPaused ? 'bg-state-success text-white border-state-success shadow-md' : 'bg-white text-primary border-primary/10 hover:bg-primary/5 disabled:opacity-20'}`}
                      >
                        <Pause className={`w-6 h-6 ${isPaused ? 'fill-white' : 'fill-current'}`} />
                      </button>

                      <button 
                        onClick={() => {
                          if (audioRef.current) {
                            audioRef.current.pause();
                            audioRef.current.currentTime = 0;
                          }
                          if (audioRef2.current) {
                            audioRef2.current.pause();
                            audioRef2.current.currentTime = 0;
                          }
                          setActivePlayer(1);
                          isCrossfadingRef.current = false;
                          setIsPlayingPreview(false);
                          setIsPaused(false);
                        }}
                        disabled={!previewUrl}
                        className="p-3 bg-white text-primary/60 rounded-xl border border-primary/10 hover:text-state-error hover:border-state-error transition-all disabled:opacity-20"
                      >
                        <Square className="w-5 h-5 fill-current" />
                      </button>
                    </div>
                  </div>
                  {!previewUrl && tracks.length > 0 && !isMixing && (
                    <p className="text-[10px] text-primary/40 font-bold uppercase tracking-wider">Clicca play per generare l'anteprima</p>
                  )}
                </div>

                <div className="flex flex-col lg:flex-row lg:items-center justify-between px-4 py-3 bg-bg-secondary/30 rounded-xl border border-border/50 gap-4">
                  <h2 className="text-xs font-bold text-primary uppercase tracking-widest flex items-center gap-2 shrink-0">
                    <Settings2 className="w-3.5 h-3.5" />
                    Timeline Montaggio
                  </h2>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-border/50 shadow-sm">
                      <button
                        onClick={() => { setShowFavoritesOnly(!showFavoritesOnly); setCurrentPage(1); }}
                        className={`px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wider rounded-md transition-all flex items-center gap-1.5 ${
                          showFavoritesOnly ? 'bg-accent text-white' : 'text-text-muted hover:bg-primary/5'
                        }`}
                        title={showFavoritesOnly ? "Mostra tutto" : "Solo preferiti"}
                      >
                        <Star className={`w-3 h-3 ${showFavoritesOnly ? 'fill-white' : ''}`} />
                        {showFavoritesOnly ? 'Solo Fav.' : 'Tutti'}
                      </button>
                      <div className="w-px h-4 bg-border/30 mx-1" />
                      <button
                        onClick={() => { setSortMethod('original'); setCurrentPage(1); }}
                        className={`px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wider rounded-md transition-all ${
                          sortMethod === 'original' ? 'bg-primary text-white' : 'text-text-muted hover:bg-primary/5'
                        }`}
                      >
                        Ordine Reg.
                      </button>
                      <button
                        onClick={() => { setSortMethod('preference'); setCurrentPage(1); }}
                        className={`px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wider rounded-md transition-all flex items-center gap-1.5 ${
                          sortMethod === 'preference' ? 'bg-primary text-white' : 'text-text-muted hover:bg-primary/5'
                        }`}
                      >
                        Priorità Fav.
                      </button>
                      <button
                        onClick={() => { setSortMethod('mixed_languages'); setCurrentPage(1); }}
                        className={`px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wider rounded-md transition-all flex items-center gap-1.5 ${
                          sortMethod === 'mixed_languages' ? 'bg-primary text-white' : 'text-text-muted hover:bg-primary/5'
                        }`}
                      >
                        <Globe className="w-3 h-3" />
                        Mix Lingue
                      </button>
                    </div>
                    <span className="text-[9px] text-text-muted font-mono bg-white px-2 py-1 rounded border border-border/30 shrink-0">{sortedTracks.length} tracci{sortedTracks.length === 1 ? 'a' : 'e'}</span>
                    <div className="hidden sm:block h-4 w-px bg-border/50" />
                    <p className="text-[9px] text-text-muted italic hidden sm:block">
                      Usa le frecce per riordinare • Regola volume e dissolvenze
                    </p>
                  </div>
                </div>

              {/* Initial Fade In */}
              {currentPage === 1 && tracks.length > 0 && (
                <div className="flex justify-center mb-2">
                  <div className="bg-white border border-primary/20 rounded-xl px-3 py-2 flex flex-wrap items-center justify-center gap-3 shadow-sm hover:border-primary transition-all">
                    <div className="p-1.5 bg-primary/5 rounded-lg text-primary hidden sm:block">
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[9px] font-black text-primary uppercase tracking-widest whitespace-nowrap">Fade In Iniziale</span>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => setInitialFadeIn(Math.max(0, Math.floor(initialFadeIn - 1)))}
                          className="p-1 bg-white rounded-md border border-primary/20 text-primary hover:bg-primary hover:text-white transition-colors"
                        >
                          <Minus className="w-2.5 h-2.5" />
                        </button>
                        <div className="flex items-center gap-1">
                          <input 
                            type="number" 
                            min="0" max="15" step="1"
                            value={Math.floor(initialFadeIn)}
                            onChange={(e) => setInitialFadeIn(Math.min(15, Math.max(0, Math.floor(parseFloat(e.target.value) || 0))))}
                            className="w-8 text-center text-xs font-mono font-bold bg-primary/5 rounded-lg border-none focus:ring-1 focus:ring-primary p-1"
                          />
                          <span className="text-[9px] font-bold text-primary/60 uppercase">sec</span>
                        </div>
                        <button 
                          onClick={() => setInitialFadeIn(Math.min(15, Math.floor(initialFadeIn + 1)))}
                          className="p-1 bg-white rounded-md border border-primary/20 text-primary hover:bg-primary hover:text-white transition-colors"
                        >
                          <Plus className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

                <div className="flex flex-col gap-2">
                  {paginatedTracks.map((track, i) => {
                    const globalIndex = tracks.findIndex(t => t.id === track.id);
                    const displayIndex = (currentPage - 1) * ITEMS_PER_PAGE + i + 1;
                    return (
                      <TrackItem 
                        key={track.id}
                        track={track} 
                        index={globalIndex}
                        displayIndex={displayIndex}
                        totalTracks={sortedTracks.length}
                        isFirst={globalIndex === 0}
                        isLast={globalIndex === tracks.length - 1}
                        prevCrossfade={globalIndex > 0 ? tracks[globalIndex - 1].crossfadeNext : 0}
                        maxDuration={maxDuration}
                        isMixing={isMixing}
                        onUpdate={(updates) => {
                          setTracks(prev => prev.map(t => t.id === track.id ? { ...t, ...updates } : t));
                          if (onUpdateTrack) {
                            const newStore: Partial<SavedTestimony> = {};
                            if ('volume' in updates) newStore.studioVolume = (updates as any).volume;
                            if ('trimStart' in updates) newStore.studioTrimStart = (updates as any).trimStart;
                            if ('trimEnd' in updates) newStore.studioTrimEnd = (updates as any).trimEnd;
                            if ('crossfadeNext' in updates) newStore.studioCrossfadeNext = (updates as any).crossfadeNext;
                            onUpdateTrack(track.id, newStore);
                          }
                        }}
                        onRemove={() => setTrackToDelete(track.id)}
                        onMoveUp={() => {
                          const allTracks = [...tracks];
                          const visualOrdered = [...sortedTracks];
                          const visualIndex = visualOrdered.findIndex(t => t.id === track.id);
                          if (visualIndex <= 0) return;

                          const remaining = allTracks.filter(t => !visualOrdered.some(vt => vt.id === t.id));
                          const alignedTracks = [...visualOrdered, ...remaining];

                          [alignedTracks[visualIndex - 1], alignedTracks[visualIndex]] = [alignedTracks[visualIndex], alignedTracks[visualIndex - 1]];

                          setSortMethod('original');
                          setTracks(alignedTracks);
                          if (onReorderTracks) onReorderTracks(alignedTracks);
                        }}
                        onMoveDown={() => {
                          const allTracks = [...tracks];
                          const visualOrdered = [...sortedTracks];
                          const visualIndex = visualOrdered.findIndex(t => t.id === track.id);
                          if (visualIndex < 0 || visualIndex >= visualOrdered.length - 1) return;

                          const remaining = allTracks.filter(t => !visualOrdered.some(vt => vt.id === t.id));
                          const alignedTracks = [...visualOrdered, ...remaining];

                          [alignedTracks[visualIndex + 1], alignedTracks[visualIndex]] = [alignedTracks[visualIndex], alignedTracks[visualIndex + 1]];

                          setSortMethod('original');
                          setTracks(alignedTracks);
                          if (onReorderTracks) onReorderTracks(alignedTracks);
                        }}
                        onMoveTo={(newDisplayIndex) => {
                          const allTracks = [...tracks];
                          const visualOrdered = [...sortedTracks];
                          const visualIndex = visualOrdered.findIndex(t => t.id === track.id);
                          if (visualIndex < 0) return;

                          const newVisualIndex = newDisplayIndex - 1;
                          if (newVisualIndex < 0 || newVisualIndex >= visualOrdered.length) return;
                          if (newVisualIndex === visualIndex) return;

                          const [targetTrack] = visualOrdered.splice(visualIndex, 1);
                          visualOrdered.splice(newVisualIndex, 0, targetTrack);

                          const remaining = allTracks.filter(t => !sortedTracks.some(vt => vt.id === t.id));
                          const alignedTracks = [...visualOrdered, ...remaining];

                          setSortMethod('original');
                          setTracks(alignedTracks);
                          if (onReorderTracks) onReorderTracks(alignedTracks);
                        }}
                      />
                    );
                  })}
                </div>

              {currentPage === totalPages && finalFadeOut > 0 && (
                <div className="flex justify-center mt-4">
                  <div className="bg-white border border-accent/20 rounded-xl px-4 py-2 flex items-center gap-4 shadow-sm hover:border-accent transition-all">
                    <div className="p-1.5 bg-accent/5 rounded-lg text-accent">
                      <ArrowRightLeft className="w-4 h-4" />
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[9px] font-black text-accent uppercase tracking-widest">Fade Out Finale</span>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => setFinalFadeOut(Math.max(0, Math.floor(finalFadeOut - 1)))}
                          className="p-1 bg-white rounded-md border border-accent/20 text-accent hover:bg-accent hover:text-white transition-colors"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <div className="flex items-center gap-1">
                          <input 
                            type="number" 
                            min="0" max="15" step="1"
                            value={Math.floor(finalFadeOut)}
                            onChange={(e) => setFinalFadeOut(Math.min(15, Math.max(0, Math.floor(parseFloat(e.target.value) || 0))))}
                            className="w-12 text-center text-xs font-mono font-bold bg-accent/5 rounded-lg border-none focus:ring-1 focus:ring-accent p-1"
                          />
                          <span className="text-[9px] font-bold text-accent/60 uppercase">sec</span>
                        </div>
                        <button 
                          onClick={() => setFinalFadeOut(Math.min(15, Math.floor(finalFadeOut + 1)))}
                          className="p-1 bg-white rounded-md border border-accent/20 text-accent hover:bg-accent hover:text-white transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex flex-col items-center gap-4 py-6 bg-bg-secondary/20 rounded-2xl border border-border/50 mt-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="p-2 rounded-xl border border-border bg-white text-primary hover:bg-primary/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      
                      <div className="flex items-center gap-1 px-4">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => {
                          if (p === 1 || p === totalPages || (p >= currentPage - 1 && p <= currentPage + 1)) {
                            return (
                              <button
                                key={p}
                                onClick={() => setCurrentPage(p)}
                                className={`w-10 h-10 rounded-xl font-bold transition-all shadow-sm border ${
                                  currentPage === p 
                                    ? 'bg-primary text-white border-primary' 
                                    : 'bg-white text-primary border-border hover:border-primary/30'
                                }`}
                              >
                                {p}
                              </button>
                            );
                          }
                          if (p === currentPage - 2 || p === currentPage + 2) {
                            return <span key={p} className="text-text-muted px-1">...</span>;
                          }
                          return null;
                        })}
                      </div>

                      <button
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        className="p-2 rounded-xl border border-border bg-white text-primary hover:bg-primary/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-3 text-xs font-bold text-text-muted uppercase tracking-widest">
                      <span>Vai alla pagina:</span>
                      <input 
                        type="number"
                        min="1"
                        max={totalPages}
                        value={currentPage}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          if (val >= 1 && val <= totalPages) setCurrentPage(val);
                        }}
                        className="w-16 text-center py-1 bg-white border border-border rounded-lg focus:ring-1 focus:ring-primary outline-none"
                      />
                      <span>di {totalPages}</span>
                    </div>
                  </div>
                )}
            </div>
          </motion.div>
        ) : (
            <motion.div 
              key="final-phase"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col h-full overflow-y-auto lg:overflow-hidden pr-2"
            >
              {/* Phase 2: Final Mix */}
              <div className="flex flex-col gap-6 lg:overflow-y-auto h-full pb-12 pt-4">
                {/* Navigation and Title Row Phase 2 */}
                <div className="flex items-center justify-between gap-4 mb-4 bg-white/50 backdrop-blur-sm p-4 rounded-2xl border border-primary/5 sticky top-0 z-50">
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={handleGoBack} 
                      className="flex items-center gap-2 p-2 bg-white hover:bg-primary hover:text-white rounded-lg transition-all text-primary shadow-sm border border-primary/10 group px-3"
                    >
                      <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                      <span className="text-[9px] font-bold uppercase tracking-wider">Indietro</span>
                    </button>
                    <h1 className="text-lg font-serif font-bold text-primary tracking-tight">Fase 2: Mix Finale</h1>
                  </div>
                  <button 
                    onClick={handleFinalExport}
                    disabled={isMixing || !previewUrl}
                    className="flex items-center gap-2 px-4 py-2 bg-[#FFD700] text-primary rounded-lg hover:bg-[#FFC800] transition-all text-[10px] font-black uppercase tracking-widest shadow-sm border border-primary/10 group"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Esporta Finale</span>
                  </button>
                </div>

                {/* Global Mix Preview Controls Phase 2 */}
                <div className="flex flex-col items-center gap-4 py-6 bg-primary/5 rounded-3xl border border-primary/10">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-2 h-2 rounded-full ${isPlayingPreview ? 'bg-state-success animate-pulse' : 'bg-primary/30'}`} />
                    <span className="text-[10px] font-black text-primary uppercase tracking-[0.25em] whitespace-nowrap">Anteprima Mix Finale</span>
                  </div>
                  
                  <div className="flex items-center gap-4 bg-white px-6 py-3 rounded-[2rem] border border-primary/20 shadow-xl">
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => setIsLooping(!isLooping)}
                        className={`p-2.5 rounded-xl transition-all border ${isLooping ? 'bg-state-success text-white border-state-success shadow-md' : 'bg-white text-primary/60 border-primary/10 hover:border-primary/30'}`}
                        title="Loop"
                      >
                        <Repeat className="w-5 h-5" />
                      </button>

                      <button 
                        onClick={() => handlePreview()}
                        disabled={isMixing}
                        className={`p-3 rounded-xl transition-all border ${isPlayingPreview ? 'bg-state-success text-white border-state-success shadow-md' : 'bg-white text-primary border-primary/10 hover:bg-primary/5'}`}
                      >
                        {isMixing ? <Loader2 className="w-6 h-6 animate-spin" /> : <Play className={`w-6 h-6 ${isPlayingPreview ? 'fill-white' : 'fill-current'}`} />}
                      </button>

                      <button 
                        onClick={() => {
                          const active = audioRef.current;
                          const second = audioRef2.current;
                          if (active) { active.pause(); setIsPlayingPreview(false); setIsPaused(true); }
                          if (second) { second.pause(); setIsPlayingPreview(false); setIsPaused(true); }
                        }}
                        disabled={!isPlayingPreview}
                        className={`p-3 rounded-xl transition-all border ${isPaused ? 'bg-state-success text-white border-state-success shadow-md' : 'bg-white text-primary border-primary/10 hover:bg-primary/5 disabled:opacity-20'}`}
                      >
                        <Pause className={`w-6 h-6 ${isPaused ? 'fill-white' : 'fill-current'}`} />
                      </button>

                      <button 
                        onClick={() => {
                          if (audioRef.current) {
                            audioRef.current.pause();
                            audioRef.current.currentTime = 0;
                          }
                          if (audioRef2.current) {
                            audioRef2.current.pause();
                            audioRef2.current.currentTime = 0;
                          }
                          setActivePlayer(1);
                          isCrossfadingRef.current = false;
                          setIsPlayingPreview(false);
                          setIsPaused(false);
                        }}
                        disabled={!previewUrl}
                        className="p-3 bg-white text-primary/60 rounded-xl border border-primary/10 hover:text-state-error hover:border-state-error transition-all disabled:opacity-20"
                      >
                        <Square className="w-5 h-5 fill-current" />
                      </button>
                    </div>
                  </div>
                  {!previewUrl && !isMixing && (
                    <p className="text-[10px] text-primary/40 font-bold uppercase tracking-wider">Clicca play per generare il mix finale</p>
                  )}
                </div>

                <div className="bg-white p-6 rounded-xl shadow-institutional border border-border flex flex-col gap-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-text-secondary uppercase tracking-widest flex items-center gap-2">
                    <Music className="w-4 h-4" />
                    Timeline Mix Finale
                  </h2>
                </div>
                
                <div className="flex flex-col gap-8">
                  {/* Voices Track */}
                  <FinalMixTrack 
                    title="Traccia Voci (Montaggio)"
                    blob={voicesMixBlob!}
                    volume={voicesVolume}
                    onVolumeChange={setVoicesVolume}
                    type="VOICES"
                    color="#1a365d"
                    disabled={isMixing}
                  />

                  {/* Music Track */}
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between px-2">
                      <h3 className="text-xs font-bold text-primary uppercase tracking-widest">Traccia Musica</h3>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 mr-4 bg-bg-secondary/30 p-1 rounded-full border border-border/50">
                          {STANDARD_MUSIC.map((m) => {
                            const isSelected = musicTrack?.name === m.name;
                            return (
                              <button
                                key={m.id}
                                onClick={() => selectStandardMusic(m)}
                                className={`px-4 py-1.5 rounded-full transition-all text-[10px] font-bold uppercase tracking-wider border ${
                                  isSelected 
                                    ? 'bg-primary text-white border-primary shadow-md scale-105' 
                                    : 'bg-white/50 text-primary border-transparent hover:bg-white hover:border-primary/20'
                                }`}
                              >
                                {m.name}
                              </button>
                            );
                          })}
                        </div>
                        <label className="flex items-center gap-2 px-4 py-1.5 bg-accent/10 text-accent rounded-full cursor-pointer hover:bg-accent hover:text-white transition-all text-[10px] font-bold uppercase tracking-wider border border-accent/20">
                          <Plus className="w-3 h-3" />
                          Carica Altro
                          <input type="file" accept="audio/*" onChange={handleMusicUpload} className="hidden" />
                        </label>
                      </div>
                    </div>

                    {musicTrack ? (
                      <FinalMixTrack 
                        title={musicTrack.name}
                        blob={musicTrack.blob as Blob}
                        volume={musicVolume}
                        onVolumeChange={setMusicVolume}
                        type="MUSIC"
                        trimStart={musicTrimStart}
                        trimEnd={musicTrimEnd}
                        onTrimChange={(start, end) => {
                          setMusicTrimStart(start);
                          setMusicTrimEnd(end);
                        }}
                        onRemove={() => setMusicTrack(null)}
                        color="#d69e2e"
                        disabled={isMixing}
                      />
                    ) : (
                      <div className="h-32 border-2 border-dashed border-border rounded-2xl flex flex-col items-center justify-center gap-3 bg-bg-secondary/20 group hover:bg-bg-secondary/30 transition-colors">
                        <Music className="w-8 h-8 text-text-muted opacity-30 group-hover:scale-110 transition-transform" />
                        <p className="text-xs text-text-muted font-medium">Seleziona un'atmosfera o carica un file</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {phase === 'FINAL' && (
                <button 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setPhase('VOICES');
                  }}
                  className="w-full py-4 bg-white border border-primary/20 text-primary/60 rounded-2xl hover:bg-primary/5 transition-all flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] mt-8 mb-8"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Torna alla Fase 1 (Montaggio Voci)
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {trackToDelete && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl flex flex-col gap-4"
            >
              <div className="flex items-center gap-3 text-state-error">
                <Trash2 className="w-6 h-6" />
                <h3 className="text-lg font-bold font-serif">Conferma Eliminazione</h3>
              </div>
              <p className="text-sm text-text-secondary">Sei sicuro di voler rimuovere questa traccia dal montaggio? L'azione non può essere annullata.</p>
              <div className="flex gap-3 mt-2">
                <button 
                  onClick={() => setTrackToDelete(null)}
                  className="flex-1 px-4 py-2 bg-bg-secondary text-text-secondary rounded-full font-bold text-xs uppercase tracking-wider hover:bg-border transition-colors"
                >
                  Annulla
                </button>
                <button 
                  onClick={() => {
                    const newTracks = tracks.filter(t => t.id !== trackToDelete);
                    setTracks(newTracks);
                    if (onReorderTracks) {
                      onReorderTracks(newTracks);
                    }
                    setTrackToDelete(null);
                  }}
                  className="flex-1 px-4 py-2 bg-state-error text-white rounded-full font-bold text-xs uppercase tracking-wider hover:opacity-90 transition-opacity"
                >
                  Elimina
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Reset All Confirmation Modal */}
        {showResetConfirm && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 pl-10 md:pl-0">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl flex flex-col gap-6"
            >
              <div className="flex items-center gap-4 text-red-600">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                  <RotateCcw className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold font-serif leading-tight">Ripristinare i parametri originali?</h3>
              </div>
              
              <div className="text-slate-600 space-y-3 mb-2 text-sm leading-relaxed">
                <p>Questa operazione ripristinerà:</p>
                <ul className="list-disc pl-5 space-y-1 font-medium">
                  <li>L'ordine originale di registrazione</li>
                  <li>Tutti i ritagli delle voci a <span className="font-bold">10 secondi</span> (o durata intera se minore).</li>
                  <li>Le dissolvenze tra tracce a <span className="font-bold">2 secondi</span>.</li>
                  <li>I volumi delle voci all'<span className="font-bold">80%</span>.</li>
                </ul>
                <p className="text-red-500 font-bold uppercase text-[10px] tracking-widest mt-4">Attenzione: Questa azione sovrascrive il lavoro non salvato.</p>
              </div>
              
              <div className="flex gap-3 justify-end items-center mt-2">
                <button 
                  onClick={() => setShowResetConfirm(false)}
                  className="px-6 py-2.5 bg-slate-100 text-slate-600 rounded-full font-bold text-xs uppercase tracking-wider hover:bg-slate-200 transition-colors"
                >
                  Annulla
                </button>
                <button 
                  onClick={confirmResetAll}
                  className="px-6 py-2.5 bg-red-600 text-white rounded-full font-bold text-xs uppercase tracking-wider hover:bg-red-700 transition-colors shadow-md shadow-red-600/20"
                >
                  Sì, Ripristina
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mixing Overlay */}
      {isMixing && (
        <div className="fixed bottom-6 right-6 w-80 z-40">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-primary text-white p-5 rounded-xl shadow-2xl flex flex-col gap-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-widest">{mixMessage}</span>
              <span className="font-mono font-bold">{mixProgress}%</span>
            </div>
            <div className="w-full bg-white/20 h-1.5 rounded-full overflow-hidden">
              <motion.div 
                className="bg-white h-full"
                initial={{ width: 0 }}
                animate={{ width: `${mixProgress}%` }}
              />
            </div>
          </motion.div>
        </div>
      )}

      {/* Hidden Preview Audio Players for Seamless Crossfade Loop */}
      {previewUrl && (
        <>
          <audio 
            ref={audioRef}
            src={previewUrl} 
            onEnded={() => !isLooping && setIsPlayingPreview(false)}
            onPlay={() => {
              setIsPlayingPreview(true);
              window.dispatchEvent(new CustomEvent('studio-stop-all-audio', { detail: { emitterId: 'global-preview' } }));
            }}
            onPause={() => !isCrossfadingRef.current && setIsPlayingPreview(false)}
            onTimeUpdate={handleTimeUpdate}
            className="hidden"
          />
          <audio 
            ref={audioRef2}
            src={previewUrl} 
            onEnded={() => !isLooping && setIsPlayingPreview(false)}
            onPlay={() => {
              setIsPlayingPreview(true);
              window.dispatchEvent(new CustomEvent('studio-stop-all-audio', { detail: { emitterId: 'global-preview' } }));
            }}
            onPause={() => !isCrossfadingRef.current && setIsPlayingPreview(false)}
            onTimeUpdate={handleTimeUpdate}
            className="hidden"
          />
        </>
      )}

      {/* Zoom Modal Removed */}
      </div>
    </div>
  );
}

interface FinalMixTrackProps {
  title: string;
  blob: Blob;
  volume: number;
  onVolumeChange: (v: number) => void;
  type: 'VOICES' | 'MUSIC';
  trimStart?: number;
  trimEnd?: number;
  onTrimChange?: (start: number, end: number) => void;
  onRemove?: () => void;
  color: string;
  disabled?: boolean;
}

function FinalMixTrack({ 
  title, 
  blob, 
  volume, 
  onVolumeChange, 
  type, 
  trimStart, 
  trimEnd, 
  onTrimChange,
  onRemove,
  color,
  disabled = false
}: FinalMixTrackProps) {
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const regionsRef = useRef<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);

  const trimStartRef = useRef(trimStart);
  const trimEndRef = useRef(trimEnd);

  useEffect(() => {
    trimStartRef.current = trimStart;
    trimEndRef.current = trimEnd;
  }, [trimStart, trimEnd]);

  useEffect(() => {
    if (!waveformRef.current || !blob) return;

    let ws: WaveSurfer | null = null;
    let regions: any = null;
    let resizeObserver: ResizeObserver | null = null;
    let isDestroyed = false;
    let url = "";

    const initWaveSurfer = async () => {
      // Small delay of 60ms to let parent container layout animations settle down
      await new Promise(resolve => setTimeout(resolve, 60));
      if (isDestroyed || !waveformRef.current) return;

      ws = WaveSurfer.create({
        container: waveformRef.current,
        waveColor: '#cbd5e1',
        progressColor: color,
        cursorColor: '#d69e2e',
        barWidth: 2,
        barGap: 2,
        height: 80,
        normalize: true,
        interact: true,
      });

      regions = ws.registerPlugin(RegionsPlugin.create());
      regionsRef.current = regions;

      url = URL.createObjectURL(blob);
      ws.load(url).catch((err: any) => {
        if (err.name !== 'AbortError' && !err.message?.includes('abort')) {
          console.error("WaveSurfer preview error:", err);
        }
      });
      wavesurferRef.current = ws;

      ws.on('ready', (d) => {
        if (isDestroyed) return;
        setDuration(d);
        if (regions) {
          regions.clearRegions();
          if (type === 'MUSIC') {
            regions.addRegion({
              id: 'trim',
              start: trimStart || 0,
              end: trimEnd || d,
              color: 'rgba(214, 158, 46, 0.15)',
              drag: true,
              resize: true,
            });
            if (!trimEnd) onTrimChange?.(0, d);
          }
        }
      });

      if (regions) {
        regions.on('region-updated', (region: any) => {
          if (type === 'MUSIC') {
            onTrimChange?.(region.start, region.end);
          }
        });
      }

      let lastTime = 0;
      ws.on('timeupdate', (currentTime: number) => {
        if (ws && ws.isPlaying()) {
          const trimEndVal = trimEndRef.current || ws.getDuration();
          if (type === 'MUSIC' && lastTime < trimEndVal && currentTime >= trimEndVal) {
            ws.pause();
            ws.setTime(trimEndVal);
          }
        }
        lastTime = currentTime;
      });

      ws.on('play', () => {
        setIsPlaying(true);
        window.dispatchEvent(new CustomEvent('studio-stop-all-audio', { detail: { emitterId: 'final-' + type } }));
      });
      ws.on('pause', () => setIsPlaying(false));
      ws.on('finish', () => setIsPlaying(false));

      // Resize observer to handle container size changes
      if (typeof ResizeObserver !== 'undefined' && waveformRef.current) {
        resizeObserver = new ResizeObserver(() => {
          if (ws && !isDestroyed) {
            try {
              ws.zoom(0);
            } catch (e) {
              // ignore
            }
          }
        });
        resizeObserver.observe(waveformRef.current);
      }
    };

    initWaveSurfer();

    const handleStopAll = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.emitterId !== 'final-' + type && ws) {
        ws.pause();
      }
    };
    window.addEventListener('studio-stop-all-audio', handleStopAll);

    return () => {
      isDestroyed = true;
      window.removeEventListener('studio-stop-all-audio', handleStopAll);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      try {
        if (ws) {
          if (ws.isPlaying()) {
            ws.pause();
          }
          ws.destroy();
        }
      } catch (err) {
        console.error("WaveSurfer cleanup error:", err);
      }
      if (url) {
        URL.revokeObjectURL(url);
      }
      wavesurferRef.current = null;
      regionsRef.current = null;
    };
  }, [blob]); // Only re-init if blob changes

  // Update color when it changes
  useEffect(() => {
    if (!wavesurferRef.current) return;
    wavesurferRef.current.setOptions({
      progressColor: color,
    });
  }, [color]);

  // Disable region modifications and interaction during playback
  useEffect(() => {
    if (wavesurferRef.current) {
      try {
        wavesurferRef.current.setOptions({ interact: !isPlaying });
      } catch (e) {
        console.error("Error updating WaveSurfer interact option:", e);
      }
    }
    if (regionsRef.current) {
      try {
        const region = regionsRef.current.getRegions()[0];
        if (region) {
          region.setOptions({
            drag: !isPlaying,
            resize: !isPlaying,
          });
        }
      } catch (e) {
        console.error("Error updating regions drag/resize options:", e);
      }
    }
  }, [isPlaying]);

  return (
    <div className="bg-white p-4 rounded-2xl border-2 border-border/50 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <button 
              disabled={disabled}
              onClick={() => wavesurferRef.current?.playPause()}
              className="p-2 bg-bg-secondary rounded-full text-primary hover:bg-primary hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <button 
              disabled={disabled}
              onClick={() => {
                wavesurferRef.current?.stop();
                setIsPlaying(false);
              }}
              className="p-2 bg-bg-secondary rounded-full text-primary hover:bg-state-error hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Square className="w-4 h-4" />
            </button>
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-xs uppercase tracking-wider text-primary truncate max-w-[200px]">{title}</span>
            <span className="text-[9px] text-text-muted font-mono">Durata: {duration.toFixed(1)}s</span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-text-muted uppercase">Volume</span>
              <input 
                type="range" 
                min="0" max="1" step="0.1" 
                value={volume}
                onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                className="w-24 accent-primary h-1.5"
              />
              <span className="text-[10px] font-mono font-bold text-primary w-4">{(volume * 10).toFixed(0)}</span>
            </div>
            {/* Removed Ritardo slider as per Rule 1 (blindato a 2s) */}
          </div>
          {onRemove && (
            <button onClick={onRemove} className="p-2 text-text-muted hover:text-state-error transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="relative bg-bg-secondary/10 rounded-xl p-2 border border-border/30">
        <div ref={waveformRef} className="w-full" />
        {type === 'VOICES' && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-5">
          </div>
        )}
      </div>

      <div className="flex justify-between items-center px-1">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
          <span className="text-[9px] font-bold text-text-muted uppercase tracking-widest">
            {type === 'VOICES' ? 'Posizionamento Voci' : 'Ritaglio Musica'}
          </span>
        </div>
        {type === 'MUSIC' && trimStart !== undefined && trimEnd !== undefined && (
          <span className="text-[9px] font-mono text-text-muted">
            Utilizzo: {trimStart.toFixed(1)}s - {trimEnd.toFixed(1)}s ({(trimEnd - trimStart).toFixed(1)}s)
          </span>
        )}
      </div>
    </div>
  );
}

