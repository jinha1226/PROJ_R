import { autoTarget, heroAct } from './actions';
import { noise, updateAwareness, updateDanger, updateExtraction } from './danger';
import { runUntilHero } from './clock';
import { hitChance, strike } from './combat';
import { activeWeapon, CLASS_BONUS, type ClassId } from './gear';
import { WEAPONS, type Weapon } from './items';
import { heroDmg, rechargeStaffs } from './weapons';
import { generateMap } from './mapgen';
import { newState, refreshSight, weaponRack } from './state';
import { same, type Cell, type GAction, type GEvent, type GridState } from './types';

/** The grid sortie: one hero action at a time, the world catches up to the hero's next turn, events say what happened. */
export class GridSim {
  private constructor(readonly s: GridState) {}

  static create(seed: number, cls: ClassId = 'warrior'): GridSim {
    const s = newState(generateMap(seed), seed, cls);
    s.floorItems = weaponRack(s);
    return new GridSim(s);
  }

  static fromState(s: GridState): GridSim {
    return new GridSim(s);
  }

  act(a: GAction): GEvent[] {
    const s = this.s;
    if (s.outcome) return [];
    s.events = [];
    const cost = heroAct(s, a, { noise: (at, r) => noise(s, at, r), cast: (w, at) => this.cast(w, at), use: () => null });
    if (cost === null) return [{ t: s.hero.nextAt, type: 'blocked', src: s.hero.id }];
    s.hero.nextAt += cost;
    rechargeStaffs(s, cost);
    refreshSight(s);
    updateAwareness(s);
    runUntilHero(s);
    s.time = s.hero.nextAt;
    if (!s.hero.alive) {
      s.outcome = 'dead';
      s.hero.value = 0;
      s.hero.loot = [];
      s.events.push({ t: s.time, type: 'dead', src: s.hero.id });
      return s.events;
    }
    refreshSight(s);
    updateAwareness(s);
    updateExtraction(s, cost);
    if (!s.outcome) updateDanger(s);
    return s.events;
  }

  autoTarget(): string | undefined {
    return autoTarget(this.s);
  }

  /** Hit chance against a foe if it can be shot now, else null. */
  shotChance(id: string): number | null {
    const f = this.s.foes.find((x) => x.id === id && x.alive);
    const w = activeWeapon(this.s.hero.gear);
    if (!f || !w || WEAPONS[w.group].melee) return null;
    return hitChance(this.s.map, this.s.hero.pos, f.pos, WEAPONS[w.group].hit + CLASS_BONUS[this.s.hero.gear.cls].rangedHit);
  }

  /** A staff spell at a cell (elements arrive with the status task: for now a plain hit on whoever stands there). */
  private cast(w: Weapon, at: Cell): void {
    const s = this.s;
    const f = s.foes.find((x) => x.alive && same(x.pos, at));
    if (f) strike(s, s.hero.nextAt, s.hero, f, hitChance(s.map, s.hero.pos, at, WEAPONS.staff.hit), heroDmg(s, w));
  }
}
