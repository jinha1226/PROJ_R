import type { ChronicleEntry, Mercenary } from './types';

export const note = (m: Mercenary, battle: number, key: string, vars: Record<string, string | number> = {}): Mercenary =>
  ({ ...m, chronicle: [...m.chronicle, { battle, key, vars } satisfies ChronicleEntry] });
