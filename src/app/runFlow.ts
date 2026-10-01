import { reportFromBattle } from '../sim/roster/aftermath';
import { equip, unequip } from '../sim/roster/equipment';
import { autoFormation } from '../sim/roster/formation';
import { applyOfferToRoster, levelOffers, settleEmptyLevelUps } from '../sim/roster/offers';
import { setTactic } from '../sim/roster/tactics';
import { battleSetupForNode, finishBattle } from '../sim/run/battleNode';
import { pickEvent } from '../sim/run/events';
import { abandonBattle, beginBattle, chooseEvent, recruitAndClose, resumeTarget } from '../sim/run/savePoints';
import { encounterCandidates, nameProtagonist, type recruit } from '../sim/run/recruit';
import { restHeal, restTalk } from '../sim/run/rest';
import { buy, healOne, sell, shopStock } from '../sim/run/shop';
import { currentNode, enterNode, newRun } from '../sim/run/state';
import type { MapNode, RunState, Slot } from '../sim/run/types';
import { openLevelUp } from '../ui/company/levelUpModal';
import { AftermathScreen } from '../ui/screens/aftermathScreen';
import { BattleScreen } from '../ui/screens/battleScreen';
import { EncounterScreen, askName } from '../ui/run/encounterScreen';
import { EndScreen } from '../ui/run/endScreens';
import { EventScreen } from '../ui/run/eventScreen';
import { MapScreen } from '../ui/run/mapScreen';
import { PrepScreen } from '../ui/run/prepScreen';
import { RestScreen, ShopScreen } from '../ui/run/restShopScreens';
import { RosterScreen } from '../ui/run/rosterScreen';
import { getAssets } from './assetCache';
import { showFatal } from './fatal';
import type { Router } from './router';
import { addHall, clearRun, saveRun } from './save';

const BATTLE_TITLES: Record<string, string> = { battle: '전투 준비', elite: '정예 전투 준비', boss: '최후의 결전: 잿빛 기사' };

/** Drives one run: map → node screens → battles → aftermath, saving after every step. */
export class RunFlow {
  private run!: RunState;

  constructor(private readonly router: Router, private readonly root: HTMLElement, private readonly toTitle: () => void) {}

  start(seed: number): void {
    this.set(newRun(seed, new Date().toISOString()));
    this.map();
  }

  resume(run: RunState): void {
    this.run = run;
    const target = resumeTarget(run);
    if (target === 'abandonedBattle') this.set(abandonBattle(run));
    if (this.run.status !== 'active') this.end();
    else if (target === 'node') this.open(currentNode(run)!);
    else this.map();
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

  private map(): void {
    this.router.go(new MapScreen({
      run: () => this.run,
      enter: (id) => { this.set(enterNode(this.run, id)); this.open(this.run.map.nodes[id]!); },
      roster: () => this.router.go(new RosterScreen({ ...this.rosterApi(), run: () => this.run, back: () => this.map(), nextLevelUp: (h) => this.levelUp(h) })),
      quit: () => { saveRun(this.run); this.toTitle(); },
    }));
  }

  private complete(): void {
    this.set({ ...this.run, pending: undefined });
    if (this.run.status !== 'active') this.end();
    else this.map();
  }

  private open(node: MapNode): void {
    const p = this.run.pending ?? { nodeId: node.id };
    if (node.type === 'battle' || node.type === 'elite' || node.type === 'boss') return this.prep(node);
    if (node.type === 'encounter') {
      const candidates = p.candidates ?? encounterCandidates(this.run, node);
      this.set({ ...this.run, pending: { ...p, candidates } });
      return this.router.go(new EncounterScreen({ run: () => this.run, candidates, leave: () => this.complete(), recruit: (c) => void this.recruit(c) }));
    }
    if (node.type === 'event') {
      const view = p.event ?? pickEvent(this.run, node);
      this.set({ ...this.run, pending: { ...p, event: view } });
      return this.router.go(new EventScreen({
        view, done: () => this.complete(),
        choose: (id) => { const r = chooseEvent(this.run, view, id); this.set(r.run); return r; },
      }));
    }
    if (node.type === 'rest') {
      return this.router.go(new RestScreen({
        run: () => this.run,
        heal: () => { this.set(restHeal(this.run)); this.complete(); },
        talk: (a, b) => { this.set(restTalk(this.run, a, b)); this.complete(); },
      }));
    }
    const stock = p.shop ?? shopStock(this.run, node);
    this.set({ ...this.run, pending: { ...p, shop: stock } });
    this.router.go(new ShopScreen({
      run: () => this.run, stock: () => this.run.pending?.shop ?? stock, leave: () => this.complete(),
      buy: (i) => { const r = buy(this.run, this.run.pending!.shop!, i); this.set({ ...r.run, pending: { nodeId: node.id, shop: r.stock } }); },
      sell: (i) => this.set(sell(this.run, i)),
      heal: (id) => this.set(healOne(this.run, id)),
    }));
  }

  private async recruit(c: Parameters<typeof recruit>[1]): Promise<void> {
    this.set(recruitAndClose(this.run, c));
    if (!this.run.namedProtagonist) this.set(nameProtagonist(this.run, await askName(this.root)));
    this.complete();
  }

  private formation(): Record<string, Slot> {
    const alive = new Set(this.run.roster.mercs.map((m) => m.id));
    const kept = Object.fromEntries(Object.entries(this.run.formation).filter(([id]) => alive.has(id)));
    if (Object.keys(kept).length) return kept;
    return Object.fromEntries(autoFormation(this.run.roster.mercs).map(({ merc, col, row }) => [merc.id, { col, row }]));
  }

  private prep(node: MapNode): void {
    const preview = battleSetupForNode({ ...this.run, formation: this.formation() }, node);
    this.router.go(new PrepScreen({
      ...this.rosterApi(), run: () => this.run, enemies: preview.enemies.map((e) => ({ enemyId: e.defId })),
      title: `${BATTLE_TITLES[node.type]} — ${node.step}단계`,
      start: (formation) => { this.set(beginBattle(this.run, formation)); void this.fight(node); },
    }, this.formation()));
  }

  private async fight(node: MapNode): Promise<void> {
    try {
      const lib = await getAssets();
      const setup = battleSetupForNode(this.run, node);
      const deployed = setup.allies.map((u) => u.id);
      this.router.go(new BattleScreen(setup, lib, {
        retry: () => undefined, back: () => undefined, fatal: (e) => showFatal(this.root, e),
        onContinue: (state, events) => this.after(node, deployed, reportFromBattle(state, events, node.step)),
      }));
    } catch (e) {
      showFatal(this.root, e);
    }
  }

  private after(node: MapNode, deployed: string[], report: ReturnType<typeof reportFromBattle>): void {
    const before = this.run.roster;
    const out = finishBattle(this.run, node, deployed, report);
    this.set({ ...out.run, roster: settleEmptyLevelUps(out.run.roster) });
    this.router.go(new AftermathScreen({ ...out.aftermath, roster: this.run.roster, loot: out.reward.items }, before, () => void this.afterLevelUps(this.root)));
  }

  private async afterLevelUps(host: HTMLElement): Promise<void> {
    while (this.run.status === 'active' && this.run.roster.mercs.some((m) => m.pendingLevelUps > 0)) await this.levelUp(host);
    this.complete();
  }

  private async levelUp(host: HTMLElement): Promise<void> {
    const m = this.run.roster.mercs.find((x) => x.pendingLevelUps > 0);
    if (!m) return;
    const choice = await openLevelUp(host, m, levelOffers(m, this.run.roster, this.run.seed + this.run.roster.battles));
    const roster = choice
      ? applyOfferToRoster(this.run.roster, m.id, choice.offer, choice.slot)
      : { ...this.run.roster, mercs: this.run.roster.mercs.map((x) => (x.id === m.id ? { ...x, pendingLevelUps: x.pendingLevelUps - 1 } : x)) };
    this.set({ ...this.run, roster: settleEmptyLevelUps(roster) });
  }

  private end(): void {
    this.router.go(new EndScreen(this.run, (entry) => { addHall(entry); clearRun(); this.toTitle(); }));
  }
}
