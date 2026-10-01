import type { Vec2 } from '../../core/vec2';
import { getSkill } from '../../data/skills';
import { xitem } from '../../data/extract';
import { isReady, startAction } from '../battle/actions';
import { segmentBlocked } from '../battle/geometry';
import { isActionBlocked } from '../battle/tags';
import { effectiveStats } from '../battle/stats';
import type { UnitState } from '../battle/types';
import { removeAt } from '../extract/loadout';
import type { WorldState } from './types';
import { emitW, heroUnit } from './worldState';
import { alertGroup } from './perception';
import { goHome } from './patrol';

export interface HeroInput {
  move: Vec2;
  attack: boolean;
  skill1: boolean;
  skill2: boolean;
  ult: boolean;
  /** quick slot index to use this tick */
  quick: number | null;
  interact: boolean;
  /** let the battle AI fight for the hero */
  auto: boolean;
}

export const idleInput = (): HeroInput => ({ move: { x: 0, y: 0 }, attack: false, skill1: false, skill2: false, ult: false, quick: null, interact: false, auto: false });

const CONE = (60 * Math.PI) / 180;
export const SEC = 20;
const HIDE_TICKS = 4 * SEC;
const DRINK_TICKS = 16;
const RECALL_TICKS = 10 * SEC;

const angleOff = (u: UnitState, p: Vec2) => {
  const off = Math.abs(Math.atan2(p.y - u.pos.y, p.x - u.pos.x) - u.facing) % (Math.PI * 2);
  return off > Math.PI ? Math.PI * 2 - off : off;
};

/** Nearest foe in reach, preferring one in front of the hero. */
function aim(w: WorldState, u: UnitState, range: number): UnitState | undefined {
  const foes = w.b.units.filter((o) => o.team === 'enemy' && o.alive && !o.downed && !o.dormant
    && Math.hypot(o.pos.x - u.pos.x, o.pos.y - u.pos.y) <= range + 0.3 && !segmentBlocked(w.b, u.pos, o.pos));
  const d = (o: UnitState) => Math.hypot(o.pos.x - u.pos.x, o.pos.y - u.pos.y);
  const front = foes.filter((o) => angleOff(u, o.pos) <= CONE).sort((a, b) => d(a) - d(b) || (a.id < b.id ? -1 : 1));
  return front[0] ?? foes.sort((a, b) => d(a) - d(b) || (a.id < b.id ? -1 : 1))[0];
}

function cast(w: WorldState, u: UnitState, skillId: string | undefined): void {
  if (!skillId || !isReady(u, skillId)) return;
  const skill = getSkill(skillId);
  if (skill.target !== 'enemy') return startAction(w.b, u, skillId, u.id, { ...u.pos });
  const t = aim(w, u, skill.range);
  if (t) return startAction(w.b, u, skillId, t.id, { ...t.pos });
  if (skill.area) {
    const r = Math.min(skill.range, 3);
    startAction(w.b, u, skillId, undefined, { x: u.pos.x + Math.cos(u.facing) * r, y: u.pos.y + Math.sin(u.facing) * r });
  }
}

/** Uses the item in a quick slot: potions take a moment, the rest act at once. */
function useQuick(w: WorldState, index: number): void {
  const s = w.hero.loadout.quick[index];
  if (!s) return;
  const use = xitem(s.id).use;
  if (!use) return;
  if (use.kind === 'heal' && w.hero.drink) return;
  if (use.kind === 'recall' && w.hero.channel && w.hero.channel.kind !== 'search') return;
  w.hero.loadout = removeAt(w.hero.loadout, 'quick', index, 1).loadout;
  const tick = w.b.tick;
  if (use.kind === 'heal') w.hero.drink = { ticks: 0, total: DRINK_TICKS, item: s.id };
  else if (use.kind === 'antidote') w.hero.poisonImmuneUntil = tick + use.sec * SEC;
  else if (use.kind === 'recall') w.hero.channel = { kind: 'recall', ticks: 0, total: RECALL_TICKS };
  else {
    const h = heroUnit(w);
    for (const [g, grp] of Object.entries(w.groups)) {
      if (grp.hunter || !grp.alerted) continue;
      if (grp.members.some((id) => { const m = w.b.units.find((x) => x.id === id); return m?.alive && Math.hypot(m.pos.x - h.pos.x, m.pos.y - h.pos.y) <= use.radius; })) goHome(w, g);
    }
    w.hero.hiddenUntil = tick + HIDE_TICKS;
  }
  emitW(w, 'use', { item: s.id });
}

/** Applies one tick of player input to the hero (movement, attacks, skills, quick items). */
export function applyHeroInput(w: WorldState, input: HeroInput): void {
  const u = heroUnit(w);
  if (!u.alive || u.downed) return;
  if (!!u.setup.controlled === input.auto) u.setup = { ...u.setup, controlled: !input.auto };
  if (input.quick !== null) useQuick(w, input.quick);
  if (input.auto) return;
  const ch = w.hero.channel;
  const len = Math.min(1, Math.hypot(input.move.x, input.move.y));
  if (len > 0.1 && ch && ch.kind !== 'extract') w.hero.channel = undefined;
  if (u.action || u.forced || isActionBlocked(u)) return;
  if (len > 0.1) {
    const speed = effectiveStats(u, w.b).moveSpeed;
    const k = (speed * len) / Math.hypot(input.move.x, input.move.y);
    u.vel = { x: input.move.x * k, y: input.move.y * k };
    u.facing = Math.atan2(input.move.y, input.move.x);
  } else u.vel = { x: 0, y: 0 };
  if (input.ult) cast(w, u, u.setup.ultimate);
  else if (input.skill1) cast(w, u, u.setup.actives[0]);
  else if (input.skill2) cast(w, u, u.setup.actives[1]);
  else if (input.attack) cast(w, u, u.setup.basic);
}

/** Hitting an unaware enemy alerts its whole group. */
export function alertOnHit(w: WorldState): void {
  for (const e of w.b.events) if (e.type === 'damage' && e.src === w.heroId && e.dst) alertGroup(w, w.groupOf[e.dst] ?? '');
}
