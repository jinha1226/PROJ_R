import { HERO_SOULS } from '../../sim/delve/heroSouls';
import { MEMORIES } from '../../sim/party/memories';
import { CLASSES } from '../../sim/party/partyDefs';
import { TRAITS } from '../../sim/party/traitDefs';
import type { RoamParty } from '../../sim/roam/roam';
import { CLASS_TINT, classIcon } from './classIcons';

/** The soul-stone tab: every stone held — class, the memory it carries (its base trait), a hero's name, level and cards; `???` while unidentified. */
export function soulListHtml(p: RoamParty, below: boolean): string {
  const rows = p.carried.map((_c, i) => soulStoneHtml(p, i));
  return `<section class="pip-souls"><h3>영혼석 <small>${p.carried.length}${below ? ' · 미전송' : ''}</small></h3>${rows.join('') || '<p class="dim">없음</p>'}</section>`;
}

/** One stone held, in full (the soul-stone tab's row, and the bag's line for a stone picked there). */
export function soulStoneHtml(p: RoamParty, i: number): string {
  const c = p.carried[i];
  if (c === undefined) return '';
  const s = typeof c === 'string' ? { cls: c } : c, unknown = 'unknown' in s && s.unknown;
  const hero = 'hero' in s && s.hero ? HERO_SOULS[s.hero] : undefined, mem = 'memory' in s && s.memory ? MEMORIES[s.memory] : undefined;
  const title = hero ? (unknown ? '미감정 영웅 영혼석' : `${hero.name} <em>레벨 ${hero.level}</em>`) : `${CLASSES[s.cls].name}의 영혼`;
  const memory = unknown ? '<span>기억</span><small>???</small>' : mem ? `<span>${mem.name}</span><small>${mem.text}</small>` : '<span class="dim">기억 없음</span>';
  const cards = hero && !unknown ? `<p class="pip-stone-cards">${Object.keys(hero.traits).map((id) => TRAITS[id]?.name ?? id).join(' · ')}</p>` : '';
  return `<div class="pip-stone" data-stone="${i}" style="--tint:${CLASS_TINT[s.cls]}">${classIcon(s.cls)}<b>${title}</b><div class="pip-stone-mem">${memory}</div>${cards}</div>`;
}
