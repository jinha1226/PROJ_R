import { applyStatus } from './status';
import { alive, damage, entOf, posOf, type Party, type Unit } from './partyCore';
import { foesNear, mostHurt } from './cardFx';
import { addShield } from './shield';
import { heal } from './kitEffects';
import { LINE } from './classKit';
import { card, rank, type TraitDef } from './traitTypes';
import type { BaseClass } from './partyDefs';
import type { TriggerDef } from './triggers';
import { dist } from '../grid/types';

const heroes = (p: Party) => p.units.filter((x) => x.side === 'hero' && !x.summoner && alive(p, x));
/** a clone's base line (an advanced class counts as the class it grew from) */
export const lineOf = (u: Unit): BaseClass | undefined => (u.cls === 'veteran' ? u.soul : u.cls && u.cls !== 'shell' ? LINE[u.cls] ?? (u.cls as BaseClass) : undefined);
const on = (u: Unit | undefined, id: 'freeze' | 'stun' | 'mark' | 'bleed', t: number) => !!u && (u.status[id]?.until ?? 0) > t;

/** The cleric's cards (spec §6.5): shields and healing that spill over into harm. */
const CLERIC: TraitDef[] = [
  card('shieldBurst', '보호막 폭발', 'law', ['방패'], 'cleric', '아군 보호막이 깨짐 → 곁의 적에게 깨진 만큼 피해', {}, '기절 추가'),
  card('judgment', '심판 낙인', 'law', ['근접'], 'cleric', '적중마다 심판 1 → 5가 되면 신성 폭발 (피해 20, 기절)', {
    trigger: (r) => ({ id: '심판 낙인', when: 'hit', test: (p, c) => !!c.target && alive(p, c.target), run: (p, c) => {
      const t = c.target!; t.judge = (t.judge ?? 0) + 1;
      if (t.judge < (r >= 2 ? 3 : 5)) return;
      t.judge = 0; damage(p, c.t, c.src.id, t, 20, c.ev, true); applyStatus(p, c.src, t, 'stun', c.t, c.ev);
    } }),
  }, '3에 폭발'),
  card('answeredPrayer', '응답하는 기도', 'law', ['치유'], 'cleric', '아군이 위기 → 즉시 치유 20 + 보호막 10', {
    triggers: (r) => (['allyCrisis', 'crisis'] as const).map((when): TriggerDef => ({ id: `응답하는 기도${when === 'crisis' ? ' (자신)' : ''}`, when, run: (p, c) => {
      const who = when === 'crisis' ? c.src : c.target;
      for (const a of r >= 2 ? heroes(p) : who ? [who] : []) { heal(p, c.src, a, 20, c.t, c.ev); addShield(a, 10, c.src); }
    } })),
  }, '파티 전원'),
  card('blessingMore', '축복 확산', 'law', ['협공'], 'cleric', '전투 시작 → 아군 전원 보호막 +10', {
    triggers: (r) => [
      { id: '축복 확산', when: 'combatStart', run: (p, c) => { for (const a of heroes(p)) addShield(a, 10, c.src); } },
      ...(r >= 2 ? [{ id: '축복의 처치', when: 'kill', run: (p, c) => { for (const a of heroes(p)) addShield(a, 5, c.src); } } satisfies TriggerDef] : []),
    ],
  }, '처치 시 아군 전원 보호막 5'),
  card('martyr', '순교', 'law', ['생존'], 'cleric', '아군이 쓰러짐 → 남은 아군 체력 30% 회복, 2턴 피해 +30%', {}, '층마다 한 번 아군의 죽음을 체력 1로 버팀'),
  card('overflowGrace', '넘친 은총', 'convert', ['치유'], 'cleric', '넘친 치유 → 두 배로 보호막', {
    trigger: () => ({ id: '넘친 은총', when: 'overflow', test: (_p, c) => !!c.target && (c.amount ?? 0) > 0, run: (_p, c) => addShield(c.target!, (c.amount ?? 0) * 2, c.src) }),
  }),
  card('lifeTransfer', '생명 전이', 'convert', ['치유'], 'cleric', '치유 → 치유량 30%를 가장 가까운 적에게 피해', {
    trigger: () => ({ id: '생명 전이', when: 'healed', test: (_p, c) => !!c.target && (c.amount ?? 0) > 0, run: (p, c) => {
      const at = posOf(p, c.target!), f = p.units.filter((x) => x.side === 'foe' && alive(p, x)).sort((a, b) => dist(posOf(p, a), at) - dist(posOf(p, b), at))[0];
      if (f) damage(p, c.t, c.src.id, f, Math.max(1, Math.round((c.amount ?? 0) * 0.3)), c.ev, true);
    } }),
  }),
  card('sacredWall', '신성 방벽', 'amp', ['방패', '치유'], 'cleric', '#방패·#치유 1당 내가 주는 보호막 +15%', {}),
];

const duo = (id: string, name: string, pair: [BaseClass, BaseClass], who: BaseClass | 'any', tags: TraitDef['tags'], text: string, trigger?: TriggerDef): TraitDef =>
  ({ ...card(id, name, 'duo', tags, 'duo', text, trigger ? { trigger: () => trigger } : {}), duo: pair, who });

/** The duo cards (spec §6.7): offered and working only while both classes stand. */
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

export const SUPPORT_CARDS: TraitDef[] = [...CLERIC, ...DUOS];
const DUO_BY_ID = new Map(DUOS.map((d) => [d.id, d]));

/** A duo works while some living clone holds it and both its classes stand. */
export function duoActive(p: Party, id: string): boolean {
  const d = DUO_BY_ID.get(id);
  if (!d?.duo) return false;
  const living = heroes(p), lines = new Set(living.map(lineOf));
  return living.some((h) => rank(h, id) > 0) && lines.has(d.duo[0]) && lines.has(d.duo[1]);
}
/** Whether a duo is in play for this clone (it is the one that runs it). */
export const duoFor = (p: Party, u: Unit, id: string): boolean => { const d = DUO_BY_ID.get(id); return !!d && duoActive(p, id) && (d.who === 'any' || d.who === lineOf(u)); };
/** The triggers of the duos in play that this clone runs. */
export function duoTriggers(p: Party, u: Unit): TriggerDef[] {
  if (u.side !== 'hero' || u.summoner) return [];
  return DUOS.filter((d) => d.trigger && duoFor(p, u, d.id)).map((d) => d.trigger!(1));
}
