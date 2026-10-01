import { reportFromBattle } from '../sim/roster/aftermath';
import { pickEvent } from '../sim/run/events';
import { beginBattle, chooseEvent } from '../sim/run/savePoints';
import type { RunState, Slot } from '../sim/run/types';
import { eventSpot, leaveExploration, markDone, moveTo, openChest, stageOf, useCampfire } from '../sim/explore/progress';
import { roomBattleSetup } from '../sim/explore/roomBattle';
import { settleRoomBattle } from '../sim/explore/roomResult';
import { ExploreScreen } from '../ui/explore/exploreScreen';
import { AftermathScreen } from '../ui/screens/aftermathScreen';
import { BattleScreen } from '../ui/screens/battleScreen';
import { EventScreen } from '../ui/run/eventScreen';
import { PrepScreen } from '../ui/run/prepScreen';
import { getAssets } from './assetCache';
import { getEnv } from './envCache';
import type { Router } from './router';

export interface ExploreHost {
  router: Router;
  run(): RunState;
  set(run: RunState): void;
  rosterApi(): { equip(m: string, i: string): void; unequip(m: string, s: 'weapon' | 'armor' | 'trinket'): void; setTactic(m: string, s: number, t: never): void };
  /** exploration over (report phase or run ended) */
  done(): void;
  fatal(e: unknown): void;
}

/** Exploration: walk the map, fight in rooms, open chests, and come back with a report. */
export class ExploreFlow {
  private screen: ExploreScreen | null = null;

  constructor(private readonly h: ExploreHost) {}

  async show(): Promise<void> {
    const run = this.h.run();
    if (!run.exploration) return this.h.done();
    try {
      const [lib, env] = await Promise.all([getAssets(), getEnv(run.exploration.theme)]);
      this.screen = new ExploreScreen({
        run: () => this.h.run(), lib, env, fatal: (e) => this.h.fatal(e),
        enterRoom: (id) => this.enter(id),
        interact: (type) => this.interact(type),
        leave: () => { this.h.set(leaveExploration(this.h.run())); this.h.done(); },
      });
      this.h.router.go(this.screen);
      // reloaded while standing in an uncleared fight room: the encounter resumes
      const here = run.exploration.rooms[run.exploration.at]!;
      if ((here.type === 'battle' || here.type === 'elite') && !here.done) queueMicrotask(() => this.prep(here.id));
    } catch (e) {
      this.h.fatal(e);
    }
  }

  private enter(roomId: string): boolean {
    const run = this.h.run();
    const e = moveTo(run.exploration!, roomId);
    this.h.set({ ...run, exploration: e });
    const room = e.rooms[roomId]!;
    if ((room.type === 'battle' || room.type === 'elite') && !room.done) queueMicrotask(() => this.prep(roomId));
    else this.screen?.refresh();
    return true;
  }

  private interact(type: string): void {
    const run = this.h.run();
    if (type === 'chest') this.h.set(openChest(run));
    else if (type === 'campfire') this.h.set(useCampfire(run));
    else if (type === 'exit') { this.h.set(leaveExploration(run)); return this.h.done(); }
    else if (type === 'event') return this.event();
    this.screen?.refresh();
  }

  private event(): void {
    const run = this.h.run();
    const roomId = run.exploration!.at;
    const view = run.pending?.event ?? pickEvent(run, eventSpot(run));
    this.h.set({ ...run, pending: { event: view } });
    this.h.router.go(new EventScreen({
      view,
      choose: (id) => { const r = chooseEvent(this.h.run(), view, id); this.h.set(markDone(r.run, roomId)); return r; },
      done: () => void this.show(),
    }));
  }

  private prep(roomId: string): void {
    const run = this.h.run();
    const e = run.exploration!;
    const room = e.rooms[roomId]!;
    const formation: Record<string, Slot> = Object.fromEntries(e.party.filter((id) => run.formation[id]).map((id) => [id, run.formation[id]!]));
    this.h.router.go(new PrepScreen({
      ...this.h.rosterApi(), run: () => this.h.run(), only: e.party,
      enemies: (room.enemies ?? []).map((x) => ({ enemyId: x.enemyId })),
      title: room.type === 'elite' ? '정예 무리와 마주쳤다!' : '적과 마주쳤다!',
      start: (f) => void this.fight(roomId, f),
    }, formation));
  }

  private async fight(roomId: string, formation: Record<string, Slot>): Promise<void> {
    try {
      this.h.set(beginBattle(this.h.run(), { ...this.h.run().formation, ...formation }));
      const run = this.h.run();
      const e = run.exploration!;
      const room = e.rooms[roomId]!;
      const [lib, env] = await Promise.all([getAssets(), getEnv(e.theme)]);
      const setup = roomBattleSetup(run, roomId, formation);
      const deployed = setup.allies.map((u) => u.id);
      this.h.router.go(new BattleScreen(setup, lib, {
        retry: () => undefined, back: () => undefined, fatal: (err) => this.h.fatal(err),
        onContinue: (state, events) => this.after(roomId, deployed, reportFromBattle(state, events, stageOf(e, room))),
      }, { theme: e.theme, room, env }));
    } catch (err) {
      this.h.fatal(err);
    }
  }

  private after(roomId: string, deployed: string[], report: ReturnType<typeof reportFromBattle>): void {
    const before = this.h.run();
    const { run, out } = settleRoomBattle(before, roomId, deployed, report);
    this.h.set(run);
    const next = () => (run.status !== 'active' || run.phase === 'report' ? this.h.done() : void this.show());
    this.h.router.go(new AftermathScreen({ ...out.aftermath, roster: run.roster, loot: out.reward.items }, before.roster, next));
  }
}
