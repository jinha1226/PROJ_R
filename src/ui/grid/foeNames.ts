import { zoneOf, type ZoneId } from '../../sim/grid/zones';

const NAMES: Record<ZoneId, Record<string, string>> = {
  cave: { minion: '고블린', archer: '고블린 석궁병', brute: '홉고블린', ghoul: '구울', mage: '고블린 주술사', champion: '고블린 족장' },
  crypt: { minion: '해골 졸개', archer: '해골 석궁병', brute: '해골 전사', ghoul: '구울', mage: '해골 마법사', champion: '해골 챔피언' },
  ruins: { minion: '오크', archer: '오크 석궁병', brute: '오크 광전사', ghoul: '구울', mage: '오크 주술사', champion: '오크 군주' },
};

/** A foe kind's name on this floor (goblins in the caves, the dead in the crypt, orcs in the ruins). */
export function foeName(kind: string, floor: number): string | undefined {
  return NAMES[zoneOf(Math.max(1, floor)).id][kind];
}
