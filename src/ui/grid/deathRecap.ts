import type { RunState } from '../../sim/grid/types';

const NAMES: Record<string, string> = {
  minion: '해골 졸개', brute: '해골 전사', archer: '해골 석궁병', ghoul: '구울',
  mage: '해골 마법사', champion: '해골 챔피언', trap: '함정', burn: '화상',
  poison: '중독', blast: '폭발', self: '자신',
};
export function deathLine(killedBy?: RunState['killedBy']): string {
  return `쓰러뜨린 것: ${killedBy?.elite ? '정예 ' : ''}${NAMES[killedBy?.kind ?? 'self'] ?? '자신'}`;
}
