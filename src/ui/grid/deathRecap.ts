import type { RunState } from '../../sim/grid/types';
import { foeName } from './foeNames';

const CAUSES: Record<string, string> = { trap: '함정', burn: '화상', poison: '중독', blast: '폭발', self: '자신' };
export function deathLine(killedBy?: RunState['killedBy'], floor = 6): string {
  const kind = killedBy?.kind ?? 'self';
  return `쓰러뜨린 것: ${killedBy?.elite ? '정예 ' : ''}${foeName(kind, floor) ?? CAUSES[kind] ?? '자신'}`;
}
