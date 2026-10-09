import { CATALOG } from '../delve/catalog';
import type { Tag } from '../party/buildTypes';
import type { TriggerDef } from '../party/triggers';

export type SfPart = 'gun' | 'suit';
/** A gun or suit module: the effect of a fantasy weapon or armour, carried over in SF form (opened by dismantling that item). */
export interface SfModule { id: string; part: SfPart; name: string; from: string; tags: Tag[]; triggers: TriggerDef[]; cost: { ore?: number; crystal?: number} }

/** the SF name of each fantasy item's effect */
const NAMES: Record<string, string> = {
  swordShield: '방호 장치', sword: '약점 분석탄', flameSword: '소이탄', bloodGreat: '톱날탄', greataxe: '산탄 확산기', stormAxe: '전격 산탄',
  mace: '충격탄', maceShield: '충격 방호기', daggers: '할로포인트탄', viper: '독침탄', viperPair: '이중 독침탄', longbow: '추적 표지탄',
  iceBow: '냉각 저격탄', crossbow: '철갑탄', staff: '전류탄', emberStaff: '소이 유탄', symbol: '흡수탄', pilgrimRelic: '의무 드론',
  cloth: '은폐막', leather: '완충재', ironPlate: '고정 장갑', hunterCloak: '광학 위장', frostRobe: '냉각 장갑', thornPlate: '반응 장갑',
  pilgrimRobe: '응급 주사기', graveRobe: '잔해 수집기',
};
/** deeper items cost more to build */
const COST: Record<number, SfModule['cost']> = { 1: { ore: 15 }, 2: { ore: 25, crystal: 3 }, 3: { ore: 35, crystal: 6 }, 4: { ore: 50, crystal: 10 } };

let table: SfModule[] | undefined;
/** Every module, built on first use (the catalogue's effects import combat code that imports this back). */
export function sfModules(): SfModule[] {
  return (table ??= Object.values(CATALOG).filter((d) => d.slot !== 'accessory' && d.family !== 'gun' && d.id !== 'agentSuit' && d.triggers.length > 0).map((d) => ({
    id: `sf-${d.id}`, part: d.slot === 'weapon' ? 'gun' : 'suit', name: NAMES[d.id] ?? d.name, from: d.id, tags: [...d.tags], triggers: d.triggers,
    cost: COST[Math.min(4, Math.max(1, d.floors[0]))]!,
  })));
}
export const sfModule = (id: string): SfModule | undefined => sfModules().find((m) => m.id === id);
