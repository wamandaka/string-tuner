import type { ParsedLrcLine } from './lyrics.types';

const LRC_TAG_REGEX = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;

export function formatLrcTimestamp(timeMs: number): string {
  const safeMs = Math.max(0, Math.floor(timeMs));
  const totalSeconds = Math.floor(safeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Parse LRC-formatted synced lyrics (`[mm:ss.xx] line`) into chronologically sorted lines.
 */
export function parseSyncedLyrics(syncedLyrics: string): ParsedLrcLine[] {
  if (!syncedLyrics.trim()) {
    return [];
  }

  const parsed: ParsedLrcLine[] = [];
  const rawLines = syncedLyrics.split(/\r?\n/);

  for (const rawLine of rawLines) {
    const timestamps: number[] = [];
    LRC_TAG_REGEX.lastIndex = 0;
    let match: RegExpExecArray | null = LRC_TAG_REGEX.exec(rawLine);

    while (match !== null) {
      const minutes = Number(match[1]);
      const seconds = Number(match[2]);
      const fractionRaw = match[3] ?? '0';
      const fractionMs =
        fractionRaw.length === 1
          ? Number(fractionRaw) * 100
          : fractionRaw.length === 2
            ? Number(fractionRaw) * 10
            : Number(fractionRaw.slice(0, 3));

      const timeMs = minutes * 60_000 + seconds * 1000 + fractionMs;
      timestamps.push(timeMs);
      match = LRC_TAG_REGEX.exec(rawLine);
    }

    if (timestamps.length === 0) {
      continue;
    }

    const text = rawLine.replace(LRC_TAG_REGEX, '').trim();
    if (!text) {
      continue;
    }

    for (const timeMs of timestamps) {
      parsed.push({
        id: `${timeMs}-${parsed.length}`,
        timeMs,
        formattedTime: formatLrcTimestamp(timeMs),
        text,
      });
    }
  }

  parsed.sort((a, b) => a.timeMs - b.timeMs);
  return parsed;
}

/**
 * Convert synced LRC text to plain lines as a fallback when `plainLyrics` is omitted.
 */
export function stripLrcTimestamps(syncedLyrics: string): string {
  return parseSyncedLyrics(syncedLyrics)
    .map((line) => line.text)
    .join('\n');
}

