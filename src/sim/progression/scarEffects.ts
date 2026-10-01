import { PASSIVES } from '../../data/passives';
import { SCARS } from '../../data/scars';
import { registerReactor } from '../battle/reactors';
import { registerMomentumModifier } from '../battle/stats';
import { addEmotion } from '../personality/emotions';

/** Scar stat changes are baked into mercStats; here only battle-start emotions (limp → resolve). */
registerReactor((s) => {
  if (s.tick !== 0) return;
  for (const u of s.units)
    for (const sc of u.setup.scars ?? []) {
      const em = SCARS[sc].startEmotion;
      if (em) addEmotion(s, u, em);
    }
});

registerMomentumModifier((u) => (u.setup.passives ?? []).reduce((m, p) => m * (PASSIVES[p]?.momentumMult ?? 1), 1));
