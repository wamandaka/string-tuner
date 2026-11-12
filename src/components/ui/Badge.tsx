import type { ReactNode } from 'react';

type BadgeTone = 'neutral' | 'accent' | 'warn' | 'danger';

interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral:
    'border-(--st-border) bg-(--st-surface-elevated) text-(--st-text-muted)',
  accent:
    'border-(--st-accent)/35 bg-(--st-accent-soft) text-(--st-accent)',
  warn: 'border-(--st-warn)/35 bg-(--st-warn)/14 text-(--st-warn)',
  danger:
    'border-(--st-danger)/35 bg-(--st-danger)/14 text-(--st-danger)',
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

