import { STARTER_TACTICS } from '../data/tactics';
import {
  hire, isGameOver, kitUp, mercToStash, moveInParty, newCompany, packToStash, pouchToStash, setParty, settleCompany, stashToMerc, stashToPack, stashToPouch,
  type SortieEnd, type XCompany,
} from '../sim/extract/company';
import { buy, sell } from '../sim/extract/profile';
import { generateRegion } from '../sim/extract/region';
import { applyOfferToRoster, levelOffers, settleEmptyLevelUps } from '../sim/roster/offers';
import type { Roster } from '../sim/roster/types';
import { openLevelUp } from '../ui/company/levelUpModal';
import { GameOverScreen } from '../ui/extract/gameOverScreen';
import { HubScreen, type HubOp } from '../ui/extract/hubScreen';
import { ResultScreen } from '../ui/extract/resultScreen';
import { SortieScreen } from '../ui/extract/sortieScreen';
import { LoadingScreen } from '../ui/screens/loadingScreen';
import { getAssets } from './assetCache';
import { getWorldEnv } from './envCache';
import { clearCompany, loadCompany, saveCompany } from './extractSave';
import { showFatal } from './fatal';
import type { Router } from './router';

const asRoster = (c: XCompany): Roster => ({ seed: c.seed, battles: c.sorties, nextId: c.nextId, mercs: c.mercs, memorial: [], relations: [], inventory: [], tacticsOwned: [...STARTER_TACTICS] });

/** Extraction mode: the company base ↔ party sorties ↔ results, saved only at the base. */
export class ExtractFlow {
  private c!: XCompany;
  private hub: HubScreen | null = null;

  constructor(private readonly router: Router, private readonly root: HTMLElement, private readonly toTitle: () => void) {}

  start(seed: number): void {
    this.c = loadCompany() ?? newCompany(seed);
    this.save();
    this.showHub();
  }

  private save(): void {
    saveCompany(this.c);
  }

  private showHub(): void {
    this.hub = new HubScreen({
      company: () => this.c,
      act: (op) => { this.c = this.apply(op); this.save(); },
      sortie: () => void this.sortie(),
      levelUp: (id) => void this.levelUp(id),
      quit: () => this.toTitle(),
    });
    this.router.go(this.hub);
  }

  private apply(op: HubOp): XCompany {
    const c = this.c;
    switch (op.op) {
      case 'equip': return stashToMerc(c, op.merc, op.i);
      case 'unequip': return mercToStash(c, op.merc, op.slot);
      case 'starter': return kitUp(c, op.merc);
      case 'toPack': return stashToPack(c, op.i);
      case 'fromPack': return packToStash(c, op.i);
      case 'toPouch': return stashToPouch(c, op.i);
      case 'fromPouch': return pouchToStash(c);
      case 'sell': return sell(c, op.i, op.all ? undefined : 1);
      case 'buy': return buy(c, op.id);
      case 'hire': return hire(c, op.i);
      case 'party': return setParty(c, c.party.includes(op.merc) ? c.party.filter((id) => id !== op.merc) : [...c.party, op.merc]);
      case 'up': return moveInParty(c, op.merc, -1);
    }
  }

  private async levelUp(id: string): Promise<void> {
    let m = this.c.mercs.find((x) => x.id === id);
    while (m && m.pendingLevelUps > 0) {
      const roster = asRoster(this.c);
      const choice = await openLevelUp(this.root, m, levelOffers(m, roster, this.c.seed + this.c.sorties * 31 + m.level));
      const next = choice ? applyOfferToRoster(roster, id, choice.offer, choice.slot) : { ...roster, mercs: roster.mercs.map((x) => (x.id === id ? { ...x, pendingLevelUps: x.pendingLevelUps - 1 } : x)) };
      this.c = kitUp({ ...this.c, mercs: settleEmptyLevelUps(next).mercs }, id);
      this.save();
      m = this.c.mercs.find((x) => x.id === id);
    }
    this.hub?.render();
  }

  private async sortie(): Promise<void> {
    // the base is saved before leaving: a reload mid-sortie simply returns here (the sortie never happened)
    this.save();
    this.router.go(new LoadingScreen());
    try {
      const [lib, env] = await Promise.all([getAssets(), getWorldEnv()]);
      const seed = (this.c.seed * 7919 + this.c.sorties * 104729 + 17) >>> 0;
      const members = this.c.party.map((id) => ({ merc: this.c.mercs.find((m) => m.id === id)!, gear: this.c.gear[id]! }));
      this.router.go(new SortieScreen({
        region: generateRegion(seed), members, pack: this.c.pack, pouch: this.c.pouch, seed, lib, env,
        end: (end) => this.end(end), abandon: () => this.showHub(), fatal: (e) => showFatal(this.root, e),
      }));
    } catch (e) {
      showFatal(this.root, e);
    }
  }

  private end(end: SortieEnd): void {
    const names = new Map(this.c.mercs.map((m) => [m.id, m.name]));
    const before = new Map(this.c.mercs.map((m) => [m.id, m.level]));
    const r = settleCompany(this.c, end);
    this.c = r.company;
    this.save();
    const members = end.members.map((m) => ({ name: names.get(m.id) ?? m.id, state: m.state, levels: (this.c.mercs.find((x) => x.id === m.id)?.level ?? 0) - (before.get(m.id) ?? 0) }));
    const after = () => (isGameOver(this.c) ? this.gameOver() : this.showHub());
    this.router.go(new ResultScreen({ outcome: end.outcome, gained: r.gained, lost: r.lost, xp: end.members.find((m) => m.state !== 'dead')?.xp ?? 0, members }, after));
  }

  private gameOver(): void {
    const record = this.c;
    clearCompany();
    this.router.go(new GameOverScreen(record, () => { this.c = newCompany((record.seed * 31 + record.sorties) >>> 0); this.save(); this.showHub(); }, () => this.toTitle()));
  }
}
