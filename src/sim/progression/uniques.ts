import { dist } from '../../core/vec2';
import type { UniqueId } from '../../data/types';
import { getSkill } from '../../data/skills';
import { PROXIMITY } from '../battle/constants';
import { dealDamage, gainMomentum, heal } from '../battle/damage';
import { registerReactor } from '../battle/reactors';
import { registerDamageModifier, registerStatModifier } from '../battle/stats';
import { addTag, hasTag } from '../battle/tags';
import type { BattleEvent, BattleState, UnitState } from '../battle/types';
import { partners } from '../personality/relations';

const has = (u: UnitState | undefined, id: UniqueId): u is UnitState => !!u?.setup.uniques?.includes(id);
const byId = (s: BattleState, id?: string) => (id ? s.units.find((u) => u.id === id) : undefined);
const DOTS = new Set(['burn', 'bleed', 'thorns', 'lifesteal']);
const isMelee = (u: UnitState) => u.setup.stats.range <= 2;

registerDamageModifier((src, dst) => (has(src, 'wetLightning') && hasTag(dst, 'wet') ? 1.25 : 1));
registerStatModifier((u) => (has(u, 'lastStand') && u.hp / u.maxHp < 0.3 ? { atk: 1.25 } : null));
registerStatModifier((u, s) => (has(u, 'friendGuard') && partners(s, u, 'friend').some((p) => dist(p.pos, u.pos) <= PROXIMITY) ? { def: 1.2 } : null));

function onEvent(s: BattleState, e: BattleEvent): void {
  const src = byId(s, e.src);
  const dst = byId(s, e.dst);
  if (e.type === 'damage' && src && dst && !DOTS.has(e.skillId ?? '')) {
    const amount = e.amount ?? 0;
    if (has(src, 'lifesteal')) heal(s, src, src, amount * 0.1, 'lifesteal');
    if (has(src, 'knockdownBleed') && hasTag(dst, 'knockdown')) addTag(s, dst, 'bleed', 3, 0.2, src.id);
    if (has(dst, 'thorns') && dst.alive && src.alive && isMelee(src) && src.team !== dst.team)
      dealDamage(s, dst, src, { mult: 0.3, canDodge: false, canCrit: false, skillId: 'thorns' });
  } else if (e.type === 'died' && has(src, 'markReset') && dst && hasTag(dst, 'marked')) {
    for (const id of src.setup.actives) if (getSkill(id).kind === 'active') src.cooldowns[id] = 0;
  }
}

registerReactor((s, events) => {
  if (s.tick === 0) for (const u of s.units) if (has(u, 'firstStrike')) gainMomentum(s, u, 30);
  for (const e of events) onEvent(s, e);
});
