import { STARTER_TACTICS } from '../data/tactics';
import { generateRegion } from '../sim/extract/region';
import { buy, claimStarterKit, loadoutToStash, newProfile, reconcileWeapon, sell, settleSortie, stashToLoadout, type XProfile } from '../sim/extract/profile';
import { applyOfferToRoster, levelOffers, settleEmptyLevelUps } from '../sim/roster/offers';
import type { Roster } from '../sim/roster/types';
import { openLevelUp } from '../ui/company/levelUpModal';
import { HubScreen, type HubOp } from '../ui/extract/hubScreen';
import { ResultScreen } from '../ui/extract/resultScreen';
import { SortieScreen } from '../ui/extract/sortieScreen';
import { LoadingScreen } from '../ui/screens/loadingScreen';
import { getAssets } from './assetCache';
import { getWorldEnv } from './envCache';
import { loadProfile, saveProfile } from './extractSave';
import { showFatal } from './fatal';
import type { Router } from './router';

const soloRoster = (p: XProfile): Roster => ({ seed: p.seed, battles: 0, nextId: 1, mercs: [p.hero], memorial: [], relations: [], inventory: [], tacticsOwned: [...STARTER_TACTICS] });

/** Extraction prototype: base ↔ sortie ↔ result, saved only at the base. */
export class ExtractFlow {
  private p!: XProfile;
  private hub: HubScreen | null = null;

  constructor(private readonly router: Router, private readonly root: HTMLElement, private readonly toTitle: () => void) {}

  start(seed: number): void {
    this.p = loadProfile() ?? newProfile(seed);
    this.save();
    this.showHub();
  }

  private save(): void {
    saveProfile(this.p);
  }

  private showHub(): void {
    this.hub = new HubScreen({
      profile: () => this.p,
      act: (op) => { this.p = this.apply(op); this.save(); },
      sortie: () => void this.sortie(),
      levelUp: () => void this.levelUp(),
      quit: () => this.toTitle(),
    });
    this.router.go(this.hub);
  }

  private apply(op: HubOp): XProfile {
    switch (op.op) {
      case 'equipFromStash': return stashToLoadout(this.p, op.i);
      case 'toStash': return loadoutToStash(this.p, op.where, op.i);
      case 'sell': return sell(this.p, op.i, op.all ? undefined : 1);
      case 'buy': return buy(this.p, op.id);
      case 'starter': return claimStarterKit(this.p);
    }
  }

  private async levelUp(): Promise<void> {
    while (this.p.hero.pendingLevelUps > 0) {
      const roster = soloRoster(this.p);
      const offers = levelOffers(this.p.hero, roster, this.p.seed + this.p.sorties * 31 + this.p.hero.level);
      const choice = await openLevelUp(this.root, this.p.hero, offers);
      const next = choice ? applyOfferToRoster(roster, this.p.hero.id, choice.offer, choice.slot) : { ...roster, mercs: [{ ...this.p.hero, pendingLevelUps: this.p.hero.pendingLevelUps - 1 }] };
      this.p = reconcileWeapon({ ...this.p, hero: settleEmptyLevelUps(next).mercs[0]! });
      this.save();
    }
    this.hub?.render();
  }

  private async sortie(): Promise<void> {
    // the base is saved before leaving: a reload mid-sortie simply returns here (the sortie never happened)
    this.save();
    this.router.go(new LoadingScreen());
    try {
      const [lib, env] = await Promise.all([getAssets(), getWorldEnv()]);
      const seed = (this.p.seed * 7919 + this.p.sorties * 104729 + 17) >>> 0;
      this.router.go(new SortieScreen({
        region: generateRegion(seed), hero: this.p.hero, loadout: this.p.loadout, seed, lib, env,
        end: (outcome, loadout, xp) => this.end(outcome, loadout, xp),
        abandon: () => this.showHub(),
        fatal: (e) => showFatal(this.root, e),
      }));
    } catch (e) {
      showFatal(this.root, e);
    }
  }

  private end(outcome: 'extracted' | 'downed', loadout: XProfile['loadout'], xp: number): void {
    const before = this.p.hero.level;
    const r = settleSortie(this.p, { outcome, loadout, xp });
    this.p = r.profile;
    this.save();
    this.router.go(new ResultScreen({ outcome, gained: r.gained, lost: r.lost, xp, levelUps: this.p.hero.level - before }, () => this.showHub()));
  }
}
