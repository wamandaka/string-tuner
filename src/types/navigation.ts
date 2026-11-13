export type AppRoute =
  | 'tuner'
  | 'metronome'
  | 'chords'
  | 'playground'
  | 'lyrics'
  | 'settings';

export interface RouteMeta {
  id: AppRoute;
  path: string;
  label: string;
  title: string;
}

export const APP_ROUTES: readonly RouteMeta[] = [
  {
    id: 'tuner',
    path: '/',
    label: 'Tuner',
    title: 'Tuner | StringTune',
  },
  {
    id: 'metronome',
    path: '/metronome',
    label: 'Metronome',
    title: 'Metronome | StringTune',
  },
  {
    id: 'chords',
    path: '/chords',
    label: 'Chords',
    title: 'Chord Library | StringTune',
  },
  {
    id: 'playground',
    path: '/playground',
    label: 'Playground',
    title: 'Guitar Playground | StringTune',
  },
  {
    id: 'lyrics',
    path: '/lyrics',
    label: 'Lyrics',
    title: 'Lyrics | StringTune',
  },
  {
    id: 'settings',
    path: '/settings',
    label: 'Settings',
    title: 'Settings | StringTune',
  },
] as const;

export function parseRouteFromPathname(pathname: string): AppRoute {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  switch (normalized) {
    case '/metronome':
      return 'metronome';
    case '/chords':
      return 'chords';
    case '/playground':
      return 'playground';
    case '/lyrics':
      return 'lyrics';
    case '/settings':
      return 'settings';
    default:
      return 'tuner';
  }
}

export function getRouteMeta(route: AppRoute): RouteMeta {
  return APP_ROUTES.find((item) => item.id === route) ?? APP_ROUTES[0]!;
}

