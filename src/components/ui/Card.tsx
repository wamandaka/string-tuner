import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div
      className={`st-card rounded-2xl border border-[var(--st-border)] bg-[var(--st-surface)] shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

