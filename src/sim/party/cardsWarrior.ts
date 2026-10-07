import { applyStatus } from './status';
import { alive, damage, entOf, freeHit, levelDmg, occupied, posOf, stats, strike, type Party, type Unit } from './partyCore';
import { fighting, foesNear, stepBehind } from './cardFx';
import { tagsOf, WHIRL_REACH } from './classKit';
import { ampBase, card, inBranch, rank, type TraitDef } from './traitTypes';
import { dist, tileAt, walkable, type Cell, type GEvent } from '../grid/types';
import type { TriggerDef } from './triggers';

const WHIRL = 'warrior:whirl', FRENZY = 'warrior:frenzy', SHOUT = 'warrior:shout';
const WHIRL_CARDS = ['bladeStorm', 'bloodVortex', 'rendWounds', 'bladeAmp'];
const avg = (p: Party, u: Unit, t: number) => { const [lo, hi] = stats(u, t, p).dmg; return ((lo + hi) / 2) * levelDmg(u); };
const nearest = (p: Party, at: Cell, r: number) => foesNear(p, at, r).sort((a, b) => dist(posOf(p, a), at) - dist(posOf(p, b), at))[0];
/** how deep bleeding stacks for this clone: five with a whirlwind card (rend wounds bursts it), else one */
export const bleedCap = (u: Unit): number => (WHIRL_CARDS.some((id) => rank(u, id)) ? 5 : 1);
const frenzyCap = (u: Unit) => (rank(u, 'frenzy') >= 2 ? 8 : 5);

/**
 * A whirlwind: every foe within reach of the spot (the warrior's own by default) takes 80% of its blow (blade mastery: ×1.12 per #출혈),
 * and bleeds when the warrior holds a whirlwind card. Blade storm sets the warrior spinning first, so the whirlwind's own kills keep it turning.
 */
export function whirlwind(p: Party, u: Unit, t: number, ev: GEvent[], o: { at?: Cell; reach?: number; mult?: number; bleed?: number; spin?: boolean } = {}): void {
  if (o.spin !== false && rank(u, 'bladeStorm') && (u.spinUntil ?? 0) <= t) u.spinUntil = t + 2;
  const at = o.at ?? { ...posOf(p, u) }, reach = o.reach ?? WHIRL_REACH;
  const amp = rank(u, 'bladeAmp') ? ampBase(u, 'bladeAmp', 1.12) ** (tagsOf(u).출혈 ?? 0) : 1, bleeds = bleedCap(u) > 1;
  const amount = Math.max(1, Math.round(avg(p, u, t) * 0.8 * (o.mult ?? 1) * amp));
  for (const f of foesNear(p, at, reach)) {
    const fp = posOf(p, f); if (Math.hypot(fp.x - at.x, fp.y - at.y) > reach + 0.5) continue;
    damage(p, t, u.id, f, amount, ev);
    if (bleeds && alive(p, f)) applyStatus(p, u, f, 'bleed', t, ev, o.bleed ?? 1);
  }
}

/** Earth slam (the warrior's aimed ultimate): a leap to a free cell within five, the foes within two stunned and struck, then a whirlwind. */
export function earthSlam(p: Party, u: Unit, cell: Cell, t: number, ev: GEvent[]): boolean {
  const from = { ...posOf(p, u) };
  if (!walkable(tileAt(p.s.map, cell)) || occupied(p, cell, u.id) || dist(from, cell) > 5) return false;
  ev.push({ t, type: 'teleport', src: u.id, from, to: { ...cell }, text: 'leap' });
  entOf(p, u.id)!.pos = { ...cell };
  p.onMovement?.([ev[ev.length - 1]!], ev);
  for (const f of foesNear(p, cell, 2)) applyStatus(p, u, f, 'stun', t, ev);
  ev.push({ t, type: 'buff', src: u.id, text: '회오리 베기' });
  whirlwind(p, u, t, ev);
  return true;
}

/** The warrior's shout mastery: a stunned or taunted foe takes 1.1× per #함성 (multiplied). */
export function shoutAmp(attacker: Unit, dst: Unit, t: number): number {
  if (!rank(attacker, 'shoutAmp') || dst.side !== 'foe') return 1;
  const held = (dst.status.stun?.until ?? 0) > t || (dst.tauntBy === attacker.id && dst.tauntUntil > t);
  return held ? ampBase(attacker, 'shoutAmp', 1.1) ** (tagsOf(attacker).함성 ?? 0) : 1;
}

export const WARRIOR_CARDS: TraitDef[] = [
  // 회오리: spin from foe to foe while the bleeding fall
  inBranch(card('bladeStorm', '칼바람', 'law', ['출혈'], 'warrior', '회오리 베기 → 회전 2턴: 공격마다 주변 1칸 베기(출혈), 적에게 붙어 돌며 이동, 처치마다 +1턴(최대 6)', {
    triggers: (r) => [
      { id: '칼바람', when: 'attack', test: (p, c) => (c.src.spinUntil ?? 0) > c.t && !!c.basic, run: (p, c) => {
        for (const f of foesNear(p, posOf(p, c.src), r >= 2 ? 2 : 1)) if (f !== c.target) { freeHit(p, c.src, f, Math.max(1, Math.round(avg(p, c.src, c.t) * 0.6)), 'physical', c.t, c.ev); if (alive(p, f)) applyStatus(p, c.src, f, 'bleed', c.t, c.ev); }
      } },
      { id: '회전 연장', when: 'kill', repeat: true, test: (_p, c) => (c.src.spinUntil ?? 0) > c.t, run: (_p, c) => { c.src.spinUntil = Math.min(c.src.spinUntil! + 1, c.t + 6); } },
      { id: '회전 이동', when: 'turn', test: (p, c) => (c.src.spinUntil ?? 0) > c.t && !foesNear(p, posOf(p, c.src), 1).length, run: (p, c) => {
        const next = nearest(p, posOf(p, c.src), 3); if (next) stepBehind(p, c.src, next, c.t, c.ev);
      } },
      ...(r >= 3 ? [{ id: '마지막 회오리', when: 'turn', test: (_p, c) => !!c.src.spinUntil && c.src.spinUntil <= c.t, run: (p, c) => {
        c.src.spinUntil = undefined; whirlwind(p, c.src, c.t, c.ev, { spin: false });
      } } satisfies TriggerDef] : []),
    ],
  }, '회전 범위 +1', '회전이 끝날 때 마지막 회오리 베기'), WHIRL, true),
  inBranch(card('bloodVortex', '피의 소용돌이', 'law', ['출혈'], 'warrior', '출혈 중인 적이 죽음 → 그 자리에서 회오리 베기(반경 2)', {
    trigger: (r) => ({ id: '피의 소용돌이', when: 'kill', repeat: true, test: (_p, c) => !!c.target && (c.target.status.bleed?.until ?? 0) > c.t, run: (p, c) => {
      whirlwind(p, c.src, c.t, c.ev, { at: { ...posOf(p, c.target!) }, reach: 2, mult: r >= 2 ? 1.3 : 1, bleed: r >= 3 ? 2 : 1 });
    } }),
  }, '피해 +30%', '소용돌이에 맞은 적 출혈 2중첩'), WHIRL),
  inBranch(card('rendWounds', '상처 찢기', 'convert', ['출혈'], 'warrior', '출혈 5중첩 → 터뜨려 중첩 × 6 피해', {
    trigger: (r) => ({ id: '상처 찢기', when: 'statusApplied', repeat: true, test: (_p, c) => c.status === 'bleed' && (c.target?.status.bleed?.stacks ?? 0) >= 5, run: (p, c) => {
      const t = c.target!, n = t.status.bleed!.stacks ?? 5, at = { ...posOf(p, t) }; delete t.status.bleed;
      damage(p, c.t, c.src.id, t, n * 6, c.ev, true);
      if (r >= 2) for (const f of foesNear(p, at, 1)) if (f !== t) damage(p, c.t, c.src.id, f, n * 6, c.ev, true);
    } }),
  }, '주변 1칸에도'), WHIRL),
  inBranch(card('bladeAmp', '칼날 숙련', 'amp', ['출혈'], 'warrior', '#출혈 1당 회오리 베기 피해 ×1.12 (곱)', {}, '×1.16'), WHIRL),
  // 광란: faster and faster, two blows a swing at the top
  inBranch(card('frenzy', '광란', 'law', ['근접'], 'warrior', '적중마다 광란 1(최대 5): 중첩당 공격 속도 +8%, 광란 5에서 매 공격 2연타, 3턴 적중 없으면 초기화', {
    passive: (u) => ({ atk: 0.08 * (u.frenzy ?? 0) }),
    triggers: (r) => [
      // a hit adds a stack (to the cap) and keeps the frenzy going
      { id: '광란', when: 'hit', run: (_p, c) => { c.src.frenzy = Math.min(frenzyCap(c.src), (c.src.frenzy ?? 0) + 1); c.src.frenzyAt = c.t; } },
      { id: '2연타', when: 'hit', test: (p, c) => !!c.basic && (c.src.frenzy ?? 0) >= 5 && !!c.target && alive(p, c.target), run: (p, c) => {
        strike(p, c.src, c.target!, c.t, c.ev, 1, false);
        // rank 3: at the top of the frenzy, a third blow
        if (r >= 3 && c.src.frenzy! >= frenzyCap(c.src) && alive(p, c.target!)) strike(p, c.src, c.target!, c.t, c.ev, 1, false);
      } },
      { id: '광란 식음', when: 'turn', test: (_p, c) => (c.src.frenzy ?? 0) > 0 && c.t - (c.src.frenzyAt ?? 0) >= 3, run: (_p, c) => { c.src.frenzy = 0; } },
    ],
  }, '최대 8', '광란 최대에서 3연타'), FRENZY, true),
  inBranch(card('carnage', '연속 도륙', 'law', ['근접'], 'warrior', '광란 5 이상에서 처치 → 즉시 다음 적에게 한 번 더 공격', {
    trigger: (r) => ({ id: '연속 도륙', when: 'kill', repeat: true, test: (_p, c) => (c.src.frenzy ?? 0) >= (r >= 2 ? 3 : 5), run: (p, c) => {
      const me = posOf(p, c.src), next = nearest(p, me, 1) ?? nearest(p, me, 3);
      if (!next) return;
      if (dist(posOf(p, next), me) > 1 && !stepBehind(p, c.src, next, c.t, c.ev)) return;
      if (r >= 3) c.src.nextCrit = true;
      strike(p, c.src, next, c.t, c.ev, 1, false);
    } }),
  }, '광란 3부터', '연속 도륙 공격은 반드시 치명'), FRENZY),
  inBranch(card('berserk', '광폭화', 'convert', ['근접'], 'warrior', '광란 1당 치명 확률 +5%', { passive: (u, r) => ({ crit: (r >= 2 ? 0.08 : 0.05) * (u.frenzy ?? 0) }) }, '광란 1당 +8%'), FRENZY),
  // its base is per stack as well as per tag, so its upgrade is smaller than other amps'
  inBranch(card('frenzyAmp', '피의 광기', 'amp', ['근접'], 'warrior', '광란 1당 피해 × 1.02^#근접 (곱)', {
    trigger: (r) => ({ id: '피의 광기', when: 'beforeHit', test: (_p, c) => (c.src.frenzy ?? 0) > 0, run: (_p, c) => { c.src.attackMult = (c.src.attackMult ?? 1) * (r >= 2 ? 1.03 : 1.02) ** ((tagsOf(c.src).근접 ?? 0) * c.src.frenzy!); } }),
  }, '×1.03'), FRENZY),
  // 함성: a shout that holds the room, stunning as it goes
  inBranch(card('warShout', '전투 함성', 'law', ['함성'], 'warrior', '전투 시작·위기 → 함성 3턴: 매 턴 3칸 안 적 도발 + 30% 기절, 기절한 적 처치마다 +1턴', {
    triggers: (r) => [
      ...(['combatStart', 'crisis'] as const).map((when): TriggerDef => ({ id: '전투 함성', when, run: (_p, c) => { c.src.shoutUntil = Math.max(c.src.shoutUntil ?? 0, c.t + 3); } })),
      { id: '함성', when: 'turn', test: (p, c) => (c.src.shoutUntil ?? 0) > c.t && fighting(p, c.src), run: (p, c) => {
        for (const f of foesNear(p, posOf(p, c.src), 3)) {
          f.tauntBy = c.src.id; f.tauntUntil = c.t + 1;
          if (p.s.rng.chance(r >= 2 ? 0.5 : 0.3)) { applyStatus(p, c.src, f, 'stun', c.t, c.ev); if (r >= 3 && alive(p, f)) applyStatus(p, c.src, f, 'exposed', c.t, c.ev); }
        }
      } },
      { id: '함성 연장', when: 'kill', repeat: true, test: (_p, c) => (c.src.shoutUntil ?? 0) > c.t && (c.target?.status.stun?.until ?? 0) > c.t, run: (_p, c) => { c.src.shoutUntil = Math.min(c.src.shoutUntil! + 1, c.t + 6); } },
    ],
  }, '기절 50%', '함성으로 기절한 적 노출'), SHOUT, true),
  inBranch(card('rage', '분노 축적', 'law', ['함성'], 'warrior', '피격마다 분노 1 (최대 5) → 다음 공격에 분노 × 30% 추가 피해', {
    triggers: (r) => [
      // rank 3: struck with full rage, the warrior spins (checked before this blow adds rage)
      ...(r >= 3 ? [{ id: '분노 폭풍', when: 'struck', cd: 1, test: (_p, c) => (c.src.rage ?? 0) >= 5, run: (p, c) => whirlwind(p, c.src, c.t, c.ev) } satisfies TriggerDef] : []),
      { id: '분노 축적', when: 'struck', run: (_p, c) => { c.src.rage = Math.min(5, (c.src.rage ?? 0) + 1); } },
      { id: '분노 폭발', when: 'beforeHit', test: (_p, c) => (c.src.rage ?? 0) > 0 && !!c.target, run: (p, c) => {
        const n = c.src.rage!; c.src.attackMult = (c.src.attackMult ?? 1) * (1 + 0.3 * n); c.src.rage = 0;
        if (r >= 2) for (const f of foesNear(p, posOf(p, c.target!), 1)) if (f !== c.target) damage(p, c.t, c.src.id, f, n * 4, c.ev, true);
      } },
    ],
  }, '분노가 터질 때 주변 1칸 적에게도 분노 × 4 피해', '분노 5에서 피격 → 바로 회오리 베기'), SHOUT),
  inBranch(card('ironCounter', '철벽 반격', 'convert', ['함성'], 'warrior', '반격 피해 +50%, 반격 25% → 기절', {
    passive: () => ({ counter: 0.5 }),
    trigger: (r) => ({ id: '철벽 반격', when: 'counter', chance: r >= 2 ? 0.5 : 0.25, test: (p, c) => !!c.target && alive(p, c.target), run: (p, c) => applyStatus(p, c.src, c.target!, 'stun', c.t, c.ev) }),
  }, '반격 50% → 기절'), SHOUT),
  inBranch(card('shoutAmp', '함성 숙련', 'amp', ['함성'], 'warrior', '#함성 1당 기절·도발 중인 적이 받는 피해 ×1.1 (곱)', {}, '×1.14'), SHOUT),
];
