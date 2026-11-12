import { describe, expect, it } from 'vitest';
import {
  formatLrcTimestamp,
  parseSyncedLyrics,
  stripLrcTimestamps,
} from './lrcParser';

describe('lrcParser', () => {
  it('formats timestamps into mm:ss', () => {
    expect(formatLrcTimestamp(0)).toBe('00:00');
    expect(formatLrcTimestamp(14_150)).toBe('00:14');
    expect(formatLrcTimestamp(125_999)).toBe('02:05');
  });

  it('parses synced LRC lines chronologically and skips blank/metadata lines', () => {
    const raw = `
[ar:Oasis]
[00:25.68] I don't believe that anybody feels the way I do
[00:14.15] Today is gonna be the day
[00:20.00]
[00:30.123] And by now
`;
    const parsed = parseSyncedLyrics(raw);
    expect(parsed).toHaveLength(3);
    expect(parsed[0]).toMatchObject({
      timeMs: 14_150,
      formattedTime: '00:14',
      text: 'Today is gonna be the day',
    });
    expect(parsed[1]).toMatchObject({
      timeMs: 25_680,
      formattedTime: '00:25',
      text: "I don't believe that anybody feels the way I do",
    });
    expect(parsed[2]).toMatchObject({
      timeMs: 30_123,
      formattedTime: '00:30',
      text: 'And by now',
    });
  });

  it('expands multi-timestamp lines and strips timestamps cleanly', () => {
    const raw = '[00:10.00][00:40.50] Chorus line';
    const parsed = parseSyncedLyrics(raw);
    expect(parsed).toHaveLength(2);
    expect(parsed.map((line) => line.timeMs)).toEqual([10_000, 40_500]);

    expect(stripLrcTimestamps('[00:10.00] First line\n[00:15.00] Second line')).toBe(
      'First line\nSecond line',
    );
  });
});

