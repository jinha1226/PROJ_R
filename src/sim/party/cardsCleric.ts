import { applyStatus } from './status';
import { alive, damage, freeHit, levelDmg, posOf, stats, strike, type Party, type Unit } from './partyCore';
import { fighting, foesNear } from './cardFx';
import { addShield } from './shield';
import { tagsOf } from './classKit';
import { resonant } from './resonance';
import { levelOf } from './partyLevel';
import { ampBase, card, inBranch, rank, type TraitDef } from './traitTypes';
import { action, type TriggerDef } from './triggers';
import { dist, tileAt, walkable, type Cell, type GEvent } from '../grid/types';
import type { DamageKind } from './partyCore';

const HAMMER = 'cleric:hammer', SHIELD = 'cleric:shield', AURA = 'cleric:aura';
const avg = (p: Party, u: Unit, t: number) => { const [lo, hi] = stats(u, t, p).dmg; return ((lo + hi) / 2) * levelDmg(u); };
/** the ring the hammers travel: the sixteen cells two from the cleric, clockwise */
const RING: Cell[] = [[2, 0], [2, 1], [2, 2], [1, 2], [0, 2], [-1, 2], [-2, 2], [-2, 1], [-2, 0], [-2, -1], [-2, -2], [-1, -2], [0, -2], [1, -2], [2, -2], [2, -1]].map(([x, y]) => ({ x: x!, y: y! }));
const hammerCap = (u: Unit) => Math.max(rank(u, 'hammer') >= 2 ? 5 : 3, rank(u, 'hammerResonance') ? (rank(u, 'hammerResonance') >= 2 ? 6 : 4) : 0);

/** Where the cleric's hammers are now: one while it fights, one more for each live extra (each three turns), spaced round the ring. */
export function hammerCells(p: Party, u: Unit, t: number): Cell[] {
  if (!rank(u, 'hammer') || !alive(p, u) || !fighting(p, u)) return [];
  const n = 1 + (u.hammers ?? []).filter((e) => e > t).length, me = posOf(p, u), phase = u.hammerPhase ?? 0;
  return Array.from({ length: n }, (_, i) => { const d = RING[(phase + Math.floor((i * RING.length) / n)) % RING.length]!; return { x: me.x + d.x, y: me.y + d.y }; });
}
/** One more hammer for three turns (up to the cap). */
function addHammer(p: Party, u: Unit, t: number): void {
  const live = (u.hammers ?? []).filter((e) => e > t);
  if (1 + live.length < hammerCap(u)) u.hammers = [...live, t + 3];
}
/** Every half turn each hammer strikes the foe on its cell (holy damage), then the ring turns one cell. */
export function tickHammers(p: Party, t: number, ev: GEvent[]): void {
  for (const u of p.units) {
    if (u.side !== 'hero' || !rank(u, 'hammer') || !alive(p, u)) continue;
    // out of a fight the ring stops and the extra hammers go (they never carry into the next one)
    if (!fighting(p, u)) { u.hammerNext = undefined; u.hammers = []; continue; }
    u.hammerNext ??= t;
    while (u.hammerNext <= t) {
      const at = u.hammerNext, cells = hammerCells(p, u, at), amount = Math.max(1, Math.round(avg(p, u, at) * 0.5));
      action(p, () => {
        u.hammering = true;
        try {
          for (const c of cells) {
            ev.push({ t: at, type: 'buff', src: u.id, to: { ...c }, text: '축복의 망치' });
            for (const f of p.units.filter((x) => x.side === 'foe' && alive(p, x) && posOf(p, x).x === c.x && posOf(p, x).y === c.y)) freeHit(p, u, f, amount, 'holy', at, ev);
          }
        } finally { u.hammering = false; }
      });
      u.hammerPhase = ((u.hammerPhase ?? 0) + 1) % RING.length;
      u.hammerNext += 0.5;
    }
  }
}

/** A sanctuary (the cleric's aimed ultimate): three turns on a cell, allies inside untouchable, foes inside burnt by holy light each turn. */
export function sanctuary(p: Party, u: Unit, cell: Cell, t: number): boolean {
  if (!walkable(tileAt(p.s.map, cell)) || dist(posOf(p, u), cell) > 6) return false;
  (p.zones ??= []).push({ at: { ...cell }, by: u.id, until: t + 3, next: t, r: 2 });
  return true;
}
export function tickZones(p: Party, t: number, ev: GEvent[]): void {
  for (const z of p.zones ?? []) {
    const src = p.units.find((x) => x.id === z.by);
    // the sanctuary ends with its cleric
    if (!src || !alive(p, src)) { z.until = -1; continue; }
    while (z.next < z.until && z.next <= t) {
      const at = z.next;
      for (const a of p.units.filter((x) => x.side === 'hero' && alive(p, x) && dist(posOf(p, x), z.at) <= z.r)) a.immuneUntil = Math.max(a.immuneUntil ?? 0, at + 1);
      if (src) action(p, () => { for (const f of foesNear(p, z.at, z.r)) damage(p, at, src.id, f, Math.max(1, Math.round(avg(p, src, at) * 0.5)), ev, true, false, 'holy'); });
      z.next += 1;
    }
  }
  p.zones = p.zones?.filter((z) => z.until > t && z.next < z.until);
}

/** how far the purifying aura reaches */
const auraReach = (p: Party, u: Unit) => (rank(u, 'purifyAura') >= 2 ? 3 : 2) + (resonant(p, u, '오라', 1) ? 1 : 0);
const inAura = (p: Party, u: Unit, f: Unit) => rank(u, 'purifyAura') > 0 && dist(posOf(p, f), posOf(p, u)) <= auraReach(p, u);
/** the aura's damage this turn: 3 + level, aura mastery ×1.2 per #오라 */
const auraDamage = (u: Unit) => (3 + levelOf(u)) * (rank(u, 'auraAmp') ? ampBase(u, 'auraAmp', 1.2) ** (tagsOf(u).오라 ?? 0) : 1);

/** Holy mastery: holy damage ×1.12 per #신성 (multiplied). */
export const holyAmp = (attacker: Unit, kind: DamageKind): number => (kind === 'holy' && rank(attacker, 'holyAmp') ? ampBase(attacker, 'holyAmp', 1.12) ** (tagsOf(attacker).신성 ?? 0) : 1);

export const CLERIC_CARDS: TraitDef[] = [
  // 축복의 망치: hammers that circle and multiply
  inBranch(card('hammer', '축복의 망치', 'law', ['신성'], 'cleric', '전투 중 망치 1개가 나를 돌며 닿는 적에게 신성 피해, 피격·세 번째 공격마다 망치 추가(3턴, 최대 3개)', {
    triggers: (r) => [
      { id: '망치 추가', when: 'struck', run: (p, c) => addHammer(p, c.src, c.t) },
      { id: '망치 추가', when: 'hit', test: (_p, c) => !!c.basic && c.src.nth % 3 === 0, run: (p, c) => addHammer(p, c.src, c.t) },
      ...(r >= 3 ? [{ id: '망치 폭발', when: 'kill', repeat: true, test: (_p, c) => !!c.src.hammering && !!c.target, run: (p, c) => {
        for (const f of foesNear(p, posOf(p, c.target!), 1)) damage(p, c.t, c.src.id, f, Math.max(1, Math.round(avg(p, c.src, c.t) * 0.6)), c.ev, true, false, 'holy');
      } } satisfies TriggerDef] : []),
    ],
  }, '최대 5개', '망치로 처치 → 그 자리 신성 폭발(반경 1)'), HAMMER, true),
  inBranch(card('judgment', '심판 낙인', 'law', ['신성'], 'cleric', '적중마다 심판 1 → 5가 되면 신성 폭발(피해 20, 기절)', {
    trigger: (r) => ({ id: '심판 낙인', when: 'hit', test: (p, c) => !!c.target && alive(p, c.target), run: (p, c) => {
      const t = c.target!; t.judge = (t.judge ?? 0) + 1;
      if (t.judge < (r >= 2 ? 3 : 5)) return;
      t.judge = 0; damage(p, c.t, c.src.id, t, 20, c.ev, true, false, 'holy');
      if (alive(p, t)) applyStatus(p, c.src, t, 'stun', c.t, c.ev);
      if (r >= 3) for (const f of foesNear(p, posOf(p, t), 1)) if (f !== t) f.judge = (f.judge ?? 0) + 2;
    } }),
  }, '3에 폭발', '심판 폭발 → 주변 적에게 심판 2'), HAMMER),
  inBranch(card('hammerResonance', '망치 공명', 'convert', ['신성'], 'cleric', '망치에 맞은 적이 죽음 → 망치 1개 추가(최대 4)', {
    trigger: () => ({ id: '망치 공명', when: 'kill', repeat: true, test: (_p, c) => !!c.src.hammering, run: (p, c) => addHammer(p, c.src, c.t) }),
  }, '최대 6'), HAMMER),
  inBranch(card('holyAmp', '신성 숙련', 'amp', ['신성'], 'cleric', '#신성 1당 신성 피해 ×1.12 (곱)', {}, '×1.16'), HAMMER),
  // 방패 강타: a shield that keeps filling, and breaks into harm
  inBranch(card('divineShield', '신성 방패', 'law', ['방패'], 'cleric', '전투 중 보호막이 계속 차오름: 전투 시작 10, 매 턴 3, 처치마다 5', {
    triggers: (r) => [
      { id: '신성 방패', when: 'combatStart', run: (_p, c) => addShield(c.src, 10, c.src) },
      { id: '신성 방패', when: 'turn', test: (p, c) => fighting(p, c.src), run: (_p, c) => addShield(c.src, 3, c.src) },
      { id: '신성 방패', when: 'kill', run: (_p, c) => addShield(c.src, r >= 2 ? 10 : 5, c.src) },
      ...(r >= 3 ? [{ id: '방패 강타', when: 'beforeHit', test: (_p, c) => c.src.shield > 0, run: (_p, c) => { c.src.nextFlat = (c.src.nextFlat ?? 0) + Math.round(c.src.shield * 0.1); } } satisfies TriggerDef] : []),
    ],
  }, '처치마다 10', '공격에 보호막 10%만큼 추가 피해'), SHIELD, true),
  // the burst itself is shieldBroken (traitCombat): it reads this card's rank
  inBranch(card('shieldBurst', '보호막 폭발', 'law', ['방패'], 'cleric', '보호막이 깨짐 → 깨진 만큼 주변 1칸 피해', {}, '기절 추가', '폭발 반경 2'), SHIELD),
  inBranch(card('overflowGrace', '넘친 은총', 'convert', ['방패'], 'cleric', '넘친 치유 → 두 배로 보호막', {
    trigger: (r) => ({ id: '넘친 은총', when: 'overflow', test: (_p, c) => !!c.target && (c.amount ?? 0) > 0, run: (_p, c) => addShield(c.target!, (c.amount ?? 0) * (r >= 2 ? 3 : 2), c.src) }),
  }, '세 배로 보호막'), SHIELD),
  inBranch(card('sacredWall', '신성 방벽', 'amp', ['방패'], 'cleric', '#방패 1당 내가 주는 보호막 ×1.15 (곱)', {}, '×1.19'), SHIELD),
  // 오라: an aura that burns harder with every death inside it
  inBranch(card('purifyAura', '정화의 오라', 'law', ['오라', '신성'], 'cleric', '전투 중 매 턴 주변 2칸 적에게 신성 피해 3(+레벨), 오라 안 처치마다 다음 턴 피해 +20%(최대 +100%)', {
    triggers: (r) => [
      { id: '정화의 오라', when: 'turn', test: (p, c) => fighting(p, c.src), run: (p, c) => {
        const amount = Math.max(1, Math.round(auraDamage(c.src) * (1 + (c.src.auraBoost ?? 0)))), exposes = resonant(p, c.src, '오라', 2);
        c.src.auraBoost = 0;
        for (const f of foesNear(p, posOf(p, c.src), auraReach(p, c.src))) {
          damage(p, c.t, c.src.id, f, amount, c.ev, true, false, 'holy');
          if (exposes && alive(p, f)) applyStatus(p, c.src, f, 'exposed', c.t, c.ev);
        }
      } },
      { id: '오라 고조', when: 'kill', repeat: true, test: (p, c) => !!c.target && inAura(p, c.src, c.target), run: (p, c) => {
        c.src.auraBoost = Math.min(1, (c.src.auraBoost ?? 0) + 0.2);
        if (r >= 3) for (const f of foesNear(p, posOf(p, c.target!), 1)) damage(p, c.t, c.src.id, f, Math.max(1, Math.round(auraDamage(c.src) * 3)), c.ev, true, false, 'holy');
      } },
    ],
  }, '3칸', '오라 안에서 죽은 적 → 신성 폭발(반경 1, 오라 피해 ×3)'), AURA, true),
  inBranch(card('zealAura', '광신의 오라', 'law', ['오라'], 'cleric', '오라 안에서 처치 → 2턴 공격 속도 +30%', {
    triggers: (r) => [
      { id: '광신의 오라', when: 'kill', repeat: true, test: (p, c) => !!c.target && inAura(p, c.src, c.target), run: (_p, c) => {
        c.src.zealUntil = r >= 2 ? Math.min(Math.max(c.src.zealUntil ?? 0, c.t) + 2, c.t + 6) : c.t + 2;
      } },
      ...(r >= 3 ? [{ id: '광신 연타', when: 'hit', chance: 0.25, test: (p, c) => !!c.basic && c.t < (c.src.zealUntil ?? 0) && !!c.target && alive(p, c.target), run: (p, c) => strike(p, c.src, c.target!, c.t, c.ev, 1, false) } satisfies TriggerDef] : []),
    ],
  }, '처치마다 연장', '광신 중 공격 25% → 2연타'), AURA),
  inBranch(card('lifeTransfer', '생명 전이', 'convert', ['오라'], 'cleric', '치유량 30% → 가장 가까운 적에게 피해', {
    trigger: (r) => ({ id: '생명 전이', when: 'healed', test: (_p, c) => !!c.target && (c.amount ?? 0) > 0, run: (p, c) => {
      const at = posOf(p, c.target!), f = foesNear(p, at, 8).sort((a, b) => dist(posOf(p, a), at) - dist(posOf(p, b), at))[0];
      if (f) damage(p, c.t, c.src.id, f, Math.max(1, Math.round((c.amount ?? 0) * (r >= 2 ? 0.5 : 0.3))), c.ev, true);
    } }),
  }, '50%'), AURA),
  inBranch(card('auraAmp', '오라 숙련', 'amp', ['오라'], 'cleric', '#오라 1당 오라 피해 ×1.2 (곱)', {}, '×1.24'), AURA),
];
