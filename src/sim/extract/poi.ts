import type { Rng } from '../../core/rng';
import type { Vec2 } from '../../core/vec2';
import type { Obstacle } from '../battle/types';
import type { Container, ContainerKind, Poi, PoiBuild, PoiKind, Prop, Spawn } from './regionTypes';

const box = (x: number, y: number, hx: number, hy: number): Obstacle => ({ pos: { x, y }, radius: 0, kind: 'box', half: { x: hx, y: hy } });
const rock = (p: Vec2, r: number): Obstacle => ({ pos: p, radius: r, kind: 'rock' });
const pillar = (p: Vec2, r: number): Obstacle => ({ pos: p, radius: r, kind: 'pillar' });
const at = (c: Vec2, a: number, r: number): Vec2 => ({ x: Math.round((c.x + Math.cos(a) * r) * 10) / 10, y: Math.round((c.y + Math.sin(a) * r) * 10) / 10 });

export const POI_RADIUS: Record<PoiKind, number> = { ruins: 7, camp: 8, nest: 7, temple: 7, vault: 5, swamp: 9, boss: 9 };
const RISK: Record<PoiKind, 1 | 2 | 3> = { ruins: 1, camp: 2, nest: 2, temple: 3, vault: 2, swamp: 2, boss: 3 };
const GUARDS: Record<PoiKind, string[]> = {
  ruins: ['bandit_cutthroat', 'bandit_archer'],
  camp: ['bandit_cutthroat', 'bandit_cutthroat', 'bandit_archer', 'bandit_hexer'],
  nest: ['skeleton_minion', 'skeleton_minion', 'skeleton_minion', 'skeleton_warrior'],
  temple: ['skeleton_warrior', 'skeleton_mage', 'skeleton_minion', 'skeleton_minion'],
  vault: ['skeleton_warrior', 'skeleton_warrior'],
  swamp: ['skeleton_minion', 'skeleton_minion'],
  boss: ['bandit_chief', 'bandit_cutthroat', 'bandit_cutthroat', 'bandit_archer'],
};
const STAGE_BONUS: Record<PoiKind, number> = { ruins: 0, camp: 1, nest: 1, temple: 2, vault: 1, swamp: 1, boss: 2 };
const LOOT: Record<PoiKind, ContainerKind[]> = {
  ruins: ['crate', 'crate'], camp: ['supply', 'crate'], nest: ['bag', 'bag'], temple: ['relic', 'crate'],
  vault: ['vault', 'crate'], swamp: ['herb', 'herb', 'herb'], boss: ['relic', 'supply'],
};

const blocks = (p: Vec2, obs: Obstacle[], pad: number) => obs.some((o) =>
  o.kind === 'box' ? Math.abs(p.x - o.pos.x) < o.half!.x + pad && Math.abs(p.y - o.pos.y) < o.half!.y + pad : Math.hypot(p.x - o.pos.x, p.y - o.pos.y) < o.radius + pad);

/** A free point near c within r (avoiding obstacles and already-taken points). */
export function freeSpot(rng: Rng, c: Vec2, r: number, obs: Obstacle[], taken: Vec2[]): Vec2 {
  for (let k = 0; k < 60; k++) {
    const p = at(c, rng.next() * Math.PI * 2, r * Math.sqrt(rng.next()));
    if (!blocks(p, obs, 0.9) && !taken.some((t) => Math.hypot(t.x - p.x, t.y - p.y) < 1.4)) return p;
  }
  return c;
}

/** Four walls around c with a 3 m gap on the side facing `toward`; returns the walls and the gap box. */
function walled(c: Vec2, half: number, toward: Vec2): { walls: Obstacle[]; gap: Obstacle } {
  const t = 0.4;
  const dx = toward.x - c.x;
  const dy = toward.y - c.y;
  const side = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'e' : 'w') : dy > 0 ? 's' : 'n';
  const walls: Obstacle[] = [];
  const g = 2;
  const seg = (half - g) / 2;
  const edge = (s: 'n' | 's' | 'e' | 'w') => {
    const horiz = s === 'n' || s === 's';
    const off = s === 'n' || s === 'w' ? -half : half;
    if (s !== side) return [horiz ? box(c.x, c.y + off, half + t, t) : box(c.x + off, c.y, t, half + t)];
    return horiz
      ? [box(c.x - g - seg - t / 2, c.y + off, seg + t / 2, t), box(c.x + g + seg + t / 2, c.y + off, seg + t / 2, t)]
      : [box(c.x + off, c.y - g - seg - t / 2, t, seg + t / 2), box(c.x + off, c.y + g + seg + t / 2, t, seg + t / 2)];
  };
  for (const s of ['n', 's', 'e', 'w'] as const) walls.push(...edge(s));
  const off = side === 'n' || side === 'w' ? -half : half;
  const gap = side === 'n' || side === 's' ? box(c.x, c.y + off, g, t) : box(c.x + off, c.y, t, g);
  return { walls, gap };
}

/** Builds one point of interest: structure, props, guards, containers. */
export function buildPoi(rng: Rng, kind: PoiKind, id: string, c: Vec2, start: Vec2, baseStage: number): PoiBuild {
  const radius = POI_RADIUS[kind];
  const obstacles: Obstacle[] = [];
  const props: Prop[] = [];
  const hazards: PoiBuild['hazards'] = [];
  let door: Poi['door'];
  const prop = (ref: string, p: Vec2, scale = 1) => props.push({ ref, pos: p, rot: Math.round(rng.next() * 628) / 100, scale });
  let inner = radius * 0.65;

  if (kind === 'temple' || kind === 'vault') {
    const half = kind === 'temple' ? 6 : 4;
    const { walls, gap } = walled(c, half, start);
    obstacles.push(...walls);
    if (kind === 'vault') {
      obstacles.push(gap);
      door = { box: gap, key: 'x_vault_key' };
    }
    if (kind === 'temple') for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      const p = { x: c.x + sx * 3, y: c.y + sy * 3 };
      obstacles.push(pillar(p, 0.6));
      prop('dungeon/pillar', p);
    }
    inner = half - 1.5;
  } else if (kind === 'ruins') {
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + rng.next();
      const p = at(c, a, 5);
      const len = 1.5 + rng.next() * 1.5;
      obstacles.push(Math.abs(Math.cos(a)) > 0.7 ? box(p.x, p.y, 0.4, len) : box(p.x, p.y, len, 0.4));
      prop('dungeon/rubble', at(c, a + 0.8, 3));
    }
  } else if (kind === 'camp') {
    for (let k = 0; k < 6; k++) {
      if (k === 2) continue;
      const p = at(c, (k / 6) * Math.PI * 2, 6);
      obstacles.push(rock(p, 0.7));
      prop(k % 2 ? 'dungeon/barrel' : 'dungeon/crates', p);
    }
    prop('dungeon/torch', c);
  } else if (kind === 'nest') {
    const crypt = { x: c.x, y: c.y - 2.5 };
    obstacles.push(rock(crypt, 1.6));
    prop('graveyard/crypt', crypt, 1.2);
    for (let k = 0; k < 5; k++) {
      const p = at(c, (k / 5) * Math.PI * 2 + 0.3, 4.5);
      obstacles.push(rock(p, 0.45));
      prop(rng.pick(['graveyard/grave', 'graveyard/graveB']), p);
    }
  } else if (kind === 'swamp') {
    hazards.push({ kind: 'poison', center: c, radius });
    for (let k = 0; k < 4; k++) {
      const p = at(c, (k / 4) * Math.PI * 2 + rng.next(), 5);
      obstacles.push(rock(p, 0.5));
      prop(rng.pick(['graveyard/deadtree', 'graveyard/deadtreeB']), p);
    }
  } else {
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      const p = { x: c.x + sx * 5, y: c.y + sy * 4 };
      obstacles.push(pillar(p, 0.7));
      prop('dungeon/pillar', p);
    }
    prop('graveyard/arch', { x: c.x, y: c.y - 7 });
  }

  const taken: Vec2[] = [];
  const containers: Container[] = LOOT[kind].map((ck, k) => {
    const pos = ck === 'vault' ? { ...c } : freeSpot(rng, c, inner, obstacles, taken);
    taken.push(pos);
    const tier = ck === 'relic' && kind === 'boss' ? 4 : RISK[kind];
    return { id: `${id}_c${k}`, kind: ck, pos, tier, poi: id };
  });
  const stage = baseStage + STAGE_BONUS[kind];
  const guardArea = kind === 'vault' ? { c: walled(c, 4, start).gap.pos, r: 3 } : { c, r: inner };
  const spawns: Spawn[] = GUARDS[kind].map((enemyId, k) => {
    const pos = freeSpot(rng, kind === 'vault' ? pushOut(guardArea.c, c, 2.2) : guardArea.c, guardArea.r, obstacles, taken);
    taken.push(pos);
    return { id: `${id}_e${k}`, enemyId, pos, stage: enemyId === 'bandit_chief' ? stage + 1 : stage, group: `g_${id}` };
  });
  return { poi: { id, kind, center: c, radius, risk: RISK[kind], door }, obstacles, props, containers, spawns, hazards };
}

/** A point `d` metres beyond p, away from c (vault guards stand outside the door). */
function pushOut(p: Vec2, c: Vec2, d: number): Vec2 {
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  const l = Math.hypot(dx, dy) || 1;
  return { x: p.x + (dx / l) * d, y: p.y + (dy / l) * d };
}
