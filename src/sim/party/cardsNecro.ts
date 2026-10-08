import { applyStatus } from './status';
import { addShield } from './shield';
import { alive, damage, entOf, freeHit, posOf, stats, type Party, type Unit } from './partyCore';
import { fighting, foesNear } from './cardFx';
import { tagsOf } from './classKit';
import { beyond } from './cardsRanged';
import { summon } from './kitEffects';
import { consume, corpsesNear } from './corpses';
import { duoFor } from './cardsCombo';
import { ampBase, card, inBranch, rank, type TraitDef } from './traitTypes';
import { dist, tileAt, walkable, type Cell, type GEvent } from '../grid/types';
import { spawnFoe } from '../grid/foes';
import { blank } from '../roam/roam';
import type { TriggerDef } from './triggers';

const avg = (p: Party, u: Unit, t: number) => { const [lo, hi] = stats(u, t, p).dmg; return (lo + hi) / 2; };
const BONE = 'necromancer:bone', LEGION = 'necromancer:legion', PLAGUE = 'necromancer:plague';
const minions = (p: Party, u: Unit) => p.units.filter((x) => x.summoner === u.id && alive(p, x) && !x.golem && !x.mirror);

/** A spear of bone through the target and every foe behind it in line: a hit each. Returns the foes it killed. */
function spear(p: Party, u: Unit, target: Unit, t: number, ev: GEvent[], expose = false): Unit[] {
  const line = [target, ...beyond(p, u, target)], amount = Math.round(avg(p, u, t) * 1.2), dead: Unit[] = [];
  ev.push({ t, type: 'shoot', src: u.id, dst: target.id, from: { ...posOf(p, u) }, to: { ...posOf(p, line[line.length - 1]!) }, text: 'bone' });
  for (const f of line) { freeHit(p, u, f, amount, 'bone', t, ev); if (!alive(p, f)) dead.push(f); else if (expose) applyStatus(p, u, f, 'exposed', t, ev); }
  // the archer-necromancer combo: a marked foe in the line throws one more spear at the foe nearest it
  const marked = duoFor(p, u, 'boneArrow') ? line.find((f) => alive(p, f) && (f.status.mark?.until ?? 0) > t) : undefined;
  const next = marked && foesNear(p, posOf(p, marked), 4).filter((f) => !line.includes(f)).sort((a, b) => dist(posOf(p, a), posOf(p, marked)) - dist(posOf(p, b), posOf(p, marked)))[0];
  if (next) { ev.push({ t, type: 'shoot', src: u.id, dst: next.id, from: { ...posOf(p, marked!) }, to: { ...posOf(p, next) }, text: 'bone' }); freeHit(p, u, next, amount, 'bone', t, ev); if (!alive(p, next)) dead.push(next); }
  return dead;
}

const legionCap = (r: number) => (r >= 2 ? 5 : 3);
/** One more skeleton beside a cell (every other one an archer once the card is upgraded); false at the legion's cap. */
const raise = (p: Party, u: Unit, at: Cell, t: number, ev: GEvent[], r: number): boolean =>
  summon(p, u, at, t, ev, legionCap(r), { hp: 24, weapon: r >= 2 && minions(p, u).length % 2 === 1 ? 'longbow' : 'fists' });
/** Where the legion rises as a fight opens: a step from the necromancer toward the nearest foe awake. */
function front(p: Party, u: Unit): Cell {
  const me = posOf(p, u), foe = p.units.filter((f) => f.side === 'foe' && alive(p, f) && !f.asleep).sort((a, b) => dist(posOf(p, a), me) - dist(posOf(p, b), me))[0];
  if (!foe) return me;
  const fp = posOf(p, foe), c = { x: me.x + Math.sign(fp.x - me.x), y: me.y + Math.sign(fp.y - me.y) };
  return walkable(tileAt(p.s.map, c)) ? c : me;
}

/** A body left where a minion fell (grasp of the dead): a dead foe unit that gives no bio-matter or experience. */
function leaveBody(p: Party, at: Cell): void {
  const e = spawnFoe(p.s, 'minion', at, false);
  e.alive = false; e.hp = 0; e.maxHp = 20;
  p.units.push({ ...blank(), id: e.id, side: 'foe', foe: 'goblin', reaped: true });
}

/** Necromancer masteries: bone and poison damage grow with their tags; minions hit harder with every #소환 (multiplied). */
export function necroAmp(p: Party, attacker: Unit, kind: string): number {
  let m = 1;
  if (kind === 'bone' && rank(attacker, 'boneAmp')) m *= ampBase(attacker, 'boneAmp', 1.12) ** (tagsOf(attacker).뼈 ?? 0);
  if (kind === 'poison' && rank(attacker, 'plagueAmp')) m *= ampBase(attacker, 'plagueAmp', 1.15) ** (tagsOf(attacker).독 ?? 0);
  const owner = attacker.summoner ? p.units.find((x) => x.id === attacker.summoner) : undefined;
  if (owner && rank(owner, 'legionAmp')) m *= ampBase(owner, 'legionAmp', 1.1) ** (tagsOf(owner).소환 ?? 0);
  return m;
}

/** Golem (the necromancer's aimed ultimate): every body within three of the cell becomes one great minion that draws the foes round it. */
export function raiseGolem(p: Party, u: Unit, cell: Cell, t: number, ev: GEvent[]): boolean {
  if (!walkable(tileAt(p.s.map, cell))) return false;
  const bodies = corpsesNear(p, cell, 3);
  if (!bodies.length) return false;
  const burnt = bodies.some((b) => (b.status.burn?.until ?? 0) > t), frozen = bodies.some((b) => (b.status.freeze?.until ?? 0) > t || (b.status.chill?.until ?? 0) > t);
  for (const b of bodies) consume(b);
  for (const old of p.units.filter((x) => x.summoner === u.id && x.golem && alive(p, x))) entOf(p, old.id)!.alive = false;
  if (!summon(p, u, cell, t, ev, 1, { hp: 40 + 25 * bodies.length, life: Infinity, golem: true, count: (x) => !!x.golem })) return false;
  const g = p.units[p.units.length - 1]!;
  // a golem of burnt bodies burns what it hits; of frozen ones, chills it
  const element = burnt ? 'burn' : frozen ? 'chill' : undefined;
  if (element) g.triggers = [{ id: '골렘 원소', when: 'hit', test: (pp, c) => !!c.target && alive(pp, c.target), run: (pp, c) => applyStatus(pp, c.src, c.target!, element, c.t, c.ev) }];
  for (const f of foesNear(p, posOf(p, g), 3)) { f.tauntBy = g.id; f.tauntUntil = t + 99; }
  return true;
}

/** The necromancer's own: when its golem falls it bursts as one great body (bone damage within two). */
export const GOLEM_FALL: TriggerDef = { id: '골렘 붕괴', when: 'summonDied', test: (_p, c) => !!c.target?.golem, run: (p, c) => {
  const g = c.target!, at = posOf(p, g), amount = Math.round(entOf(p, g.id)!.maxHp * 0.5);
  for (const f of foesNear(p, at, 2)) damage(p, c.t, c.src.id, f, amount, c.ev, true, false, 'bone');
} };

export const NECRO_CARDS: TraitDef[] = [
  // 뼈: spears that run through lines, and run on through what they kill
  inBranch(card('boneSpear', '뼈 창', 'law', ['뼈'], 'necromancer', '공격마다 30% → 일렬 관통 뼈 창(적중), 뼈 창으로 처치하면 그 자리에서 다음 적에게 한 번 더', {
    trigger: (r) => ({ id: '뼈 창', when: 'attack', chance: r >= 2 ? 0.5 : 0.3, test: (p, c) => !!c.target && !!c.basic && alive(p, c.target), run: (p, c) => {
      let dead = spear(p, c.src, c.target!, c.t, c.ev, r >= 3);
      for (let k = 0; k < 3 && dead.length; k++) {
        const from = dead[0]!, next = foesNear(p, posOf(p, from), 4).sort((a, b) => dist(posOf(p, a), posOf(p, from)) - dist(posOf(p, b), posOf(p, from)))[0];
        dead = next ? spear(p, c.src, next, c.t, c.ev, r >= 3) : [];
      }
    } }),
  }, '50%', '뼈 창에 맞은 적 노출'), BONE, true),
  inBranch(card('bonePrison', '뼈 감옥', 'law', ['뼈'], 'necromancer', '위기 → 주변 2칸 적 1턴 묶음', {
    triggers: (r) => (r >= 3 ? ['crisis', 'combatStart'] as const : ['crisis'] as const).map((when): TriggerDef => ({ id: '뼈 감옥', when, run: (p, c) => {
      for (const f of foesNear(p, posOf(p, c.src), 2)) { applyStatus(p, c.src, f, 'stun', c.t, c.ev); if (r >= 2 && alive(p, f)) applyStatus(p, c.src, f, 'exposed', c.t, c.ev); }
    } })),
  }, '묶인 적 노출', '전투 시작에도 터짐'), BONE),
  inBranch(card('boneArmor', '뼈 갑옷', 'convert', ['뼈'], 'necromancer', '받은 피해 20% → 뼈 조각 보호막, 깨질 때 주변 1칸 뼈 피해', {
    triggers: (r) => [
      { id: '뼈 갑옷', when: 'damaged', test: (_p, c) => (c.amount ?? 0) > 0, run: (_p, c) => addShield(c.src, Math.max(1, Math.round((c.amount ?? 0) * (r >= 2 ? 0.35 : 0.2))), c.src) },
      { id: '뼈 파편', when: 'shieldBreak', run: (p, c) => { for (const f of foesNear(p, posOf(p, c.src), 1)) damage(p, c.t, c.src.id, f, Math.max(2, c.amount ?? 0), c.ev, true, false, 'bone'); } },
    ],
  }, '받은 피해 35%'), BONE),
  inBranch(card('boneAmp', '뼈 숙련', 'amp', ['뼈'], 'necromancer', '#뼈 1당 뼈 피해 ×1.12 (곱)', {}, '×1.16'), BONE),
  // 군단: skeletons that stand up as the fight opens, and again from every body
  inBranch(card('raiseSkeleton', '해골 일으키기', 'law', ['소환'], 'necromancer', '전투 진입 → 해골 2, 3칸 안 시체마다 매 턴 해골(최대 3), 전투 중 대기 → 하나 더', {
    triggers: (r) => [
      // the legion rises with the fight, between the necromancer and the foes: no body needed
      { id: '해골 일으키기', when: 'combatStart', run: (p, c) => { const at = front(p, c.src); for (let k = 0; k < (r >= 2 ? 3 : 2); k++) raise(p, c.src, at, c.t, c.ev, r); } },
      { id: '해골 일으키기', when: 'turn', test: (p, c) => fighting(p, c.src) && minions(p, c.src).length < legionCap(r) && corpsesNear(p, posOf(p, c.src), 3).length > 0, run: (p, c) => {
        const body = corpsesNear(p, posOf(p, c.src), 3)[0]!;
        if (raise(p, c.src, posOf(p, body), c.t, c.ev, r)) consume(body);
      } },
      { id: '해골 일으키기', when: 'wait', test: (p, c) => fighting(p, c.src), run: (p, c) => { raise(p, c.src, posOf(p, c.src), c.t, c.ev, r); } },
      ...(r >= 3 ? [{ id: '해골 폭발', when: 'summonDied', repeat: true, test: (_p, c) => !!c.target && !c.target.golem && !c.target.mirror, run: (p, c) => {
        for (const f of foesNear(p, posOf(p, c.target!), 1)) damage(p, c.t, c.src.id, f, Math.max(1, Math.round(avg(p, c.src, c.t) * 0.8)), c.ev, true, false, 'bone');
      } } satisfies TriggerDef] : []),
    ],
  }, '진입 시 3, 해골 궁수 포함 최대 5', '해골이 죽음 → 그 시체가 바로 폭발'), LEGION, true),
  inBranch(card('deadGrasp', '망자의 손아귀', 'law', ['소환'], 'necromancer', '소환수가 죽음 → 그 자리에 시체 2구', {
    trigger: (r) => ({ id: '망자의 손아귀', when: 'summonDied', test: (_p, c) => !!c.target && !c.target.golem && !c.target.mirror, run: (p, c) => {
      const at = posOf(p, c.target!); for (let k = 0; k < (r >= 2 ? 3 : 2); k++) leaveBody(p, at);
      if (r >= 3) for (const f of foesNear(p, at, 1)) applyStatus(p, c.src, f, 'stun', c.t, c.ev);
    } }),
  }, '3구', '남긴 시체 주변 1칸 적 1턴 묶음'), LEGION),
  inBranch(card('soulLink', '사령의 연결', 'convert', ['소환'], 'necromancer', '받는 피해 30%를 가장 가까운 소환수가 대신 받음', {}, '45%'), LEGION),
  inBranch(card('legionAmp', '망자의 군세', 'amp', ['소환'], 'necromancer', '소환수 1당 내 피해 ×1.08, #소환 1당 소환수 피해 ×1.1 (곱)', {
    trigger: () => ({ id: '망자의 군세', when: 'beforeHit', test: (p, c) => minions(p, c.src).length > 0, run: (p, c) => { c.src.attackMult = (c.src.attackMult ?? 1) * 1.08 ** minions(p, c.src).length; } }),
  }, '소환수 피해 ×1.14'), LEGION),
  // 독·저주: poison clouds that grow where things die
  inBranch(card('poisonNova', '독 신성', 'law', ['독'], 'necromancer', '처치 → 그 자리에 독구름 2턴(반경 2, 매 턴 중독 2), 구름 안에서 죽으면 구름 연장·확대', {
    trigger: (r) => ({ id: '독 신성', when: 'kill', test: (_p, c) => !!c.target, run: (p, c) => {
      const at = { ...posOf(p, c.target!) }, mine = (p.grounds ?? []).find((g) => g.by === c.src.id && g.kind === 'poison' && dist(g.at, at) <= (g.r ?? 1));
      if (mine) { mine.until = Math.max(mine.until, c.t + 2); mine.r = Math.min((r >= 2 ? 4 : 3), (mine.r ?? 2) + 1); return; }
      (p.grounds ??= []).push({ at, by: c.src.id, until: c.t + 2, next: c.t + 1, kind: 'poison', r: r >= 2 ? 3 : 2 });
    } }),
    // rank 3: the foes in its clouds are cursed
    triggers: (r) => (r >= 3 ? [{ id: '독구름 저주', when: 'turn', run: (p, c) => {
      for (const g of (p.grounds ?? []).filter((x) => x.by === c.src.id && x.kind === 'poison' && x.until > c.t))
        for (const f of foesNear(p, g.at, g.r ?? 1)) { f.cursedUntil = Math.max(f.cursedUntil ?? 0, c.t + 1); f.cursedBy = c.src.id; }
    } } satisfies TriggerDef] : []),
  }, '반경 3', '독구름 안 적 저주'), PLAGUE, true),
  inBranch(card('curse', '저주', 'law', ['독'], 'necromancer', '적중 → 3턴 받는 피해 +20% 저주', {
    triggers: (r) => [
      { id: '저주', when: 'hit', test: (p, c) => !!c.target && alive(p, c.target), run: (_p, c) => { c.target!.cursedUntil = c.t + 3; c.target!.cursedBy = c.src.id; } },
      ...(r >= 3 ? [{ id: '저주의 독', when: 'kill', repeat: true, test: (_p, c) => !!c.target && (c.target.cursedUntil ?? 0) > c.t, run: (p, c) => {
        for (const f of foesNear(p, posOf(p, c.target!), 1)) applyStatus(p, c.src, f, 'poison', c.t, c.ev, 3, true);
      } } satisfies TriggerDef] : []),
      ...(r >= 2 ? [{ id: '저주 전이', when: 'kill', test: (_p, c) => !!c.target && (c.target.cursedUntil ?? 0) > c.t, run: (p, c) => { const n = foesNear(p, posOf(p, c.target!), 4)[0]; if (n) { n.cursedUntil = c.t + 3; n.cursedBy = c.src.id; } } } satisfies TriggerDef] : []),
    ],
  }, '저주된 적이 죽으면 가까운 적에게 옮김', '저주된 적이 죽음 → 주변 1칸 중독 3'), PLAGUE),
  inBranch(card('poisonBurst', '독 폭발', 'convert', ['독'], 'necromancer', '중독 5중첩 → 모두 터뜨려 즉시 독 피해, 주변 중독 2', {
    trigger: (r) => ({ id: '독 폭발', when: 'statusApplied', repeat: true, test: (_p, c) => c.status === 'poison' && (c.target?.status.poison?.stacks ?? 0) >= 5, run: (p, c) => {
      const t = c.target!, stacks = t.status.poison!.stacks ?? 5; delete t.status.poison;
      damage(p, c.t, c.src.id, t, stacks * 4, c.ev, true, false, 'poison');
      for (const f of foesNear(p, posOf(p, t), 1)) if (f !== t) applyStatus(p, c.src, f, 'poison', c.t, c.ev, r >= 2 ? 4 : 2, true);
    } }),
  }, '주변 중독 4'), PLAGUE),
  inBranch(card('plagueAmp', '독 숙련', 'amp', ['독'], 'necromancer', '#독 1당 독 피해 ×1.15 (곱)', {}, '×1.19'), PLAGUE),
];

