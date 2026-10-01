import { createRng, type Rng } from '../../core/rng';
import type { MapNode, NodeType, RunMap } from './types';

export const STEPS = 12;
const LANES = [0, 1, 2] as const;
const BOSS_ID = `n${STEPS}_1`;

const WEIGHTS: [NodeType, number, number][] = [
  // type, weight, min step
  ['battle', 45, 1], ['elite', 15, 4], ['event', 18, 1], ['encounter', 8, 1], ['shop', 9, 3], ['rest', 5, 4],
];

function roll(rng: Rng, step: number): NodeType {
  const pool = WEIGHTS.filter(([, , min]) => step >= min);
  let x = rng.next() * pool.reduce((a, [, w]) => a + w, 0);
  for (const [type, w] of pool) if ((x -= w) < 0) return type;
  return 'battle';
}

function typeFor(rng: Rng, step: number): NodeType {
  if (step === 1) return 'battle';
  if (step === 2) return 'encounter';
  if (step === STEPS - 1) return 'rest';
  return roll(rng, step);
}

/** 12 steps × 3 lanes; edges go to the same or an adjacent lane; step 11 leads to the boss. */
export function generateMap(seed: number): RunMap {
  const rng = createRng(seed ^ 0x51ed27);
  const nodes: Record<string, MapNode> = {};
  for (let step = 1; step < STEPS; step++)
    for (const lane of LANES) nodes[`n${step}_${lane}`] = { id: `n${step}_${lane}`, step, lane, type: typeFor(rng, step), next: [] };
  nodes[BOSS_ID] = { id: BOSS_ID, step: STEPS, lane: 1, type: 'boss', next: [] };

  const sixth = LANES.map((l) => nodes[`n6_${l}`]!);
  if (!sixth.some((n) => n.type === 'rest')) rng.pick(sixth).type = 'rest';
  const mid = Object.values(nodes).filter((n) => n.step >= 3 && n.step <= 10);
  if (!mid.some((n) => n.type === 'shop')) rng.pick(mid.filter((n) => n.type !== 'rest')).type = 'shop';

  for (let step = 1; step < STEPS - 1; step++)
    for (const lane of LANES) {
      const n = nodes[`n${step}_${lane}`]!;
      const options = LANES.filter((l) => Math.abs(l - lane) <= 1);
      const keep = options.filter((l) => l === lane || rng.chance(0.55));
      n.next = keep.map((l) => `n${step + 1}_${l}`);
    }
  for (const lane of LANES) nodes[`n${STEPS - 1}_${lane}`]!.next = [BOSS_ID];
  // every node in steps 2..11 must have an incoming edge (straight edges guarantee this)
  return { nodes, steps: STEPS };
}
