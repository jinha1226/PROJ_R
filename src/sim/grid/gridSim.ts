import { autoTarget, heroAct } from './actions';
import { noise, updateAwareness, updateDanger, updateExtraction } from './danger';
import { runUntilHero } from './clock';
import { hitChance } from './combat';
import { generateMap } from './mapgen';
import { newState, refreshSight } from './state';
import { HERO, type GAction, type GEvent, type GridState } from './types';

/** The grid sortie: one hero action at a time, the world catches up to the hero's next turn, events say what happened. */
export class GridSim {
  private constructor(readonly s: GridState) {}

  static create(seed: number): GridSim {
    return new GridSim(newState(generateMap(seed), seed));
  }

  static fromState(s: GridState): GridSim {
    return new GridSim(s);
  }

  act(a: GAction): GEvent[] {
    const s = this.s;
    if (s.outcome) return [];
    s.events = [];
    const cost = heroAct(s, a, (at, r) => noise(s, at, r));
    if (cost === null) return [{ t: s.hero.nextAt, type: 'blocked', src: s.hero.id }];
    s.hero.nextAt += cost;
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
    return f ? hitChance(this.s.map, this.s.hero.pos, f.pos, HERO.boltHit) : null;
  }
}
