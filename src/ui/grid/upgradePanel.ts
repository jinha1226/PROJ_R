import { UPGRADES, type UpgradeId } from '../../sim/grid/upgrades';
import type { GAction } from '../../sim/grid/types';

/** Choose one run-long suit upgrade or pass up the pending offer. */
export class UpgradePanel {
  readonly el = document.createElement('div');

  constructor(offer: UpgradeId[], level: number, act: (a: GAction) => void) {
    this.el.className = 'glvl';
    this.el.dataset.testid = 'grid-upgrade';
    this.el.innerHTML = `<div class="glvl-panel">
      <h3>레벨 ${level}! 슈트 강화</h3>
      <div class="glvl-cards">${offer.map((id, i) => `<button class="glvl-card" data-i="${i}" data-testid="grid-upgrade-${i}">
        <b>${UPGRADES[id].name}</b><span>${UPGRADES[id].note}</span></button>`).join('')}</div>
      <button class="btn" data-do="skip" data-testid="grid-upgrade-skip">넘기기</button>
    </div>`;
    this.el.addEventListener('click', (e) => {
      const button = (e.target as HTMLElement).closest<HTMLElement>('[data-i],[data-do]');
      if (!button) return;
      act({ kind: 'upgrade', i: button.dataset.do === 'skip' ? null : Number(button.dataset.i) });
    });
  }
}
