import { applyStatus } from './status';
import { alive, canHit, damage, entOf, freeHit, occupied, posOf, stats, strike, type Party, type Unit } from './partyCore';
import { foesNear } from './cardFx';
import { tagsOf } from './classKit';
import { beyond } from './cardsRanged';
import { isGun, magOf } from './ammo';
import { ampBase, card, inBranch, type TraitDef } from './traitTypes';
import { addShield } from './shield';
import { dist, tileAt, walkable, type Cell, type GEvent } from '../grid/types';
import type { TriggerDef } from './triggers';

const tr = (d: TriggerDef): TriggerDef => d;
const gunShot = (p: Party, u: Unit) => isGun(u) && stats(u, 0, p).range > 1;
const avg = (p: Party, u: Unit, t: number) => { const [lo, hi] = stats(u, t, p).dmg; return (lo + hi) / 2; };
/** the round goes on into the first foe behind the target: a hit (Achra's free hit) at 70%; true when it killed that foe */
export function pierceOn(p: Party, u: Unit, target: Unit, t: number, ev: GEvent[]): boolean {
  const behind = beyond(p, u, target)[0];
  if (!behind) return false;
  freeHit(p, u, behind, Math.round(avg(p, u, t) * 0.7), 'physical', t, ev);
  return !alive(p, behind);
}
/** burning ground on a cell for a few turns (a burn each turn on the foes within `r`) */
const burnGround = (p: Party, u: Unit, at: Cell, t: number, turns: number, r: number) => { (p.grounds ??= []).push({ at: { ...at }, by: u.id, until: t + turns, next: t + 1, kind: 'burn', r }); };
/** A blast: fire damage (not a hit) and a burn on every foe within `radius` of a cell; returns how many it killed. */
export function explode(p: Party, u: Unit, at: Cell, radius: number, amount: number, t: number, ev: GEvent[]): number {
  let kills = 0;
  for (const f of p.units.filter((x) => x.side === 'foe' && alive(p, x) && dist(posOf(p, x), at) <= radius)) {
    damage(p, t, u.id, f, amount, ev, true, false, 'fire');
    if (alive(p, f)) applyStatus(p, u, f, 'burn', t, ev); else kills++;
  }
  return kills;
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

const SHOT = 'shell:shot', BLAST = 'shell:blast', SUIT = 'shell:suit';
/** The empty body's cards (spec §3.7): three branches — shooting, explosives, the suit — whose signatures run as sustained states. */
export const SHELL_CARDS: TraitDef[] = [
  // 사격: hits in a row
  inBranch(card('pierceRound', '관통탄', 'law', ['원거리'], 'shell', '3연속 명중부터 모든 사격이 뒤의 적 관통 70% (빗나가면 초기화)', {
    trigger: (r) => ({ id: '관통탄', when: 'hit', test: (p, c) => !!c.target && !!c.basic && gunShot(p, c.src) && (c.src.hitStreak ?? 0) >= (r >= 2 ? 2 : 3), run: (p, c) => {
      if (pierceOn(p, c.src, c.target!, c.t, c.ev) && r >= 3) c.src.ammo = Math.min(magOf(p, c.src), (c.src.ammo ?? magOf(p, c.src)) + 1);
    } }),
  }, '2연속 명중부터', '관통으로 처치 → 탄 1발 회수'), SHOT, true),
  inBranch(card('quickReload', '즉시 재장전', 'law', ['치명'], 'shell', '처치 → 탄창 채움 + 다음 사격 치명', {
    trigger: (r) => ({ id: '즉시 재장전', when: 'kill', test: (_p, c) => isGun(c.src), run: (p, c) => {
      c.src.ammo = magOf(p, c.src); c.src.nextCrit = true; if (r >= 2) c.src.critShots = 1;
      if (r >= 3) for (const f of foesNear(p, posOf(p, c.src), 2)) applyStatus(p, c.src, f, 'stun', c.t, c.ev);
    } }),
  }, '다음 2발 치명', '즉시 재장전 → 주변 2칸 적 섬광 기절'), SHOT),
  inBranch(card('targetLock', '표적 분석', 'convert', ['치명'], 'shell', '빗나간 사격 → 다음 사격 치명', {}, '다음 2발 치명'), SHOT),
  inBranch(card('pointBlank', '산탄 확산', 'amp', ['원거리'], 'shell', '2칸 안 사격 피해 ×1.1^#원거리 (곱)', {
    trigger: () => ({ id: '산탄 확산', when: 'beforeHit', test: (p, c) => !!c.target && isGun(c.src) && dist(posOf(p, c.src), posOf(p, c.target)) <= 2, run: (_p, c) => {
      c.src.attackMult = (c.src.attackMult ?? 1) * ampBase(c.src, 'pointBlank', 1.1) ** (tagsOf(c.src).원거리 ?? 0);
    } }),
  }, '×1.14'), SHOT),
  // 폭발물: fire damage that keeps blowing up
  inBranch(card('grenade', '유탄', 'law', ['화염'], 'shell', '세 번째 사격마다 유탄(반경 1 화염 피해·화상), 유탄으로 처치하면 다음 사격도 유탄', {
    trigger: (r) => ({ id: '유탄', when: 'hit', test: (p, c) => !!c.target && !!c.basic && gunShot(p, c.src) && (c.src.nth % 3 === 0 || !!c.src.grenadeNext), run: (p, c) => {
      const kills = explode(p, c.src, posOf(p, c.target!), r >= 2 ? 2 : 1, Math.round(avg(p, c.src, c.t) * 0.8), c.t, c.ev);
      c.src.grenadeNext = kills > 0;
      if (r >= 3) burnGround(p, c.src, posOf(p, c.target!), c.t, 2, 1);
    } }),
  }, '반경 2', '유탄 자리에 2턴 불바닥'), BLAST, true),
  inBranch(card('overheat', '과열탄', 'law', ['화염'], 'shell', '3연속 명중마다 → 화상', {
    triggers: (r) => [...(r >= 3 ? [tr({ id: '과열 폭발', when: 'kill', repeat: true, test: (_p, c) => !!c.target && (c.target.status.burn?.until ?? 0) > c.t, run: (p, c) => {
      explode(p, c.src, posOf(p, c.target!), 1, Math.round(avg(p, c.src, c.t) * 0.6), c.t, c.ev);
    } })] : []), { id: '과열탄', when: 'hit', test: (p, c) => !!c.target && !!c.basic && gunShot(p, c.src) && (c.src.hitStreak ?? 0) > 0 && c.src.hitStreak! % 3 === 0, run: (p, c) => {
      applyStatus(p, c.src, c.target!, 'burn', c.t, c.ev);
      if (r >= 2) for (const f of foesNear(p, posOf(p, c.target!), 1)) if (f !== c.target) applyStatus(p, c.src, f, 'burn', c.t, c.ev);
    } }],
  }, '대상 주변도 화상', '화상 적이 죽으면 작은 폭발(반경 1)'), BLAST),
  inBranch(card('chainBlast', '연쇄 폭발', 'convert', ['화염'], 'shell', '화염 피해로 처치 → 그 자리에서 작은 폭발(반경 1)', {
    trigger: (r) => ({ id: '연쇄 폭발', when: 'kill', repeat: true, test: (_p, c) => c.kind === 'fire' && !!c.target, run: (p, c) => { explode(p, c.src, posOf(p, c.target!), r >= 2 ? 2 : 1, Math.round(avg(p, c.src, c.t) * 0.8), c.t, c.ev); } }),
  }, '폭발 반경 2'), BLAST),
  inBranch(card('blastAmp', '폭약 숙련', 'amp', ['화염'], 'shell', '#화염 1당 화염 피해 ×1.12 (곱)', {}, '×1.16'), BLAST),
  // 슈트: answer every blow
  inBranch(card('returnFire', '반격 사격', 'law', ['원거리', '생존'], 'shell', '피격·회피마다 공격자에게 반격 사격 (턴당 2회)', {
    triggers: (r) => (['struck', 'dodge'] as const).map((when): TriggerDef => ({ id: '반격 사격', when, test: (p, c) => {
      if (!c.target || !isGun(c.src) || !alive(p, c.target) || !canHit(p, c.src, c.target)) return false;
      const turn = Math.floor(c.t);
      if (c.src.rfTurn !== turn) { c.src.rfTurn = turn; c.src.rfCount = 0; }
      return (c.src.rfCount ?? 0) < (r >= 2 ? 4 : 2);
    }, run: (p, c) => {
      c.src.rfCount = (c.src.rfCount ?? 0) + 1; c.src.returnFiring = true;
      try { strike(p, c.src, c.target!, c.t, c.ev, 1, false); } finally { c.src.returnFiring = false; }
    } })).concat(r >= 3 ? [tr({ id: '반격 관통', when: 'crit', test: (p, c) => !!c.src.returnFiring && !!c.target, run: (p, c) => { pierceOn(p, c.src, c.target!, c.t, c.ev); } })] : []),
  }, '턴당 4회', '반격 사격 치명 → 뒤의 적 관통'), SUIT, true),
  inBranch(card('buttStroke', '개머리판 밀치기', 'convert', ['근접'], 'shell', '붙은 적 사격 → 1칸 밀치고 기절', {
    trigger: (r) => ({ id: '개머리판 밀치기', when: 'hit', test: (p, c) => !!c.target && isGun(c.src) && alive(p, c.target) && dist(posOf(p, c.src), posOf(p, c.target)) === 1, run: (p, c) => {
      const me = posOf(p, c.src), at = posOf(p, c.target!), to = { x: at.x + Math.sign(at.x - me.x), y: at.y + Math.sign(at.y - me.y) };
      if (walkable(tileAt(p.s.map, to)) && !occupied(p, to, c.target!.id)) {
        c.ev.push({ t: c.t, type: 'push', src: c.target!.id, from: { ...at }, to: { ...to } });
        entOf(p, c.target!.id)!.pos = { ...to };
      } else if (r >= 2) damage(p, c.t, c.src.id, c.target!, 6, c.ev, true);
      applyStatus(p, c.src, c.target!, 'stun', c.t, c.ev);
    } }),
  }, '벽에 부딪히면 피해 +6'), SUIT),
  inBranch(card('suitOverload', '슈트 과부하', 'law', ['생존'], 'shell', '위기 → 1턴 행동 2배 (층마다 1회)', {
    triggers: (r) => [
      { id: '슈트 과부하', when: 'crisis', test: (p, c) => (r >= 2 ? !c.src.overloadUsed : c.src.overloadFloor !== floorOf(p)), run: (p, c) => {
        c.src.overloadUsed = true; c.src.overloadFloor = floorOf(p); c.src.hasteUntil = Math.max(c.src.hasteUntil, c.t + 1);
      } },
      ...(r >= 2 ? [tr({ id: '슈트 과부하', when: 'combatStart', run: (_p, c) => { c.src.overloadUsed = false; } })] : []),
      ...(r >= 3 ? [tr({ id: '과부하 보호막', when: 'kill', test: (_p, c) => c.t < c.src.hasteUntil, run: (_p, c) => addShield(c.src, 10) })] : []),
    ],
  }, '전투마다', '과부하 중 처치 → 보호막 10'), SUIT),
  inBranch(card('armorAmp', '장갑 숙련', 'amp', ['생존'], 'shell', '#생존 1당 받는 피해 ×0.96 (곱)', {}, '×0.92'), SUIT),
];
