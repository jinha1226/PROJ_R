import type { WeaponGroup } from '../../sim/grid/items';

/** Small line icons (24×24, stroke = currentColor) for the grid HUD. */
const P: Record<string, string> = {
  sword: 'M14.5 3.5 20.5 3.5 20.5 9.5 9 21 6 21 6 18Z M5 15 9 19 M3.5 20.5 6 18',
  dagger: 'M16 4 20 4 20 8 11 17 8 17 8 14Z M6 13 11 18 M4 20 7 17',
  axe: 'M6 21 15 9 M12 4c4 0 8 4 8 8-3 0-5-1-6.5-2.5S11 7 12 4Z',
  spear: 'M4 20 17 7 M15 4 20 4 20 9 17 7Z',
  mace: 'M5 20 13 12 M16 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z M16 2v2 M22 8h-2 M16 14v-2',
  bow: 'M6 3c7 2 11 8 9 18 M6 3 15 21 M4 12h14 M15 9l3 3-3 3',
  crossbow: 'M4 12h16 M12 5v14 M5 6c4 2 10 2 14 0 M16 9l4 3-4 3',
  throwing: 'M5 19 15 9 M13 5h6v6 M4 10l3 3 M10 4l3 3',
  staff: 'M7 21 15 9 M17 3a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z M12 6l-2-2 M20 11l2 2',
  potion: 'M9 3h6 M10 3v5l-4 7a4 4 0 0 0 3.5 6h5A4 4 0 0 0 18 15l-4-7V3 M7.5 14h9',
  bag: 'M6 8h12l1 12H5Z M9 8V6a3 3 0 0 1 6 0v2',
  swap: 'M4 8h13l-3-3 M20 16H7l3 3',
  wait: 'M7 3h10 M7 21h10 M8 3c0 5 8 5 8 9s-8 4-8 9 M16 3c0 5-8 5-8 9',
  arrow: 'M4 20 17 7 M13 6h5v5 M4 17l3 3 M7 14l3 3',
  heart: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10Z',
  hourglass: 'M7 3h10 M7 21h10 M8 3c0 6 8 6 8 9s-8 3-8 9 M16 3c0 6-8 6-8 9',
  skull: 'M12 3a7 7 0 0 0-4 12.7V19h8v-3.3A7 7 0 0 0 12 3Z M9.5 11h.01 M14.5 11h.01 M10 19v2 M14 19v2',
  prev: 'M15 5l-7 7 7 7',
  next: 'M9 5l7 7-7 7',
};

export function icon(name: string, cls = ''): string {
  return `<svg class="gi ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${P[name] ?? ''}"/></svg>`;
}

export const weaponIcon = (g: WeaponGroup | undefined): string => icon(g ?? 'sword');
