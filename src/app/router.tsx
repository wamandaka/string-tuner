import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  getRouteMeta,
  parseRouteFromPathname,
  type AppRoute,
} from '../types/navigation';

interface RouterContextValue {
  route: AppRoute;
  navigate: (nextRoute: AppRoute) => void;
}

const RouterContext = createContext<RouterContextValue | null>(null);

export function RouterProvider({ children }: { children: ReactNode }) {
  const [route, setRoute] = useState<AppRoute>(() =>
    parseRouteFromPathname(window.location.pathname),
  );

  const navigate = useCallback((nextRoute: AppRoute) => {
    const meta = getRouteMeta(nextRoute);
    if (window.location.pathname !== meta.path) {
      window.history.pushState({ route: nextRoute }, '', meta.path);
    }
    setRoute(nextRoute);
    document.title = meta.title;
  }, []);

  useEffect(() => {
    document.title = getRouteMeta(route).title;
  }, [route]);

  useEffect(() => {
    const handlePopState = () => {
      const next = parseRouteFromPathname(window.location.pathname);
      setRoute(next);
      document.title = getRouteMeta(next).title;
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const value = useMemo(() => ({ route, navigate }), [route, navigate]);

  return (
    <RouterContext.Provider value={value}>{children}</RouterContext.Provider>
  );
}

export function useRouter(): RouterContextValue {
  const ctx = useContext(RouterContext);
  if (!ctx) {
    throw new Error('useRouter must be used inside RouterProvider');
  }
  return ctx;
}

