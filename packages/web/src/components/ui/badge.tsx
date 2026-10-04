/** 徽标：brass / neutral / moss */
import type { ReactNode } from 'react';

type Tone = 'brass' | 'neutral' | 'moss';

const tones: Record<Tone, string> = {
  brass: 'border-brass-400/40 bg-brass-400/10 text-brass-300',
  neutral: 'border-ink-600 bg-ink-800 text-fog-400',
  moss: 'border-moss-400/40 bg-moss-400/10 text-moss-400',
};

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-[11px] tracking-wide ${tones[tone]}`}>
      {children}
    </span>
  );
}
