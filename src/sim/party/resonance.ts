import { dist } from '../grid/types';
import { alive, entOf, posOf, stats, strike, damage, type Party, type Unit } from './partyCore';
import { tagsOf } from './classKit';
import { applyStatus, type StatusId } from './status';
import { addShield } from './shield';
import type { Tag } from './traitTypes';
import type { TriggerDef } from './triggers';

/** how many of a tag light its first and second law */
export const RESONANCE_AT = [3, 6] as const;

/** The laws each tag lights at three and at six (one line each, for the status tab). */
export const LAW_TEXT: Record<Tag, [string, string]> = {
  근접: ['근접 적중 10%로 적 노출', '근접 처치 시 즉시 다음 행동'],
  원거리: ['사거리 +1', '사격 25%로 한 발 더'],
  화염: ['화상 걸린 적이 죽으면 인접에 화상', '화상 중첩'],
  냉기: ['냉기 걸린 적이 움직이면 피해 4', '빙결 +1턴 · 빙결된 적 받는 피해 +50%'],
  독: ['중독 상한 +3', '중독된 적이 죽으면 주변에 중독 2'],
  전기: ['튄 번개에 맞은 적도 감전', '튄 번개 피해 ×3'],
  출혈: ['출혈 이동 피해 ×2', '출혈로 죽은 적이 주변에 출혈'],
  방패: ['막으면 공격자 노출', '반격 피해 ×2'],
  은신: ['처치 시 1턴 은신', '은신 중 첫 공격 치명 · 50%로 은신 유지'],
  치유: ['넘친 치유는 보호막', '보호막이 있는 아군 피해 +20%'],
  협공: ['아군이 방금 친 적을 치면 피해 +30%', '같은 적을 셋이 치면 기절'],
  소환: ['소환수 +1', '소환수가 죽으면 폭발'],
  생존: ['위기 시 보호막 최대체력 20%', '위기 시 1턴 무적 (층당 1)'],
  치명: ['치명 시 출혈', '치명 시 즉시 한 번 더 공격'],
};

/** A clone's tag counts toward resonance: its cards, worn gear and memory; teamwork summed over the living party. Empty bodies and summons have none. */
export function tagCount(p: Party, u: Unit): Partial<Record<Tag, number>> {
  if (!u.cls || u.cls === 'shell' || u.summoner || u.side !== 'hero') return {};
  const tags = { ...tagsOf(u) };
  const team = p.units.filter((x) => x.side === 'hero' && !x.summoner && x.cls && x.cls !== 'shell' && alive(p, x)).reduce((n, x) => n + (tagsOf(x).협공 ?? 0), 0);
  if (team) tags.협공 = team; else delete tags.협공;
  return tags;
}

export function resonant(p: Party, u: Unit | undefined, tag: Tag, level: 1 | 2): boolean {
  return !!u && (tagCount(p, u)[tag] ?? 0) >= RESONANCE_AT[level - 1]!;
}

const melee = (p: Party, u: Unit, t: number) => stats(u, t, p).range <= 1;
const active = (u: Unit | undefined, id: StatusId, t: number) => !!u && (u.status[id]?.until ?? 0) > t;
/** a dead foe's state passed on to the foes beside where it fell */
const spread = (id: StatusId, stacks = 1): TriggerDef['run'] => (p, c) => {
  if (!c.target) return;
  const at = entOf(p, c.target.id)!.pos;
  for (const f of p.units) if (f.side === c.target.side && f !== c.target && alive(p, f) && dist(posOf(p, f), at) <= 1) applyStatus(p, c.src, f, id, c.t, c.ev, stacks, true);
};
const floorOf = (p: Party) => (p as { floor?: number }).floor ?? 0;

/** The resonance laws that work as triggers, for the clone's lit tags. */
export function resonanceTriggers(p: Party, u: Unit): TriggerDef[] {
  const n = tagCount(p, u), lit = (tag: Tag, level: 1 | 2) => (n[tag] ?? 0) >= RESONANCE_AT[level - 1]!, out: TriggerDef[] = [];
  const add = (tag: Tag, level: 1 | 2, def: Omit<TriggerDef, 'id'>) => { if (lit(tag, level)) out.push({ id: `공명:${tag}${RESONANCE_AT[level - 1]!}`, ...def }); };
  add('근접', 1, { when: 'hit', chance: 0.1, test: (pp, c) => !!c.target && melee(pp, c.src, c.t), run: (pp, c) => applyStatus(pp, c.src, c.target!, 'exposed', c.t, c.ev) });
  add('근접', 2, { when: 'kill', test: (pp, c) => melee(pp, c.src, c.t), run: (_pp, c) => { c.src.nextAt = c.t; } });
  add('원거리', 2, { when: 'hit', chance: 0.25, test: (pp, c) => !!c.target && alive(pp, c.target) && !melee(pp, c.src, c.t), run: (pp, c) => strike(pp, c.src, c.target!, c.t, c.ev, 1, false) });
  add('화염', 1, { when: 'kill', test: (_pp, c) => active(c.target, 'burn', c.t), run: spread('burn') });
  add('독', 2, { when: 'kill', test: (_pp, c) => active(c.target, 'poison', c.t), run: spread('poison', 2) });
  add('출혈', 2, { when: 'kill', test: (_pp, c) => active(c.target, 'bleed', c.t), run: spread('bleed') });
  add('방패', 1, { when: 'block', test: (_pp, c) => !!c.target, run: (pp, c) => applyStatus(pp, c.src, c.target!, 'exposed', c.t, c.ev) });
  add('은신', 1, { when: 'kill', run: (_pp, c) => { c.src.hiddenUntil = Math.max(c.src.hiddenUntil, c.t + 1); } });
  add('은신', 2, { when: 'beforeHit', test: (_pp, c) => c.t < c.src.hiddenUntil, run: (_pp, c) => { c.src.nextCrit = true; } });
  if (lit('은신', 2)) out.push({ id: '공명:은신6 유지', when: 'hit', chance: 0.5, run: (_pp, c) => { c.src.hiddenUntil = Math.max(c.src.hiddenUntil, c.t + 1); } });
  add('치유', 1, { when: 'overflow', test: (_pp, c) => !!c.target && (c.amount ?? 0) > 0, run: (_pp, c) => addShield(c.target!, c.amount ?? 0) });
  add('협공', 1, { when: 'beforeHit', test: (_pp, c) => !!c.target?.lastHitBy && c.target.lastHitBy !== c.src.id && c.t - (c.target.lastHitAt ?? -9) < 1, run: (_pp, c) => { c.src.attackMult = (c.src.attackMult ?? 1) * 1.3; } });
  add('협공', 2, { when: 'hit', test: (_pp, c) => !!c.target && !active(c.target, 'stun', c.t) && new Set((c.target.hitters ?? []).filter((h) => c.t - h.t < 1).map((h) => h.id)).size >= 3, run: (pp, c) => applyStatus(pp, c.src, c.target!, 'stun', c.t, c.ev) });
  add('소환', 2, { when: 'summonDied', test: (_pp, c) => !!c.target, run: (pp, c) => { const at = entOf(pp, c.target!.id)!.pos; for (const f of pp.units) if (f.side === 'foe' && alive(pp, f) && dist(posOf(pp, f), at) <= 1) damage(pp, c.t, c.src.id, f, 8, c.ev, true); } });
  add('생존', 1, { when: 'crisis', run: (pp, c) => addShield(c.src, Math.round(entOf(pp, c.src.id)!.maxHp * 0.2)) });
  add('생존', 2, { when: 'crisis', test: (pp, c) => c.src.lastStandFloor !== floorOf(pp), run: (pp, c) => { c.src.lastStandFloor = floorOf(pp); c.src.immuneUntil = c.t + 1; } });
  add('치명', 1, { when: 'crit', test: (_pp, c) => !!c.target, run: (pp, c) => applyStatus(pp, c.src, c.target!, 'bleed', c.t, c.ev) });
  add('치명', 2, { when: 'crit', test: (pp, c) => !!c.target && alive(pp, c.target), run: (pp, c) => strike(pp, c.src, c.target!, c.t, c.ev, 1, false) });
  return out;
}

/** Whether any living clone has the second healing law lit (clones with a shield then hit harder). */
export const shieldedFury = (p: Party): boolean => p.units.some((x) => x.side === 'hero' && alive(p, x) && resonant(p, x, '치유', 2));
