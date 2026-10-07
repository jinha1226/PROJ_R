import { TRAITS } from './traitDefs';
import type { Tag } from './buildTypes';

/** A class line's branch (spec §2.1): three per line, each with a signature card that runs as a sustained state. */
export interface Branch { id: string; line: string; name: string; tag: Tag }
export const BRANCHES: Branch[] = [
  { id: 'shell:shot', line: 'shell', name: '사격', tag: '원거리' },
  { id: 'shell:blast', line: 'shell', name: '폭발물', tag: '화염' },
  { id: 'shell:suit', line: 'shell', name: '슈트', tag: '생존' },
  { id: 'warrior:whirl', line: 'warrior', name: '회오리', tag: '출혈' },
  { id: 'warrior:frenzy', line: 'warrior', name: '광란', tag: '근접' },
  { id: 'warrior:shout', line: 'warrior', name: '함성', tag: '함성' },
  { id: 'mage:fire', line: 'mage', name: '화염', tag: '화염' },
  { id: 'mage:cold', line: 'mage', name: '냉기', tag: '냉기' },
  { id: 'mage:lightning', line: 'mage', name: '번개', tag: '전기' },
  { id: 'necromancer:bone', line: 'necromancer', name: '뼈', tag: '뼈' },
  { id: 'necromancer:legion', line: 'necromancer', name: '군단', tag: '소환' },
  { id: 'necromancer:plague', line: 'necromancer', name: '독·저주', tag: '독' },
  { id: 'rogue:trap', line: 'rogue', name: '함정', tag: '함정' },
  { id: 'rogue:martial', line: 'rogue', name: '무술', tag: '치명' },
  { id: 'rogue:shadow', line: 'rogue', name: '그림자', tag: '은신' },
];
const BY_ID = new Map(BRANCHES.map((b) => [b.id, b]));
/** the branch a card belongs to (none for commons, duos, oaths and lines not yet split) */
export const branchOf = (cardId: string): Branch | undefined => { const b = TRAITS[cardId]?.branch; return b ? BY_ID.get(b) : undefined; };
/** the signature cards of a line */
export const sigCards = (line: string): string[] => Object.values(TRAITS).filter((d) => d.pool === line && d.sig).map((d) => d.id);
