import { stopMicrophoneStream } from './MicrophoneManager';

export interface AudioEngineSessionInfo {
  sampleRate: number;
  fftSize: number;
}

type AudioContextConstructor = typeof AudioContext;

function getAudioContextConstructor(): AudioContextConstructor | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const win = window as Window & {
    webkitAudioContext?: AudioContextConstructor;
  };
  return window.AudioContext ?? win.webkitAudioContext ?? null;
}

export class AudioEngine {
  private audioContext: AudioContext | null = null;
  private analyserNode: AnalyserNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private stream: MediaStream | null = null;
  private timeDomainBuffer = new Float32Array(0);

  async start(
    stream: MediaStream,
    fftSize: number = 4096,
  ): Promise<AudioEngineSessionInfo> {
    await this.stop();

    const AudioCtx = getAudioContextConstructor();
    if (!AudioCtx) {
      stopMicrophoneStream(stream);
      throw new Error('Web Audio API is not supported in this browser.');
    }

    const context = new AudioCtx({ latencyHint: 'interactive' });
    try {
      if (context.state === 'suspended') {
        await context.resume();
      }

      const analyser = context.createAnalyser();
      try {
        analyser.fftSize = fftSize;
      } catch {
        analyser.fftSize = 2048;
      }
      analyser.smoothingTimeConstant = 0;

      const source = context.createMediaStreamSource(stream);
      source.connect(analyser);

      this.audioContext = context;
      this.analyserNode = analyser;
      this.sourceNode = source;
      this.stream = stream;
      this.timeDomainBuffer = new Float32Array(analyser.fftSize);

      return {
        sampleRate: context.sampleRate,
        fftSize: analyser.fftSize,
      };
    } catch (error) {
      stopMicrophoneStream(stream);
      await context.close().catch(() => undefined);
      throw error;
    }
  }

  getSampleRate(): number | null {
    return this.audioContext?.sampleRate ?? null;
  }

  isRunning(): boolean {
    return this.audioContext !== null && this.analyserNode !== null;
  }

  readTimeDomainData(): Float32Array | null {
    if (!this.analyserNode || this.timeDomainBuffer.length === 0) {
      return null;
    }
    this.analyserNode.getFloatTimeDomainData(this.timeDomainBuffer);
    return this.timeDomainBuffer;
  }

  async stop(): Promise<void> {
    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch {
        // Ignore disconnect errors on torn-down nodes.
      }
      this.sourceNode = null;
    }

    if (this.analyserNode) {
      try {
        this.analyserNode.disconnect();
      } catch {
        // Ignore disconnect errors on torn-down nodes.
      }
      this.analyserNode = null;
    }

    if (this.stream) {
      stopMicrophoneStream(this.stream);
      this.stream = null;
    }

    if (this.audioContext) {
      const ctx = this.audioContext;
      this.audioContext = null;
      if (ctx.state !== 'closed') {
        await ctx.close().catch(() => undefined);
      }
    }

    this.timeDomainBuffer = new Float32Array(0);
  }
}

