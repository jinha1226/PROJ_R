import { applyEffects } from './events';
import type { RunState } from './types';

export function restHeal(run: RunState): RunState {
  return { ...applyEffects(run, [{ kind: 'healAll' }]), pending: undefined };
}

/** Two members talk by the fire: +12 affinity (+15 if either is chatty). */
export function restTalk(run: RunState, a: string, b: string): RunState {
  const chatty = run.roster.mercs.some((m) => (m.id === a || m.id === b) && m.traits.includes('chatty'));
  return { ...applyEffects(run, [{ kind: 'affinity', a, b, amount: chatty ? 15 : 12 }]), pending: undefined };
}
