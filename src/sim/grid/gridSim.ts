import { autoTarget, heroAct } from './actions';
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
    // foes hearing shots arrive with the AI task
    const cost = heroAct(s, a, () => undefined);
    if (cost === null) return [{ t: s.hero.nextAt, type: 'blocked', src: s.hero.id }];
    s.hero.nextAt += cost;
    runUntilHero(s);
    s.time = s.hero.nextAt;
    refreshSight(s);
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
