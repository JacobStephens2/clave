import type { SongCard } from "@clave/content";

export interface SongPhrase {
  number: 1 | 2;
  section: "Cuerpo" | "Montuno";
}

export interface SongCount {
  phraseNumber: 1 | 2;
  count: number;
  section: "Cuerpo" | "Montuno";
  phraseEnded: boolean;
  songEnded: boolean;
}

export interface SongPlace {
  songLength: number;
  phraseLength: number;
  phrases: readonly SongPhrase[];
  at: SongCount | null;
}

const PHRASE_LENGTH = 8;

/** Where `songIndex` sits. `at` is null before the first card. */
export function readSongPlace(cards: readonly SongCard[], songIndex: number): SongPlace {
  const songLength = cards.length;
  const phraseLength = songLength / 2;
  const cuerpo = cards.slice(0, phraseLength);
  const montuno = cards.slice(phraseLength);
  if (
    phraseLength !== PHRASE_LENGTH ||
    cuerpo.some((card) => card.section !== "Cuerpo") ||
    montuno.some((card) => card.section !== "Montuno")
  ) {
    throw new Error("A song must be eight Cuerpo cards followed by eight Montuno cards.");
  }

  const phrases: readonly SongPhrase[] = [
    { number: 1, section: "Cuerpo" },
    { number: 2, section: "Montuno" },
  ];
  if (songIndex < 0) return { songLength, phraseLength, phrases, at: null };

  const phrase = (songIndex < phraseLength ? phrases[0] : phrases[1])!;
  const count = (songIndex % phraseLength) + 1;
  return {
    songLength,
    phraseLength,
    phrases,
    at: {
      phraseNumber: phrase.number,
      count,
      section: phrase.section,
      phraseEnded: count === phraseLength,
      songEnded: songIndex === songLength - 1,
    },
  };
}
