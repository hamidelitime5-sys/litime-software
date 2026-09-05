export type NotationMode = 'standard' | 'solfege' | 'german' | 'nashville';

export interface Song {
  id: string;
  title: string;
  artist: string;
  key: string; // e.g. "G", "Am", "E"
  bpm: number;
  timeSignature: string; // e.g. "4/4", "3/4"
  durationSeconds: number; // e.g. 210 for 3m 30s
  capo?: number; // e.g. 2
  tuning?: string; // e.g. "Standard (E A D G B E)"
  chordProContent: string; // Lyrics with [Chord] embedded or line-above
  notes?: string;
  jamTrackUrl?: string; // YouTube or MP3 audio link for Jam Track / Backing Track
  jamTrackStyle?: string; // Style label e.g. "Blues Rock 120BPM"
  midiData?: string; // Base64 encoded MIDI file for multi-track playback
  midiFileName?: string; // Original MIDI file name
  midiSoundfontName?: string; // Associated soundfont info
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export interface SetlistEntry {
  id: string;
  type: 'song' | 'interlude';
  songId?: string;
  targetKey?: string; // override default song key for this setlist
  capo?: number;
  interludeTitle?: string;
  interludeDurationSeconds?: number;
  notes?: string; // e.g. "Guitar swap / 2 min speech"
}

export interface Setlist {
  id: string;
  name: string;
  venue?: string;
  date?: string;
  targetDurationMinutes?: number;
  entries: SetlistEntry[];
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export interface ChordPosition {
  string: number; // 1 to 6 (1 = high E, 6 = low E)
  fret: number; // 0 = open, -1 = muted, 1..24
  finger?: number; // 1 = index, 2 = middle, 3 = ring, 4 = pinky
}

export interface GuitarChordData {
  chordName: string;
  baseFret: number; // The starting fret of the 5-fret diagram window (e.g. 1, 2, 3, 5, 7)
  positions: ChordPosition[]; // 6 strings
  barreFret?: number; // Fret on which index finger bars (e.g. 1, 2, 3...)
  barreStartString?: number; // default 6 (Low E) or 5 (A)
  barreEndString?: number; // default 1 (High E)
  voicingLabel?: string; // e.g. "Position standard (Case 1)", "Barré Forme La (Case 2)"
  noteNames?: string[]; // Evaluated note on each string from 6 down to 1
  voicings?: GuitarChordData[]; // Alternate positions on neck
}

export interface PianoChordData {
  chordName: string;
  notes: string[]; // e.g. ["C", "E", "G"] or ["C4", "E4", "G4"]
  voicingLabel?: string;
}

export interface StageSettings {
  autoScrollSpeed: number; // px per second
  fontSize: number; // rem multiplier e.g. 1, 1.25, 1.5
  darkStageMode: boolean;
  showMetronomePulse: boolean;
  metronomeVolume: number;
  notationMode: NotationMode;
}
