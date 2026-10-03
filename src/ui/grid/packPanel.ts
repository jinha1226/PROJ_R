import { isKnown, potionKey, potionName, POTIONS, scrollKey, scrollName, SCROLLS } from '../../sim/grid/lore';
import type { GridState } from '../../sim/grid/types';

export interface PackRow { kind: 'potion' | 'scroll'; id: string; name: string; n: number; known: boolean }

const esc = (v: unknown): string => String(v).replace(/[&"<>]/g, (c) => `&#${c.charCodeAt(0)};`);

/** Potions and scrolls the hero carries, named by colour/rune until learned. */
export function packRows(s: GridState): PackRow[] {
  const g = s.hero.gear;
  return [
    ...POTIONS.filter((k) => (g.potions[k] ?? 0) > 0).map((k) => ({ kind: 'potion' as const, id: k, name: potionName(s, k), n: g.potions[k]!, known: isKnown(s, potionKey(k)) })),
    ...SCROLLS.filter((k) => (g.scrolls[k] ?? 0) > 0).map((k) => ({ kind: 'scroll' as const, id: k, name: scrollName(s, k), n: g.scrolls[k]!, known: isKnown(s, scrollKey(k)) })),
  ];
}

/** The bag's potions-and-scrolls section: drink or throw a potion, read a scroll (each a turn). */
export function packHtml(s: GridState): string {
  const rows = packRows(s);
  if (!rows.length) return '<div class="gpack"><h4>물약 · 주문서</h4><p class="muted">없음</p></div>';
  return `<div class="gpack"><h4>물약 · 주문서</h4>${rows.map((r) => `<div class="gpack-row" data-testid="grid-pack-${r.kind}-${r.id}">
    <b>${esc(r.name)}${r.known ? '' : ' <i>?</i>'}</b><small>×${r.n}</small>
    ${r.kind === 'potion'
    ? `<button class="btn" data-do="drink" data-k="${r.id}" data-testid="grid-drink-${r.id}">마시기</button><button class="btn" data-do="throw" data-k="${r.id}">던지기</button>`
    : `<button class="btn" data-do="read" data-k="${r.id}" data-testid="grid-read-${r.id}">읽기</button>`}</div>`).join('')}</div>`;
}
