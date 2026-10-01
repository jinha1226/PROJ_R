import type { RelationKind } from '../../data/types';
import { relationKinds } from '../../sim/personality/relations';
import type { Roster } from '../../sim/roster/types';

export const EDGE_COLORS: Record<RelationKind, string> = {
  comrade: '#f0c040', mentor: '#6ac8ff', friend: '#7ad08a', rival: '#ff8a2a', feud: '#b070e0',
};
const PRIORITY: RelationKind[] = ['comrade', 'mentor', 'friend', 'rival', 'feud'];

export interface GraphModel {
  nodes: { id: string; name: string; color: string; x: number; y: number }[];
  edges: { a: string; b: string; kinds: RelationKind[]; color: string; affinity: number }[];
}

/** Members on a circle; an edge for every pair that holds at least one named relationship. */
export function graphModel(r: Roster, size: number): GraphModel {
  const c = size / 2;
  const radius = size / 2 - 40;
  const mercs = r.mercs.filter((m) => m.alive);
  const nodes = mercs.map((m, i) => {
    const a = (Math.PI * 2 * i) / Math.max(1, mercs.length) - Math.PI / 2;
    return { id: m.id, name: m.name, color: m.color, x: c + Math.cos(a) * radius, y: c + Math.sin(a) * radius };
  });
  const level = new Map(mercs.map((m) => [m.id, m.level]));
  const edges = r.relations
    .filter((x) => level.has(x.a) && level.has(x.b))
    .map((x) => {
      const kinds = PRIORITY.filter((k) => relationKinds(x, level.get(x.a)!, level.get(x.b)!).has(k));
      return { a: x.a, b: x.b, kinds, color: kinds.length ? EDGE_COLORS[kinds[0]!] : '', affinity: x.affinity };
    })
    .filter((e) => e.kinds.length > 0);
  return { nodes, edges };
}
