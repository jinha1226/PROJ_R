import { getItem } from '../../data/items';
import type { ItemDef, Stats } from '../../data/types';
import type { ChronicleEntry, Mercenary, Roster } from '../../sim/roster/types';
import { t } from '../i18n/ko';

export const displayName = (m: Mercenary): string => (m.title ? `${m.name} '${t(`title.${m.title}`)}'` : m.name);

const nameOf = (r: Roster, id: string): string => {
  const m = r.mercs.find((x) => x.id === id) ?? r.memorial.find((x) => x.id === id);
  return m ? m.name : id;
};

/** Chronicle line with ids and keys translated. */
export function chronicleText(e: ChronicleEntry, r: Roster): string {
  const v: Record<string, string | number> = { ...e.vars };
  if (typeof v.who === 'string') v.who = nameOf(r, v.who);
  if (typeof v.by === 'string') v.by = nameOf(r, v.by);
  if (typeof v.enemy === 'string') v.enemy = t(`enemy.${v.enemy}`);
  if (typeof v.title === 'string') v.title = t(`title.${v.title}`);
  if (typeof v.scar === 'string') v.scar = t(`scar.${v.scar}`);
  if (typeof v.trait === 'string') v.trait = t(`trait.${v.trait}`);
  if (typeof v.class === 'string') v.class = t(`class.${v.class}`);
  if (typeof v.rank === 'string') v.rank = t(`rank.${v.rank}`);
  return t(`chronicle.${e.key}`, v);
}

const STAT_LABEL: Partial<Record<keyof Stats, string>> = {
  maxHp: '체력', atk: '공격', def: '방어', atkSpeed: '공속', moveSpeed: '이동', dodge: '회피', crit: '치명', range: '사거리',
};

export function statLine(stats: Partial<Stats>): string {
  return (Object.entries(stats) as [keyof Stats, number][])
    .map(([k, v]) => `${STAT_LABEL[k] ?? k} +${k === 'dodge' || k === 'crit' ? `${Math.round(v * 100)}%` : v}`)
    .join(', ');
}

export function itemLabel(id: string): { name: string; tier: number; detail: string; item: ItemDef } {
  const item = getItem(id);
  const unique = item.unique ? ` · ${t(`unique.${item.unique}`)}` : '';
  return { name: t(`item.${id}`), tier: item.tier, detail: `${statLine(item.stats)}${unique}`, item };
}

export const growthGrade = (g: number): string => (g >= 1.07 ? 'A' : g >= 0.95 ? 'B' : 'C');
