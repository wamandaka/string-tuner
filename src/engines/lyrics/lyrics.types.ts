export interface LyricsTrack {
  id: number;
  trackName: string;
  artistName: string;
  albumName: string;
  durationSeconds: number;
  instrumental: boolean;
  plainLyrics: string | null;
  syncedLyrics: string | null;
}

export interface ParsedLrcLine {
  id: string;
  timeMs: number;
  formattedTime: string;
  text: string;
}

export type LyricsDisplayMode = 'plain' | 'synced';

