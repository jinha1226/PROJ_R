import { DungeonKit } from '../view/grid/dungeonKit';
import { ShipKit } from '../view/grid/shipKit';
import { UalLibrary } from '../view/grid/ualActor';
import { WeaponKit } from '../view/grid/weaponKit';

/** One shared load per asset set (retried after a failure), so the title can start loading what the ship and the run need. */
const once = <T>(load: () => Promise<T>) => {
  let p: Promise<T> | null = null;
  return (): Promise<T> => (p ??= load().catch((e: unknown) => { p = null; throw e; }));
};
const base = (): string => import.meta.env.BASE_URL;
export const getUal = once(() => UalLibrary.load(base()));
export const getDungeon = once(() => DungeonKit.load(base()));
export const getWeapons = once(() => WeaponKit.load(base()));
export const getShip = once(() => ShipKit.load(base()));

/** The asset sets in loading order, each with a short boot-log name. */
export const GRID_ASSETS: { id: string; name: string; load: () => Promise<unknown> }[] = [
  { id: 'ship', name: '선체 도면', load: getShip },
  { id: 'ual', name: '요원 골격', load: getUal },
  { id: 'weapons', name: '무장', load: getWeapons },
  { id: 'dungeon', name: '하층 측량', load: getDungeon },
];
