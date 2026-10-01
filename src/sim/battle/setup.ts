import { createRng } from '../../core/rng';
import { v, type Vec2 } from '../../core/vec2';
import { CLASSES } from '../../data/classes';
import { ENEMIES } from '../../data/enemies';
import { ALLY_PRESETS, ALLY_RELATIONS, ENEMY_PRESETS, type AllyPresetMember } from '../../data/presets';
import type { Relation, Stats } from '../../data/types';
import { DECISION_INTERVAL, STAGE_SCALE } from './constants';
import type { BattleSetup, BattleState, Line, Obstacle, Team, UnitSetup, UnitState } from './types';

type Col = 0 | 1 | 2;
const CAUTIOUS_DELAY = 10;
type Row = 0 | 1 | 2 | 3;

export function slotToPos(team: Team, col: number, row: number): Vec2 {
  const depth = (2 - col) * 2.5;
  const x = team === 'ally' ? -5 - depth : 5 + depth;
  return v(x === 0 ? 0 : x, -4.5 + row * 3);
}

export function lineOf(col: number): Line {
  return col >= 2 ? 'front' : col === 1 ? 'mid' : 'back';
}

const grow = (base: Stats, growth: Partial<Stats>, levels: number): Stats => {
  const out = { ...base };
  for (const k of Object.keys(growth) as (keyof Stats)[]) out[k] = base[k] + (growth[k] ?? 0) * levels;
  return out;
};

export function allyFromClass(m: AllyPresetMember, index: number, level = m.level ?? 1): UnitSetup {
  const c = CLASSES[m.classId];
  return {
    id: `a${index}`, name: m.name, team: 'ally', role: c.role, defId: c.id,
    stats: grow(c.base, c.growth, level - 1), basic: c.basic, actives: [...c.actives], ultimate: c.ultimate,
    tactics: [...m.tactics], traits: [...(m.traits ?? [])], level, slot: { col: m.col, row: m.row }, color: m.color, model: c.model,
    gear: { ...c.gear }, isLeader: index === 0,
  };
}

export function enemyFromDef(enemyId: string, col: Col, row: Row, stage: number, index: number): UnitSetup {
  const d = ENEMIES[enemyId];
  if (!d) throw new Error(`unknown enemy: ${enemyId}`);
  const k = 1 + STAGE_SCALE * (stage - 1);
  return {
    id: `e${index}`, name: enemyId, team: 'enemy', role: d.role, defId: d.id,
    stats: { ...d.base, maxHp: Math.round(d.base.maxHp * k), atk: Math.round(d.base.atk * k) },
    basic: d.basic, actives: [...d.actives], ultimate: d.ultimate, tactics: [], traits: [], level: stage,
    slot: { col, row }, color: '#d0533f', model: d.model, gear: { ...d.gear },
    tint: d.tint, scale: d.scale, elite: d.elite, boss: d.boss, phases: d.phases,
  };
}

function rollObstacles(seed: number): Obstacle[] {
  const rng = createRng(seed ^ 0x9e3779b9);
  const n = rng.int(0, 3);
  const out: Obstacle[] = [];
  for (let i = 0; i < n; i++) {
    const radius = 0.6 + rng.next() * 0.4;
    const x = -3 + radius + rng.next() * (6 - 2 * radius);
    const y = -5.5 + rng.next() * 11;
    if (out.some((o) => Math.hypot(o.pos.x - x, o.pos.y - y) < o.radius + radius + 1.5)) continue;
    out.push({ pos: v(x, y), radius, kind: rng.chance(0.5) ? 'rock' : 'pillar' });
  }
  return out;
}

export function setupFromPresets(seed: number, allyKey: string, enemyKey: string): BattleSetup {
  const allies = ALLY_PRESETS[allyKey];
  const enemies = ENEMY_PRESETS[enemyKey];
  if (!allies || !enemies) throw new Error(`unknown preset: ${allyKey}/${enemyKey}`);
  return {
    seed,
    allies: allies.map((m, i) => allyFromClass(m, i)),
    enemies: enemies.members.map((m, i) => enemyFromDef(m.enemyId, m.col, m.row, enemies.stage, i)),
    obstacles: rollObstacles(seed),
    relations: (ALLY_RELATIONS[allyKey] ?? []).map((r) => ({ ...r })),
  };
}

export function makeUnitState(setup: UnitSetup, pos: Vec2, index: number, summoned: boolean): UnitState {
  return {
    id: setup.id, setup, team: setup.team, line: lineOf(setup.slot.col), pos: { ...pos },
    facing: setup.facing ?? (setup.team === 'ally' ? 0 : Math.PI), vel: v(0, 0),
    hp: setup.stats.maxHp, maxHp: setup.stats.maxHp, shield: 0, momentum: 0,
    alive: true, downed: false, lifeline: 0, action: null, cooldowns: {}, tags: [], emotions: [], intent: null,
    decisionIn: (index % DECISION_INTERVAL) + (setup.traits.includes('cautious') ? CAUTIOUS_DELAY : 0), forced: null, engagedWith: null, threat: {},
    rescueUsed: false, minLifelineFrac: 1, rescueProgress: 0, rescueTarget: null, phaseIndex: 0, summoned,
    stats: { kills: 0, damageDealt: 0, healingDone: 0, dodges: 0 },
  };
}

function buildRelations(setup: BattleSetup): Map<string, Relation> {
  const ids = new Set(setup.allies.map((u) => u.id));
  const map = new Map<string, Relation>();
  for (const r of setup.relations ?? []) {
    if (!ids.has(r.a) || !ids.has(r.b) || r.a === r.b) continue;
    map.set(r.a < r.b ? `${r.a}|${r.b}` : `${r.b}|${r.a}`, { ...r });
  }
  return map;
}

export function createState(setup: BattleSetup): BattleState {
  const all = [...setup.allies, ...setup.enemies];
  return {
    tick: 0,
    rng: createRng(setup.seed),
    units: all.map((u, i) => makeUnitState(u, u.spawn ?? slotToPos(u.team, u.slot.col, u.slot.row), i, false)),
    telegraphs: [],
    projectiles: [],
    obstacles: (setup.obstacles ?? []).map((o) => ({ ...o, pos: { ...o.pos } })),
    events: [],
    outcome: null,
    pending: [],
    nextId: 1,
    berserkMult: 1,
    relations: buildRelations(setup),
    triggerReady: new Map(),
    pairCooldowns: new Map(),
  };
}
