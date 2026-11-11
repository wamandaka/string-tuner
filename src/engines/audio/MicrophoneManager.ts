export type MicrophonePermissionState =
  | 'granted'
  | 'prompt'
  | 'denied'
  | 'unsupported'
  | 'unknown';

export type MicrophoneErrorCode =
  | 'permission-denied'
  | 'not-found'
  | 'device-busy'
  | 'insecure-context'
  | 'unsupported'
  | 'unknown';

export class MicrophoneError extends Error {
  readonly code: MicrophoneErrorCode;
  readonly title: string;

  constructor(code: MicrophoneErrorCode, title: string, message: string) {
    super(message);
    this.name = 'MicrophoneError';
    this.code = code;
    this.title = title;
  }
}

export function isMicrophoneSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices !== 'undefined' &&
    typeof navigator.mediaDevices.getUserMedia === 'function'
  );
}

export async function queryMicrophonePermission(): Promise<MicrophonePermissionState> {
  if (!isMicrophoneSupported()) {
    return 'unsupported';
  }
  if (
    typeof navigator.permissions === 'undefined' ||
    typeof navigator.permissions.query !== 'function'
  ) {
    return 'unknown';
  }

  try {
    const status = await navigator.permissions.query({
      name: 'microphone' as PermissionName,
    });
    if (
      status.state === 'granted' ||
      status.state === 'prompt' ||
      status.state === 'denied'
    ) {
      return status.state;
    }
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

export function normalizeMicrophoneError(error: unknown): MicrophoneError {
  if (error instanceof MicrophoneError) {
    return error;
  }

  if (error instanceof DOMException || error instanceof Error) {
    const name = error.name;
    if (
      name === 'NotAllowedError' ||
      name === 'PermissionDeniedError' ||
      name === 'SecurityError'
    ) {
      return new MicrophoneError(
        'permission-denied',
        'Microphone access blocked',
        'Allow microphone access in your browser site settings and try again.',
      );
    }
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      return new MicrophoneError(
        'not-found',
        'No microphone found',
        'Connect or enable an audio input device, then start the tuner again.',
      );
    }
    if (name === 'NotReadableError' || name === 'TrackStartError') {
      return new MicrophoneError(
        'device-busy',
        'Microphone unavailable',
        'Your microphone may be in use by another app or unavailable to the browser.',
      );
    }
  }

  return new MicrophoneError(
    'unknown',
    'Unable to start microphone',
    'An unexpected error occurred while accessing your audio input.',
  );
}

export async function requestMicrophoneStream(): Promise<MediaStream> {
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    throw new MicrophoneError(
      'insecure-context',
      'Secure context required',
      'Microphone access requires HTTPS or localhost.',
    );
  }

  if (!isMicrophoneSupported()) {
    throw new MicrophoneError(
      'unsupported',
      'Microphone API unsupported',
      'This browser does not support Web Audio microphone capture (getUserMedia).',
    );
  }

  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
      video: false,
    });
  } catch (error) {
    if (
      error instanceof DOMException &&
      error.name === 'OverconstrainedError'
    ) {
      try {
        return await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });
      } catch (fallbackError) {
        throw normalizeMicrophoneError(fallbackError);
      }
    }
    throw normalizeMicrophoneError(error);
  }
}

export function stopMicrophoneStream(stream: MediaStream | null): void {
  if (!stream) {
    return;
  }
  const tracks = stream.getTracks();
  for (let i = 0; i < tracks.length; i++) {
    tracks[i]?.stop();
  }
}

