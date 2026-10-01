import { reportFromBattle, resolveBattle } from '../sim/roster/aftermath';
import { companyBattleSetup, deployable, stageFor } from '../sim/roster/companyBattle';
import { equip, unequip } from '../sim/roster/equipment';
import { newRoster } from '../sim/roster/generate';
import { applyOfferToRoster, levelOffers, settleEmptyLevelUps } from '../sim/roster/offers';
import type { Roster } from '../sim/roster/types';
import { openLevelUp } from '../ui/company/levelUpModal';
import { AftermathScreen } from '../ui/screens/aftermathScreen';
import { BattleScreen } from '../ui/screens/battleScreen';
import { CompanyScreen } from '../ui/screens/companyScreen';
import { getAssets } from './assetCache';
import { showFatal } from './fatal';
import type { Router } from './router';

const MAX_DEPLOY = 5;

/** Company mode: roster in memory, battles in sequence (save/load arrives with Plan 4). */
export class CompanyFlow {
  private roster: Roster;
  private deployed: string[];
  private enemy = 'bandits';

  constructor(private readonly router: Router, private readonly root: HTMLElement, private readonly exit: () => void, private seed: number) {
    this.roster = newRoster(seed, 4);
    this.deployed = deployable(this.roster);
  }

  hub(): void {
    this.router.go(new CompanyScreen({
      roster: () => this.roster,
      deployed: () => this.deployed,
      toggleDeploy: (id) => {
        if (this.deployed.includes(id)) this.deployed = this.deployed.filter((x) => x !== id);
        else if (this.deployed.length < MAX_DEPLOY) this.deployed = [...this.deployed, id];
      },
      enemy: () => this.enemy,
      setEnemy: (k) => { this.enemy = k; },
      fight: () => void this.fight(),
      equip: (m, item) => { this.roster = equip(this.roster, m, item); },
      unequip: (m, slot) => { this.roster = unequip(this.roster, m, slot); },
      nextLevelUp: (host) => this.levelUp(host),
      newCompany: () => {
        this.seed += 1;
        this.roster = newRoster(this.seed, 4);
        this.deployed = deployable(this.roster);
        this.hub();
      },
      exit: this.exit,
    }));
  }

  private async levelUp(host: HTMLElement): Promise<void> {
    const m = this.roster.mercs.find((x) => x.pendingLevelUps > 0);
    if (!m) return;
    const choice = await openLevelUp(host, m, levelOffers(m, this.roster, this.roster.seed + this.roster.battles));
    if (choice) this.roster = settleEmptyLevelUps(applyOfferToRoster(this.roster, m.id, choice.offer, choice.slot));
    else this.roster = { ...this.roster, mercs: this.roster.mercs.map((x) => (x.id === m.id ? { ...x, pendingLevelUps: x.pendingLevelUps - 1 } : x)) };
  }

  private async fight(): Promise<void> {
    try {
      const lib = await getAssets();
      const stage = stageFor(this.roster.battles);
      const setup = companyBattleSetup(this.roster, this.deployed, this.enemy, stage, this.seed * 1000 + this.roster.battles);
      const deployed = setup.allies.map((u) => u.id);
      this.router.go(new BattleScreen(setup, lib, {
        retry: () => void this.fight(), back: () => this.hub(), fatal: (e) => showFatal(this.root, e),
        onContinue: (state, events) => this.after(deployed, reportFromBattle(state, events, Math.max(stage, 1))),
      }));
    } catch (e) {
      showFatal(this.root, e);
    }
  }

  private after(deployed: string[], report: ReturnType<typeof reportFromBattle>): void {
    const before = this.roster;
    const a = resolveBattle(this.roster, deployed, report);
    this.roster = settleEmptyLevelUps(a.roster);
    const alive = new Set(this.roster.mercs.map((m) => m.id));
    this.deployed = this.deployed.filter((id) => alive.has(id));
    this.router.go(new AftermathScreen(a, before, () => this.hub()));
  }
}
