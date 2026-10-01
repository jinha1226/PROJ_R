import { gainMomentum } from '../battle/damage';
import { registerReactor } from '../battle/reactors';
import { registerDamageModifier, registerHealModifier, registerLifelineModifier, registerStatModifier } from '../battle/stats';

registerStatModifier((u) => (u.setup.title === 'guardian' && (u.intent?.kind === 'protect' || u.intent?.kind === 'guard') ? { def: 1.15 } : null));
registerLifelineModifier((u) => (u.setup.title === 'undying' ? 1.25 : 1));
registerDamageModifier((src, dst) => (src.setup.title === 'giantSlayer' && (dst.setup.boss || dst.setup.elite) ? 1.1 : 1));
registerHealModifier((src) => (src.setup.title === 'healingHand' ? 1.1 : 1));
registerReactor((s, events) => {
  for (const e of events) {
    if (e.type !== 'died') continue;
    const killer = s.units.find((u) => u.id === e.src);
    if (killer?.setup.title === 'hundredCuts') gainMomentum(s, killer, 10);
  }
});
