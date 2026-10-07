import { applyStatus } from './status';
import { alive, entOf, posOf, type Party, type Unit } from './partyCore';
import { foesNear, mostHurt } from './cardFx';
import { heal } from './kitEffects';
import { linesOf } from './body';
import { card, rank, type TraitDef } from './traitTypes';
import type { BaseClass } from './partyDefs';
import type { TriggerDef } from './triggers';

const on = (u: Unit | undefined, id: 'freeze' | 'stun' | 'mark' | 'bleed', t: number) => !!u && (u.status[id]?.until ?? 0) > t;

const duo = (id: string, name: string, pair: [BaseClass, BaseClass], who: BaseClass | 'any', tags: TraitDef['tags'], text: string, trigger?: TriggerDef): TraitDef =>
  ({ ...card(id, name, 'duo', tags, 'duo', text, trigger ? { trigger: () => trigger } : {}), duo: pair, who });

/** The duo cards (spec §6.7): offered and working only in a body holding both classes. */
const DUOS: TraitDef[] = [
  duo('bait', '미끼와 사냥꾼', ['warrior', 'archer'], 'warrior', ['협공'], '전사를 친 적 → 표식',
    { id: '미끼와 사냥꾼', when: 'struck', test: (p, c) => !!c.target && alive(p, c.target), run: (p, c) => applyStatus(p, c.src, c.target!, 'mark', c.t, c.ev) }),
  duo('shatterDuo', '산산조각', ['warrior', 'mage'], 'warrior', ['냉기'], '전사가 빙결된 적을 침 → 파쇄, 곁에 냉기',
    { id: '산산조각', when: 'beforeHit', test: (_p, c) => on(c.target, 'freeze', c.t), run: (p, c) => {
      c.src.attackMult = (c.src.attackMult ?? 1) * 2; delete c.target!.status.freeze;
      for (const f of foesNear(p, posOf(p, c.target!), 1)) if (f !== c.target) applyStatus(p, c.src, f, 'chill', c.t, c.ev, 1, true);
    } }),
  duo('holyShield', '성스러운 방패', ['warrior', 'cleric'], 'warrior', ['방패'], '전사에게 보호막이 있으면 반격 2배, 깨지면 분노 최대',
    { id: '성스러운 방패', when: 'shieldBreak', run: (_p, c) => { c.src.rage = 5; } }),
  duo('gap', '틈새', ['warrior', 'rogue'], 'rogue', ['치명'], '기절한 적에게 도적 공격 → 치명',
    { id: '틈새', when: 'beforeHit', test: (_p, c) => on(c.target, 'stun', c.t), run: (_p, c) => { c.src.nextCrit = true; } }),
  duo('elemArrow', '원소 화살', ['archer', 'mage'], 'any', ['원거리'], '표식된 적이 원소 반응 → 곁의 적에게 표식',
    { id: '원소 화살', when: 'reaction', test: (_p, c) => on(c.target, 'mark', c.t), run: (p, c) => { for (const f of foesNear(p, entOf(p, c.target!.id)!.pos, 1)) if (f !== c.target) applyStatus(p, c.src, f, 'mark', c.t, c.ev); } }),
  duo('lightArrow', '빛의 화살', ['archer', 'cleric'], 'archer', ['치유'], '표식된 적 적중 → 가장 다친 아군 치유 4',
    { id: '빛의 화살', when: 'hit', test: (_p, c) => on(c.target, 'mark', c.t), run: (p, c) => { const a = mostHurt(p); if (a) heal(p, c.src, a, 4, c.t, c.ev); } }),
  duo('prey', '사냥감', ['archer', 'rogue'], 'rogue', ['치명'], '표식된 체력 40% 미만 적을 도적이 침 → 피해 2배',
    { id: '사냥감', when: 'beforeHit', test: (p, c) => on(c.target, 'mark', c.t) && entOf(p, c.target!.id)!.hp < entOf(p, c.target!.id)!.maxHp * 0.4, run: (_p, c) => { c.src.attackMult = (c.src.attackMult ?? 1) * 2; } }),
  duo('purifyFlame', '정화의 불꽃', ['mage', 'cleric'], 'cleric', ['화염'], '넘친 치유 → 곁의 적에게 화상',
    { id: '정화의 불꽃', when: 'overflow', test: (_p, c) => !!c.target, run: (p, c) => { for (const f of foesNear(p, posOf(p, c.target!), 1)) applyStatus(p, c.src, f, 'burn', c.t, c.ev); } }),
  duo('toxicSmoke', '맹독 연기', ['mage', 'rogue'], 'rogue', ['독'], '독 폭발 → 곁의 적에게 화상도 (독연 반응)'),
  duo('bloodFeast', '피의 성찬', ['cleric', 'rogue'], 'any', ['출혈'], '출혈 중인 적 적중 → 가장 다친 아군 치유 3',
    { id: '피의 성찬', when: 'hit', test: (_p, c) => on(c.target, 'bleed', c.t), run: (p, c) => { const a = mostHurt(p); if (a) heal(p, c.src, a, 3, c.t, c.ev); } }),
];

export const SUPPORT_CARDS: TraitDef[] = DUOS;
const DUO_BY_ID = new Map(DUOS.map((d) => [d.id, d]));

/** A duo works in a body that holds it and both its classes' souls. */
export function duoActive(u: Unit, id: string): boolean {
  const d = DUO_BY_ID.get(id);
  return !!d?.duo && rank(u, id) > 0 && d.duo.every((c) => linesOf(u).includes(c));
}
/** Whether a duo is in play for this clone. */
export const duoFor = (_p: Party, u: Unit, id: string): boolean => duoActive(u, id);
/** The triggers of the duos in play in this body. */
export function duoTriggers(p: Party, u: Unit): TriggerDef[] {
  if (u.side !== 'hero' || u.summoner) return [];
  return DUOS.filter((d) => d.trigger && duoFor(p, u, d.id)).map((d) => d.trigger!(1));
}
