import { dist, lerp } from '../../core/vec2';
import type { RelationTriggerKind } from '../../data/types';
import { registerConsideration } from '../battle/ai/considerations';
import { registerCandidateGenerator, type Candidate } from '../battle/ai/candidates';
import { PROXIMITY, TICK_RATE } from '../battle/constants';
import { gainMomentum } from '../battle/damage';
import { emit } from '../battle/events';
import { registerReactor } from '../battle/reactors';
import { registerStatModifier, type StatMods } from '../battle/stats';
import type { BattleEvent, BattleState, UnitState } from '../battle/types';
import { addEmotion } from './emotions';
import { hasRelation, partners, relatedEvenIfDown } from './relations';

const DANGER_HP = 0.3;
const PROTECT_COOLDOWN = 6 * TICK_RATE;
const FEUD_COOLDOWN = 10 * TICK_RATE;
const near = (a: UnitState, b: UnitState): boolean => dist(a.pos, b.pos) <= PROXIMITY;
const byId = (s: BattleState, id?: string) => (id ? s.units.find((u) => u.id === id) : undefined);
/** Mentorship only flows from the higher-level unit to the lower-level one. */
const isMentorOf = (s: BattleState, master: UnitState, disciple: UnitState): boolean =>
  master.setup.level > disciple.setup.level && hasRelation(s, master, disciple, 'mentor');

/** Emits a relation_trigger unless the same src/dst/kind fired within the cooldown. */
export function fireTrigger(s: BattleState, src: string, dst: string, kind: RelationTriggerKind, cooldown: number, data: Record<string, unknown> = {}): void {
  const key = `${src}|${dst}|${kind}`;
  if ((s.triggerReady.get(key) ?? -1) > s.tick) return;
  s.triggerReady.set(key, s.tick + cooldown);
  emit(s, { type: 'relation_trigger', src, dst, data: { kind, ...data } });
}

/** Friends and disciples that are wounded and currently targeted by a standing enemy. */
function threatened(u: UnitState, s: BattleState): { ally: UnitState; foe: UnitState }[] {
  const out: { ally: UnitState; foe: UnitState }[] = [];
  const allies = [...new Set([...partners(s, u, 'friend'), ...partners(s, u, 'mentor')])];
  for (const ally of allies) {
    if (ally.hp / ally.maxHp >= DANGER_HP) continue;
    for (const foe of s.units)
      if (foe.team !== u.team && foe.alive && !foe.downed && foe.intent?.targetId === ally.id) out.push({ ally, foe });
  }
  return out;
}

registerCandidateGenerator((u, s) => {
  if (u.team !== 'ally' || s.relations.size === 0) return [];
  return threatened(u, s)
    .filter(({ foe }) => dist(u.pos, foe.pos) > u.setup.stats.range + 0.2)
    .map(({ ally, foe }): Candidate => ({ kind: 'protect', target: foe, ally, dest: lerp(ally.pos, foe.pos, 0.35) }));
});

registerConsideration({ id: 'relation:protect', reason: 'protectFriend', score: (c, { u, s }) => {
  if (c.kind === 'protect') return 45 + (c.ally && isMentorOf(s, u, c.ally) ? 10 : 0) + (u.setup.traits.includes('protective') ? 20 : 0);
  if (c.kind !== 'skill' || c.skill?.target !== 'enemy' || !c.target) return 0;
  return threatened(u, s).some((t) => t.foe === c.target) ? 25 : 0;
} });

registerConsideration({ id: 'relation:rivalry', reason: 'rivalry', score: (c, { u, s }) => {
  if (c.kind !== 'skill' || c.skill?.target !== 'enemy' || !c.target) return 0;
  return partners(s, u, 'rival').some((r) => r.intent?.targetId === c.target!.id) ? 12 : 0;
} });

registerConsideration({ id: 'relation:feud', score: (c, { u, s }) => {
  const helping = c.kind === 'rescue' || c.kind === 'protect' ? c.ally ?? c.target : c.kind === 'skill' && c.skill?.target === 'ally' ? c.target : undefined;
  return helping && helping !== u && relatedEvenIfDown(s, u, helping, 'feud') ? -25 : 0;
} });

registerStatModifier((u, s): StatMods | null => {
  if (u.team !== 'ally' || s.relations.size === 0) return null;
  const mods: StatMods = {};
  if (partners(s, u, 'friend').some((p) => near(u, p))) mods.def = 1.1;
  if (partners(s, u, 'rival').some((p) => near(u, p))) { mods.atkSpeed = 1.1; mods.crit = 1.1; }
  if (partners(s, u, 'feud').some((p) => near(u, p))) mods.atk = 0.9;
  return Object.keys(mods).length ? mods : null;
});

function onEvent(s: BattleState, e: BattleEvent): void {
  if (e.type === 'intent' && e.data?.kind === 'protect' && e.src && typeof e.data.allyId === 'string') {
    const u = byId(s, e.src);
    const ally = byId(s, e.data.allyId);
    if (u && ally) fireTrigger(s, u.id, ally.id, isMentorOf(s, u, ally) ? 'mentor' : 'protect', PROTECT_COOLDOWN);
  } else if (e.type === 'died') {
    const killer = byId(s, e.src);
    if (!killer || killer.team !== 'ally') return;
    for (const r of partners(s, killer, 'rival')) {
      gainMomentum(s, r, 10);
      fireTrigger(s, r.id, killer.id, 'rivalry', 0, { kill: true });
    }
  } else if (e.type === 'downed') {
    const victim = byId(s, e.dst);
    if (!victim || victim.team !== 'ally') return;
    let barked = false;
    for (const o of s.units) {
      if (o === victim || o.team !== victim.team || !o.alive || o.downed) continue;
      if (relatedEvenIfDown(s, o, victim, 'rival')) {
        addEmotion(s, o, 'rage');
        fireTrigger(s, o.id, victim.id, 'rivalry', 0, { downed: true });
      }
      if (!barked && relatedEvenIfDown(s, o, victim, 'friend')) {
        emit(s, { type: 'bark', src: o.id, dst: victim.id, data: { key: 'downedFriend' } });
        barked = true;
      }
    }
  }
}

function feudProximity(s: BattleState): void {
  for (const u of s.units) {
    if (u.team !== 'ally' || !u.alive || u.downed) continue;
    for (const p of partners(s, u, 'feud')) if (u.id < p.id && near(u, p)) fireTrigger(s, u.id, p.id, 'feud', FEUD_COOLDOWN);
  }
}

registerReactor((s, events) => {
  if (s.relations.size === 0) return;
  for (const e of events) onEvent(s, e);
  feudProximity(s);
});
