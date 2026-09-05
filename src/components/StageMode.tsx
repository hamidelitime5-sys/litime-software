import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  SkipBack,
  X,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  ListMusic,
  ZoomIn,
  ZoomOut,
  Radio,
  Sliders,
  Columns,
  Square,
  Zap,
  Gauge,
  Piano,
  Music,
  ChevronUp,
  ChevronDown,
  Clock,
  Sparkles,
  SlidersHorizontal,
  FastForward,
  Mic2,
  Flame,
  Target,
} from 'lucide-react';
import { NotationMode, Setlist, Song } from '../types';
import { transposeChordPro } from '../utils/chordUtils';
import { metronomeEngine, rhythmEngine, DRUM_GROOVES, DrumGrooveStyle } from '../utils/audioEngine';
import { midiAudioEngine, MidiPlaybackState } from '../utils/midiAudioEngine';
import { JamTrackPlayer } from './JamTrackPlayer';
import { MidiMultiTrackPlayer } from './MidiMultiTrackPlayer';

interface StageModeProps {
  setlist?: Setlist;
  singleSong?: Song;
  songs: Song[];
  onExitStageMode: () => void;
  onOpenChordModal: (chordName: string) => void;
  onUpdateSong?: (updatedSong: Song) => void;
}

export type ScrollSyncMode = 'midi_realtime' | 'tempo_duration' | 'manual';

export const StageMode: React.FC<StageModeProps> = ({
  setlist,
  singleSong,
  songs,
  onExitStageMode,
  onOpenChordModal,
  onUpdateSong,
}) => {
  // If setlist provided, get all valid song tracks
  const trackEntries = setlist
    ? setlist.entries.filter((e) => e.type === 'song')
    : singleSong
    ? [{ id: 'single', type: 'song', songId: singleSong.id, targetKey: singleSong.key }]
    : [];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(5.0); // Fine px per second (1.0 to 60.0)
  const [scrollSyncMode, setScrollSyncMode] = useState<ScrollSyncMode>('tempo_duration');
  const [scrollProgressPercent, setScrollProgressPercent] = useState(0);
  const [isSpeedPanelOpen, setIsSpeedPanelOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<any>(null);

  const [fontSize, setFontSize] = useState(1.25); // rem
  const [notationMode] = useState<NotationMode>('standard');
  const [isMetronomePlaying, setIsMetronomePlaying] = useState(false);
  const [isRhythmPlaying, setIsRhythmPlaying] = useState(false);
  const [rhythmStyle, setRhythmStyle] = useState<DrumGrooveStyle>('latin_afrocuban');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isJamDockOpen, setIsJamDockOpen] = useState(false); // Side-by-Side Jam Track view
  const [dockViewMode, setDockViewMode] = useState<'midi' | 'backing'>('midi');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeBeat, setActiveBeat] = useState<{ beat: number; isAccent: boolean } | null>(null);

  // Karaoke Real-Time Illumination States
  const [isKaraokeMode, setIsKaraokeMode] = useState(true);
  const [karaokeColor, setKaraokeColor] = useState<'orange' | 'cyan' | 'gold' | 'emerald'>('orange');
  const [autoCenterKaraoke, setAutoCenterKaraoke] = useState(true);

  const [midiPlaybackState, setMidiPlaybackState] = useState<MidiPlaybackState>(() => midiAudioEngine.getState());

  const currentEntry = trackEntries[currentIndex];
  const currentSong = currentEntry ? songs.find((s) => s.id === currentEntry.songId) || singleSong : singleSong;
  const targetKey = currentEntry?.targetKey || currentSong?.key || 'C';

  const contentRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 1800);
  };

  // Setup metronome & rhythm engine callbacks
  useEffect(() => {
    metronomeEngine.setBeatCallback((beat, isAccent) => {
      setActiveBeat({ beat: beat + 1, isAccent });
      setTimeout(() => setActiveBeat(null), 120);
    });

    rhythmEngine.setStepCallback((_step, _totalSteps, isAccent, beatNumber) => {
      setActiveBeat({ beat: beatNumber, isAccent });
      setTimeout(() => setActiveBeat(null), 120);
    });
  }, []);

  // Subscribe to MIDI Engine state
  useEffect(() => {
    const unsubscribe = midiAudioEngine.subscribe((state) => {
      setMidiPlaybackState(state);

      // Realtime MIDI follow mode
      if (scrollSyncMode === 'midi_realtime' && state.duration > 0 && contentRef.current) {
        const totalHeight = contentRef.current.scrollHeight;
        const visibleHeight = contentRef.current.clientHeight;
        const maxScroll = Math.max(0, totalHeight - visibleHeight);

        if (state.isPlaying) {
          setIsScrolling(true);
          const progressFraction = Math.min(1, Math.max(0, state.currentTime / state.duration));
          contentRef.current.scrollTop = progressFraction * maxScroll;
        } else if (!state.isPlaying && isScrolling && state.currentTime === 0) {
          setIsScrolling(false);
        }
      }
    });

    return () => unsubscribe();
  }, [scrollSyncMode, isScrolling]);

  // Recalculate optimal scroll speed based on partition height and duration
  const recalculateTempoScrollSpeed = useCallback((song: Song) => {
    if (!contentRef.current) return;
    const totalHeight = contentRef.current.scrollHeight || 1000;
    const visibleHeight = contentRef.current.clientHeight || 600;
    const scrollDistance = Math.max(40, totalHeight - visibleHeight);

    // Duration in seconds (use MIDI duration if available, else song duration or estimate)
    const midiDur = midiPlaybackState.duration > 0 ? midiPlaybackState.duration : null;
    const duration = midiDur || song.durationSeconds || Math.max(90, Math.min(360, (120 / (song.bpm || 110)) * 160));
    
    const calculatedSpeed = Math.max(1.0, Math.min(45.0, Number((scrollDistance / duration).toFixed(1))));

    if (scrollSyncMode === 'tempo_duration') {
      setScrollSpeed(calculatedSpeed);
    }
  }, [scrollSyncMode, midiPlaybackState.duration]);

  // Update engines and recalculate speed when song changes
  useEffect(() => {
    if (currentSong) {
      const bpm = currentSong.bpm || 110;
      metronomeEngine.setBpm(bpm);
      rhythmEngine.setBpm(bpm);

      // Auto-pick appropriate groove style for known songs
      if (currentSong.title.toLowerCase().includes('café') || currentSong.tags?.includes('Afro-Cubain')) {
        setRhythmStyle('latin_afrocuban');
        rhythmEngine.setStyle('latin_afrocuban');
      } else {
        rhythmEngine.setStyle(rhythmStyle);
      }

      // If song has MIDI data, prefer midi_realtime mode
      if (currentSong.midiData) {
        setScrollSyncMode('midi_realtime');
      }

      // Delay slightly for DOM render to compute scrollHeight accurately
      setTimeout(() => {
        recalculateTempoScrollSpeed(currentSong);
      }, 150);
    }
  }, [currentSong, rhythmStyle, recalculateTempoScrollSpeed]);

  // Handle scroll progress update
  const handleScroll = () => {
    if (!contentRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = contentRef.current;
    const maxScroll = scrollHeight - clientHeight;
    if (maxScroll > 0) {
      const pct = Math.min(100, Math.max(0, (scrollTop / maxScroll) * 100));
      setScrollProgressPercent(pct);
    }
  };

  // Jump to click position on progress bar
  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || !contentRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickRatio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const maxScroll = contentRef.current.scrollHeight - contentRef.current.clientHeight;
    contentRef.current.scrollTop = clickRatio * maxScroll;

    // If in MIDI realtime mode and MIDI loaded, seek MIDI too
    if (scrollSyncMode === 'midi_realtime' && midiPlaybackState.duration > 0) {
      midiAudioEngine.seek(clickRatio * midiPlaybackState.duration);
    }
  };

  // Toggle Metronome Click
  const toggleMetronome = () => {
    if (isRhythmPlaying) {
      rhythmEngine.stop();
      setIsRhythmPlaying(false);
    }
    const isPlaying = metronomeEngine.toggle();
    setIsMetronomePlaying(isPlaying);
  };

  // Toggle Rhythm / Drum Beat Accompaniment
  const toggleRhythm = () => {
    if (isMetronomePlaying) {
      metronomeEngine.stop();
      setIsMetronomePlaying(false);
    }
    const isPlaying = rhythmEngine.toggle();
    setIsRhythmPlaying(isPlaying);
  };

  // Master Play: Toggle both Auto-Scroll, Accompaniment Beat and MIDI
  const handleMasterPlayToggle = () => {
    if (isScrolling || isRhythmPlaying || midiPlaybackState.isPlaying) {
      setIsScrolling(false);
      rhythmEngine.stop();
      setIsRhythmPlaying(false);
      if (midiPlaybackState.isPlaying) midiAudioEngine.pause();
    } else {
      setIsScrolling(true);
      rhythmEngine.start();
      setIsRhythmPlaying(true);
      if (currentSong?.midiData && !midiPlaybackState.isPlaying) {
        midiAudioEngine.play();
      }
    }
  };

  // Toggle Auto Scroll with MIDI sync
  const toggleAutoScroll = () => {
    const nextScrolling = !isScrolling;
    setIsScrolling(nextScrolling);

    // If in MIDI sync mode, start/stop MIDI playback in sync
    if (scrollSyncMode === 'midi_realtime' && currentSong?.midiData) {
      if (nextScrolling && !midiPlaybackState.isPlaying) {
        midiAudioEngine.play();
      } else if (!nextScrolling && midiPlaybackState.isPlaying) {
        midiAudioEngine.pause();
      }
    }
  };

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === 'Space') {
        e.preventDefault();
        toggleAutoScroll();
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        setScrollSpeed((prev) => {
          const next = Math.min(60, Number((prev + (e.shiftKey ? 2 : 0.5)).toFixed(1)));
          showToast(`⚡ Vitesse : ${next} px/s`);
          return next;
        });
        setScrollSyncMode('manual');
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        setScrollSpeed((prev) => {
          const next = Math.max(1, Number((prev - (e.shiftKey ? 2 : 0.5)).toFixed(1)));
          showToast(`⚡ Vitesse : ${next} px/s`);
          return next;
        });
        setScrollSyncMode('manual');
      } else if (e.code === 'Home' || e.code === 'KeyR') {
        e.preventDefault();
        if (contentRef.current) contentRef.current.scrollTop = 0;
        if (midiPlaybackState.duration > 0) midiAudioEngine.seek(0);
        showToast('⏮️ Début de la partition');
      } else if (e.code === 'ArrowRight' || e.code === 'KeyN') {
        e.preventDefault();
        handleNextSong();
      } else if (e.code === 'ArrowLeft' || e.code === 'KeyP') {
        e.preventDefault();
        handlePrevSong();
      } else if (e.code === 'KeyB') {
        e.preventDefault();
        toggleRhythm();
      } else if (e.code === 'KeyM') {
        e.preventDefault();
        setDockViewMode('midi');
        setIsJamDockOpen((prev) => !prev);
      } else if (e.code === 'KeyJ') {
        e.preventDefault();
        setDockViewMode('backing');
        setIsJamDockOpen((prev) => !prev);
      } else if (e.code === 'Escape') {
        onExitStageMode();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      metronomeEngine.stop();
      rhythmEngine.stop();
    };
  }, [currentIndex, trackEntries.length, isScrolling, isRhythmPlaying, scrollSyncMode, midiPlaybackState.isPlaying, midiPlaybackState.duration, currentSong]);

  // Smooth Auto-Scrolling loop (for 'manual' and 'tempo_duration' modes)
  useEffect(() => {
    let animationFrameId: number;
    let lastTime: number | null = null;

    const scrollStep = (time: number) => {
      if (!lastTime) lastTime = time;
      const delta = (time - lastTime) / 1000;
      lastTime = time;

      // Only perform time-delta scrolling if not in realtime MIDI mode (which is driven by MIDI timeline)
      if (isScrolling && contentRef.current && scrollSyncMode !== 'midi_realtime') {
        contentRef.current.scrollTop += scrollSpeed * delta;
      }

      if (isScrolling) {
        animationFrameId = requestAnimationFrame(scrollStep);
      }
    };

    if (isScrolling) {
      animationFrameId = requestAnimationFrame(scrollStep);
    }

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [isScrolling, scrollSpeed, scrollSyncMode]);

  const handleNextSong = () => {
    if (currentIndex < trackEntries.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setIsScrolling(false);
      if (contentRef.current) contentRef.current.scrollTop = 0;
      if (midiPlaybackState.isPlaying) midiAudioEngine.stop();
    }
  };

  const handlePrevSong = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setIsScrolling(false);
      if (contentRef.current) contentRef.current.scrollTop = 0;
      if (midiPlaybackState.isPlaying) midiAudioEngine.stop();
    }
  };

  const toggleFullscreenMode = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  if (!currentSong) {
    return (
      <div className="fixed inset-0 z-50 bg-neutral-950 text-white flex flex-col items-center justify-center p-6">
        <h2 className="text-xl font-bold mb-4">Aucune chanson sélectionnée pour le Mode Scène</h2>
        <button onClick={onExitStageMode} className="px-5 py-2 bg-orange-500 text-black font-bold rounded-lg cursor-pointer">
          Quitter le Mode Scène
        </button>
      </div>
    );
  }

  // Next song preview title
  const nextEntry = trackEntries[currentIndex + 1];
  const nextSong = nextEntry ? songs.find((s) => s.id === nextEntry.songId) : null;

  // Format seconds to mm:ss
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Parse transposed ChordPro content into structured lines for Karaoke Tracking
  const parsedChordProLines = useMemo(() => {
    if (!currentSong) return [];
    const transposed = transposeChordPro(currentSong.chordProContent, 0, notationMode, targetKey);
    const rawLines = transposed.split('\n');
    let lyricCounter = 0;

    return rawLines.map((line, originalIndex) => {
      const trimmed = line.trim();
      const isComment = (trimmed.startsWith('{') && trimmed.endsWith('}')) || trimmed.startsWith('#');
      const sectionMatch = trimmed.match(/^\[(Verse|Chorus|Intro|Bridge|Solo|Outro|Pre-Chorus|Couplet|Refrain|Pont)[^\]]*\]$/i);

      if (isComment) {
        return { type: 'comment' as const, originalIndex, text: line };
      }
      if (sectionMatch) {
        return {
          type: 'section' as const,
          originalIndex,
          sectionName: trimmed.replace(/^\[|\]$/g, ''),
          text: line,
        };
      }
      if (trimmed.length === 0) {
        return { type: 'empty' as const, originalIndex, text: '' };
      }

      // Check for timestamp tags like {time: 01:23} or [01:23.00]
      const timeMatch = trimmed.match(/(?:\{time:\s*|\[)(\d{1,2}):(\d{2})(?:\.\d+)?(?:\}|\])/i);
      let taggedSeconds: number | undefined;
      if (timeMatch) {
        taggedSeconds = parseInt(timeMatch[1], 10) * 60 + parseInt(timeMatch[2], 10);
      }

      const cleanLine = trimmed.replace(/\{time:\s*\d{1,2}:\d{2}\}/gi, '');
      const parts = cleanLine.split(/(\[[^\]]+\])/g).filter(Boolean);
      const hasChords = parts.some((p) => p.startsWith('[') && p.endsWith(']'));
      const lyricIndex = lyricCounter++;

      return {
        type: 'lyric' as const,
        originalIndex,
        lyricIndex,
        hasChords,
        parts: parts.map((part) => ({
          isChord: part.startsWith('[') && part.endsWith(']'),
          text: part.startsWith('[') && part.endsWith(']') ? part.slice(1, -1) : part,
        })),
        taggedSeconds,
        text: cleanLine,
      };
    });
  }, [currentSong, notationMode, targetKey]);

  const totalLyricLines = useMemo(() => {
    return parsedChordProLines.filter((l) => l.type === 'lyric').length || 1;
  }, [parsedChordProLines]);

  // Total song playback duration
  const activeSongDuration = useMemo(() => {
    if (midiPlaybackState.duration > 0) return midiPlaybackState.duration;
    if (currentSong?.durationSeconds && currentSong.durationSeconds > 0) return currentSong.durationSeconds;
    return Math.max(60, (120 / (currentSong?.bpm || 110)) * 160);
  }, [midiPlaybackState.duration, currentSong]);

  // Current playback progress fraction (0.0 to 1.0)
  const currentProgressFraction = useMemo(() => {
    if (midiPlaybackState.duration > 0) {
      return Math.max(0, Math.min(1, midiPlaybackState.currentTime / midiPlaybackState.duration));
    }
    return Math.max(0, Math.min(1, scrollProgressPercent / 100));
  }, [midiPlaybackState.currentTime, midiPlaybackState.duration, scrollProgressPercent]);

  // Active Karaoke Line Index
  const activeKaraokeLyricIndex = useMemo(() => {
    if (totalLyricLines <= 0) return 0;
    const currentTime = midiPlaybackState.currentTime;
    if (midiPlaybackState.duration > 0) {
      const taggedLines = parsedChordProLines.filter((l) => l.type === 'lyric' && l.taggedSeconds !== undefined);
      if (taggedLines.length > 0) {
        let best = taggedLines[0];
        for (const line of taggedLines) {
          if (line.taggedSeconds! <= currentTime) {
            best = line;
          } else {
            break;
          }
        }
        if (best.lyricIndex !== undefined) return best.lyricIndex;
      }
    }

    const calculatedIndex = Math.floor(currentProgressFraction * totalLyricLines);
    return Math.max(0, Math.min(totalLyricLines - 1, calculatedIndex));
  }, [totalLyricLines, currentProgressFraction, midiPlaybackState.currentTime, midiPlaybackState.duration, parsedChordProLines]);

  // Active line internal progression (0.0 to 1.0) for live underline progress fill
  const activeLineProgress = useMemo(() => {
    const rawVal = (currentProgressFraction * totalLyricLines) - activeKaraokeLyricIndex;
    return Math.max(0, Math.min(1, rawVal));
  }, [currentProgressFraction, totalLyricLines, activeKaraokeLyricIndex]);

  // Auto-centering effect when Karaoke is active and song is playing
  useEffect(() => {
    if (isKaraokeMode && autoCenterKaraoke && (midiPlaybackState.isPlaying || isScrolling)) {
      if (activeLineRef.current && contentRef.current) {
        const container = contentRef.current;
        const lineElem = activeLineRef.current;
        const containerRect = container.getBoundingClientRect();
        const lineRect = lineElem.getBoundingClientRect();

        const targetScrollTop = container.scrollTop + (lineRect.top - containerRect.top) - (container.clientHeight * 0.35);

        container.scrollTo({
          top: Math.max(0, targetScrollTop),
          behavior: 'smooth',
        });
      }
    }
  }, [activeKaraokeLyricIndex, isKaraokeMode, autoCenterKaraoke, midiPlaybackState.isPlaying, isScrolling]);

  // Interactive Click on a Lyric Line to Jump/Seek in Song
  const handleSeekToLyricLine = (lyricIndex: number) => {
    const fraction = Math.max(0, Math.min(1, lyricIndex / Math.max(1, totalLyricLines)));
    const targetSeconds = fraction * activeSongDuration;

    if (midiPlaybackState.duration > 0) {
      midiAudioEngine.seek(targetSeconds);
      showToast(`🎯 Karaoké sauté à ${formatTime(targetSeconds)}`);
    } else {
      showToast(`🎯 Ligne ${lyricIndex + 1}/${totalLyricLines}`);
    }

    if (contentRef.current) {
      const maxScroll = contentRef.current.scrollHeight - contentRef.current.clientHeight;
      if (maxScroll > 0) {
        contentRef.current.scrollTo({
          top: fraction * maxScroll,
          behavior: 'smooth',
        });
      }
    }
  };

  const getKaraokeTheme = () => {
    switch (karaokeColor) {
      case 'cyan':
        return {
          name: 'Bleu Cyan Néon',
          badge: 'bg-cyan-500 text-black shadow-cyan-500/50',
          border: 'border-cyan-400',
          bgGradient: 'from-cyan-950/80 via-cyan-900/30 to-transparent',
          textGlow: 'text-cyan-100 font-bold drop-shadow-[0_0_12px_rgba(6,182,212,0.8)]',
          progressBar: 'bg-gradient-to-r from-cyan-400 to-teal-300 shadow-sm shadow-cyan-400/50',
          chordActive: 'bg-cyan-400 text-black border-cyan-300 shadow-md shadow-cyan-400/60 font-black scale-105',
          activeIndicator: 'bg-cyan-400',
        };
      case 'gold':
        return {
          name: 'Or Scène & Étoiles',
          badge: 'bg-amber-400 text-black shadow-amber-400/50',
          border: 'border-amber-400',
          bgGradient: 'from-amber-950/80 via-amber-900/30 to-transparent',
          textGlow: 'text-amber-100 font-bold drop-shadow-[0_0_12px_rgba(251,191,36,0.8)]',
          progressBar: 'bg-gradient-to-r from-amber-400 to-yellow-300 shadow-sm shadow-amber-400/50',
          chordActive: 'bg-amber-400 text-black border-amber-300 shadow-md shadow-amber-400/60 font-black scale-105',
          activeIndicator: 'bg-amber-400',
        };
      case 'emerald':
        return {
          name: 'Vert Émeraude Laser',
          badge: 'bg-emerald-500 text-black shadow-emerald-500/50',
          border: 'border-emerald-400',
          bgGradient: 'from-emerald-950/80 via-emerald-900/30 to-transparent',
          textGlow: 'text-emerald-100 font-bold drop-shadow-[0_0_12px_rgba(16,185,129,0.8)]',
          progressBar: 'bg-gradient-to-r from-emerald-400 to-teal-300 shadow-sm shadow-emerald-400/50',
          chordActive: 'bg-emerald-400 text-black border-emerald-300 shadow-md shadow-emerald-400/60 font-black scale-105',
          activeIndicator: 'bg-emerald-400',
        };
      case 'orange':
      default:
        return {
          name: 'Orange Flamboyant',
          badge: 'bg-orange-500 text-black shadow-orange-500/50',
          border: 'border-orange-400',
          bgGradient: 'from-orange-950/80 via-amber-950/30 to-transparent',
          textGlow: 'text-orange-100 font-bold drop-shadow-[0_0_12px_rgba(249,115,22,0.8)]',
          progressBar: 'bg-gradient-to-r from-orange-400 to-amber-300 shadow-sm shadow-orange-400/50',
          chordActive: 'bg-orange-500 text-black border-orange-300 shadow-md shadow-orange-500/60 font-black scale-105',
          activeIndicator: 'bg-orange-400',
        };
    }
  };

  const currentTheme = getKaraokeTheme();

  return (
    <div className="fixed inset-0 z-50 bg-black text-white flex flex-col select-none overflow-hidden font-sans">
      
      {/* Toast Notification for Speed Adjustment */}
      {toastMessage && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-zinc-900/95 text-orange-400 border border-orange-500/50 shadow-2xl px-4 py-2 rounded-full text-xs font-bold font-mono animate-fade-in flex items-center gap-2 pointer-events-none">
          <Zap className="w-3.5 h-3.5 fill-current" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Stage Bar (HUD) */}
      <header className="bg-zinc-900 border-b border-zinc-800 px-4 py-2.5 flex items-center justify-between gap-3 flex-shrink-0 relative">
        
        {/* Song Info & Index */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsDrawerOpen(true)}
            className="p-2 bg-zinc-800 hover:bg-zinc-700 text-orange-400 rounded border border-zinc-700 flex items-center gap-2 cursor-pointer transition"
            title="Ouvrir le menu de la setlist"
          >
            <ListMusic className="w-4 h-4" />
            {setlist && (
              <span className="text-xs font-mono font-bold hidden md:inline">
                {currentIndex + 1}/{trackEntries.length}
              </span>
            )}
          </button>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-bold text-white leading-tight tracking-tight">
                {currentSong.title}
              </h1>
              <span className="px-2 py-0.5 bg-orange-500 text-black rounded text-xs font-bold font-mono">
                {targetKey}
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 font-medium truncate max-w-[180px] sm:max-w-xs">
              {currentSong.artist}
            </p>
          </div>
        </div>

        {/* Center: BPM & Beat accompaniment buttons */}
        <div className="flex items-center gap-2">
          {/* Visual 4-beat pulse indicators */}
          <div className="flex items-center gap-1.5 bg-zinc-950 border border-zinc-800 px-2.5 py-1.5 rounded">
            <span className="text-[10px] text-zinc-400 font-bold uppercase">BPM</span>
            <span className="text-xs font-bold font-mono text-orange-400">{currentSong.bpm}</span>
            <div className="flex items-center gap-0.5 ml-1">
              {[1, 2, 3, 4].map((b) => {
                const isActive = activeBeat?.beat === b;
                return (
                  <div
                    key={b}
                    className={`w-2 h-3.5 rounded-sm transition-all duration-75 ${
                      isActive
                        ? b === 1
                          ? 'bg-orange-400 scale-110 shadow-md shadow-orange-400'
                          : 'bg-green-400 scale-105'
                        : 'bg-zinc-800'
                    }`}
                  />
                );
              })}
            </div>
          </div>

          {/* Quick Rhythm / Drum Beat Button */}
          <button
            onClick={toggleRhythm}
            className={`px-3 py-1.5 rounded border text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
              isRhythmPlaying
                ? 'bg-orange-500 text-black border-orange-400 shadow-md animate-pulse font-extrabold'
                : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:text-white hover:bg-zinc-700'
            }`}
            title="Activer/Désactiver le battement d'accompagnement batterie (Raccourci: B)"
          >
            <Zap className={`w-3.5 h-3.5 ${isRhythmPlaying ? 'fill-current' : 'text-orange-400'}`} />
            <span className="hidden sm:inline">{isRhythmPlaying ? 'Battement Actif' : 'Battement'}</span>
          </button>

          {/* Simple Metronome Click Button */}
          <button
            onClick={toggleMetronome}
            className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded border text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
              isMetronomePlaying
                ? 'bg-amber-500 text-black border-amber-400 shadow'
                : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-white'
            }`}
            title="Activer/Désactiver le clic métronome"
          >
            {isMetronomePlaying ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span className="hidden md:inline">Clic</span>
          </button>

          {/* MIDI Multi-Track & SF2 Player Toggle Button */}
          <button
            onClick={() => {
              setDockViewMode('midi');
              setIsJamDockOpen((prev) => (!isJamDockOpen || dockViewMode !== 'midi' ? true : false));
            }}
            className={`px-3 py-1.5 rounded border text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
              isJamDockOpen && dockViewMode === 'midi'
                ? 'bg-purple-600 text-white border-purple-500 shadow-lg shadow-purple-500/30'
                : 'bg-purple-950/40 text-purple-300 border-purple-800 hover:bg-purple-900/40'
            }`}
            title="Ouvrir le Lecteur MIDI Multi-pistes & VSampler 3 (Raccourci: M)"
          >
            <Piano className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden sm:inline">Lecteur MIDI</span>
            {midiPlaybackState.isPlaying && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            )}
          </button>

          {/* Karaoke Mode Toggle Button */}
          <button
            onClick={() => {
              setIsKaraokeMode((prev) => {
                const next = !prev;
                showToast(next ? '✨ Mode Karaoké Lumineux Activé' : 'Mode Karaoké Désactivé');
                return next;
              });
            }}
            className={`px-3 py-1.5 rounded border text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
              isKaraokeMode
                ? `${currentTheme.badge} border-transparent shadow-lg font-black scale-105 animate-pulse`
                : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-white'
            }`}
            title="Activer/Désactiver l'illumination Karaoké synchronisée au MIDI"
          >
            <Mic2 className="w-3.5 h-3.5 fill-current" />
            <span className="hidden sm:inline">Karaoké Lumineux</span>
            {isKaraokeMode && (
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
            )}
          </button>

          {/* Jam Track Video/Audio Toggle Button */}
          <button
            onClick={() => {
              setDockViewMode('backing');
              setIsJamDockOpen((prev) => (!isJamDockOpen || dockViewMode !== 'backing' ? true : false));
            }}
            className={`px-2.5 py-1.5 rounded border text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
              isJamDockOpen && dockViewMode === 'backing'
                ? 'bg-orange-600 text-white border-orange-500 shadow-lg shadow-orange-500/30'
                : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-white'
            }`}
            title="Afficher la vidéo ou backing track YouTube (Raccourci: J)"
          >
            <Columns className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Vidéo / Jam</span>
          </button>
        </div>

        {/* Stage Teleprompter Controls: Fine Scroll & Font Zoom */}
        <div className="flex items-center gap-2">
          
          {/* Rich Fine-Tuned Scroll & Karaoke Options Widget */}
          <div className="relative">
            <button
              onClick={() => setIsSpeedPanelOpen((prev) => !prev)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-bold border transition cursor-pointer ${
                isSpeedPanelOpen
                  ? 'bg-orange-500 text-black border-orange-400 shadow'
                  : 'bg-zinc-950 text-orange-400 border-zinc-800 hover:border-orange-500/50'
              }`}
              title="Ouvrir les réglages de défilement et de Karaoké"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span className="font-mono">{scrollSpeed} px/s</span>
              <span className="text-[10px] opacity-75 font-sans hidden sm:inline">
                {scrollSyncMode === 'midi_realtime' ? '(MIDI)' : scrollSyncMode === 'tempo_duration' ? '(Auto)' : '(Man)'}
              </span>
            </button>

            {/* Expanded Fine-Tuning Dropdown Panel */}
            {isSpeedPanelOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-zinc-900 border border-zinc-700 rounded-xl p-4 shadow-2xl z-50 space-y-3.5 animate-fade-in text-xs max-h-[85vh] overflow-y-auto">
                
                <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-orange-400" /> Réglages Scène & Karaoké
                  </span>
                  <button
                    onClick={() => setIsSpeedPanelOpen(false)}
                    className="p-1 text-zinc-400 hover:text-white rounded cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Section Karaoké Lumineux */}
                <div className="space-y-2 bg-zinc-950 p-3 rounded-lg border border-zinc-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Mic2 className="w-4 h-4 text-orange-400" />
                      <span className="font-bold text-white">Illumination Karaoké MIDI</span>
                    </div>
                    <button
                      onClick={() => setIsKaraokeMode((k) => !k)}
                      className={`px-2.5 py-1 rounded text-xs font-bold transition cursor-pointer ${
                        isKaraokeMode ? 'bg-orange-500 text-black font-extrabold shadow' : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {isKaraokeMode ? 'ACTIVÉ' : 'DÉSACTIVÉ'}
                    </button>
                  </div>

                  {isKaraokeMode && (
                    <div className="space-y-2 pt-1 border-t border-zinc-800/80">
                      <div>
                        <span className="text-[10px] text-zinc-400 font-bold uppercase">Couleur d'illumination :</span>
                        <div className="grid grid-cols-4 gap-1 mt-1">
                          {[
                            { id: 'orange', label: 'Orange', bg: 'bg-orange-500' },
                            { id: 'cyan', label: 'Cyan', bg: 'bg-cyan-500' },
                            { id: 'gold', label: 'Or Scène', bg: 'bg-amber-400' },
                            { id: 'emerald', label: 'Émeraude', bg: 'bg-emerald-500' },
                          ].map((col) => (
                            <button
                              key={col.id}
                              onClick={() => setKaraokeColor(col.id as any)}
                              className={`py-1 px-1.5 rounded text-[10px] font-bold border transition text-center cursor-pointer ${
                                karaokeColor === col.id
                                  ? `${col.bg} text-black font-black border-white shadow`
                                  : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-600'
                              }`}
                            >
                              {col.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[11px] text-zinc-300">Centrage automatique sur le texte :</span>
                        <input
                          type="checkbox"
                          checked={autoCenterKaraoke}
                          onChange={(e) => setAutoCenterKaraoke(e.target.checked)}
                          className="w-4 h-4 accent-orange-500 cursor-pointer"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Synchronization Modes */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-zinc-400 uppercase">Mode de Synchronisation :</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    
                    <button
                      onClick={() => {
                        setScrollSyncMode('midi_realtime');
                        showToast('⚡ Défilement asservi en temps réel au MIDI');
                      }}
                      className={`p-2 rounded border text-center transition cursor-pointer ${
                        scrollSyncMode === 'midi_realtime'
                          ? 'bg-purple-950 border-purple-500 text-purple-200 font-bold'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                      title="Suit directement le timing et la lecture du fichier MIDI"
                    >
                      <div className="text-sm">⚡</div>
                      <div className="text-[10px] mt-0.5">Sync MIDI</div>
                    </button>

                    <button
                      onClick={() => {
                        setScrollSyncMode('tempo_duration');
                        if (currentSong) recalculateTempoScrollSpeed(currentSong);
                        showToast('⏱️ Défilement calibré sur la durée du morceau');
                      }}
                      className={`p-2 rounded border text-center transition cursor-pointer ${
                        scrollSyncMode === 'tempo_duration'
                          ? 'bg-orange-950 border-orange-500 text-orange-200 font-bold'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                      title="Calcule la vitesse exacte pour arriver en bas à la fin du morceau"
                    >
                      <div className="text-sm">⏱️</div>
                      <div className="text-[10px] mt-0.5">Sync Durée</div>
                    </button>

                    <button
                      onClick={() => {
                        setScrollSyncMode('manual');
                        showToast('🎚️ Mode Vitesse Libre');
                      }}
                      className={`p-2 rounded border text-center transition cursor-pointer ${
                        scrollSyncMode === 'manual'
                          ? 'bg-emerald-950 border-emerald-500 text-emerald-200 font-bold'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                      title="Vitesse fixe personnalisée avec réglage fin au pixel près"
                    >
                      <div className="text-sm">🎚️</div>
                      <div className="text-[10px] mt-0.5">Manuel</div>
                    </button>

                  </div>
                </div>

                {/* Fine Precision Slider & Steppers */}
                <div className="space-y-2 bg-zinc-950 p-3 rounded-lg border border-zinc-800">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-zinc-300 font-medium">Vitesse de Défilement :</span>
                    <span className="text-xs font-bold font-mono text-orange-400 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-700">
                      {scrollSpeed} px/s
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setScrollSyncMode('manual');
                        setScrollSpeed((prev) => Math.max(1, Number((prev - 0.5).toFixed(1))));
                      }}
                      className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-white rounded text-xs font-bold cursor-pointer"
                      title="-0.5 px/s"
                    >
                      -
                    </button>

                    <input
                      type="range"
                      min="1.0"
                      max="40.0"
                      step="0.5"
                      value={scrollSpeed}
                      onChange={(e) => {
                        setScrollSyncMode('manual');
                        setScrollSpeed(Number(Number(e.target.value).toFixed(1)));
                      }}
                      className="flex-1 accent-orange-500 cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
                    />

                    <button
                      onClick={() => {
                        setScrollSyncMode('manual');
                        setScrollSpeed((prev) => Math.min(60, Number((prev + 0.5).toFixed(1))));
                      }}
                      className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-white rounded text-xs font-bold cursor-pointer"
                      title="+0.5 px/s"
                    >
                      +
                    </button>
                  </div>

                  {/* Quick Preset Speed Buttons */}
                  <div className="flex items-center justify-between gap-1 pt-1">
                    {[
                      { label: '🐢 2', val: 2.0, desc: 'Très Lent' },
                      { label: '🚶 5', val: 5.0, desc: 'Lent (3-4 min)' },
                      { label: '🎵 9', val: 9.0, desc: 'Moyen' },
                      { label: '⚡ 15', val: 15.0, desc: 'Dynamique' },
                      { label: '🚀 25', val: 25.0, desc: 'Rapide' },
                    ].map((p) => (
                      <button
                        key={p.val}
                        onClick={() => {
                          setScrollSyncMode('manual');
                          setScrollSpeed(p.val);
                        }}
                        className={`px-1.5 py-1 text-[10px] font-bold rounded transition flex-1 text-center cursor-pointer ${
                          scrollSpeed === p.val
                            ? 'bg-orange-500 text-black font-extrabold shadow'
                            : 'bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800'
                        }`}
                        title={`${p.desc} (${p.val} px/s)`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Auto Recalculate Button */}
                <button
                  onClick={() => {
                    setScrollSyncMode('tempo_duration');
                    if (currentSong) recalculateTempoScrollSpeed(currentSong);
                    showToast('🎯 Vitesse recalculée selon la partition');
                  }}
                  className="w-full py-1.5 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer border border-zinc-700"
                >
                  <Sparkles className="w-3.5 h-3.5 text-orange-400" />
                  <span>Calculer vitesse idéale pour ce morceau</span>
                </button>

                <p className="text-[10px] text-zinc-500">
                  💡 <em>Astuce Karaoké :</em> Cliquez sur <strong>n'importe quelle ligne de paroles</strong> pour sauter instantanément à cet endroit dans la chanson !
                </p>

              </div>
            )}
          </div>

          {/* Font Zoom */}
          <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded">
            <button
              onClick={() => setFontSize((f) => Math.max(0.9, f - 0.15))}
              className="p-1.5 text-zinc-400 hover:text-white cursor-pointer"
              title="Diminuer la taille du texte"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-mono font-bold px-1 text-orange-400">
              {(fontSize * 100).toFixed(0)}%
            </span>
            <button
              onClick={() => setFontSize((f) => Math.min(2.2, f + 0.15))}
              className="p-1.5 text-zinc-400 hover:text-white cursor-pointer"
              title="Agrandir la taille du texte"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={toggleFullscreenMode}
            className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded border border-zinc-700 cursor-pointer"
            title="Plein Écran"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          <button
            onClick={onExitStageMode}
            className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded transition cursor-pointer"
            title="Quitter le Mode Scène"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

      </header>

      {/* Interactive Top Teleprompter Progress Bar */}
      <div
        ref={progressBarRef}
        onClick={handleProgressBarClick}
        className="w-full h-2 bg-zinc-950 hover:h-3.5 border-b border-zinc-800 transition-all cursor-pointer relative group flex-shrink-0"
        title="Cliquez pour sauter directement dans la partition"
      >
        <div
          className="h-full bg-gradient-to-r from-orange-600 via-amber-500 to-orange-400 transition-all duration-100"
          style={{ width: `${scrollProgressPercent}%` }}
        />
        
        {/* Progress Tooltip / Indicator */}
        <div className="absolute left-2 top-0 bottom-0 flex items-center opacity-0 group-hover:opacity-100 transition text-[9px] font-mono text-zinc-300 pointer-events-none">
          <span>Défilement : {scrollProgressPercent.toFixed(0)}%</span>
          {midiPlaybackState.duration > 0 && (
            <span className="ml-2 text-orange-400">
              • {formatTime(midiPlaybackState.currentTime)} / {formatTime(midiPlaybackState.duration)}
            </span>
          )}
        </div>
      </div>

      {/* Main Workspace (Partition + Optional Side Dock Jam Track) */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        
        {/* Main Lyrics & Chords Teleprompter Canvas */}
        <main
          ref={contentRef}
          onScroll={handleScroll}
          className={`flex-1 overflow-y-auto p-6 sm:p-10 space-y-6 scrollbar-thin scrollbar-thumb-zinc-800 transition-all ${
            isJamDockOpen ? 'md:w-3/5 lg:w-2/3' : 'max-w-5xl mx-auto w-full'
          }`}
          style={{ fontSize: `${fontSize}rem` }}
        >
          {/* Performance Notes Banner */}
          {currentSong.notes && (
            <div className="p-3.5 bg-orange-500/10 border-l-2 border-orange-500 text-orange-200 text-xs font-semibold rounded-r mb-6">
              💡 {currentSong.notes}
            </div>
          )}

          {/* Karaoke Transposed Chord Chart */}
          <div className="space-y-3">
            {parsedChordProLines.map((item, idx) => {
              if (item.type === 'comment' || item.type === 'empty') return null;

              if (item.type === 'section') {
                return (
                  <div key={`sec-${idx}`} className="pt-6 pb-2 flex items-center gap-3">
                    <span className="px-3.5 py-1 bg-gradient-to-r from-orange-500 to-amber-500 text-black font-extrabold rounded-md text-xs tracking-wider uppercase font-mono shadow-md shadow-orange-500/20 flex items-center gap-1.5">
                      <Flame className="w-3.5 h-3.5 fill-black" />
                      <span>{item.sectionName}</span>
                    </span>
                    <div className="flex-1 h-px bg-zinc-800/80"></div>
                  </div>
                );
              }

              // Lyric / Chord Line
              const isActive = isKaraokeMode && item.lyricIndex === activeKaraokeLyricIndex;
              const isNext = isKaraokeMode && item.lyricIndex === activeKaraokeLyricIndex + 1;
              const isPast = isKaraokeMode && item.lyricIndex !== undefined && item.lyricIndex < activeKaraokeLyricIndex;

              return (
                <div
                  key={`line-${idx}`}
                  ref={isActive ? activeLineRef : undefined}
                  onClick={() => item.lyricIndex !== undefined && handleSeekToLyricLine(item.lyricIndex)}
                  className={`relative rounded-r-xl transition-all duration-200 cursor-pointer group px-3 py-2 ${
                    isActive
                      ? `bg-gradient-to-r ${currentTheme.bgGradient} border-l-4 ${currentTheme.border} shadow-2xl scale-[1.01] my-2`
                      : isNext
                      ? 'border-l-2 border-zinc-700 bg-zinc-900/30 hover:bg-zinc-900/60'
                      : isPast
                      ? 'opacity-60 hover:opacity-100 border-l-2 border-transparent hover:border-zinc-700 hover:bg-zinc-900/40'
                      : 'hover:bg-zinc-900/40 border-l-2 border-transparent hover:border-zinc-700'
                  }`}
                  title="Cliquer pour caler le Karaoké / MIDI directement sur cette ligne"
                >
                  {/* Live Karaoke Progression Underline Bar */}
                  {isActive && (
                    <div className="absolute left-0 bottom-0 h-1 bg-zinc-800 w-full rounded-full overflow-hidden">
                      <div
                        className={`h-full ${currentTheme.progressBar} transition-all duration-75`}
                        style={{ width: `${Math.min(100, Math.max(0, activeLineProgress * 100))}%` }}
                      />
                    </div>
                  )}

                  {/* Active Indicator & Line Time Tag */}
                  {isActive && (
                    <div className="flex items-center gap-2 mb-1 animate-fade-in">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${currentTheme.badge}`}>
                        <Mic2 className="w-3 h-3 fill-current" />
                        <span>Chantez</span>
                      </span>
                      {midiPlaybackState.duration > 0 && (
                        <span className="text-[10px] font-mono font-bold text-zinc-400">
                          ⏱️ {formatTime(midiPlaybackState.currentTime)}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Lyrics Content without Chords */}
                  {!item.hasChords ? (
                    <p
                      className={`font-sans leading-relaxed min-h-[1.5em] transition-colors ${
                        isActive
                          ? `${currentTheme.textGlow} text-white font-bold text-[1.06em]`
                          : isNext
                          ? 'text-zinc-200 font-medium'
                          : 'text-zinc-300'
                      }`}
                    >
                      {item.text}
                    </p>
                  ) : (
                    /* Lyrics Content with Chords */
                    <div className="flex flex-wrap items-end gap-x-3 gap-y-2 py-0.5">
                      {item.parts?.map((part, pIdx) => {
                        if (part.isChord) {
                          return (
                            <button
                              key={pIdx}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenChordModal(part.text);
                              }}
                              className={`px-2.5 py-0.5 font-mono font-bold rounded text-xs transition cursor-pointer shadow-sm ${
                                isActive
                                  ? currentTheme.chordActive
                                  : 'bg-zinc-800 hover:bg-zinc-700 text-orange-400 border border-zinc-700 hover:border-orange-500'
                              }`}
                            >
                              {part.text}
                            </button>
                          );
                        }

                        return (
                          <span
                            key={pIdx}
                            className={`font-mono whitespace-pre transition-colors ${
                              isActive
                                ? `${currentTheme.textGlow} text-white font-bold text-[1.06em]`
                                : isNext
                                ? 'text-zinc-100 font-medium'
                                : 'text-zinc-300 font-medium'
                            }`}
                          >
                            {part.text}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Hover Jump Tooltip */}
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition text-[10px] font-mono text-zinc-400 bg-zinc-950 px-2 py-1 rounded border border-zinc-800 pointer-events-none">
                    🎯 Caler Karaoké ici
                  </span>
                </div>
              );
            })}
          </div>

          {/* Bottom Spacing Buffer for smooth scrolling past end */}
          <div className="h-96" />
        </main>

        {/* Side-by-Side Docked Accompaniment View (MIDI Multi-Tracks with SF2 or Jam Video) */}
        {isJamDockOpen && (
          <aside
            className="w-full md:w-2/5 lg:w-[42%] border-t md:border-t-0 md:border-l border-zinc-800 bg-zinc-950 flex flex-col h-96 md:h-auto animate-fade-in shadow-2xl flex-shrink-0"
            style={{ resize: 'horizontal', overflow: 'auto', minWidth: 320 }}
          >
            {/* Dock Top Tabs Switcher */}
            <div className="flex items-center justify-between p-2 bg-zinc-900 border-b border-zinc-800">
              <div className="flex items-center gap-1 bg-zinc-950 p-0.5 rounded border border-zinc-800">
                <button
                  onClick={() => setDockViewMode('midi')}
                  className={`px-3 py-1 text-xs font-bold rounded transition flex items-center gap-1.5 cursor-pointer ${
                    dockViewMode === 'midi'
                      ? 'bg-purple-600 text-white shadow'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Piano className="w-3.5 h-3.5" />
                  <span>Lecteur MIDI & VSampler 3</span>
                </button>

                <button
                  onClick={() => setDockViewMode('backing')}
                  className={`px-3 py-1 text-xs font-bold rounded transition flex items-center gap-1.5 cursor-pointer ${
                    dockViewMode === 'backing'
                      ? 'bg-orange-600 text-white shadow'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Columns className="w-3.5 h-3.5" />
                  <span>Vidéo / Audio Jam</span>
                </button>
              </div>

              <button
                onClick={() => setIsJamDockOpen(false)}
                className="p-1 text-zinc-400 hover:text-white rounded hover:bg-zinc-800 cursor-pointer"
                title="Fermer le volet latéral"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Active Dock Component */}
            <div className="flex-1 overflow-hidden">
              {dockViewMode === 'midi' ? (
                <MidiMultiTrackPlayer
                  currentSong={currentSong}
                  mode="dock"
                  onClose={() => setIsJamDockOpen(false)}
                  isAutoScrolling={isScrolling}
                  onToggleAutoScroll={toggleAutoScroll}
                  onSaveMidiToSong={(base64, fileName) => {
                    if (currentSong && onUpdateSong) {
                      onUpdateSong({
                        ...currentSong,
                        midiData: base64,
                        midiFileName: fileName,
                        updatedAt: Date.now(),
                      });
                    }
                  }}
                />
              ) : (
                <JamTrackPlayer
                  currentSong={currentSong}
                  mode="dock"
                  onClose={() => setIsJamDockOpen(false)}
                  isAutoScrolling={isScrolling}
                  onToggleAutoScroll={toggleAutoScroll}
                />
              )}
            </div>
          </aside>
        )}

      </div>

      {/* Bottom Stage Control Dock */}
      <footer className="bg-zinc-900 border-t border-zinc-800 px-4 py-2.5 flex items-center justify-between gap-3 flex-shrink-0">
        
        {/* Song Switchers */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevSong}
            disabled={currentIndex === 0}
            className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 text-white font-bold text-xs rounded border border-zinc-700 transition cursor-pointer"
          >
            <SkipBack className="w-4 h-4" />
            <span className="hidden sm:inline">Précédent</span>
          </button>

          <button
            onClick={handleNextSong}
            disabled={currentIndex === trackEntries.length - 1}
            className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 text-white font-bold text-xs rounded border border-zinc-700 transition cursor-pointer"
          >
            <span className="hidden sm:inline">Suivant</span>
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        {/* Center: Play / Pause Controls (Auto-Scroll & Master Play) */}
        <div className="flex items-center gap-2.5">
          
          <button
            onClick={() => {
              if (contentRef.current) contentRef.current.scrollTop = 0;
              if (midiPlaybackState.duration > 0) midiAudioEngine.seek(0);
              showToast('⏮️ Début');
            }}
            className="p-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded border border-zinc-700 transition cursor-pointer"
            title="Remonter au début de la partition (Raccourci: R ou Origine)"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Autoscroll Only Button */}
          <button
            onClick={toggleAutoScroll}
            className={`flex items-center gap-2 px-4 py-2.5 rounded font-bold text-xs uppercase tracking-wider transition shadow cursor-pointer ${
              isScrolling
                ? 'bg-orange-500 text-black hover:bg-orange-400 shadow-orange-500/30'
                : 'bg-zinc-800 text-orange-400 hover:bg-zinc-700 border border-zinc-700'
            }`}
          >
            {isScrolling ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
            <span>{isScrolling ? 'Pause Défilement' : 'Défilement Auto'}</span>
          </button>

          {/* Master Play Button: Défilement + Battement ensemble */}
          <button
            onClick={handleMasterPlayToggle}
            className={`hidden sm:flex items-center gap-2 px-3.5 py-2.5 rounded font-bold text-xs uppercase tracking-wider transition shadow cursor-pointer ${
              isScrolling && isRhythmPlaying
                ? 'bg-red-500 text-white hover:bg-red-400'
                : 'bg-orange-500/20 text-orange-300 border border-orange-500/40 hover:bg-orange-500/30'
            }`}
            title="Lancer le défilement et la batterie d'accompagnement en même temps"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>{isScrolling && isRhythmPlaying ? 'Tout Arrêter' : 'Défilement + Batterie'}</span>
          </button>
        </div>

        {/* Right: Quick speed stepper & Next Song Badge */}
        <div className="flex items-center gap-2">
          
          {/* Quick Fine-Tuning Steppers in Footer */}
          <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded px-2 py-1 gap-1">
            <button
              onClick={() => {
                setScrollSyncMode('manual');
                setScrollSpeed((prev) => {
                  const next = Math.max(1, Number((prev - 0.5).toFixed(1)));
                  showToast(`⚡ Vitesse : ${next} px/s`);
                  return next;
                });
              }}
              className="px-1.5 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded text-[10px] font-bold cursor-pointer"
              title="Ralentir (-0.5 px/s)"
            >
              -
            </button>

            <button
              onClick={() => setIsSpeedPanelOpen((prev) => !prev)}
              className="text-xs font-mono font-bold text-orange-400 px-1 cursor-pointer hover:underline"
              title="Cliquer pour configurer la vitesse"
            >
              {scrollSpeed} px/s
            </button>

            <button
              onClick={() => {
                setScrollSyncMode('manual');
                setScrollSpeed((prev) => {
                  const next = Math.min(60, Number((prev + 0.5).toFixed(1)));
                  showToast(`⚡ Vitesse : ${next} px/s`);
                  return next;
                });
              }}
              className="px-1.5 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded text-[10px] font-bold cursor-pointer"
              title="Accélérer (+0.5 px/s)"
            >
              +
            </button>
          </div>

          {/* Next Song Preview Badge */}
          <div className="hidden lg:flex items-center gap-2 bg-zinc-950 border border-zinc-800 px-3 py-1.5 rounded text-xs">
            <span className="text-zinc-500 font-bold uppercase text-[10px]">Suivant :</span>
            {nextSong ? (
              <span className="text-orange-400 font-bold font-mono text-xs truncate max-w-[130px]">
                {nextSong.title}
              </span>
            ) : (
              <span className="text-zinc-500 font-medium text-xs">Fin du Set</span>
            )}
          </div>
        </div>

      </footer>

      {/* Setlist Drawer Overlay */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex justify-start animate-fade-in">
          <div className="w-80 bg-zinc-900 border-r border-zinc-800 text-white p-6 flex flex-col h-full shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800 mb-4">
              <h3 className="font-bold text-sm text-orange-400 flex items-center gap-2">
                <ListMusic className="w-4 h-4" /> Programme du Concert
              </h3>
              <button onClick={() => setIsDrawerOpen(false)} className="p-1 text-zinc-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {trackEntries.map((entry, idx) => {
                const s = songs.find((song) => song.id === entry.songId);
                if (!s) return null;
                const isCurrent = idx === currentIndex;

                return (
                  <div
                    key={entry.id}
                    onClick={() => {
                      setCurrentIndex(idx);
                      setIsDrawerOpen(false);
                      if (contentRef.current) contentRef.current.scrollTop = 0;
                    }}
                    className={`p-2.5 rounded border transition cursor-pointer flex items-center justify-between gap-3 ${
                      isCurrent
                        ? 'bg-orange-500 text-black border-orange-400 font-bold shadow'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:bg-zinc-800'
                    }`}
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <span className="text-xs font-mono font-bold w-5">{idx + 1}.</span>
                      <span className="text-xs font-bold truncate">{s.title}</span>
                    </div>

                    <span className={`text-xs font-mono px-2 py-0.5 rounded ${isCurrent ? 'bg-black/20 text-black font-bold' : 'bg-black/30 text-orange-300'}`}>
                      {entry.targetKey || s.key}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

