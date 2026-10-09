import { PACK_SIZE } from '../../sim/delve/gear';
import { itemName } from '../../sim/delve/items';
import type { Unit } from '../../sim/party/partyCore';
import type { RoamParty } from '../../sim/roam/roam';
import { icon } from '../grid/icons';
import { CLASS_TINT, classIcon } from './classIcons';
import { packItemHtml } from './pipGear';
import { soulStoneHtml } from './pipSouls';

const BAG_SLOTS = 16;
/** what the base counts, carried as things in the bag: its name, its line icon, what it is for */
const RESOURCE: Record<'ore' | 'crystal', [string, string, string]> = { ore: ['광석', 'bomb', '건물과 작업장'], crystal: ['마정석', 'charge', '함선 연료 · 개조'] };

/**
 * The bag: one grid of everything carried (what the base counts, soul stones, gear, consumables); the thing chosen
 * (`pick`: `ore`, `soul:2`, `item:<id>`) tells what it is under the grid. `u`: the clone gear is compared against;
 * `canImplant`: a fresh body stands ready to take a stone.
 */
export function bagHtml(p: RoamParty, u: Unit | undefined, pick: string, canImplant: boolean): string {
  const slot = (key: string, cls: string, inner: string, style = '') => `<button type="button" class="pip-slot ${cls}${pick === key ? ' on' : ''}" data-pick="${key}"${style ? ` style="${style}"` : ''}>${inner}</button>`;
  const res = (['ore', 'crystal'] as const).filter((k) => p[k] > 0).map((k) => slot(k, 'res', `${icon(RESOURCE[k][1])}<span>${RESOURCE[k][0]}</span><b>${p[k]}</b>`));
  const souls = p.carried.map((soul, i) => { const c = typeof soul === 'string' ? soul : soul.cls; return slot(`soul:${i}`, 'soul', `${classIcon(c)}<span>영혼석</span>`, `--tint:${CLASS_TINT[c]}`); });
  // gear lies one piece to a slot; consumables of a kind stack in one, with how many uses are left
  const stacks = new Map<string, { id: string; name: string; n: number }>();
  for (const it of p.pack) if (!('def' in it)) { const k = stacks.get(it.consumable); stacks.set(it.consumable, { id: k?.id ?? it.id, name: itemName(it), n: (k?.n ?? 0) + (it.charges ?? 1) }); }
  const pack = [...p.pack.filter((it) => 'def' in it).map((it) => slot(`item:${it.id}`, 'item', `<span>${itemName(it)}</span>`)),
    ...[...stacks.values()].map((k) => slot(`item:${k.id}`, 'item use', `<span>${k.name}</span><b>${k.n}</b>`))];
  const all = [...res, ...souls, ...pack];
  const grid = [...all, ...Array.from({ length: Math.max(0, BAG_SLOTS - all.length) }, () => '<div class="pip-slot"></div>')].join('');
  return `<section class="pip-bag"><div class="pip-grid">${grid}</div><div class="pip-pick">${pickedHtml(p, u, pick, canImplant)}</div><p class="pip-count">영혼석 ${souls.length} · 장비·소모품 ${p.pack.length}/${PACK_SIZE}</p></section>`;
}

/** what the thing chosen in the bag is, in full (nothing chosen, or it is gone: a hint) */
function pickedHtml(p: RoamParty, u: Unit | undefined, pick: string, canImplant: boolean): string {
  const [kind, id] = pick.split(':');
  if (kind === 'ore' || kind === 'crystal') return `<div class="pg-card"><div class="pg-head"><b>${RESOURCE[kind][0]}</b><small>${p[kind]}</small></div><div class="pg-stat">${RESOURCE[kind][2]}</div></div>`;
  if (kind === 'soul' && p.carried[Number(id)] !== undefined) return `${soulStoneHtml(p, Number(id))}${canImplant ? `<div class="pg-btns"><button type="button" data-soul="${id}">주입</button></div>` : ''}`;
  const it = kind === 'item' ? p.pack.find((x) => x.id === id) : undefined;
  return it ? packItemHtml(p, u, it) : '<p class="pg-none">칸을 눌러 살펴보기</p>';
}
