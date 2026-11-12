import type { ReactNode } from 'react';
import { WifiOff } from 'lucide-react';
import { usePreferences } from '../../app/providers/PreferencesProvider';
import { useRouter } from '../../app/router';
import { Badge } from '../ui/Badge';
import { Navigation } from '../navigation/Navigation';

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { isOnline } = usePreferences();
  const { navigate } = useRouter();

  return (
    <div className="flex min-h-dvh flex-col bg-(--st-bg) text-(--st-text)">
      <a
        href="#main-content"
        className="visually-hidden fixed top-3 left-3 z-50 rounded-lg bg-(--st-accent) px-4 py-2 text-sm font-semibold text-(--st-accent-text) shadow-lg"
      >
        Skip to main content
      </a>

      <header className="st-safe-top sticky top-0 z-20 border-b border-(--st-border) bg-(--st-bg)/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <a
              href="/"
              onClick={(event) => {
                if (
                  event.metaKey ||
                  event.ctrlKey ||
                  event.shiftKey ||
                  event.altKey ||
                  event.button !== 0
                ) {
                  return;
                }
                event.preventDefault();
                navigate('tuner');
              }}
              className="inline-flex min-h-10 items-center gap-2.5 rounded-xl px-1 text-base font-semibold tracking-tight text-(--st-text)"
            >
              <span
                aria-hidden="true"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-(--st-border) bg-(--st-surface-elevated)"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M5 17a7 7 0 0 1 14 0"
                    stroke="currentColor"
                    strokeOpacity="0.35"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M9.2 10.6a7 7 0 0 1 5.6 0"
                    stroke="var(--st-accent)"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                  <line
                    x1="12"
                    y1="7"
                    x2="12"
                    y2="17"
                    stroke="var(--st-accent)"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <circle cx="12" cy="17" r="2" fill="var(--st-accent)" />
                </svg>
              </span>
              <span>StringTune</span>
            </a>

            {!isOnline ? (
              <Badge tone="warn">
                <WifiOff className="h-3 w-3" aria-hidden="true" />
                <span>Offline</span>
              </Badge>
            ) : null}
          </div>

          <Navigation />
        </div>
      </header>

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-5xl flex-1 px-4 pt-4 pb-24 focus:outline-none md:px-6 md:py-6"
      >
        {children}
      </main>
    </div>
  );
}

