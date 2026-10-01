import { advanceActions, tickCooldowns } from '../battle/actions';
import { decide } from '../battle/ai/decide';
import { segmentBlocked } from '../battle/geometry';
import { updateEngagement } from '../battle/engagement';
import { moveUnits } from '../battle/movement';
import { updateProjectiles } from '../battle/projectiles';
import { runReactors } from '../battle/reactors';
import { updateRules } from '../battle/rules';
import { makeSnapshot } from '../battle/snapshot';
import { tickTags } from '../battle/tags';
import { updateTelegraphs } from '../battle/telegraphs';
import type { Snapshot } from '../battle/types';
import type { Loadout } from '../extract/loadout';
import type { Region } from '../extract/regionTypes';
import type { Mercenary } from '../roster/types';
import type { GearSlot } from '../../data/extract';
import { updateActivation } from './activation';
import { phaseOf, updateClock } from './clock';
import { onHeroDamage, updateChannel, updateHazards, updateRegen } from './extraction';
import { alertOnHit, applyHeroInput, type HeroInput } from './heroControl';
import { dropBody, interact, lootDrop, lootTake, nearby, startEquip, toPouch, toQuick, unequip, type Nearby } from './interact';
import { updatePatrol, walkTo } from './patrol';
import { updatePerception } from './perception';
import type { WorldState } from './types';
import { createWorld, emitW, heroUnit } from './worldState';

export { idleInput, type HeroInput } from './heroControl';

const XP_PER_KILL = (stage: number) => 6 * stage + 4;

/** One sortie, stepped at 20 ticks per second from player input. */
export class WorldSim {
  readonly w: WorldState;

  constructor(region: Region, hero: Mercenary, loadout: Loadout, seed: number) {
    this.w = createWorld(region, hero, loadout, seed);
  }

  step(input: HeroInput): void {
    const w = this.w;
    if (w.outcome) return;
    const b = w.b;
    b.events = [];
    applyHeroInput(w, input);
    if (input.interact && !w.hero.channel) interact(w);
    updateRules(b);
    tickTags(b);
    tickCooldowns(b);
    updateActivation(w);
    updatePerception(w, phaseOf(b.tick) !== 'day' && phaseOf(b.tick) !== 'dusk');
    updatePatrol(w);
    decide(b);
    this.chaseAroundWalls();
    advanceActions(b);
    updateTelegraphs(b);
    updateProjectiles(b);
    moveUnits(b);
    updateEngagement(b);
    runReactors(b);
    alertOnHit(w);
    this.bodies();
    updateHazards(w);
    onHeroDamage(w);
    updateRegen(w);
    updateChannel(w);
    updateClock(w);
    const h = heroUnit(w);
    if (!w.outcome && (!h.alive || h.downed)) {
      w.outcome = 'downed';
      emitW(w, 'downed_end');
    }
    b.tick++;
  }

  /** Alert enemies whose line to their target is blocked follow the nav grid instead of walking into the wall. */
  private chaseAroundWalls(): void {
    const w = this.w;
    for (const u of w.b.units) {
      if (u.team !== 'enemy' || u.dormant || !u.alive || u.downed || u.action || w.ai[u.id]?.mode !== 'alert') continue;
      const t = w.b.units.find((x) => x.id === u.intent?.targetId);
      if (!t || (u.vel.x === 0 && u.vel.y === 0) || !segmentBlocked(w.b, u.pos, t.pos)) continue;
      walkTo(w, u, w.ai[u.id]!, t.pos, 1);
    }
  }

  private bodies(): void {
    const w = this.w;
    for (const e of w.b.events) {
      if (e.type !== 'died' || !e.dst) continue;
      const u = w.b.units.find((x) => x.id === e.dst);
      if (!u || u.team !== 'enemy') continue;
      dropBody(w, u.setup.defId, u.id, u.setup.level, u.pos);
      w.xp += XP_PER_KILL(u.setup.level);
    }
  }

  /** The clock alone (tests and fast-forward previews). */
  clockOnly(): void {
    updateClock(this.w);
  }

  nearby(): Nearby { return nearby(this.w); }
  lootTake(id: string, index: number): boolean { return lootTake(this.w, id, index); }
  lootDrop(where: 'bag' | 'quick', index: number): void { lootDrop(this.w, where, index); }
  equip(index: number): void { startEquip(this.w, index); }
  unequip(slot: GearSlot): void { unequip(this.w, slot); }
  toQuick(bagIndex: number, quickIndex: number): void { toQuick(this.w, bagIndex, quickIndex); }
  toPouch(bagIndex: number): void { toPouch(this.w, bagIndex); }

  /** Units within `radius` of the hero (the view only draws what is near). */
  snapshot(radius: number): Snapshot {
    const s = makeSnapshot(this.w.b);
    const h = heroUnit(this.w).pos;
    const near = (x: number, y: number) => Math.hypot(x - h.x, y - h.y) <= radius;
    return { ...s, units: s.units.filter((u) => u.id === this.w.heroId || near(u.x, u.y)), projectiles: s.projectiles.filter((p) => near(p.x, p.y)) };
  }
}
