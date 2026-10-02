import { GridSim } from '../sim/grid/gridSim';
import { GridResult } from '../ui/grid/gridResult';
import { GridScreen } from '../ui/grid/gridScreen';
import { LoadingScreen } from '../ui/screens/loadingScreen';
import { UalLibrary } from '../view/grid/ualActor';
import { setWeaponKit, WeaponKit } from '../view/grid/weaponKit';
import { getGridEnv } from './envCache';
import { showFatal } from './fatal';
import type { Router } from './router';

const KEY = 'projr.grid.v1';
let ual: Promise<UalLibrary> | null = null;
let weaponsP: Promise<WeaponKit> | null = null;
const getWeapons = (): Promise<WeaponKit> => (weaponsP ??= WeaponKit.load(import.meta.env.BASE_URL).catch((e: unknown) => { weaponsP = null; throw e; }));
const getUal = (): Promise<UalLibrary> => (ual ??= UalLibrary.load(import.meta.env.BASE_URL).catch((e: unknown) => { ual = null; throw e; }));

function loadGold(): number {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { gold?: unknown } | null;
    return typeof v?.gold === 'number' ? v.gold : 0;
  } catch {
    return 0;
  }
}

function saveGold(gold: number): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ gold }));
  } catch {
    /* storage blocked: the total just isn't kept */
  }
}

/** Grid sortie prototype: title → sortie → result → again. */
export class GridFlow {
  constructor(private readonly router: Router, private readonly root: HTMLElement, private readonly toTitle: () => void) {}

  async start(seed: number): Promise<void> {
    this.router.go(new LoadingScreen());
    try {
      const [lib, env, weapons] = await Promise.all([getUal(), getGridEnv(), getWeapons()]);
      setWeaponKit(weapons);
      const sim = GridSim.create(seed);
      this.router.go(new GridScreen({ sim, lib, env, end: () => this.result(sim, seed), fatal: (e) => showFatal(this.root, e) }));
    } catch (e) {
      showFatal(this.root, e);
    }
  }

  private result(sim: GridSim, seed: number): void {
    const s = sim.s;
    const ok = s.outcome === 'extracted';
    const gold = loadGold() + (ok ? s.hero.value : 0);
    saveGold(gold);
    this.router.go(new GridResult({
      ok, value: ok ? s.hero.value : 0, loot: ok ? s.hero.loot : [], turns: Math.floor(s.time), gold,
      again: () => void this.start((seed * 7919 + 104729) % 999983 + 1), quit: () => this.toTitle(),
    }));
  }
}
