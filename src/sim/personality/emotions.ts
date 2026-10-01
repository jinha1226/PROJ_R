import { EMOTIONS } from '../../data/emotions';
import type { EmotionId, Stats } from '../../data/types';
import { secToTicks } from '../battle/constants';
import { emit } from '../battle/events';
import { registerReactor } from '../battle/reactors';
import { registerLethalGuard, registerMomentumModifier, registerStatModifier, type StatMods } from '../battle/stats';
import type { BattleState, UnitState } from '../battle/types';

const FEAR_RECOVER = 0.4;

const isCalm = (u: UnitState): boolean => u.setup.traits.includes('calm');

export function hasEmotion(u: UnitState, id: EmotionId): boolean {
  return u.emotions.some((e) => e.id === id);
}

export function emotionOf(u: UnitState, id: EmotionId) {
  return u.emotions.find((e) => e.id === id);
}

function remove(s: BattleState, u: UnitState, id: EmotionId): void {
  if (!hasEmotion(u, id)) return;
  u.emotions = u.emotions.filter((e) => e.id !== id);
  emit(s, { type: 'emotion_end', dst: u.id, data: { id } });
}

/** Adds or refreshes an emotion. Calm halves duration; courage and fear exclude each other. */
export function addEmotion(s: BattleState, u: UnitState, id: EmotionId, opts: { targetId?: string; durationSec?: number } = {}): void {
  if (!u.alive || u.downed) return;
  if (id === 'fear' && hasEmotion(u, 'courage')) return;
  if (id === 'courage') remove(s, u, 'fear');
  const sec = (opts.durationSec ?? EMOTIONS[id].durationSec) * (isCalm(u) ? 0.5 : 1);
  const ticks = secToTicks(sec);
  const cur = emotionOf(u, id);
  if (cur) {
    cur.ticksLeft = Math.max(cur.ticksLeft, ticks);
    if (opts.targetId) cur.targetId = opts.targetId;
  } else {
    u.emotions.push({ id, ticksLeft: ticks, targetId: opts.targetId });
  }
  emit(s, { type: 'emotion', dst: u.id, data: { id, targetId: opts.targetId } });
}

export function tickEmotions(s: BattleState): void {
  for (const u of s.units) {
    if (u.emotions.length === 0) continue;
    if (!u.alive || u.downed) {
      for (const e of [...u.emotions]) if (e.id !== 'resolve') remove(s, u, e.id);
      continue;
    }
    for (const e of [...u.emotions]) {
      e.ticksLeft--;
      const target = e.targetId ? s.units.find((o) => o.id === e.targetId) : undefined;
      const revengeDone = e.id === 'revenge' && (!target || !target.alive);
      const fearDone = e.id === 'fear' && u.hp / u.maxHp > FEAR_RECOVER;
      if (e.ticksLeft <= 0 || revengeDone || fearDone) remove(s, u, e.id);
    }
  }
}

const emotionStats = (u: UnitState): StatMods | null => {
  if (u.emotions.length === 0) return null;
  const calm = isCalm(u);
  const mods: StatMods = {};
  for (const e of u.emotions)
    for (const [k, m] of Object.entries(EMOTIONS[e.id].statMult) as [keyof Stats, number][])
      mods[k] = (mods[k] ?? 1) * (calm ? 1 + (m - 1) / 2 : m);
  return mods;
};

registerStatModifier((u) => emotionStats(u));
registerMomentumModifier((u) => u.emotions.reduce((m, e) => m * EMOTIONS[e.id].momentumMult, 1));
registerLethalGuard((u, s) => {
  const r = emotionOf(u, 'resolve');
  if (!r || r.used) return false;
  r.used = true;
  emit(s, { type: 'resolve', dst: u.id });
  return true;
});
registerReactor((s) => tickEmotions(s));
