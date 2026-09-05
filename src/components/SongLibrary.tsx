import React, { useState } from 'react';
import { Search, Plus, Sparkles, Guitar, Play, Edit3, Trash2, Clock, Music, Upload, Download, AlertTriangle, X } from 'lucide-react';
import { Song } from '../types';

interface SongLibraryProps {
  songs: Song[];
  onSelectSongToEdit: (song: Song) => void;
  onCreateNewSong: () => void;
  onOpenImportModal: () => void;
  onOpenExportModal?: (song?: Song) => void;
  onDeleteSong: (id: string) => void;
  onDeleteAllSongs?: () => void;
  onLaunchSingleSongStageView: (song: Song) => void;
}

export const SongLibrary: React.FC<SongLibraryProps> = ({
  songs,
  onSelectSongToEdit,
  onCreateNewSong,
  onOpenImportModal,
  onOpenExportModal,
  onDeleteSong,
  onDeleteAllSongs,
  onLaunchSingleSongStageView,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('Tous');
  const [sortBy, setSortBy] = useState<'title' | 'artist' | 'bpm' | 'key' | 'updated'>('updated');
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  const [isConfirmingDeleteAll, setIsConfirmingDeleteAll] = useState(false);

  const ALPHABET = ['#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')];

  // Strip accents so "É" matches the "E" bucket, etc.
  const firstLetterOf = (title: string) => {
    const normalized = title.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const first = normalized.charAt(0).toUpperCase();
    return /[A-Z]/.test(first) ? first : '#';
  };

  // Collect all unique tags
  const allTags = Array.from(new Set(['Tous', ...songs.flatMap((s) => s.tags || [])]));

  // Filter and sort songs
  const filteredSongs = songs
    .filter((song) => {
      const matchesSearch =
        song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        song.artist.toLowerCase().includes(searchQuery.toLowerCase()) ||
        song.key.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTag = selectedTag === 'Tous' || (song.tags && song.tags.includes(selectedTag));
      const matchesLetter = !selectedLetter || firstLetterOf(song.title) === selectedLetter;
      return matchesSearch && matchesTag && matchesLetter;
    })
    .sort((a, b) => {
      if (sortBy === 'title') return a.title.localeCompare(b.title);
      if (sortBy === 'artist') return a.artist.localeCompare(b.artist);
      if (sortBy === 'bpm') return b.bpm - a.bpm;
      if (sortBy === 'key') return a.key.localeCompare(b.key);
      return b.updatedAt - a.updatedAt;
    });

  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins}m ${remainder < 10 ? '0' : ''}${remainder}s`;
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner & Action Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-900/50 border border-zinc-800 p-6 rounded-lg">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Music className="w-6 h-6 text-orange-500" /> Repertoire & Partitions
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Gérez vos grilles d'accords, paroles, transpositions et métadonnées de scène pour vos {songs.length} chansons.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {onOpenExportModal && (
            <button
              onClick={() => onOpenExportModal()}
              className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 font-bold text-xs uppercase tracking-wider rounded transition cursor-pointer"
              title="Exporter toute la bibliothèque en sauvegarde MobileSheets (.msb) ou JSON"
            >
              <Download className="w-3.5 h-3.5 text-zinc-400" />
              <span>Exporter (.msb / .msf)</span>
            </button>
          )}

          <button
            onClick={onOpenImportModal}
            className="flex items-center gap-2 px-3 py-2 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/30 font-bold text-xs uppercase tracking-wider rounded transition cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-orange-400" />
            <span>Importer des chansons</span>
          </button>

          <button
            onClick={onCreateNewSong}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-400 text-black font-bold text-xs uppercase tracking-wider rounded transition cursor-pointer shadow-md"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nouvelle Chanson</span>
          </button>

          {onDeleteAllSongs && songs.length > 0 && (
            <button
              onClick={() => setIsConfirmingDeleteAll(true)}
              className="flex items-center gap-2 px-3 py-2 bg-red-950/40 hover:bg-red-900/50 text-red-400 border border-red-900/60 font-bold text-xs uppercase tracking-wider rounded transition cursor-pointer"
              title="Effacer toute la bibliothèque de chansons"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Tout effacer</span>
            </button>
          )}
        </div>
      </div>

      {/* Alphabetical Filter Bar */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none bg-zinc-900/50 border border-zinc-800 p-2 rounded-lg">
        <button
          onClick={() => setSelectedLetter(null)}
          className={`flex-shrink-0 px-2.5 py-1 rounded text-xs font-bold transition ${
            selectedLetter === null
              ? 'bg-orange-500 text-black'
              : 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700'
          }`}
        >
          Tout
        </button>
        {ALPHABET.map((letter) => {
          const hasSongs = songs.some((s) => firstLetterOf(s.title) === letter);
          return (
            <button
              key={letter}
              onClick={() => setSelectedLetter(selectedLetter === letter ? null : letter)}
              disabled={!hasSongs}
              className={`flex-shrink-0 w-7 h-7 rounded text-xs font-bold transition ${
                selectedLetter === letter
                  ? 'bg-orange-500 text-black'
                  : hasSongs
                  ? 'bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 cursor-pointer'
                  : 'bg-zinc-900 text-zinc-700 cursor-not-allowed'
              }`}
            >
              {letter}
            </button>
          );
        })}
      </div>

      {/* Delete-All Confirmation Modal */}
      {isConfirmingDeleteAll && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-red-900/60 rounded-xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-sm font-bold text-white">Tout effacer ?</h3>
            </div>
            <p className="text-xs text-zinc-400">
              Êtes-vous sûr de vouloir supprimer toutes vos chansons ({songs.length}) ? Cette action est <strong className="text-red-400">définitive et irréversible</strong>.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsConfirmingDeleteAll(false)}
                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold rounded transition cursor-pointer"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  onDeleteAllSongs?.();
                  setIsConfirmingDeleteAll(false);
                }}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded transition cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Oui, tout supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search, Filter & Sorting Bar */}
      <div className="flex flex-col lg:flex-row gap-4 justify-between items-center bg-zinc-900/50 border border-zinc-800 p-4 rounded-lg">
        
        {/* Search Bar */}
        <div className="relative w-full lg:w-96">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher titre, artiste, tonalité (ex: Champs-Élysées, C, Joe)..."
            className="w-full bg-zinc-950 border border-zinc-800 text-white pl-10 pr-4 py-2 rounded text-xs focus:outline-none focus:border-orange-500 transition"
          />
        </div>

        {/* Tag Filters */}
        <div className="flex items-center gap-2 overflow-x-auto w-full lg:w-auto pb-2 lg:pb-0 scrollbar-none">
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setSelectedTag(tag)}
              className={`px-3 py-1.5 rounded text-xs font-semibold whitespace-nowrap transition ${
                selectedTag === tag
                  ? 'bg-orange-500 text-black font-bold'
                  : 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>

        {/* Sort selector */}
        <div className="flex items-center gap-2 w-full lg:w-auto justify-end">
          <span className="text-xs text-zinc-400 font-semibold">Trier par :</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as unknown as typeof sortBy)}
            className="bg-zinc-950 border border-zinc-800 text-white text-xs font-semibold px-3 py-1.5 rounded focus:outline-none focus:border-orange-500 cursor-pointer"
          >
            <option value="updated">Récemment Mises à Jour</option>
            <option value="title">Titre (A-Z)</option>
            <option value="artist">Artiste (A-Z)</option>
            <option value="bpm">Tempo (BPM rapide d'abord)</option>
            <option value="key">Tonalité</option>
          </select>
        </div>
      </div>

      {/* Song Cards Grid */}
      {filteredSongs.length === 0 ? (
        <div className="text-center py-16 bg-zinc-900/30 border border-dashed border-zinc-800 rounded-lg">
          <Music className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white">Aucune chanson trouvée</h3>
          <p className="text-xs text-zinc-400 max-w-md mx-auto mt-1 mb-6">
            Ajustez vos critères de recherche ou cliquez sur "Importer des chansons" pour ajouter des partitions facilement.
          </p>
          <button
            onClick={onOpenImportModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 text-black font-bold text-xs uppercase tracking-wider rounded"
          >
            <Upload className="w-3.5 h-3.5" /> Importer des chansons
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredSongs.map((song) => (
            <div
              key={song.id}
              className="group bg-zinc-900/50 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-lg p-5 transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <h3 className="text-base font-bold text-white group-hover:text-orange-400 transition line-clamp-1">
                      {song.title}
                    </h3>
                    <p className="text-xs text-zinc-400 font-medium line-clamp-1">{song.artist}</p>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="px-2 py-0.5 bg-zinc-800 text-orange-400 border border-zinc-700 rounded text-xs font-mono font-bold">
                      {song.key}
                    </span>
                  </div>
                </div>

                {/* Song Badges & Specs */}
                <div className="flex flex-wrap items-center gap-2 my-3 text-xs text-zinc-400 font-mono">
                  <span className="bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800 flex items-center gap-1">
                    ⚡ {song.bpm} BPM
                  </span>
                  <span className="bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-zinc-500" /> {formatDuration(song.durationSeconds)}
                  </span>
                  {song.capo !== undefined && song.capo > 0 && (
                    <span className="bg-orange-500/10 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded flex items-center gap-1">
                      <Guitar className="w-3 h-3" /> Capo {song.capo}
                    </span>
                  )}
                  {song.midiFileName && (
                    <span className="bg-purple-500/15 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded flex items-center gap-1">
                      🎹 MIDI Multi-pistes
                    </span>
                  )}
                </div>

                {/* Tags */}
                {song.tags && song.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {song.tags.map((t) => (
                      <span key={t} className="text-[10px] font-semibold bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded">
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-zinc-800 mt-2">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onSelectSongToEdit(song)}
                    className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition cursor-pointer"
                    title="Éditer la chanson & grille"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  {onOpenExportModal && (
                    <button
                      onClick={() => onOpenExportModal(song)}
                      className="p-1.5 text-zinc-400 hover:text-orange-400 hover:bg-zinc-800 rounded transition cursor-pointer"
                      title="Exporter ce morceau (.msf, .msb, .cho)"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => onDeleteSong(song.id)}
                    className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded transition cursor-pointer"
                    title="Supprimer la chanson"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <button
                  onClick={() => onLaunchSingleSongStageView(song)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-orange-500 hover:text-black text-orange-400 border border-zinc-700 font-bold text-xs rounded transition cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Vue Scène</span>
                </button>
              </div>

            </div>
          ))}
        </div>
      )}

    </div>
  );
};
