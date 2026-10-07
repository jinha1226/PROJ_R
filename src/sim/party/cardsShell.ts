import { applyStatus } from './status';
import { alive, canHit, damage, entOf, occupied, posOf, stats, strike, type Party, type Unit } from './partyCore';
import { foesNear } from './cardFx';
import { tagsOf } from './classKit';
import { beyond } from './cardsRanged';
import { isGun, magOf } from './ammo';
import { card, type TraitDef } from './traitTypes';
import { dist, tileAt, walkable, type GEvent } from '../grid/types';
import type { TriggerDef } from './triggers';

const tr = (d: TriggerDef): TriggerDef => d;
const gunShot = (p: Party, u: Unit) => isGun(u) && stats(u, 0, p).range > 1;
const avg = (p: Party, u: Unit, t: number) => { const [lo, hi] = stats(u, t, p).dmg; return (lo + hi) / 2; };
/** the round goes on into the first foe behind the target, at 70% */
export function pierceOn(p: Party, u: Unit, target: Unit, t: number, ev: GEvent[]): void {
  const behind = beyond(p, u, target)[0];
  if (behind) damage(p, t, u.id, behind, Math.round(avg(p, u, t) * 0.7), ev, true);
}
const floorOf = (p: Party): number => (p as { floor?: number }).floor ?? 0;

/** The empty body's innates (the seventh class, spec §2.1): the first shot at each foe is aimed; a calm reload loads a piercing round. */
export const SHELL_INNATE: TriggerDef[] = [
  { id: '조준 사격', when: 'beforeHit', test: (p, c) => !!c.target && gunShot(p, c.src) && !c.target.sighted?.includes(c.src.id), run: (_p, c) => {
    c.target!.sighted = [...(c.target!.sighted ?? []), c.src.id]; c.src.nextCrit = true;
  } },
  { id: '전술 재장전', when: 'reload', test: (p, c) => foesNear(p, posOf(p, c.src), 2).length === 0, run: (_p, c) => { c.src.pierceNext = true; } },
  { id: '전술 재장전', when: 'hit', test: (p, c) => !!c.src.pierceNext && !!c.target && gunShot(p, c.src), run: (p, c) => { c.src.pierceNext = false; pierceOn(p, c.src, c.target!, c.t, c.ev); } },
];

/** The empty body's cards (spec §4.7): pistol and suit rules that chain with the shared tags. */
export const SHELL_CARDS: TraitDef[] = [
  card('pierceRound', '관통탄', 'law', ['원거리'], 'shell', '탄창 마지막 발 → 뒤의 적 관통 70%', {
    trigger: (r) => ({ id: '관통탄', when: 'hit', test: (p, c) => !!c.target && gunShot(p, c.src) && (r >= 2 ? c.src.nth % 3 === 0 : c.src.ammo === 0), run: (p, c) => pierceOn(p, c.src, c.target!, c.t, c.ev) }),
  }, '매 3발째'),
  card('returnFire', '반격 사격', 'law', ['원거리', '생존'], 'shell', '회피 → 공격자에게 사격', {
    trigger: (r) => ({ id: '반격 사격', when: 'dodge', test: (p, c) => !!c.target && isGun(c.src) && alive(p, c.target) && canHit(p, c.src, c.target), run: (p, c) => {
      for (let k = 0; k < (r >= 2 ? 2 : 1) && alive(p, c.target!); k++) strike(p, c.src, c.target!, c.t, c.ev, 1, false);
    } }),
  }, '2발'),
  card('overheat', '과열탄', 'law', ['화염'], 'shell', '3연속 명중 → 화상', {
    trigger: (r) => ({ id: '과열탄', when: 'hit', test: (p, c) => {
      const u = c.src;
      if (!c.target || !gunShot(p, u) || u.streakNth === u.nth) return false;
      u.hitStreak = u.streakNth === u.nth - 1 ? (u.hitStreak ?? 0) + 1 : 1; u.streakNth = u.nth;
      return u.hitStreak >= 3;
    }, run: (p, c) => {
      c.src.hitStreak = 0;
      applyStatus(p, c.src, c.target!, 'burn', c.t, c.ev);
      if (r >= 2) for (const f of foesNear(p, posOf(p, c.target!), 1)) if (f !== c.target) applyStatus(p, c.src, f, 'burn', c.t, c.ev);
    } }),
  }, '대상 주변도 화상'),
  card('quickReload', '즉시 재장전', 'law', ['치명'], 'shell', '처치 → 탄창 채움 + 다음 사격 치명', {
    trigger: (r) => ({ id: '즉시 재장전', when: 'kill', test: (_p, c) => isGun(c.src), run: (p, c) => { c.src.ammo = magOf(p, c.src); c.src.nextCrit = true; if (r >= 2) c.src.critShots = 1; } }),
  }, '다음 2발 치명'),
  card('buttStroke', '개머리판 밀치기', 'law', ['근접'], 'shell', '붙은 적 사격 → 1칸 밀치고 기절', {
    trigger: (r) => ({ id: '개머리판 밀치기', when: 'hit', test: (p, c) => !!c.target && isGun(c.src) && alive(p, c.target) && dist(posOf(p, c.src), posOf(p, c.target)) === 1, run: (p, c) => {
      const me = posOf(p, c.src), at = posOf(p, c.target!), to = { x: at.x + Math.sign(at.x - me.x), y: at.y + Math.sign(at.y - me.y) };
      if (walkable(tileAt(p.s.map, to)) && !occupied(p, to, c.target!.id)) {
        c.ev.push({ t: c.t, type: 'push', src: c.src.id, dst: c.target!.id, from: { ...at }, to: { ...to } });
        entOf(p, c.target!.id)!.pos = { ...to };
      } else if (r >= 2) damage(p, c.t, c.src.id, c.target!, 6, c.ev, true);
      applyStatus(p, c.src, c.target!, 'stun', c.t, c.ev);
    } }),
  }, '벽에 부딪히면 피해 +6'),
  card('suitOverload', '슈트 과부하', 'law', ['생존'], 'shell', '위기 → 1턴 행동 2배 (층마다 1회)', {
    triggers: (r) => [
      { id: '슈트 과부하', when: 'crisis', test: (p, c) => (r >= 2 ? !c.src.overloadUsed : c.src.overloadFloor !== floorOf(p)), run: (p, c) => {
        c.src.overloadUsed = true; c.src.overloadFloor = floorOf(p); c.src.hasteUntil = Math.max(c.src.hasteUntil, c.t + 1);
      } },
      ...(r >= 2 ? [tr({ id: '슈트 과부하', when: 'combatStart', run: (_p, c) => { c.src.overloadUsed = false; } })] : []),
    ],
  }, '전투마다'),
  card('pointBlank', '산탄 확산', 'amp', ['원거리'], 'shell', '2칸 안 사격 피해 × (1 + #원거리 × 0.1)', {
    trigger: () => ({ id: '산탄 확산', when: 'beforeHit', test: (p, c) => !!c.target && isGun(c.src) && dist(posOf(p, c.src), posOf(p, c.target)) <= 2, run: (_p, c) => {
      c.src.attackMult = (c.src.attackMult ?? 1) * (1 + 0.1 * (tagsOf(c.src).원거리 ?? 0));
    } }),
  }),
  card('targetLock', '표적 분석', 'convert', ['치명'], 'shell', '빗나간 사격 → 다음 사격 치명', {}),
];
