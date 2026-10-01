import { GEAR, STARTER_KIT } from './gear';
import { GOODS } from './goods';
import type { XItemDef } from './types';

export * from './types';
export { STARTER_KIT };

export const X_ITEMS: Record<string, XItemDef> = Object.fromEntries([...GEAR, ...GOODS].map((i) => [i.id, i]));

export function xitem(id: string): XItemDef {
  const i = X_ITEMS[id];
  if (!i) throw new Error(`unknown extraction item: ${id}`);
  return i;
}
