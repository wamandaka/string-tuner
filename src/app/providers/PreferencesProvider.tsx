import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  clearFavoriteChordIds,
  loadFavoriteChordIds,
  saveFavoriteChordIds,
} from '../../stores/favoritesStorage';
import {
  applyThemeToDocument,
  loadPreferences,
  resetStoredPreferences,
  savePreferences,
} from '../../stores/preferencesStorage';
import type { UserPreferences } from '../../types/settings';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface NavigatorWithInstall extends Navigator {
  install?: () => Promise<void>;
}

interface PreferencesContextValue {
  preferences: UserPreferences;
  updatePreference: <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K],
  ) => void;
  resetPreferences: () => void;
  favoriteChordIds: readonly string[];
  isFavoriteChord: (chordId: string) => boolean;
  toggleFavoriteChord: (chordId: string) => void;
  clearFavorites: () => void;
  systemScheme: 'dark' | 'light';
  resolvedScheme: 'dark' | 'light';
  isOnline: boolean;
  canInstallApp: boolean;
  installStatusMessage: string | null;
  triggerInstallApp: () => Promise<void>;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

function getSystemPrefersDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return true;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<UserPreferences>(() =>
    loadPreferences(),
  );
  const [favoriteChordIds, setFavoriteChordIds] = useState<string[]>(() =>
    loadFavoriteChordIds(),
  );
  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(() =>
    getSystemPrefersDark(),
  );
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  const [canInstallApp, setCanInstallApp] = useState<boolean>(() => {
    if (typeof Navigator === 'undefined') {
      return false;
    }
    return (
      typeof (Navigator.prototype as unknown as NavigatorWithInstall)
        .install === 'function'
    );
  });
  const [installStatusMessage, setInstallStatusMessage] = useState<
    string | null
  >(null);
  const deferredInstallPromptRef = useRef<BeforeInstallPromptEvent | null>(
    null,
  );

  const resolvedScheme = useMemo(
    () => applyThemeToDocument(preferences.theme, systemPrefersDark),
    [preferences.theme, systemPrefersDark],
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return;
    }
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event: MediaQueryListEvent) => {
      setSystemPrefersDark(event.matches);
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const onStorage = () => {
      setPreferences(loadPreferences());
      setFavoriteChordIds(loadFavoriteChordIds());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      deferredInstallPromptRef.current = event as BeforeInstallPromptEvent;
      setCanInstallApp(true);
    };

    const onAppInstalled = () => {
      deferredInstallPromptRef.current = null;
      setCanInstallApp(false);
      setInstallStatusMessage('StringTune is installed on this device.');
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  const updatePreference = useCallback(
    <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
      setPreferences((prev) => {
        const next = { ...prev, [key]: value };
        savePreferences(next);
        return next;
      });
    },
    [],
  );

  const resetPreferences = useCallback(() => {
    const defaults = resetStoredPreferences();
    setPreferences(defaults);
  }, []);

  const favoriteSet = useMemo(
    () => new Set(favoriteChordIds),
    [favoriteChordIds],
  );

  const isFavoriteChord = useCallback(
    (chordId: string) => favoriteSet.has(chordId),
    [favoriteSet],
  );

  const toggleFavoriteChord = useCallback((chordId: string) => {
    setFavoriteChordIds((prev) => {
      const exists = prev.includes(chordId);
      const next = exists
        ? prev.filter((id) => id !== chordId)
        : [...prev, chordId];
      saveFavoriteChordIds(next);
      return next;
    });
  }, []);

  const clearFavorites = useCallback(() => {
    clearFavoriteChordIds();
    setFavoriteChordIds([]);
  }, []);

  const triggerInstallApp = useCallback(async () => {
    const nav = navigator as NavigatorWithInstall;
    try {
      if (typeof nav.install === 'function') {
        await nav.install();
        setInstallStatusMessage('StringTune was installed or opened.');
        setCanInstallApp(false);
        return;
      }

      const promptEvent = deferredInstallPromptRef.current;
      if (!promptEvent) {
        return;
      }

      deferredInstallPromptRef.current = null;
      await promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      if (outcome === 'accepted') {
        setInstallStatusMessage('StringTune installation accepted.');
        setCanInstallApp(false);
      } else {
        setInstallStatusMessage('Installation canceled.');
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setInstallStatusMessage('Installation was canceled.');
      } else {
        setInstallStatusMessage('Installation could not start.');
      }
    }
  }, []);

  const value = useMemo<PreferencesContextValue>(
    () => ({
      preferences,
      updatePreference,
      resetPreferences,
      favoriteChordIds,
      isFavoriteChord,
      toggleFavoriteChord,
      clearFavorites,
      systemScheme: systemPrefersDark ? 'dark' : 'light',
      resolvedScheme,
      isOnline,
      canInstallApp,
      installStatusMessage,
      triggerInstallApp,
    }),
    [
      preferences,
      updatePreference,
      resetPreferences,
      favoriteChordIds,
      isFavoriteChord,
      toggleFavoriteChord,
      clearFavorites,
      systemPrefersDark,
      resolvedScheme,
      isOnline,
      canInstallApp,
      installStatusMessage,
      triggerInstallApp,
    ],
  );

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) {
    throw new Error('usePreferences must be used inside PreferencesProvider');
  }
  return ctx;
}

