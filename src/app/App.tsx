import { PreferencesProvider } from './providers/PreferencesProvider';
import { RouterProvider, useRouter } from './router';
import { AppShell } from '../components/layout/AppShell';
import { TunerScreen } from '../features/tuner/components/TunerScreen';
import { MetronomeScreen } from '../features/metronome/components/MetronomeScreen';
import { ChordsScreen } from '../features/chords/components/ChordsScreen';
import { PlaygroundScreen } from '../features/playground/components/PlaygroundScreen';
import { LyricsScreen } from '../features/lyrics/components/LyricsScreen';
import { SettingsScreen } from '../features/settings/components/SettingsScreen';

function ActiveRouteView() {
  const { route } = useRouter();

  switch (route) {
    case 'tuner':
      return <TunerScreen />;
    case 'metronome':
      return <MetronomeScreen />;
    case 'chords':
      return <ChordsScreen />;
    case 'playground':
      return <PlaygroundScreen />;
    case 'lyrics':
      return <LyricsScreen />;
    case 'settings':
      return <SettingsScreen />;
  }
}

export function App() {
  return (
    <PreferencesProvider>
      <RouterProvider>
        <AppShell>
          <ActiveRouteView />
        </AppShell>
      </RouterProvider>
    </PreferencesProvider>
  );
}

export default App;

