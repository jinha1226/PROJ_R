import { newDelve, type DelveParty } from '../../sim/delve/delveSim';
import { BRANCHES } from '../../sim/party/branches';
import { entOf } from '../../sim/party/partyCore';
import type { BaseClass } from '../../sim/party/partyDefs';
import { gainXp, LEVEL_XP } from '../../sim/party/partyLevel';
import { TRAITS } from '../../sim/party/traitDefs';
import { clones, implant } from '../../sim/roam/roam';
import { packHorde } from './chainArena';

/**
 * `?demo=branch&b=<branch>`: one body built for a branch — every card of it at its top rank, level 8 — set against a packed
 * horde, to watch the branch's chain run (and plan its effects). A line without branches gets all of its line's cards.
 */
export function branchArena(seed: number, key: string): DelveParty {
  const p = newDelve(seed, 3), u = clones(p)[0]!;
  const branch = BRANCHES.find((b) => b.id === key), line = branch?.line ?? key;
  if (line !== 'shell') implant(p, u, line as BaseClass, []);
  u.level = 1; u.xp = 0; gainXp(p, u, LEVEL_XP[7]!, []);
  const cards = Object.values(TRAITS).filter((d) => (branch ? d.branch === branch.id : d.pool === line));
  u.traits = Object.fromEntries(cards.map((d) => [d.id, d.ranks]));
  u.picks = 0; u.offer = undefined;
  const e = entOf(p, u.id)!; e.hp = e.maxHp;
  packHorde(p);
  return p;
}

/** The branches to choose from, by line (lines without branches listed whole). */
export function branchMenuHtml(): string {
  const lines = ['shell', 'warrior', 'mage', 'archer', 'cleric', 'rogue', 'necromancer'];
  const name: Record<string, string> = { shell: '빈 몸', warrior: '전사', mage: '마법사', archer: '궁수', cleric: '성직자', rogue: '도적', necromancer: '강령술사' };
  return `<div class="branch-menu"><h2>갈래 데모</h2>${lines.map((l) => {
    const bs = BRANCHES.filter((b) => b.line === l && Object.values(TRAITS).some((d) => d.branch === b.id));
    const links = bs.length ? bs.map((b) => `<a href="?demo=branch&b=${b.id}">${b.name}</a>`).join('') : Object.values(TRAITS).some((d) => d.pool === l) ? `<a href="?demo=branch&b=${l}">카드 전체</a>` : '<span>준비 중</span>';
    return `<div class="branch-line"><b>${name[l]}</b>${links}</div>`;
  }).join('')}</div>`;
}
