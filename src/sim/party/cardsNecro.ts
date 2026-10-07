import { applyStatus } from './status';
import { addShield } from './shield';
import { alive, damage, entOf, freeHit, posOf, stats, type Party, type Unit } from './partyCore';
import { fighting, foesNear } from './cardFx';
import { tagsOf } from './classKit';
import { beyond } from './cardsRanged';
import { summon } from './kitEffects';
import { consume, corpsesNear } from './corpses';
import { card, inBranch, rank, type TraitDef } from './traitTypes';
import { dist, tileAt, walkable, type Cell, type GEvent } from '../grid/types';
import { spawnFoe } from '../grid/foes';
import { blank } from '../roam/roam';
import type { TriggerDef } from './triggers';

const avg = (p: Party, u: Unit, t: number) => { const [lo, hi] = stats(u, t, p).dmg; return (lo + hi) / 2; };
const BONE = 'necromancer:bone', LEGION = 'necromancer:legion', PLAGUE = 'necromancer:plague';
const minions = (p: Party, u: Unit) => p.units.filter((x) => x.summoner === u.id && alive(p, x) && !x.golem && !x.mirror);

/** A spear of bone through the target and every foe behind it in line: a hit each. Returns the foes it killed. */
function spear(p: Party, u: Unit, target: Unit, t: number, ev: GEvent[]): Unit[] {
  const line = [target, ...beyond(p, u, target)], amount = Math.round(avg(p, u, t) * 1.2), dead: Unit[] = [];
  ev.push({ t, type: 'shoot', src: u.id, dst: target.id, from: { ...posOf(p, u) }, to: { ...posOf(p, line[line.length - 1]!) }, text: 'bone' });
  for (const f of line) { freeHit(p, u, f, amount, 'bone', t, ev); if (!alive(p, f)) dead.push(f); }
  return dead;
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
  if (kind === 'bone' && rank(attacker, 'boneAmp')) m *= 1.12 ** (tagsOf(attacker).뼈 ?? 0);
  if (kind === 'poison' && rank(attacker, 'plagueAmp')) m *= 1.15 ** (tagsOf(attacker).독 ?? 0);
  const owner = attacker.summoner ? p.units.find((x) => x.id === attacker.summoner) : undefined;
  if (owner && rank(owner, 'legionAmp')) m *= 1.1 ** (tagsOf(owner).소환 ?? 0);
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
      let dead = spear(p, c.src, c.target!, c.t, c.ev);
      for (let k = 0; k < 3 && dead.length; k++) {
        const from = dead[0]!, next = foesNear(p, posOf(p, from), 4).sort((a, b) => dist(posOf(p, a), posOf(p, from)) - dist(posOf(p, b), posOf(p, from)))[0];
        dead = next ? spear(p, c.src, next, c.t, c.ev) : [];
      }
    } }),
  }, '50%'), BONE, true),
  inBranch(card('bonePrison', '뼈 감옥', 'law', ['뼈'], 'necromancer', '위기 → 주변 2칸 적 1턴 묶음', {
    trigger: (r) => ({ id: '뼈 감옥', when: 'crisis', run: (p, c) => { for (const f of foesNear(p, posOf(p, c.src), 2)) { applyStatus(p, c.src, f, 'stun', c.t, c.ev); if (r >= 2 && alive(p, f)) applyStatus(p, c.src, f, 'exposed', c.t, c.ev); } } }),
  }, '묶인 적 노출'), BONE),
  inBranch(card('boneArmor', '뼈 갑옷', 'convert', ['뼈'], 'necromancer', '받은 피해 20% → 뼈 조각 보호막, 깨질 때 주변 1칸 뼈 피해', {
    triggers: () => [
      { id: '뼈 갑옷', when: 'damaged', test: (_p, c) => (c.amount ?? 0) > 0, run: (_p, c) => addShield(c.src, Math.max(1, Math.round((c.amount ?? 0) * 0.2)), c.src) },
      { id: '뼈 파편', when: 'shieldBreak', run: (p, c) => { for (const f of foesNear(p, posOf(p, c.src), 1)) damage(p, c.t, c.src.id, f, Math.max(2, c.amount ?? 0), c.ev, true, false, 'bone'); } },
    ],
  }), BONE),
  inBranch(card('boneAmp', '뼈 숙련', 'amp', ['뼈'], 'necromancer', '#뼈 1당 뼈 피해 ×1.12 (곱)', {}), BONE),
  // 군단: skeletons rising from every body
  inBranch(card('raiseSkeleton', '해골 일으키기', 'law', ['소환'], 'necromancer', '3칸 안에 시체가 있으면 매 턴 해골(최대 3), 대기하면 하나 더', {
    triggers: (r) => (['turn', 'wait'] as const).map((when): TriggerDef => ({ id: '해골 일으키기', when, test: (p, c) => fighting(p, c.src) && minions(p, c.src).length < (r >= 2 ? 5 : 3) && corpsesNear(p, posOf(p, c.src), 3).length > 0, run: (p, c) => {
      const body = corpsesNear(p, posOf(p, c.src), 3)[0]!, archer = r >= 2 && minions(p, c.src).length % 2 === 1;
      if (summon(p, c.src, posOf(p, body), c.t, c.ev, r >= 2 ? 5 : 3, { hp: 24, weapon: archer ? 'longbow' : 'fists' })) consume(body);
    } })),
  }, '해골 궁수 포함 최대 5'), LEGION, true),
  inBranch(card('deadGrasp', '망자의 손아귀', 'law', ['소환'], 'necromancer', '소환수가 죽음 → 그 자리에 시체 2구', {
    trigger: (r) => ({ id: '망자의 손아귀', when: 'summonDied', test: (_p, c) => !!c.target && !c.target.golem && !c.target.mirror, run: (p, c) => {
      const at = posOf(p, c.target!); for (let k = 0; k < (r >= 2 ? 3 : 2); k++) leaveBody(p, at);
    } }),
  }, '3구'), LEGION),
  inBranch(card('soulLink', '사령의 연결', 'convert', ['소환'], 'necromancer', '받는 피해 30%를 가장 가까운 소환수가 대신 받음', {}), LEGION),
  inBranch(card('legionAmp', '망자의 군세', 'amp', ['소환'], 'necromancer', '소환수 1당 내 피해 ×1.08, #소환 1당 소환수 피해 ×1.1', {
    trigger: () => ({ id: '망자의 군세', when: 'beforeHit', test: (p, c) => minions(p, c.src).length > 0, run: (p, c) => { c.src.attackMult = (c.src.attackMult ?? 1) * 1.08 ** minions(p, c.src).length; } }),
  }), LEGION),
  // 독·저주: poison clouds that grow where things die
  inBranch(card('poisonNova', '독 신성', 'law', ['독'], 'necromancer', '처치 → 그 자리에 독구름 2턴(반경 2, 매 턴 중독 2), 구름 안에서 죽으면 구름 연장·확대', {
    trigger: (r) => ({ id: '독 신성', when: 'kill', test: (_p, c) => !!c.target, run: (p, c) => {
      const at = { ...posOf(p, c.target!) }, mine = (p.grounds ?? []).find((g) => g.by === c.src.id && g.kind === 'poison' && dist(g.at, at) <= (g.r ?? 1));
      if (mine) { mine.until = Math.max(mine.until, c.t + 2); mine.r = Math.min((r >= 2 ? 4 : 3), (mine.r ?? 2) + 1); return; }
      (p.grounds ??= []).push({ at, by: c.src.id, until: c.t + 2, next: c.t + 1, kind: 'poison', r: r >= 2 ? 3 : 2 });
    } }),
  }, '반경 3'), PLAGUE, true),
  inBranch(card('curse', '저주', 'law', ['독'], 'necromancer', '적중 → 3턴 받는 피해 +20% 저주', {
    triggers: (r) => [
      { id: '저주', when: 'hit', test: (p, c) => !!c.target && alive(p, c.target), run: (_p, c) => { c.target!.cursedUntil = c.t + 3; c.target!.cursedBy = c.src.id; } },
      ...(r >= 2 ? [{ id: '저주 전이', when: 'kill', test: (_p, c) => !!c.target && (c.target.cursedUntil ?? 0) > c.t, run: (p, c) => { const n = foesNear(p, posOf(p, c.target!), 4)[0]; if (n) { n.cursedUntil = c.t + 3; n.cursedBy = c.src.id; } } } satisfies TriggerDef] : []),
    ],
  }, '저주된 적이 죽으면 가까운 적에게 옮김'), PLAGUE),
  inBranch(card('poisonBurst', '독 폭발', 'convert', ['독'], 'necromancer', '중독 5중첩 → 모두 터뜨려 즉시 독 피해, 주변 중독 2', {
    trigger: () => ({ id: '독 폭발', when: 'statusApplied', repeat: true, test: (_p, c) => c.status === 'poison' && (c.target?.status.poison?.stacks ?? 0) >= 5, run: (p, c) => {
      const t = c.target!, stacks = t.status.poison!.stacks ?? 5; delete t.status.poison;
      damage(p, c.t, c.src.id, t, stacks * 4, c.ev, true, false, 'poison');
      for (const f of foesNear(p, posOf(p, t), 1)) if (f !== t) applyStatus(p, c.src, f, 'poison', c.t, c.ev, 2, true);
    } }),
  }), PLAGUE),
  inBranch(card('plagueAmp', '독 숙련', 'amp', ['독'], 'necromancer', '#독 1당 독 피해 ×1.15 (곱)', {}), PLAGUE),
];

