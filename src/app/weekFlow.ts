import { reportFromBattle } from '../sim/roster/aftermath';
import { equip, unequip } from '../sim/roster/equipment';
import { autoFormation } from '../sim/roster/formation';
import { applyOfferToRoster, levelOffers, settleEmptyLevelUps } from '../sim/roster/offers';
import { setTactic } from '../sim/roster/tactics';
import { finishBattle } from '../sim/run/battleNode';
import { abandonBattle, beginBattle, chooseEvent, resumeTarget } from '../sim/run/savePoints';
import { leaveExploration, chooseExplore } from '../sim/explore/progress';
import { buy, healOne, sell } from '../sim/run/shop';
import type { RunState, Slot } from '../sim/run/types';
import { BOSS_ROOM, bossBattleSetup } from '../sim/week/boss';
import { endWeek, newRunV2, recruitVisitor, restWeek, skipStart, trainWeek } from '../sim/week/week';
import { nameProtagonist } from '../sim/run/recruit';
import { openLevelUp } from '../ui/company/levelUpModal';
import { askName } from '../ui/run/encounterScreen';
import { EndScreen } from '../ui/run/endScreens';
import { EventScreen } from '../ui/run/eventScreen';
import { PrepScreen } from '../ui/run/prepScreen';
import { ShopScreen } from '../ui/run/restShopScreens';
import { RosterScreen } from '../ui/run/rosterScreen';
import { BattleScreen } from '../ui/screens/battleScreen';
import { HubScreen } from '../ui/week/hubScreen';
import { ReportScreen } from '../ui/week/reportScreen';
import { getAssets } from './assetCache';
import { getEnv } from './envCache';
import { ExploreFlow } from './exploreFlow';
import { showFatal } from './fatal';
import type { Router } from './router';
import { addHall, clearRun, saveRun } from './save';

/** Drives a 12-week run: hub → action → report → next week … → boss → ending. Saves at every step. */
export class WeekFlow {
  private run!: RunState;
  private explore: ExploreFlow;

  constructor(private readonly router: Router, private readonly root: HTMLElement, private readonly toTitle: () => void) {
    this.explore = new ExploreFlow({
      router, run: () => this.run, set: (r) => this.set(r), rosterApi: () => this.rosterApi() as never,
      done: () => this.route(), fatal: (e) => showFatal(root, e),
    });
  }

  start(seed: number): void {
    this.set(newRunV2(seed, new Date().toISOString()));
    this.route();
  }

  resume(run: RunState): void {
    this.run = run;
    if (resumeTarget(run) === 'abandonedBattle') {
      let r = abandonBattle(run);
      if (r.phase === 'exploring') r = leaveExploration(r, true);
      this.set(r);
    }
    this.route();
  }

  private set(run: RunState): void {
    this.run = run;
    saveRun(run);
  }

  private rosterApi() {
    return {
      equip: (m: string, item: string) => this.set({ ...this.run, roster: equip(this.run.roster, m, item) }),
      unequip: (m: string, slot: 'weapon' | 'armor' | 'trinket') => this.set({ ...this.run, roster: unequip(this.run.roster, m, slot) }),
      setTactic: (m: string, slot: number, tac: Parameters<typeof setTactic>[3]) => this.set({ ...this.run, roster: setTactic(this.run.roster, m, slot, tac) }),
    };
  }

  private route(): void {
    const r = this.run;
    if (r.status !== 'active') return this.end();
    if (r.phase === 'exploring') return void this.explore.show();
    if (r.phase === 'report') return this.router.go(new ReportScreen(r, () => void this.nextWeek()));
    if (r.phase === 'boss') return this.bossPrep();
    this.hub();
  }

  private hub(): void {
    this.router.go(new HubScreen({
      run: () => this.run,
      recruit: (c) => void this.recruit(c),
      skipVisitors: () => { this.set(this.run.startEvent ? { ...this.run, visitors: undefined } : skipStart(this.run)); this.route(); },
      openEvent: () => this.startEvent(),
      explore: (i, party) => { this.set(chooseExplore(this.run, i, party)); this.route(); },
      train: (ids) => { this.set(trainWeek(this.run, ids)); this.route(); },
      rest: (a, b) => { this.set(restWeek(this.run, a, b)); this.route(); },
      shop: () => this.shop(),
      roster: () => this.router.go(new RosterScreen({ ...this.rosterApi(), run: () => this.run, back: () => this.route(), nextLevelUp: (h) => this.levelUp(h) })),
      quit: () => { saveRun(this.run); this.toTitle(); },
    }));
  }

  private async recruit(c: Parameters<typeof recruitVisitor>[1]): Promise<void> {
    this.set(recruitVisitor(this.run, c));
    if (!this.run.namedProtagonist) this.set(nameProtagonist(this.run, await askName(this.root)));
    this.route();
  }

  private startEvent(): void {
    const view = this.run.startEvent!;
    this.router.go(new EventScreen({
      view,
      choose: (id) => { const r = chooseEvent(this.run, view, id); this.set({ ...r.run, startEvent: undefined, phase: r.run.visitors ? 'start' : 'choose' }); return r; },
      done: () => this.route(),
    }));
  }

  private shop(): void {
    this.router.go(new ShopScreen({
      run: () => this.run, stock: () => this.run.shop!.stock, leave: () => this.route(),
      buy: (i) => { const r = buy(this.run, this.run.shop!.stock, i); this.set({ ...r.run, shop: { week: this.run.week, stock: r.stock } }); },
      sell: (i) => this.set(sell(this.run, i)),
      heal: (id) => this.set(healOne(this.run, id)),
    }));
  }

  private async levelUp(host: HTMLElement): Promise<void> {
    const m = this.run.roster.mercs.find((x) => x.pendingLevelUps > 0);
    if (!m) return;
    const choice = await openLevelUp(host, m, levelOffers(m, this.run.roster, this.run.seed + this.run.week));
    const roster = choice
      ? applyOfferToRoster(this.run.roster, m.id, choice.offer, choice.slot)
      : { ...this.run.roster, mercs: this.run.roster.mercs.map((x) => (x.id === m.id ? { ...x, pendingLevelUps: x.pendingLevelUps - 1 } : x)) };
    this.set({ ...this.run, roster: settleEmptyLevelUps(roster) });
  }

  private async nextWeek(): Promise<void> {
    this.set({ ...this.run, roster: settleEmptyLevelUps(this.run.roster) });
    while (this.run.roster.mercs.some((m) => m.pendingLevelUps > 0)) await this.levelUp(this.root);
    this.set(endWeek(this.run));
    this.route();
  }

  private bossPrep(): void {
    const alive = this.run.roster.mercs.filter((m) => m.alive);
    const kept = Object.fromEntries(Object.entries(this.run.formation).filter(([id]) => alive.some((m) => m.id === id)));
    const formation: Record<string, Slot> = Object.keys(kept).length ? kept : Object.fromEntries(autoFormation(alive).map(({ merc, col, row }) => [merc.id, { col, row }]));
    this.router.go(new PrepScreen({
      ...this.rosterApi(), run: () => this.run, enemies: BOSS_ROOM.enemies!.map((e) => ({ enemyId: e.enemyId })),
      title: '12주차 — 잿빛 기사가 변경을 덮쳤다!', start: (f) => void this.bossFight(f),
    }, formation));
  }

  private async bossFight(formation: Record<string, Slot>): Promise<void> {
    try {
      this.set(beginBattle(this.run, formation));
      const [lib, env] = await Promise.all([getAssets(), getEnv('dungeon')]);
      const setup = bossBattleSetup(this.run, formation);
      const deployed = setup.allies.map((u) => u.id);
      this.router.go(new BattleScreen(setup, lib, {
        retry: () => undefined, back: () => undefined, fatal: (e) => showFatal(this.root, e),
        onContinue: (state, events) => {
          this.set(finishBattle(this.run, { kind: 'boss', stage: 12, key: 1212 }, deployed, reportFromBattle(state, events, 12)).run);
          this.route();
        },
      }, { theme: 'dungeon', room: BOSS_ROOM, env }));
    } catch (e) {
      showFatal(this.root, e);
    }
  }

  private end(): void {
    this.router.go(new EndScreen(this.run, (entry) => { addHall(entry); clearRun(); this.toTitle(); }));
  }
}
