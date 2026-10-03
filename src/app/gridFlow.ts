import { GridSim } from '../sim/grid/gridSim';
import { GridResult } from '../ui/grid/gridResult';
import { GridScreen } from '../ui/grid/gridScreen';
import { ClassSelect } from '../ui/grid/classSelect';
import type { ClassId } from '../sim/grid/gear';
import { LoadingScreen } from '../ui/screens/loadingScreen';
import { DungeonKit } from '../view/grid/dungeonKit';
import { UalLibrary } from '../view/grid/ualActor';
import { setWeaponKit, WeaponKit } from '../view/grid/weaponKit';
import { showFatal } from './fatal';
import type { Router } from './router';

const KEY = 'projr.grid.v1';
let ual: Promise<UalLibrary> | null = null;
let dungeonP: Promise<DungeonKit> | null = null;
const getDungeon = (): Promise<DungeonKit> => (dungeonP ??= DungeonKit.load(import.meta.env.BASE_URL).catch((e: unknown) => { dungeonP = null; throw e; }));
let weaponsP: Promise<WeaponKit> | null = null;
const getWeapons = (): Promise<WeaponKit> => (weaponsP ??= WeaponKit.load(import.meta.env.BASE_URL).catch((e: unknown) => { weaponsP = null; throw e; }));
const getUal = (): Promise<UalLibrary> => (ual ??= UalLibrary.load(import.meta.env.BASE_URL).catch((e: unknown) => { ual = null; throw e; }));

interface Record { best: number; wins: number }

function loadRecord(): Record {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Record> | null;
    return { best: typeof v?.best === 'number' ? v.best : 0, wins: typeof v?.wins === 'number' ? v.wins : 0 };
  } catch {
    return { best: 0, wins: 0 };
  }
}

function saveRecord(r: Record): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(r));
  } catch {
    /* storage blocked: the record just isn't kept */
  }
}

/** Grid dungeon: title → three floors → result → again. */
export class GridFlow {
  constructor(private readonly router: Router, private readonly root: HTMLElement, private readonly toTitle: () => void) {}

  start(seed: number): void {
    this.router.go(new ClassSelect((cls) => void this.launch(seed, cls), () => this.toTitle()));
  }

  private async launch(seed: number, cls: ClassId): Promise<void> {
    this.router.go(new LoadingScreen());
    try {
      const [lib, kit, weapons] = await Promise.all([getUal(), getDungeon(), getWeapons()]);
      setWeaponKit(weapons);
      const sim = GridSim.create(seed, cls);
      this.router.go(new GridScreen({ sim, lib, kit, end: () => this.result(sim, seed), fatal: (e) => showFatal(this.root, e) }));
    } catch (e) {
      showFatal(this.root, e);
    }
  }

  private result(sim: GridSim, seed: number): void {
    const s = sim.s;
    const won = s.outcome === 'won';
    const before = loadRecord();
    const rec = { best: Math.max(before.best, s.run.floor), wins: before.wins + (won ? 1 : 0) };
    saveRecord(rec);
    this.router.go(new GridResult({
      won, floor: s.run.floor, kills: s.run.kills, level: s.hero.level, turns: Math.floor(s.time), best: rec.best, wins: rec.wins,
      again: () => this.start((seed * 7919 + 104729) % 999983 + 1), quit: () => this.toTitle(),
    }));
  }
}
