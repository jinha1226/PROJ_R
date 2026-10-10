import { newDelve, type DelveParty } from '../../sim/delve/delveSim';
import { BRANCHES } from '../../sim/party/branches';
import { entOf } from '../../sim/party/partyCore';
import { CLASSES, type BaseClass, type ClassId } from '../../sim/party/partyDefs';
import { gainXp, LEVEL_XP } from '../../sim/party/partyLevel';
import { TRAITS } from '../../sim/party/traitDefs';
import { clones, implant } from '../../sim/roam/roam';
import { packHorde } from './chainArena';

/**
 * `?demo=branch&b=<branch>`: one body built for a branch — every card of it at its top rank, level 8 — set against a packed
 * horde, to watch the branch's chain run (and plan its effects). A line without branches gets all of its line's cards.
 * `&hand`: the same body as a run would have it a few floors in (level 5, each card once) on an ordinary floor, played by hand.
 */
export function branchArena(seed: number, key: string, hand = false): DelveParty {
  const p = newDelve(seed, 3), u = clones(p)[0]!;
  const branch = BRANCHES.find((b) => b.id === key), line = branch?.line ?? key;
  if (line !== 'shell') implant(p, u, line as BaseClass, []);
  u.level = 1; u.xp = 0; gainXp(p, u, LEVEL_XP[hand ? 4 : 7]!, []);
  const cards = Object.values(TRAITS).filter((d) => (branch ? d.branch === branch.id : d.pool === line));
  u.traits = Object.fromEntries(cards.map((d) => [d.id, hand ? 1 : d.ranks]));
  u.picks = 0; u.offer = undefined;
  const e = entOf(p, u.id)!; e.hp = e.maxHp;
  if (!hand) packHorde(p);
  return p;
}

/** the switches the menu's links carry on (so a hand run keeps its look and its keys) */
const HAND = typeof location === 'undefined' ? '' : ['hand', 'hd', 'dark', 'dpad'].filter((k) => new URLSearchParams(location.search).has(k)).map((k) => `&${k}`).join('');
/** The branches to choose from, by class: seven lines of three. */
export function branchMenuHtml(): string {
  const lines = ['shell', 'warrior', 'mage', 'archer', 'cleric', 'rogue', 'necromancer'];
  return `<div class="branch-menu"><h2>갈래 데모</h2>${lines.map((l) => {
    const links = BRANCHES.filter((b) => b.line === l).map((b) => `<a href="?demo=branch&b=${b.id}${HAND}">${b.name}</a>`).join('');
    return `<div class="branch-line"><b>${CLASSES[l as ClassId].name}</b>${links}</div>`;
  }).join('')}</div>`;
}
