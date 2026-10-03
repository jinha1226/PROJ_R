import { autoTarget, heroAct } from './actions';
import { noise, updateAwareness } from './danger';
import { nextFloor, settleKills, updateWanderers } from './run';
import { runUntilHero } from './clock';
import { hitChance } from './combat';
import { activeWeapon, CLASS_BONUS, type ClassId } from './gear';
import { WEAPONS, type Weapon } from './items';
import { heroDmg, rechargeStaffs } from './weapons';
import { castSpell, passMarks } from './shotCombos';
import { fire, has } from './engraveCore';
import { explodeBarrels, useThrown } from './explosives';
import { tickStatuses } from './status';
import { generateMap } from './mapgen';
import { newState, refreshSight, weaponRack } from './state';
import { same, type Cell, type GAction, type GEvent, type GridState } from './types';

/** The grid sortie: one hero action at a time, the world catches up to the hero's next turn, events say what happened. */
const MOMENTUM = 0.5;

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
    s.fired = new Set();
    const t0 = s.hero.nextAt;
    const fx = s.hero.fx;
    fx.acted = null;
    const boosted = fx.momentum;
    fx.momentum = false;
    const alive = new Set(s.foes.filter((f) => f.alive).map((f) => f.id));
    // frozen: whatever was asked, the turn passes
    const frozen = (s.hero.status?.freeze ?? 0) > 0;
    let cost = frozen ? 1 : heroAct(s, a, { noise: (at, r) => noise(s, at, r), cast: (w, at) => this.cast(w, at), use: (u) => (u.item === 'potion' ? null : useThrown(s, t0, u.item, u.at)) });
    if (cost === null) { fx.momentum = boosted; return [{ t: t0, type: 'blocked', src: s.hero.id }]; }
    // momentum halves the action after a kill (a free swap does not use it up)
    if (boosted && cost > 0) cost *= MOMENTUM;
    else if (boosted) fx.momentum = true;
    if (fx.acted !== 'melee') fx.combo = { hits: 0 };
    if (fx.acted !== 'shot') fx.rapid = { n: 0 };
    passMarks(s, t0);
    if (s.foes.some((f) => alive.has(f.id) && !f.alive) && has(s, 'momentum') && fire(s, t0, 'momentum')) fx.momentum = true;
    tickStatuses(s, s.hero, t0);
    s.hero.nextAt += cost;
    settleKills(s, alive);
    if (s.outcome) { s.time = s.hero.nextAt; return s.events; }
    if (s.map.stairs && same(s.hero.pos, s.map.stairs) && s.hero.alive) {
      s.time = s.hero.nextAt;
      nextFloor(s);
      return s.events;
    }
    rechargeStaffs(s, cost);
    refreshSight(s);
    updateAwareness(s);
    runUntilHero(s);
    s.time = s.hero.nextAt;
    s.tiles = s.tiles.filter((x) => x.until > s.time);
    s.telegraphs = s.telegraphs.filter((x) => s.foes.some((f) => f.id === x.src && f.alive));
    settleKills(s, alive);
    // a champion felled in the same moment still counts: the run is won
    if (!s.hero.alive && s.outcome !== 'won') {
      s.outcome = 'dead';
      s.events.push({ t: s.time, type: 'dead', src: s.hero.id });
      return s.events;
    }
    if (s.outcome) return s.events;
    refreshSight(s);
    updateAwareness(s);
    updateWanderers(s);
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

  /** A staff spell at a cell; returns the time factor its engravings give the cast. */
  private cast(w: Weapon, at: Cell): number {
    const s = this.s;
    return castSpell(s, w, at, heroDmg(s, w), (c) => explodeBarrels(s, s.hero.nextAt, c, s.hero.id));
  }
}
