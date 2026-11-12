import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Download,
  Mic,
  Moon,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Sun,
  Trash2,
  Monitor,
} from 'lucide-react';
import { usePreferences } from '../../../app/providers/PreferencesProvider';
import { Badge } from '../../../components/ui/Badge';
import { Card } from '../../../components/ui/Card';
import { Switch } from '../../../components/ui/Switch';
import {
  isMicrophoneSupported,
  normalizeMicrophoneError,
  queryMicrophonePermission,
  requestMicrophoneStream,
  stopMicrophoneStream,
  type MicrophonePermissionState,
} from '../../../engines/audio/MicrophoneManager';
import { TUNING_PRESETS } from '../../../engines/pitch/NoteMapper';
import type { ThemePreference, TuningPresetId } from '../../../types/settings';

function formatPermissionBadge(state: MicrophonePermissionState): {
  label: string;
  tone: 'accent' | 'warn' | 'danger' | 'neutral';
} {
  switch (state) {
    case 'granted':
      return { label: 'Granted', tone: 'accent' };
    case 'prompt':
      return { label: 'Ask on Start', tone: 'neutral' };
    case 'denied':
      return { label: 'Denied', tone: 'danger' };
    case 'unsupported':
      return { label: 'Unsupported', tone: 'danger' };
    default:
      return { label: 'Unknown', tone: 'neutral' };
  }
}

export function SettingsScreen() {
  const {
    preferences,
    updatePreference,
    resetPreferences,
    favoriteChordIds,
    clearFavorites,
    systemScheme,
    isOnline,
    canInstallApp,
    installStatusMessage,
    triggerInstallApp,
  } = usePreferences();

  const [permissionState, setPermissionState] =
    useState<MicrophonePermissionState>('unknown');
  const [inputDeviceCount, setInputDeviceCount] = useState<number | null>(null);
  const [diagMessage, setDiagMessage] = useState<string | null>(null);
  const [diagError, setDiagError] = useState<string | null>(null);
  const [isTestingMic, setIsTestingMic] = useState(false);

  const refreshDiagnostics = useCallback(async () => {
    const status = await queryMicrophonePermission();
    setPermissionState(status);

    if (
      typeof navigator !== 'undefined' &&
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.enumerateDevices === 'function'
    ) {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter((d) => d.kind === 'audioinput');
        setInputDeviceCount(audioInputs.length);
      } catch {
        setInputDeviceCount(null);
      }
    }
  }, []);

  useEffect(() => {
    void refreshDiagnostics();
  }, [refreshDiagnostics]);

  const handleTestMicrophone = useCallback(async () => {
    setIsTestingMic(true);
    setDiagMessage(null);
    setDiagError(null);
    try {
      const stream = await requestMicrophoneStream();
      const tracks = stream.getAudioTracks();
      const trackLabel = tracks[0]?.label || 'Default audio input';
      stopMicrophoneStream(stream);
      setDiagMessage(`Audio input verified: ${trackLabel}`);
      await refreshDiagnostics();
    } catch (error) {
      const micErr = normalizeMicrophoneError(error);
      setDiagError(`${micErr.title}: ${micErr.message}`);
      await refreshDiagnostics();
    } finally {
      setIsTestingMic(false);
    }
  }, [refreshDiagnostics]);

  const permBadge = formatPermissionBadge(permissionState);
  const isSecure =
    typeof window !== 'undefined' ? window.isSecureContext : true;

  const themeOptions: readonly {
    id: ThemePreference;
    label: string;
    detail?: string;
    icon: typeof Moon;
  }[] = [
    { id: 'dark', label: 'Dark', icon: Moon },
    { id: 'light', label: 'Light', icon: Sun },
    {
      id: 'system',
      label: 'System',
      detail: `Currently ${systemScheme}`,
      icon: Monitor,
    },
  ];

  return (
    <section
      aria-labelledby="settings-heading"
      className="mx-auto flex max-w-xl flex-col gap-4"
    >
      <div>
        <h1
          id="settings-heading"
          className="text-lg font-semibold tracking-tight text-(--st-text)"
        >
          Settings
        </h1>
        <p className="text-xs text-(--st-text-muted)">
          Local preferences, theme appearance, and audio input diagnostics
        </p>
      </div>

      {/* Tuner Defaults */}
      <Card className="divide-y divide-(--st-border)">
        <div className="p-4 sm:p-5">
          <h2 className="text-xs font-semibold tracking-wider text-(--st-text-muted) uppercase">
            Tuner Defaults
          </h2>

          <div className="mt-4 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <label
                  htmlFor="settings-default-tuning"
                  className="text-sm font-medium text-(--st-text)"
                >
                  Default Tuning
                </label>
                <p className="text-xs text-(--st-text-muted)">
                  Applied when opening Guitar Tuner mode
                </p>
              </div>
              <select
                id="settings-default-tuning"
                value={preferences.defaultTuningId}
                onChange={(event) =>
                  updatePreference(
                    'defaultTuningId',
                    event.target.value as TuningPresetId,
                  )
                }
                className="min-h-10 rounded-xl border border-(--st-border) bg-(--st-surface-elevated) px-3 py-1.5 text-sm font-medium text-(--st-text)"
              >
                {TUNING_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="border-t border-(--st-border) pt-4">
              <Switch
                id="settings-chromatic-switch"
                label="Chromatic mode by default"
                description="Detect all 12 chromatic notes instead of snapping to guitar strings"
                checked={preferences.defaultChromatic}
                onChange={(checked) =>
                  updatePreference('defaultChromatic', checked)
                }
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Appearance */}
      <Card className="p-4 sm:p-5">
        <h2 className="text-xs font-semibold tracking-wider text-(--st-text-muted) uppercase">
          Appearance
        </h2>
        <p className="mt-1 text-xs text-(--st-text-muted)">
          Choose Dark, Light, or follow your operating system preference
        </p>

        <div
          role="group"
          aria-label="Theme preference"
          className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3"
        >
          {themeOptions.map((option) => {
            const Icon = option.icon;
            const selected = preferences.theme === option.id;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={selected}
                onClick={() => updatePreference('theme', option.id)}
                className={`flex min-h-12 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-semibold transition-colors ${
                  selected
                    ? 'border-(--st-accent) bg-(--st-accent-soft) text-(--st-accent)'
                    : 'border-(--st-border) bg-(--st-surface-elevated) text-(--st-text-muted) hover:border-(--st-border-strong) hover:text-(--st-text)'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <div>
                  <div className="leading-tight">{option.label}</div>
                  {option.detail ? (
                    <div className="text-[10px] font-normal opacity-80">
                      {option.detail}
                    </div>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Microphone & Audio Diagnostics */}
      <Card className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xs font-semibold tracking-wider text-(--st-text-muted) uppercase">
            Microphone &amp; Audio Input
          </h2>
          <Badge tone={permBadge.tone}>{permBadge.label}</Badge>
        </div>

        <dl className="mt-3 grid grid-cols-2 gap-3 rounded-xl border border-(--st-border) bg-(--st-surface-elevated) p-3 text-xs">
          <div>
            <dt className="text-(--st-text-muted)">Browser Support</dt>
            <dd className="mt-0.5 font-medium text-(--st-text)">
              {isMicrophoneSupported() ? 'Web Audio Ready' : 'Unsupported'}
            </dd>
          </div>
          <div>
            <dt className="text-(--st-text-muted)">Secure Context</dt>
            <dd className="mt-0.5 font-medium text-(--st-text)">
              {isSecure ? 'HTTPS / Localhost' : 'Insecure Origin'}
            </dd>
          </div>
          <div>
            <dt className="text-(--st-text-muted)">Detected Inputs</dt>
            <dd className="mt-0.5 font-medium text-(--st-text)">
              {inputDeviceCount === null
                ? 'Available after permission'
                : `${inputDeviceCount} audio ${inputDeviceCount === 1 ? 'input' : 'inputs'}`}
            </dd>
          </div>
          <div>
            <dt className="text-(--st-text-muted)">Network Mode</dt>
            <dd className="mt-0.5 font-medium text-(--st-text)">
              {isOnline ? 'Online' : 'Offline Ready'}
            </dd>
          </div>
        </dl>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleTestMicrophone()}
            disabled={isTestingMic}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-(--st-border-strong) bg-(--st-surface-elevated) px-3.5 py-2 text-xs font-semibold text-(--st-text) hover:bg-(--st-surface-subtle) disabled:opacity-50"
          >
            <Mic className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{isTestingMic ? 'Checking...' : 'Test Audio Input'}</span>
          </button>

          <button
            type="button"
            onClick={() => void refreshDiagnostics()}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-(--st-border) bg-(--st-surface) px-3.5 py-2 text-xs font-medium text-(--st-text-muted) hover:border-(--st-border-strong) hover:text-(--st-text)"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Refresh Status</span>
          </button>
        </div>

        {diagMessage ? (
          <div
            role="status"
            className="mt-3 flex items-center gap-2 rounded-xl border border-(--st-accent)/35 bg-(--st-accent-soft) px-3 py-2 text-xs text-(--st-accent)"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{diagMessage}</span>
          </div>
        ) : null}

        {diagError ? (
          <div
            role="alert"
            className="mt-3 flex items-start gap-2 rounded-xl border border-(--st-danger)/35 bg-(--st-danger)/10 px-3 py-2 text-xs text-(--st-danger)"
          >
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{diagError}</span>
          </div>
        ) : null}
      </Card>

      {/* Local Storage & PWA App */}
      <Card className="p-4 sm:p-5">
        <h2 className="text-xs font-semibold tracking-wider text-(--st-text-muted) uppercase">
          Local Storage &amp; App
        </h2>

        <div className="mt-3 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-medium text-(--st-text)">
                Saved Favorite Chords
              </div>
              <p className="text-xs text-(--st-text-muted)">
                {favoriteChordIds.length} saved locally on this device
              </p>
            </div>
            <button
              type="button"
              onClick={clearFavorites}
              disabled={favoriteChordIds.length === 0}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-(--st-border) bg-(--st-surface-elevated) px-3 py-1.5 text-xs font-semibold text-(--st-text) hover:border-(--st-border-strong) disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Clear Favorites</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-(--st-border) pt-3">
            <div>
              <div className="text-sm font-medium text-(--st-text)">
                Reset Preferences
              </div>
              <p className="text-xs text-(--st-text-muted)">
                Restore default dark theme, standard tuning, and 120 BPM
              </p>
            </div>
            <button
              type="button"
              onClick={resetPreferences}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-(--st-border) bg-(--st-surface-elevated) px-3 py-1.5 text-xs font-semibold text-(--st-text) hover:border-(--st-border-strong)"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Reset Defaults</span>
            </button>
          </div>

          {canInstallApp ? (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-(--st-border) pt-3">
              <div>
                <div className="text-sm font-medium text-(--st-text)">
                  Install StringTune
                </div>
                <p className="text-xs text-(--st-text-muted)">
                  Add StringTune to your home screen for offline access
                </p>
              </div>
              <button
                type="button"
                onClick={() => void triggerInstallApp()}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-(--st-accent) px-3.5 py-2 text-xs font-semibold text-(--st-accent-text) hover:opacity-95"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Install App</span>
              </button>
            </div>
          ) : null}

          {installStatusMessage ? (
            <p role="status" className="text-xs text-(--st-text-muted)">
              {installStatusMessage}
            </p>
          ) : null}
        </div>
      </Card>
    </section>
  );
}
