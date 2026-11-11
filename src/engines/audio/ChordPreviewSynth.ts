const STANDARD_OPEN_MIDI = [40, 45, 50, 55, 59, 64] as const;

let sharedPreviewContext: AudioContext | null = null;

function getPreviewContext(): AudioContext | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const win = window as Window & {
    webkitAudioContext?: typeof AudioContext;
  };
  const Ctx = window.AudioContext ?? win.webkitAudioContext;
  if (!Ctx) {
    return null;
  }
  if (!sharedPreviewContext || sharedPreviewContext.state === 'closed') {
    sharedPreviewContext = new Ctx();
  }
  return sharedPreviewContext;
}

/**
 * Synthesizes a gentle local Web Audio strum across unmuted strings of a chord.
 */
export async function playChordPreview(
  frets: readonly [number, number, number, number, number, number],
): Promise<void> {
  const ctx = getPreviewContext();
  if (!ctx) {
    return;
  }
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }

  const master = ctx.createGain();
  master.gain.value = 0.25;
  master.connect(ctx.destination);

  const now = ctx.currentTime + 0.02;
  let strumIndex = 0;

  for (let i = 0; i < frets.length; i++) {
    const fret = frets[i]!;
    if (fret < 0) {
      continue;
    }

    const midi = STANDARD_OPEN_MIDI[i]! + fret;
    const freq = 440 * Math.pow(2, (midi - 69) / 12);
    const startTime = now + strumIndex * 0.042;
    strumIndex += 1;

    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, startTime);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(Math.min(3400, freq * 6), startTime);
    filter.frequency.exponentialRampToValueAtTime(
      Math.max(380, freq * 2),
      startTime + 0.85,
    );

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(0.45, startTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 1.05);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(master);

    osc.start(startTime);
    osc.stop(startTime + 1.1);
  }
}

