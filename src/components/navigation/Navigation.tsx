import {
  AudioWaveform,
  BookOpen,
  Clock,
  FileText,
  Guitar,
  Settings,
} from 'lucide-react';
import { useRouter } from '../../app/router';
import { APP_ROUTES, type AppRoute } from '../../types/navigation';

const ROUTE_ICONS: Record<AppRoute, typeof AudioWaveform> = {
  tuner: AudioWaveform,
  metronome: Clock,
  chords: BookOpen,
  playground: Guitar,
  lyrics: FileText,
  settings: Settings,
};

export function Navigation() {
  const { route, navigate } = useRouter();

  return (
    <nav
      aria-label="Primary"
      className="st-safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-(--st-border) bg-(--st-surface)/95 backdrop-blur-md md:static md:border-t-0 md:bg-transparent md:pb-0 md:backdrop-blur-none"
    >
      <ul className="mx-auto flex max-w-lg items-center justify-around gap-1 px-1.5 pt-1.5 pb-1 md:max-w-none md:justify-end md:gap-1.5 md:p-0">
        {APP_ROUTES.map((item) => {
          const Icon = ROUTE_ICONS[item.id];
          const active = route === item.id;

          return (
            <li key={item.id} className="min-w-0 flex-1 md:flex-initial">
              <a
                href={item.path}
                aria-current={active ? 'page' : undefined}
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
                  navigate(item.id);
                }}
                className={`st-nav-item flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] font-medium transition-colors sm:px-1.5 sm:text-[11px] md:min-h-10 md:flex-row md:gap-2 md:px-3.5 md:py-2 md:text-sm ${
                  active
                    ? 'bg-(--st-accent-soft) text-(--st-accent)'
                    : 'text-(--st-text-muted) hover:bg-(--st-surface-elevated) hover:text-(--st-text)'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="max-w-full truncate">{item.label}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

