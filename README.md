# StringTune

**StringTune** is a lightweight, mobile-first, offline-capable Progressive Web App (PWA) for guitarists, featuring a real-time Web Audio guitar & chromatic tuner, a lookahead-scheduled metronome, an interactive chord reference library, and a song lyrics lookup tool.

All audio acquisition, DSP pitch detection, timing synthesis, and user preferences run **100% locally in the browser** with no backend or authentication, while optional song lyrics lookup queries the free, keyless public [LRCLIB](https://lrclib.net) API directly over HTTPS.

---

## Key Features

### 1. Real-Time Guitar & Chromatic Tuner
- **On-demand microphone activation** — microphone permission is requested only when the user clicks **Start Tuner**.
- **Custom Normalized Autocorrelation (NSDF) Pitch Detection** — uses a 4096-sample `AnalyserNode` time-domain buffer, DC-offset removal, RMS noise gating, McLeod key-maximum octave-error rejection, and parabolic sub-sample interpolation.
- **Standard & Preset Tunings + Chromatic Mode** — Standard (`E2 A2 D3 G3 B3 E4`), Drop D, Half-Step Down, Open G, DADGAD, and full 12-tone Chromatic (`A4 = 440 Hz`).
- **Auto & Manual String Selection** — automatic string matching in logarithmic cents space (`cents = 1200 * log2(detectedFrequency / targetFrequency)`), plus manual string lock.
- **Smooth Low-Overhead UI** — `requestAnimationFrame` drives compositor-only needle rotation while React UI updates are throttled to ~24 FPS.
- **Clean Resource Lifecycle** — tracks, `MediaStreamAudioSourceNode`, `AnalyserNode`, `AudioContext`, and animation loops are torn down cleanly when stopped or unmounted.

### 2. Precision Web Audio Metronome
- **Hardware Clock Lookahead Scheduling** — schedules clicks ahead of playback using `AudioContext.currentTime` (never relying on `setInterval` for audio timing).
- **Range & Controls** — 40–240 BPM slider, `±1` / `±5` / `±10` nudges, Play/Pause/Reset, Tap Tempo, adjustable gain, and time signatures (`2/4`, `3/4`, `4/4`, `6/8`) with Beat 1 accenting and synchronized visual beat indicators.

### 3. Interactive Guitar Chord Library
- **51 Local Chord Voicings** stored in [`src/data/chords.json`](src/data/chords.json) across Major, Minor, Dominant 7th, Major 7th, Minor 7th, Sus2, Sus4, and Diminished categories.
- **Open & Barre Support** — custom SVG fretboard diagrams with nut/base-fret positioning, muted/open markers, barre bars, finger numbers (`1–4`), tap-to-inspect string fingering, and local Web Audio strum preview.
- **Search, Filter & Favorites** — filter by chord category, open vs. barre voicing, search query, and persistent local favorites.

### 4. Song Lyrics Lookup (Public LRCLIB API)
- **Keyless Public Search** — searches songs by title or artist via `https://lrclib.net/api/search` (no API key or backend required).
- **Plain & Synced Views** — switch between plain lyrics and timestamped LRC lines (`[mm:ss]`) when available, adjust reader text size (`S / M / L`), copy lyrics, or enable smooth Auto-Scroll while practicing.
- **Save for Offline** — bookmark lyrics locally in `localStorage` so saved songs remain accessible even when offline.

### 5. Settings & Offline PWA
- **Theme Preference** — Dark-first UI with Light and System modes via `<meta name="color-scheme">` and `light-dark()` CSS tokens.
- **Tuner Defaults & Diagnostics** — default tuning preset, default chromatic toggle, microphone permission state check, audio input testing, and local storage reset controls.
- **Installable PWA** — generated Web App Manifest, PNG/SVG/maskable icons, and Workbox precached offline shell via `vite-plugin-pwa`.

---

## Getting Started

```bash
npm install
npm run dev
```

### Type Check & Unit Tests (Vitest)
```bash
npm run typecheck
npm test
```

### End-to-End Tests (Playwright)
```bash
npm run build
npm run test:e2e
```

---

## Production Build & Cloudflare Deployment

- **Build command**: `npm run build`
- **Build output directory**: `dist`
- **SPA Routing**: Both Cloudflare Workers Static Assets (`not_found_handling: "single-page-application"`, auto-detected for Vite by Wrangler) and Cloudflare Pages automatically serve `index.html` for unknown routes (`/metronome`, `/chords`, `/lyrics`, `/settings`) when no `404.html` or conflicting `_redirects` rule is present.
- **HTTPS Requirement**: Browser `navigator.mediaDevices.getUserMedia` requires a secure context (`https://` or `http://localhost`).

