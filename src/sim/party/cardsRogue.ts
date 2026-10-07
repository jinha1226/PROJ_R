import { applyStatus, type StatusId } from './status';
import { alive, damage, entOf, freeHit, levelDmg, posOf, stats, strike, type Party, type Unit } from './partyCore';
import { fighting, foesNear, stepBehind } from './cardFx';
import { tagsOf } from './classKit';
import { summon } from './kitEffects';
import { laySnare, snareSpot } from './snares';
import { ampBase, card, inBranch, rank, type TraitDef } from './traitTypes';
import { dist, tileAt, walkable, type Cell, type GEvent } from '../grid/types';
import type { TriggerDef } from './triggers';

const TRAP = 'rogue:trap', MARTIAL = 'rogue:martial', SHADOW = 'rogue:shadow';
const avg = (p: Party, u: Unit, t: number) => { const [lo, hi] = stats(u, t, p).dmg; return ((lo + hi) / 2) * levelDmg(u); };
const live = (u: { status: Partial<Record<StatusId, { until: number }>> }, t: number) => Object.values(u.status).filter((s) => (s?.until ?? 0) > t).length;
export const mirrorsOf = (p: Party, u: Unit) => p.units.filter((x) => x.summoner === u.id && x.mirror && alive(p, x));
/** martial mastery: each ki is worth ×1.1 more per #치명 (multiplied) */
const kiAmp = (u: Unit) => (rank(u, 'martialAmp') ? ampBase(u, 'martialAmp', 1.1) ** (tagsOf(u).치명 ?? 0) : 1);

/** Shadow clone (the rogue's aimed ultimate): two clones beside the cell for three turns; one touch and they are gone. */
export function shadowClone(p: Party, u: Unit, cell: Cell, t: number, ev: GEvent[]): boolean {
  if (!walkable(tileAt(p.s.map, cell)) || dist(posOf(p, u), cell) > 10) return false;
  for (const old of mirrorsOf(p, u)) entOf(p, old.id)!.alive = false;
  let made = 0;
  for (let k = 0; k < 2; k++) if (summon(p, u, cell, t, ev, 2, { hp: 1, life: 3, mirror: true, count: (x) => !!x.mirror })) { p.units[p.units.length - 1]!.nextAt = Infinity; made++; }
  return made > 0;
}

/** The rogue's own: each clone repeats its blow from where it stands, on the nearest foe within two (a clone never copies a clone). */
export const MIRROR_STRIKE: TriggerDef = { id: '분신 공격', when: 'attack', repeat: true, test: (p, c) => !c.src.mirror && mirrorsOf(p, c.src).length > 0, run: (p, c) => {
  for (const m of mirrorsOf(p, c.src)) {
    const at = posOf(p, m), f = foesNear(p, at, 2).sort((a, b) => dist(posOf(p, a), at) - dist(posOf(p, b), at))[0];
    if (!f) continue;
    c.ev.push({ t: c.t, type: 'bump', src: m.id, dst: f.id, from: { ...at }, to: { ...posOf(p, f) } });
    freeHit(p, c.src, f, Math.max(1, Math.round(avg(p, c.src, c.t) * 0.7)), 'physical', c.t, c.ev);
  }
} };

/** where a lightning snare goes this turn: beside the rogue, and beside each of its clones */
const layBolts = (p: Party, u: Unit, t: number, ev: GEvent[]) => {
  for (const who of [u, ...mirrorsOf(p, u)]) { const at = snareSpot(p, posOf(p, who)); if (at) laySnare(p, u, at, 'bolt', t, ev); }
};

export const ROGUE_CARDS: TraitDef[] = [
  // 함정: snares that go off in chains
  inBranch(card('lightningTrap', '번개 함정', 'law', ['함정'], 'rogue', '전투 중 매 턴 2칸 안에 번개 함정(밟으면 피해·감전, 3번, 최대 3개), 대기하면 하나 더', {
    triggers: () => (['turn', 'wait'] as const).map((when): TriggerDef => ({ id: '번개 함정', when, test: (p, c) => fighting(p, c.src), run: (p, c) => layBolts(p, c.src, c.t, c.ev) })),
  }, '최대 5개', '번개 함정이 주변 1칸에도'), TRAP, true),
  inBranch(card('fireTrap', '화염 함정', 'law', ['함정', '화염'], 'rogue', '이동 → 떠난 칸에 화염 함정(밟으면 폭발·화상)', {
    trigger: () => ({ id: '화염 함정', when: 'moved', test: (p, c) => fighting(p, c.src), run: (p, c) => {
      const step = [...c.ev].reverse().find((e) => e.src === c.src.id && (e.type === 'move' || e.type === 'teleport') && e.from);
      if (step?.from) laySnare(p, c.src, step.from, 'fire', c.t, c.ev);
    } }),
  }, '폭발 반경 1', '화염 함정 자리에 2턴 불바닥'), TRAP),
  inBranch(card('chainDetonate', '연쇄 기폭', 'convert', ['함정'], 'rogue', '함정이 터짐 → 2칸 안 다른 함정도 터짐', {}, '기폭된 함정 피해 +50%'), TRAP),
  inBranch(card('trapAmp', '함정 숙련', 'amp', ['함정'], 'rogue', '#함정 1당 함정 피해 ×1.15 (곱)', {}, '×1.19'), TRAP),
  // 무술: ki built blow by blow, spent in one burst
  inBranch(card('chargeUp', '기 모으기', 'law', ['치명'], 'rogue', '적중마다 기 1(최대 3), 기가 있는 동안 공격마다 기 1당 옆 적에게 충격파', {
    triggers: (r) => [
      { id: '기 모으기', when: 'hit', test: (_p, c) => c.src.finishAt !== c.t && (c.src.ki ?? 0) < (r >= 2 ? 5 : 3), run: (_p, c) => { c.src.ki = (c.src.ki ?? 0) + 1; } },
      // a blow that will spend the ki in a finishing burst sends no shockwave
      { id: '충격파', when: 'attack', test: (_p, c) => (c.src.ki ?? 0) > 0 && !(rank(c.src, 'finisher') && c.src.ki! >= 3), run: (p, c) => {
        const amount = Math.max(1, Math.round(avg(p, c.src, c.t) * 0.15 * c.src.ki! * kiAmp(c.src)));
        // rank 3: with full ki the shockwave reaches two cells
        for (const f of foesNear(p, posOf(p, c.src), r >= 3 && c.src.ki! >= (r >= 2 ? 5 : 3) ? 2 : 1)) damage(p, c.t, c.src.id, f, amount, c.ev, true);
      } },
    ],
  }, '최대 5', '기가 최대면 충격파 2칸까지'), MARTIAL, true),
  inBranch(card('finisher', '마무리 일격', 'law', ['치명'], 'rogue', '기 3 이상에서 공격 → 기를 모두 써 기당 피해 +50%, 주변 1칸 폭발', {
    triggers: (r) => [
      { id: '마무리 일격', when: 'attack', test: (p, c) => (c.src.ki ?? 0) >= 3 && !!c.target && alive(p, c.target), run: (_p, c) => {
        c.src.finishing = c.src.ki; c.src.finishTarget = c.target!.id; c.src.finishAt = c.t; c.src.ki = 0;
      } },
      { id: '기 폭발', when: 'beforeHit', test: (_p, c) => !!c.src.finishing && c.target?.id === c.src.finishTarget, run: (_p, c) => {
        c.src.attackMult = (c.src.attackMult ?? 1) * (1 + 0.5 * kiAmp(c.src) * c.src.finishing!);
      } },
      { id: '마무리 폭발', when: 'hit', test: (_p, c) => !!c.src.finishing && c.target?.id === c.src.finishTarget, run: (p, c) => {
        const n = c.src.finishing!, at = posOf(p, c.target!); c.src.finishing = 0;
        for (const f of foesNear(p, at, r >= 3 ? 2 : 1)) {
          if (f !== c.target) damage(p, c.t, c.src.id, f, Math.max(1, Math.round(avg(p, c.src, c.t) * 0.5 * n)), c.ev, true);
          if (r >= 2 && alive(p, f)) applyStatus(p, c.src, f, 'stun', c.t, c.ev);
        }
      } },
    ],
  }, '기절', '폭발 반경 2'), MARTIAL),
  inBranch(card('dragonClaw', '용의 발톱', 'convert', ['치명'], 'rogue', '마무리 일격으로 처치 → 기 2 회복', {
    trigger: (r) => ({ id: '용의 발톱', when: 'kill', repeat: true, test: (_p, c) => !!c.src.finishing && c.target?.id === c.src.finishTarget, run: (_p, c) => {
      c.src.ki = (c.src.ki ?? 0) + (r >= 2 ? 3 : 2);
    } }),
  }, '기 3 회복'), MARTIAL),
  inBranch(card('martialAmp', '무술 숙련', 'amp', ['치명'], 'rogue', '#치명 1당 기 1의 피해 ×1.1 (곱)', {}, '×1.14'), MARTIAL),
  // 그림자: kill, vanish, appear beside the next one
  inBranch(card('shadowStep', '그림자 걸음', 'law', ['은신'], 'rogue', '처치 → 은신, 4칸 안 가장 가까운 적 곁으로 순간이동해 바로 공격', {
    trigger: (r) => ({ id: '그림자 걸음', when: 'kill', repeat: true, run: (p, c) => {
      c.src.hiddenUntil = Math.max(c.src.hiddenUntil, c.t + 1);
      const me = posOf(p, c.src), next = foesNear(p, me, r >= 2 ? 6 : 4).sort((a, b) => dist(posOf(p, a), me) - dist(posOf(p, b), me))[0];
      if (next && stepBehind(p, c.src, next, c.t, c.ev)) { if (r >= 3) c.src.nextCrit = true; strike(p, c.src, next, c.t, c.ev, 1, false); }
    } }),
  }, '순간이동 거리 +2', '순간이동 공격은 반드시 치명'), SHADOW, true),
  inBranch(card('vitals', '급소 찌르기', 'law', ['치명'], 'rogue', '적의 상태 1개당 피해 +25%', {
    triggers: (r) => [
      { id: '급소 찌르기', when: 'beforeHit', test: (_p, c) => !!c.target && live(c.target, c.t) > 0, run: (_p, c) => { c.src.attackMult = (c.src.attackMult ?? 1) * (1 + (r >= 2 ? 0.4 : 0.25) * live(c.target!, c.t)); } },
      // rank 3: a foe dying under three states or more hands them to the nearest foe
      ...(r >= 3 ? [{ id: '상태 전이', when: 'kill', repeat: true, test: (_p, c) => !!c.target && live(c.target, c.t) >= 3, run: (p, c) => {
        const at = posOf(p, c.target!), next = foesNear(p, at, 4).sort((a, b) => dist(posOf(p, a), at) - dist(posOf(p, b), at))[0];
        if (!next) return;
        for (const [id, st] of Object.entries(c.target!.status)) if (st && st.until > c.t) applyStatus(p, c.src, next, id as StatusId, c.t, c.ev, st.stacks ?? 1, true);
      } } satisfies TriggerDef] : []),
    ],
  }, '1개당 +40%', '상태 3개 이상인 적 처치 → 그 상태들을 가까운 적에게 옮김'), SHADOW),
  inBranch(card('shadowPoison', '그림자 독', 'convert', ['은신', '독'], 'rogue', '은신 중 공격 → 중독 3중첩', {
    triggers: (r) => [
      // the blow from hiding ends the stealth before it lands: remember it
      { id: '그림자 독 준비', when: 'beforeHit', test: (_p, c) => c.t < c.src.hiddenUntil, run: (_p, c) => { c.src.fromHiding = c.t; } },
      { id: '그림자 독', when: 'hit', test: (p, c) => !!c.target && alive(p, c.target) && (c.t < c.src.hiddenUntil || c.src.fromHiding === c.t), run: (p, c) => {
        c.src.fromHiding = undefined; applyStatus(p, c.src, c.target!, 'poison', c.t, c.ev, r >= 2 ? 5 : 3);
      } },
    ],
  }, '중독 5중첩'), SHADOW),
  inBranch(card('ambushArt', '기습', 'amp', ['은신'], 'rogue', '#은신 1당 은신 공격 피해 ×1.3 (곱)', {}, '×1.34'), SHADOW),
];
