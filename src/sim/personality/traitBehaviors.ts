import { dist } from '../../core/vec2';
import type { TraitId } from '../../data/types';
import { registerConsideration } from '../battle/ai/considerations';
import { gainMomentum } from '../battle/damage';
import { emit } from '../battle/events';
import { registerReactor } from '../battle/reactors';
import { registerMomentumModifier, registerStatModifier } from '../battle/stats';
import { PROXIMITY } from '../battle/constants';
import type { BattleEvent, BattleState, UnitState } from '../battle/types';
import { addEmotion, emotionOf, hasEmotion } from './emotions';
import { partners, relatedEvenIfDown } from './relations';

const has = (u: UnitState, t: TraitId): boolean => u.setup.traits.includes(t);
const COWARD_HP = 0.3;
const HOTHEAD_CHANCE = 0.15;
const byId = (s: BattleState, id?: string) => (id ? s.units.find((u) => u.id === id) : undefined);
const standingAllyNear = (s: BattleState, u: UnitState) =>
  s.units.some((o) => o !== u && o.team === u.team && o.alive && !o.downed && dist(o.pos, u.pos) <= PROXIMITY);

// --- considerations (score bonuses; reasons are ko.reason keys) ---
registerConsideration({ id: 'trait:reckless', score: (c, { u }) => {
  if (!has(u, 'reckless')) return 0;
  if (c.kind === 'dodge') return -30;
  return c.kind === 'skill' && c.skill?.hints?.includes('gapClose') ? 15 : 0;
} });
registerConsideration({ id: 'trait:cautious', reason: 'dodge', score: (c, { u }) => (has(u, 'cautious') && c.kind === 'dodge' ? 30 : 0) });
registerConsideration({ id: 'trait:altruist', reason: 'heal', score: (c, { u }) => {
  if (!has(u, 'altruist')) return 0;
  if (c.kind === 'rescue' || c.kind === 'protect') return 20;
  const h = c.skill?.hints;
  return c.kind === 'skill' && (h?.includes('heal') || h?.includes('shield')) ? 20 : 0;
} });
registerConsideration({ id: 'trait:protective', reason: 'heal', score: (c, { u }) => {
  if (!has(u, 'protective') || c.kind !== 'skill' || !c.target || c.skill?.target !== 'ally') return 0;
  return c.target.hp / c.target.maxHp < COWARD_HP ? 10 : 0;
} });
registerConsideration({ id: 'trait:glory', reason: 'glory', score: (c, { u }) =>
  has(u, 'glory') && c.kind === 'skill' && c.skill?.target === 'enemy' && (c.target?.setup.boss || c.target?.setup.elite) ? 20 : 0 });
registerConsideration({ id: 'trait:competitive', reason: 'competitive', score: (c, { u, s }) => {
  if (!has(u, 'competitive') || c.kind !== 'skill' || c.skill?.target !== 'enemy' || !c.target) return 0;
  if (c.target.hp / c.target.maxHp > 0.4) return 0;
  return s.units.some((o) => o !== u && o.team === u.team && o.intent?.targetId === c.target!.id) ? 12 : 0;
} });
registerConsideration({ id: 'emotion:fear', reason: 'flee', score: (c, { u }) => {
  if (!hasEmotion(u, 'fear')) return 0;
  return c.kind === 'flee' ? 60 : c.kind === 'skill' ? -30 : 0;
} });
registerConsideration({ id: 'emotion:revenge', reason: 'revenge', score: (c, { u }) => {
  const r = emotionOf(u, 'revenge');
  if (!r || c.kind !== 'skill' || c.skill?.target !== 'enemy' || !c.target) return 0;
  return c.target.id === r.targetId ? 60 : -20;
} });
registerConsideration({ id: 'emotion:rage', reason: 'rage', score: (c, { u }) => {
  if (!hasEmotion(u, 'rage')) return 0;
  if (c.kind === 'kite' || c.kind === 'dodge') return -20;
  return c.kind === 'skill' && c.skill?.target === 'enemy' ? 15 : 0;
} });

// --- stat / momentum modifiers ---
registerStatModifier((u, s) => (has(u, 'loner') && !standingAllyNear(s, u) ? { atk: 1.15 } : null));
registerMomentumModifier((u) => (has(u, 'reckless') ? 1.25 : 1));

// --- event reactors ---
function cowardice(s: BattleState): void {
  for (const u of s.units) {
    if (u.team !== 'ally' || !u.alive || u.downed || !has(u, 'coward') || u.hp / u.maxHp > COWARD_HP) continue;
    if (hasEmotion(u, 'fear') || hasEmotion(u, 'courage')) continue;
    const friend = partners(s, u, 'friend').find((f) => dist(f.pos, u.pos) <= PROXIMITY);
    if (friend) {
      addEmotion(s, u, 'courage');
      emit(s, { type: 'relation_trigger', src: u.id, dst: friend.id, data: { kind: 'courage' } });
    } else {
      addEmotion(s, u, 'fear');
    }
  }
}

function onEvent(s: BattleState, e: BattleEvent): void {
  if (e.type === 'downed') {
    const victim = byId(s, e.dst);
    const attacker = byId(s, e.src);
    if (!victim || !attacker || attacker.team === victim.team) return;
    for (const v of s.units) {
      if (v.team !== victim.team || v.downed || !has(v, 'vengeful') || !relatedEvenIfDown(s, v, victim, 'friend')) continue;
      addEmotion(s, v, 'revenge', { targetId: attacker.id });
      emit(s, { type: 'relation_trigger', src: v.id, dst: victim.id, data: { kind: 'revenge', targetId: attacker.id } });
    }
  } else if (e.type === 'damage') {
    const hit = byId(s, e.dst);
    if (hit && hit.alive && !hit.downed && has(hit, 'hotheaded') && !hasEmotion(hit, 'rage') && s.rng.chance(HOTHEAD_CHANCE)) addEmotion(s, hit, 'rage');
  } else if (e.type === 'died') {
    const killer = byId(s, e.src);
    if (killer && has(killer, 'glory')) gainMomentum(s, killer, 30);
  }
}

registerReactor((s, events) => {
  for (const e of events) onEvent(s, e);
  cowardice(s);
});
