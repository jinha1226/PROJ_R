import { createRng } from '../../core/rng';
import { SCARS } from '../../data/scars';
import { TITLES, TITLE_ORDER } from '../../data/titles';
import type { Relation, ScarId, TitleId, TraitId } from '../../data/types';
import type { BattleEvent, BattleState, Outcome } from '../battle/types';
import { relationKinds } from '../personality/relations';
import { note } from './chronicle';
import { addXp } from './leveling';
import { rollItem } from './loot';
import { applyBattleToRelations, type Moment } from './relationships';
import { mercToUnitSetup } from './toSetup';
import { rankOf, type Mercenary, type Roster } from './types';

export interface BattleReport {
  outcome: Outcome;
  stage: number;
  events: readonly BattleEvent[];
  units: { id: string; alive: boolean; downed: boolean; minLifelineFrac: number }[];
  enemies: Record<string, { defId: string; boss?: boolean; elite?: boolean }>;
}

export interface Aftermath {
  roster: Roster;
  xp: Record<string, number>;
  levelUps: string[];
  injuries: string[];
  scars: { id: string; scar: ScarId }[];
  deaths: string[];
  titles: { id: string; title: TitleId }[];
  loot: string[];
  moments: Moment[];
  revealed: { id: string; trait: TraitId }[];
}

const SCAR_CHANCE = 0.3;
const SCAR_LIFELINE = 0.25;
const LOSS_BATTLES = 3;
const NEW_REL_KEYS: Partial<Record<Moment['kind'], string>> = { newFriend: 'newFriend', newComrade: 'newComrade', newRival: 'newRival', newFeud: 'newFeud' };

const count = (events: readonly BattleEvent[], type: string, key: 'src' | 'dst', id: string) => events.filter((e) => e.type === type && e[key] === id).length;
const isMentored = (m: Mercenary, all: Mercenary[], rels: Relation[]) => all.some((o) => {
  const r = rels.find((x) => x.a === m.id ? x.b === o.id : x.b === m.id && x.a === o.id);
  return !!r && o.level > m.level && relationKinds(r, r.a === m.id ? m.level : o.level, r.a === m.id ? o.level : m.level).has('mentor');
});

/** `perBattleHeal`: injuries tick down after each battle (company mode); the weekly run heals once a week instead. */
export function resolveBattle(roster: Roster, deployed: string[], report: BattleReport, { perBattleHeal = true } = {}): Aftermath {
  const battle = roster.battles + 1;
  const rng = createRng((roster.seed ^ Math.imul(battle, 2654435761)) >>> 0);
  const ev = report.events;
  const unit = new Map(report.units.map((u) => [u.id, u]));
  const inBattle = roster.mercs.filter((m) => deployed.includes(m.id));
  const out: Omit<Aftermath, 'roster' | 'moments'> = { xp: {}, levelUps: [], injuries: [], scars: [], deaths: [], titles: [], loot: [], revealed: [] };
  const stageMult = 1 + 0.1 * (report.stage - 1);
  const won = report.outcome === 'victory';
  const updated = new Map<string, Mercenary>();

  for (const m0 of inBattle) {
    const u = unit.get(m0.id);
    let m: Mercenary = { ...m0, record: { ...m0.record }, tempTraits: m0.tempTraits.map((t) => ({ ...t, battles: t.battles - 1 })).filter((t) => t.battles > 0) };
    const kills = ev.filter((e) => e.type === 'died' && e.src === m.id && report.enemies[e.dst ?? '']);
    const r = m.record;
    if (r.kills === 0 && kills.length) m = note(m, battle, 'firstKill', { battle });
    r.battles++;
    r.kills += kills.length;
    r.rescues += count(ev, 'rescued', 'src', m.id);
    r.dodges += count(ev, 'miss', 'dst', m.id);
    r.healing += ev.filter((e) => e.type === 'heal' && e.src === m.id).reduce((a, e) => a + (e.amount ?? 0), 0);
    for (const k of kills) {
      const info = report.enemies[k.dst!]!;
      if (info.boss) { r.bossKills++; m = note(m, battle, 'bossKill', { enemy: info.defId }); }
      else if (info.elite) m = note(m, battle, 'eliteKill', { enemy: info.defId });
    }
    for (const e of ev) if (e.type === 'rescued' && e.dst === m.id) m = note(m, battle, 'downedRescued', { by: e.src ?? '' });
    if (u && !u.alive) {
      out.deaths.push(m.id);
      updated.set(m.id, note({ ...m, alive: false }, battle, 'died', { battle }));
      continue;
    }
    if (count(ev, 'downed', 'dst', m.id) > 0) r.downedSurvived++;
    let xp = (30 + 6 * kills.length + (won ? 20 : 0)) * stageMult * (won ? 1 : 0.5);
    if (isMentored(m, inBattle, roster.relations)) xp *= 1.25;
    out.xp[m.id] = Math.round(xp);
    const before = rankOf(m.level);
    const lv = m.level;
    m = addXp(m, xp);
    if (m.level > lv) out.levelUps.push(m.id);
    if (rankOf(m.level) !== before) m = note(m, battle, 'rank', { rank: rankOf(m.level) });
    if (u?.downed) {
      m = { ...m, injury: 2 + rng.int(0, 1) };
      out.injuries.push(m.id);
    }
    // spec 4.5: lifeline cut to ≤25% and survived (whether still down or rescued)
    const free = (Object.keys(SCARS) as ScarId[]).filter((s) => !m.scars.includes(s));
    if (u && u.minLifelineFrac <= SCAR_LIFELINE && free.length && rng.chance(SCAR_CHANCE)) {
      const scar = rng.pick(free);
      m = note({ ...m, scars: [...m.scars, scar] }, battle, 'scar', { scar });
      out.scars.push({ id: m.id, scar });
    }
    if (!m.title) {
      const title = TITLE_ORDER.find((t) => TITLES[t].check(m.record));
      if (title) { m = note({ ...m, title }, battle, 'title', { title }); out.titles.push({ id: m.id, title }); }
    }
    if (m.revealed.length < m.traits.length) {
      const trait = m.traits.find((t) => !m.revealed.includes(t))!;
      m = note({ ...m, revealed: [...m.revealed, trait] }, battle, 'revealed', { trait });
      out.revealed.push({ id: m.id, trait });
    }
    for (const e of ev) if (e.type === 'rescued' && e.src === m.id) m = note(m, battle, 'rescued', { who: e.dst ?? '' });
    updated.set(m.id, m);
  }

  const rel = applyBattleToRelations({
    relations: roster.relations, events: ev, seed: (roster.seed ^ battle) >>> 0,
    allies: inBattle.map((m, i) => mercToUnitSetup(m, i, { col: 0, row: 0 })),
  });
  for (const mo of rel.moments) {
    const key = NEW_REL_KEYS[mo.kind];
    if (!key || !mo.b) continue;
    for (const [self, other] of [[mo.a, mo.b], [mo.b, mo.a]] as const) {
      const m = updated.get(self);
      if (m?.alive) updated.set(self, note(m, battle, key, { who: other }));
    }
  }
  for (const dead of out.deaths) {
    for (const r of roster.relations) {
      if (r.a !== dead && r.b !== dead) continue;
      const otherId = r.a === dead ? r.b : r.a;
      const other = updated.get(otherId) ?? roster.mercs.find((x) => x.id === otherId);
      if (!other?.alive || r.affinity < 40) continue;
      const already = other.traits.includes('vengeful') || other.tempTraits.some((x) => x.trait === 'vengeful');
      const grieving = already ? other : { ...other, tempTraits: [...other.tempTraits, { trait: 'vengeful' as const, battles: LOSS_BATTLES }] };
      updated.set(otherId, note(grieving, battle, 'friendDied', { who: dead }));
    }
  }
  const relations = rel.relations.filter((r) => !out.deaths.includes(r.a) && !out.deaths.includes(r.b));

  let inventory = [...roster.inventory];
  if (won) {
    const bonus = ev.filter((e) => e.type === 'died' && (report.enemies[e.dst ?? '']?.elite || report.enemies[e.dst ?? '']?.boss)).length;
    for (let i = 0; i < 1 + bonus; i++) out.loot.push(rollItem(rng, report.stage));
    inventory = [...inventory, ...out.loot];
  }
  const mercs: Mercenary[] = [];
  const memorial = [...roster.memorial];
  for (const m0 of roster.mercs) {
    let m = updated.get(m0.id) ?? m0;
    if (perBattleHeal && m.alive && m.injury > 0 && !out.injuries.includes(m.id)) m = { ...m, injury: m.injury - 1 };
    if (!m.alive) {
      inventory = [...inventory, ...Object.values(m.gear).filter((g): g is string => !!g)];
      memorial.push({ ...m, gear: {} });
    } else mercs.push(m);
  }
  return { ...out, moments: rel.moments, roster: { ...roster, battles: battle, mercs, memorial, relations, inventory } };
}

/** Builds a report from a finished battle state (allies' lowest lifeline is tracked by the sim). */
export function reportFromBattle(s: BattleState, events: readonly BattleEvent[], stage: number): BattleReport {
  const enemies: BattleReport['enemies'] = {};
  for (const u of s.units) if (u.team === 'enemy') enemies[u.id] = { defId: u.setup.defId, boss: u.setup.boss, elite: u.setup.elite };
  return {
    outcome: s.outcome ?? 'defeat', stage, events,
    units: s.units.filter((u) => u.team === 'ally').map((u) => ({ id: u.id, alive: u.alive, downed: u.downed, minLifelineFrac: u.minLifelineFrac })),
    enemies,
  };
}
