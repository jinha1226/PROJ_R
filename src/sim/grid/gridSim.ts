import { shipAct } from './ship';
import { newRunState, type RunOptions } from './runSetup';
import type { MetaState } from './meta';
import { recordDeath } from './deathRecap';
import { autoTarget, heroAct } from './actions';
import { noise, updateAwareness } from './danger';
import { nextFloor, settleKills, updateWanderers } from './run';
import { runUntilHero } from './clock';
import { hitChance } from './combat';
import { activeWeapon } from './gear';
import { WEAPONS, type GunGroup, type Weapon } from './items';
import { heroDmg, rechargeStaffs } from './weapons';
import { canRegenerate, regenerate } from './regen';
import { castSpell, passMarks } from './shotCombos';
import { discover } from './traps';
import { scatterLoot } from './consumables';
import { buffOn, clearBuff } from './buffs';
import { fire, has } from './engraveCore';
import { explodeBarrels, useThrown } from './explosives';
import { tickStatuses } from './status';
import { generateMap } from './mapgen';
import { newState, refreshSight } from './state';
import { DIRS, same, type Cell, type GAction, type GEvent, type GridState } from './types';

/** The grid sortie: one hero action at a time, the world catches up to the hero's next turn, events say what happened. */
const MOMENTUM = 0.5;
const HASTE = 0.5;
const CONFUSED_ASTRAY = 0.5;

export class GridSim {
  private constructor(readonly s: GridState) {}

  static create(seed: number, gun: GunGroup = 'pistol'): GridSim {
    const s = newState(generateMap(seed), seed, gun);
    s.floorItems.push(...scatterLoot(s));
    return new GridSim(s);
  }

  static createRun(seed: number, meta: MetaState, opts: RunOptions): GridSim {
    return new GridSim(newRunState(seed, meta, opts));
  }

  static fromState(s: GridState): GridSim {
    return new GridSim(s);
  }

  act(a: GAction): GEvent[] {
    const s = this.s;
    if (s.outcome) return [];
    if (s.mode === 'ship') return shipAct(s, a);
    s.events = [];
    s.fired = new Set();
    const t0 = s.hero.nextAt;
    const safeAtStart = canRegenerate(s);
    const fx = s.hero.fx;
    fx.free ??= false;
    const free = fx.free;
    fx.acted = null;
    const boosted = fx.momentum;
    fx.momentum = false;
    const alive = new Set(s.foes.filter((f) => f.alive).map((f) => f.id));
    // frozen: whatever was asked, the turn passes
    // a level-up pick is not a turn: it is made even while frozen
    const frozen = (s.hero.status?.freeze ?? 0) > 0 && a.kind !== 'choose' && a.kind !== 'upgrade';
    // confused: a step goes astray half the time
    const astray = a.kind === 'move' && buffOn(s.hero, 'confuse', t0) && s.rng.chance(CONFUSED_ASTRAY);
    if (astray) a = { kind: 'move', dir: s.rng.pick(DIRS), plain: true };
    let cost = frozen ? 1 : heroAct(s, a, { noise: (at, r) => noise(s, at, r), cast: (w, at) => this.cast(w, at), use: (u) => (u.item === 'potion' ? null : useThrown(s, t0, u.item, u.at)) });
    // a stumble into a wall still spends the turn (no free re-rolls of the confusion)
    if (cost === null && astray) { s.events.push({ t: t0, type: 'stumble', src: s.hero.id, to: { ...s.hero.pos } }); cost = 1; }
    if (cost === null) { fx.momentum = boosted; return [{ t: t0, type: 'blocked', src: s.hero.id }]; }
    // momentum halves the action after a kill (a free swap does not use it up)
    if (cost > 0 && buffOn(s.hero, 'haste', t0)) cost *= HASTE;
    // any attack or throw gives an invisible hero away
    if (fx.acted || (a.kind === 'use' && a.item !== 'potion') || a.kind === 'throwPotion') clearBuff(s.hero, 'invis');
    if (boosted && cost > 0) cost *= MOMENTUM;
    else if (boosted) fx.momentum = true;
    if (free && cost > 0) { cost = 0; fx.free = false; }
    if (cost > 0) discover(s, t0);
    if (fx.acted) fx.swapReady = true;
    if (fx.acted !== 'melee') fx.combo = { hits: 0 };
    if (fx.acted !== 'shot') fx.rapid = { n: 0 };
    passMarks(s, t0);
    if (s.foes.some((f) => alive.has(f.id) && !f.alive) && has(s, 'momentum') && fire(s, t0, 'momentum')) fx.momentum = true;
    const n = s.fired.size;
    if (n >= 3) {
      s.events.push({ t: t0, type: 'chain', src: s.hero.id, amount: n });
      if (has(s, 'flow') && fire(s, t0, 'flow')) fx.free = true;
    }
    // a free action (quick swap, a level-up pick) takes no time, so nothing ticks
    if (cost > 0) tickStatuses(s, s.hero, t0);
    s.hero.nextAt += cost;
    recordDeath(s);
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
    regenerate(s, cost, safeAtStart);
    runUntilHero(s);
    s.time = s.hero.nextAt;
    s.tiles = s.tiles.filter((x) => x.until > s.time);
    s.telegraphs = s.telegraphs.filter((x) => s.foes.some((f) => f.id === x.src && f.alive));
    recordDeath(s);
    settleKills(s, alive);
    // a core collected in the same action still counts: the run is won
    if (!s.hero.alive && s.outcome !== 'won') {
      s.outcome = 'dead';
      s.events.push({ t: s.time, type: 'dead', src: s.hero.id });
      return s.events;
    }
    if (s.outcome) return s.events;
    refreshSight(s);
    updateAwareness(s, false);
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
    return hitChance(this.s.map, this.s.hero.pos, f.pos, WEAPONS[w.group].hit, w.group === 'rifle' ? 0.5 : 1);
  }

  /** A staff spell at a cell; returns the time factor its engravings give the cast. */
  private cast(w: Weapon, at: Cell): number {
    const s = this.s;
    return castSpell(s, w, at, heroDmg(s, w), (c) => explodeBarrels(s, s.hero.nextAt, c, s.hero.id));
  }
}
