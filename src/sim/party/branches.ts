import { TRAITS } from './traitDefs';
import type { Tag } from './buildTypes';

/** A class line's branch (spec §2.1): three per line, each with a signature card that runs as a sustained state. */
export interface Branch { id: string; line: string; name: string; tag: Tag }
export const BRANCHES: Branch[] = [
  { id: 'shell:shot', line: 'shell', name: '사격', tag: '원거리' },
  { id: 'shell:blast', line: 'shell', name: '폭발물', tag: '화염' },
  { id: 'shell:suit', line: 'shell', name: '슈트', tag: '생존' },
];
const BY_ID = new Map(BRANCHES.map((b) => [b.id, b]));
/** the branch a card belongs to (none for commons, duos, oaths and lines not yet split) */
export const branchOf = (cardId: string): Branch | undefined => { const b = TRAITS[cardId]?.branch; return b ? BY_ID.get(b) : undefined; };
/** the signature cards of a line */
export const sigCards = (line: string): string[] => Object.values(TRAITS).filter((d) => d.pool === line && d.sig).map((d) => d.id);
