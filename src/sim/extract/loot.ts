import { createRng, type Rng } from '../../core/rng';
import { X_ITEMS, type Tier, type XItemDef } from '../../data/extract';
import { CONTAINER_LOOT, ENEMY_DROPS, ENEMY_GEAR_CHANCE, type LootEntry } from '../../data/extract/lootTables';
import { mergeAll, type Stack } from './inventory';
import type { Container } from './regionTypes';

const NIGHT_MINUTE = 8;
const ALL = Object.values(X_ITEMS);
const clampTier = (t: number): Tier => Math.max(0, Math.min(4, Math.round(t))) as Tier;
const hash = (s: string) => [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);

function poolFor(e: LootEntry): XItemDef[] {
  if (e.kind === 'potion') return ALL.filter((i) => i.use?.kind === 'heal');
  if (e.kind === 'herbal') return ALL.filter((i) => i.use?.kind === 'heal' || i.use?.kind === 'antidote');
  if (e.kind === 'consumable') return ALL.filter((i) => i.kind === 'consumable' && i.use?.kind !== 'recall');
  return ALL.filter((i) => i.kind === e.kind && i.kind !== 'key');
}

/** Picks one item of the entry's kind, preferring the target tier and falling back to the nearest tier. */
function draw(rng: Rng, e: LootEntry, tier: number): Stack {
  const pool = poolFor(e);
  const want = clampTier(tier + (e.tierOffset ?? 0));
  const exact = pool.filter((i) => i.tier === want);
  const dist = (i: XItemDef) => Math.abs(i.tier - want);
  const best = exact.length ? exact : pool.filter((i) => dist(i) === Math.min(...pool.map(dist)));
  // a rare recall scroll can turn up in rich containers
  const item = e.kind === 'consumable' && tier >= 3 && rng.chance(0.15) ? X_ITEMS.x_recall! : rng.pick(best);
  return { id: item.id, n: item.stack > 1 ? rng.int(1, Math.min(item.stack, 3)) : 1 };
}

function weighted(rng: Rng, entries: LootEntry[]): LootEntry {
  let r = rng.next() * entries.reduce((a, e) => a + e.weight, 0);
  for (const e of entries) if ((r -= e.weight) < 0) return e;
  return entries[entries.length - 1]!;
}

/** Contents of a container opened at `minute` into the sortie; after nightfall gear and junk run one tier richer half the time. */
export function rollContainer(c: Container, seed: number, minute: number): Stack[] {
  const rng = createRng((seed ^ hash(c.id)) >>> 0);
  const table = CONTAINER_LOOT[c.kind];
  const night = minute >= NIGHT_MINUTE;
  const tierFor = () => c.tier + (night && rng.chance(0.5) ? 1 : 0);
  const out: Stack[] = [...(table.guaranteed ?? []).map((e) => draw(rng, e, tierFor()))];
  const n = rng.int(table.rolls[0], table.rolls[1]) + (night && rng.chance(0.3) ? 1 : 0);
  for (let k = 0; k < n; k++) out.push(draw(rng, weighted(rng, table.entries), tierFor()));
  for (const id of c.extra ?? []) out.push({ id, n: 1 });
  return mergeAll([], out);
}

const family = (enemyId: string): string => {
  if (enemyId === 'bandit_chief' || enemyId === 'ashen_knight') return enemyId;
  if (enemyId.startsWith('bandit')) return 'bandit';
  return enemyId === 'skeleton_warrior' || enemyId === 'skeleton_mage' ? 'skeleton_elite' : 'skeleton';
};

/** What a fallen enemy leaves on its body. */
export function rollDrop(enemyId: string, stage: number, seed: number): Stack[] {
  const rng = createRng((seed ^ hash(enemyId) ^ Math.imul(stage, 2654435761)) >>> 0);
  const fam = family(enemyId);
  const drops = [...(ENEMY_DROPS[fam] ?? []), ...(fam === 'skeleton_elite' ? ENEMY_DROPS.skeleton!.slice(0, 1) : [])];
  const out: Stack[] = [];
  for (const d of drops) if (rng.chance(d.chance)) out.push({ id: d.id, n: rng.int(d.n[0], d.n[1]) });
  if (rng.chance(ENEMY_GEAR_CHANCE[fam] ?? 0)) out.push(draw(rng, { kind: 'gear', weight: 1 }, Math.floor(stage / 2) + (fam === 'bandit_chief' ? 1 : 0)));
  return mergeAll([], out);
}
