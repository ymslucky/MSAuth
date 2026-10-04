/** 提示条：error / success / info */
import type { ReactNode } from 'react';

type Tone = 'error' | 'success' | 'info';

const tones: Record<Tone, string> = {
  error: 'border-alarm-400/35 bg-alarm-400/10 text-alarm-400',
  success: 'border-moss-400/35 bg-moss-400/10 text-moss-400',
  info: 'border-brass-400/30 bg-brass-400/10 text-brass-300',
};

export function Alert({ tone = 'info', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <div role="alert" className={`rounded-lg border px-3.5 py-2.5 text-sm ${tones[tone]}`}>
      {children}
    </div>
  );
}
