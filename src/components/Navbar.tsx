import React from 'react';
import { ListMusic, Music, Play, Sliders, Sparkles, Clock, Upload, Download, Monitor, Palette } from 'lucide-react';
import { Setlist } from '../types';

export type ActiveTab = 'setlists' | 'songs' | 'stage' | 'tools' | 'import';
export type AppTheme = 'scene-sombre' | 'jour' | 'neon';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  setlists: Setlist[];
  activeSetlistId: string | null;
  setActiveSetlistId: (id: string) => void;
  onLaunchStageMode: () => void;
  onOpenImportModal: () => void;
  onOpenExportModal?: () => void;
  onOpenDesktopModal?: () => void;
  theme?: AppTheme;
  onChangeTheme?: (theme: AppTheme) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  setlists,
  activeSetlistId,
  setActiveSetlistId,
  onLaunchStageMode,
  onOpenImportModal,
  onOpenExportModal,
  onOpenDesktopModal,
  theme = 'scene-sombre',
  onChangeTheme,
}) => {
  const activeSetlist = setlists.find((s) => s.id === activeSetlistId) || setlists[0];

  return (
    <header className="sticky top-0 z-40 bg-zinc-900/50 backdrop-blur-md border-b border-zinc-800 text-zinc-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-4 cursor-pointer" onClick={() => setActiveTab('setlists')}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-gradient-to-tr from-amber-600 to-orange-500 rounded flex items-center justify-center text-black font-extrabold text-xs shadow-md">
                HL
              </div>
              <div className="flex flex-col">
                <span className="text-white font-bold tracking-tight text-sm leading-tight">
                  Hamide Litime Software
                </span>
                <span className="text-[10px] text-zinc-400 font-medium">
                  Stage Prompter &amp; MIDI Studio
                </span>
              </div>
            </div>

            {activeSetlist && (
              <>
                <div className="h-4 w-[1px] bg-zinc-800 hidden md:block"></div>
                <div className="hidden md:flex flex-col">
                  <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">
                    Setlist Actuelle
                  </span>
                  <span className="text-xs text-white font-medium truncate max-w-[160px]">
                    {activeSetlist.name}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => setActiveTab('setlists')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-semibold transition ${
                activeTab === 'setlists'
                  ? 'bg-orange-500/10 text-orange-400 border border-orange-500/30'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
              }`}
            >
              <ListMusic className="w-3.5 h-3.5" />
              <span>Setlists</span>
            </button>

            <button
              onClick={() => setActiveTab('songs')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-semibold transition ${
                activeTab === 'songs'
                  ? 'bg-orange-500/10 text-orange-400 border border-orange-500/30'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
              }`}
            >
              <Music className="w-3.5 h-3.5" />
              <span>Chansons</span>
            </button>

            <button
              onClick={() => setActiveTab('tools')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-semibold transition ${
                activeTab === 'tools'
                  ? 'bg-orange-500/10 text-orange-400 border border-orange-500/30'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Outils & Métronome</span>
              <span className="md:hidden">Outils</span>
            </button>

            <button
              onClick={onOpenImportModal}
              className="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-semibold bg-orange-500/20 text-orange-300 border border-orange-500/40 hover:bg-orange-500/30 transition cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-orange-400" />
              <span className="hidden sm:inline">Importer (.msb/.pdf)</span>
              <span className="sm:hidden">Importer</span>
            </button>

            {onOpenExportModal && (
              <button
                onClick={onOpenExportModal}
                className="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700 hover:text-white transition cursor-pointer"
                title="Exporter vos chansons et setlists vers MobileSheets (.msb / .msf)"
              >
                <Download className="w-3.5 h-3.5 text-orange-400" />
                <span className="hidden sm:inline">Exporter (.msb)</span>
                <span className="sm:hidden">Export</span>
              </button>
            )}

            {onOpenDesktopModal && (
              <button
                onClick={onOpenDesktopModal}
                className="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-semibold bg-blue-950/40 text-blue-300 border border-blue-800/60 hover:bg-blue-900/60 hover:text-white transition cursor-pointer"
                title="Application Native Desktop Windows 11 (Tauri v2)"
              >
                <Monitor className="w-3.5 h-3.5 text-blue-400" />
                <span className="hidden sm:inline">Windows 11 (Tauri)</span>
                <span className="sm:hidden">Win 11</span>
              </button>
            )}
          </nav>

          {/* Quick Stage View Trigger & Active Setlist Selection */}
          <div className="flex items-center gap-3">
            {onChangeTheme && (
              <div className="hidden md:flex items-center gap-1 bg-zinc-950 border border-zinc-800 p-0.5 rounded" title="Thème visuel de l'application">
                <button
                  onClick={() => onChangeTheme('scene-sombre')}
                  className={`p-1.5 rounded transition cursor-pointer ${theme === 'scene-sombre' ? 'bg-orange-500 text-black' : 'text-zinc-400 hover:text-white'}`}
                  title="Scène Sombre — contraste élevé pour le noir complet"
                >
                  <Palette className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onChangeTheme('jour')}
                  className={`p-1.5 rounded transition cursor-pointer ${theme === 'jour' ? 'bg-orange-500 text-black' : 'text-zinc-400 hover:text-white'}`}
                  title="Jour / Répétition — fonds clairs sans reflets"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onChangeTheme('neon')}
                  className={`p-1.5 rounded transition cursor-pointer ${theme === 'neon' ? 'bg-orange-500 text-black' : 'text-zinc-400 hover:text-white'}`}
                  title="Studio Néon — variante stylisée cyan/magenta"
                >
                  <Music className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {setlists.length > 0 && (
              <div className="hidden lg:flex items-center gap-2 bg-zinc-950 border border-zinc-800 px-2.5 py-1 rounded">
                <Clock className="w-3.5 h-3.5 text-orange-400" />
                <select
                  value={activeSetlistId || ''}
                  onChange={(e) => setActiveSetlistId(e.target.value)}
                  className="bg-transparent text-xs text-zinc-300 font-medium focus:outline-none cursor-pointer"
                >
                  {setlists.map((s) => (
                    <option key={s.id} value={s.id} className="bg-zinc-900 text-white">
                      {s.name} ({s.entries.length})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={onLaunchStageMode}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-400 text-black font-bold text-xs uppercase tracking-wider rounded transition cursor-pointer shadow-md"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>MODE SCÈNE</span>
            </button>
          </div>

        </div>
      </div>
    </header>
  );
};
