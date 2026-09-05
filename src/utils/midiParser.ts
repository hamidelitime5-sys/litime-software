import { Midi } from '@tonejs/midi';

export interface ParsedMidiResult {
  title: string;
  artist: string;
  key: string;
  bpm: number;
  timeSignature: string;
  durationSeconds: number;
  chordProContent: string;
  tracksInfo: { name: string; instrument: string; noteCount: number; isPercussion: boolean }[];
  detectedChords: string[];
  rawNotesSummary: string;
}

// Note pitch classes mapping
const PITCH_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Major and Minor profiles (Krumhansl-Schmuckler)
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

/**
 * Estimate Key (Key Signature) from pitch class distribution
 */
function detectMidiKey(pitchCounts: number[]): string {
  const totalNotes = pitchCounts.reduce((a, b) => a + b, 0);
  if (totalNotes === 0) return 'C';

  let bestKey = 'C';
  let maxScore = -Infinity;

  for (let root = 0; root < 12; root++) {
    // Check Major
    let majorScore = 0;
    for (let i = 0; i < 12; i++) {
      majorScore += pitchCounts[(root + i) % 12] * MAJOR_PROFILE[i];
    }
    if (majorScore > maxScore) {
      maxScore = majorScore;
      bestKey = PITCH_NAMES[root];
    }

    // Check Minor
    let minorScore = 0;
    for (let i = 0; i < 12; i++) {
      minorScore += pitchCounts[(root + i) % 12] * MINOR_PROFILE[i];
    }
    if (minorScore > maxScore) {
      maxScore = minorScore;
      bestKey = `${PITCH_NAMES[root]}m`;
    }
  }

  return bestKey;
}

/**
 * Identify a chord name from a set of active pitch classes
 */
function identifyChordFromPitchClasses(pitchClasses: Set<number>, rootHint?: number): string {
  if (pitchClasses.size === 0) return '';
  const pcs = Array.from(pitchClasses).sort((a, b) => a - b);

  // If only 1 note
  if (pcs.length === 1) return PITCH_NAMES[pcs[0]];

  // Try each present note as potential root
  for (const root of pcs) {
    const rootName = PITCH_NAMES[root];
    const intervals = pcs.map((pc) => (pc - root + 12) % 12);

    const hasMinor3rd = intervals.includes(3);
    const hasMajor3rd = intervals.includes(4);
    const hasPerfect5th = intervals.includes(7);
    const hasDim5th = intervals.includes(6);
    const hasAug5th = intervals.includes(8);
    const hasMinor7th = intervals.includes(10);
    const hasMajor7th = intervals.includes(11);
    const hasMajor6th = intervals.includes(9);
    const has2nd = intervals.includes(2);

    if (hasMajor3rd && hasPerfect5th) {
      if (hasMajor7th) return `${rootName}maj7`;
      if (hasMinor7th) return `${rootName}7`;
      return rootName;
    }

    if (hasMinor3rd && hasPerfect5th) {
      if (hasMinor7th) return `${rootName}m7`;
      return `${rootName}m`;
    }

    if (hasMinor3rd && hasDim5th) {
      if (hasMinor7th) return `${rootName}m7b5`;
      return `${rootName}dim`;
    }

    if (hasMajor3rd && hasAug5th) {
      return `${rootName}aug`;
    }

    if (has2nd && hasPerfect5th) {
      return `${rootName}sus2`;
    }

    if (intervals.includes(5) && hasPerfect5th) {
      return `${rootName}sus4`;
    }
  }

  // Fallback to lowest pitch / root
  const primaryRoot = rootHint !== undefined ? rootHint : pcs[0];
  return PITCH_NAMES[primaryRoot];
}

/**
 * Main function to parse ArrayBuffer of a MIDI file
 */
export async function parseMidiFile(arrayBuffer: ArrayBuffer, fileName: string): Promise<ParsedMidiResult> {
  const midi = new Midi(arrayBuffer);

  // Clean Title & Artist
  const title = midi.name && midi.name.trim().length > 0 
    ? midi.name.trim() 
    : fileName.replace(/\.(mid|midi)$/i, '');
  const artist = 'Fichier MIDI Importé';

  // Tempo (BPM)
  let bpm = 120;
  if (midi.header.tempos && midi.header.tempos.length > 0) {
    bpm = Math.round(midi.header.tempos[0].bpm);
  }

  // Time Signature
  let timeSignature = '4/4';
  let beatsPerMeasure = 4;
  if (midi.header.timeSignatures && midi.header.timeSignatures.length > 0) {
    const ts = midi.header.timeSignatures[0].timeSignature;
    timeSignature = `${ts[0]}/${ts[1]}`;
    beatsPerMeasure = ts[0];
  }

  // Duration
  const durationSeconds = Math.max(15, Math.round(midi.duration || 180));

  // Collect tracks info
  const tracksInfo = midi.tracks.map((track, i) => {
    const isPerc = track.instrument?.percussion || track.channel === 9;
    return {
      name: track.name || `Piste ${i + 1}`,
      instrument: track.instrument?.name || 'Instrument Synthé',
      noteCount: track.notes.length,
      isPercussion: !!isPerc,
    };
  });

  // Analyze Pitch Classes & Key
  const pitchCounts = new Array(12).fill(0);
  const allNotesWithTime: { pitchClass: number; time: number; duration: number; midi: number }[] = [];

  midi.tracks.forEach((track) => {
    if (track.instrument?.percussion || track.channel === 9) return;
    track.notes.forEach((note) => {
      const pc = note.midi % 12;
      pitchCounts[pc]++;
      allNotesWithTime.push({
        pitchClass: pc,
        time: note.time,
        duration: note.duration,
        midi: note.midi,
      });
    });
  });

  const estimatedKey = detectMidiKey(pitchCounts);

  // Calculate measure-by-measure chords
  const measureDuration = (60 / bpm) * beatsPerMeasure;
  const totalMeasures = Math.min(64, Math.ceil(durationSeconds / measureDuration));

  const measureChords: { measureNum: number; chord: string }[] = [];
  const detectedChordsSet = new Set<string>();

  for (let m = 0; m < totalMeasures; m++) {
    const measureStart = m * measureDuration;
    const measureEnd = measureStart + measureDuration;

    // Find active notes in this measure
    const activePitchClasses = new Set<number>();
    let lowestMidi = 128;
    let rootHint: number | undefined = undefined;

    // Filter notes in measure (ignoring micro-passing notes < 0.1s)
    const measureNotes = allNotesWithTime.filter((n) => {
      const isOverlap = n.time < measureEnd && n.time + n.duration > measureStart;
      return isOverlap && n.duration >= 0.1;
    });

    // Prioritize bass notes (MIDI pitch < 64) for root identification
    const bassNotes = measureNotes.filter((n) => n.midi < 64);
    if (bassNotes.length > 0) {
      bassNotes.sort((a, b) => a.midi - b.midi);
      rootHint = bassNotes[0].pitchClass;
    }

    measureNotes.forEach((n) => {
      // Don't include high lead/piccolo notes (> pitch 76) in chord triad detection
      if (n.midi <= 76) {
        activePitchClasses.add(n.pitchClass);
      }
      if (n.midi < lowestMidi) {
        lowestMidi = n.midi;
        if (rootHint === undefined) rootHint = n.pitchClass;
      }
    });

    const chord = identifyChordFromPitchClasses(activePitchClasses, rootHint);
    if (chord) {
      detectedChordsSet.add(chord);
      measureChords.push({ measureNum: m + 1, chord });
    }
  }

  const detectedChordsList = Array.from(detectedChordsSet);

  // Build ChordPro Content with Structured Sections (Intro, Couplet, Refrain)
  let chordProContent = `{title: ${title}}\n{artist: ${artist}}\n{key: ${estimatedKey}}\n{bpm: ${bpm}}\n{time: ${timeSignature}}\n\n`;

  chordProContent += `# ==========================================\n`;
  chordProContent += `# FICHIER MIDI ANALYSÉ & HARMONISÉ:\n`;
  chordProContent += `# Fichier original: ${fileName}\n`;
  chordProContent += `# Pistes: ${tracksInfo.length} (${tracksInfo.map(t => t.name).join(', ')})\n`;
  chordProContent += `# Tonalité principale: ${estimatedKey} | Tempo: ${bpm} BPM\n`;
  chordProContent += `# Accords clés: ${detectedChordsList.join(', ') || 'Aucun'}\n`;
  chordProContent += `# ==========================================\n\n`;

  // Format into clean structured sections
  if (measureChords.length > 0) {
    const totalBlocks = Math.ceil(measureChords.length / 4);

    for (let b = 0; b < totalBlocks; b++) {
      const block = measureChords.slice(b * 4, (b + 1) * 4);
      const line = block.map((mc) => `[${mc.chord}]`).join('   |   ');
      
      let sectionName = '';
      if (b === 0) sectionName = '[Intro]';
      else if (b === 1) sectionName = '[Couplet 1]';
      else if (b === Math.floor(totalBlocks / 2)) sectionName = '[Refrain]';
      else if (b === totalBlocks - 2) sectionName = '[Pont]';
      else if (b === totalBlocks - 1) sectionName = '[Outro]';

      if (sectionName) {
        chordProContent += `${sectionName}\n`;
      }

      chordProContent += `|  ${line}  |\n`;
      if (sectionName || (b + 1) % 2 === 0) {
        chordProContent += `\n`;
      }
    }
  } else {
    chordProContent += `[Couplet 1]\n[${estimatedKey}] Fichier MIDI sans notes mélodiques identifiables.\n`;
  }

  // Raw Summary
  const rawNotesSummary = `MIDI: ${fileName} | ${tracksInfo.length} pistes | ${allNotesWithTime.length} notes musicales lues.`;

  return {
    title,
    artist,
    key: estimatedKey,
    bpm,
    timeSignature,
    durationSeconds,
    chordProContent,
    tracksInfo,
    detectedChords: detectedChordsList,
    rawNotesSummary,
  };
}
