import type { ReactNode } from 'react';

type BadgeTone = 'neutral' | 'accent' | 'warn' | 'danger';

interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral:
    'border-[var(--st-border)] bg-[var(--st-surface-elevated)] text-[var(--st-text-muted)]',
  accent:
    'border-[color-mix(in_srgb,var(--st-accent)_35%,transparent)] bg-[var(--st-accent-soft)] text-[var(--st-accent)]',
  warn: 'border-[color-mix(in_srgb,var(--st-warn)_35%,transparent)] bg-[color-mix(in_srgb,var(--st-warn)_14%,transparent)] text-[var(--st-warn)]',
  danger:
    'border-[color-mix(in_srgb,var(--st-danger)_35%,transparent)] bg-[color-mix(in_srgb,var(--st-danger)_14%,transparent)] text-[var(--st-danger)]',
};

export function Badge({
  children,
  tone = 'neutral',
  className = '',
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-wide ${TONE_CLASSES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

