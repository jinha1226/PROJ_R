import type { Outcome, UnitState } from '../../sim/battle/types';
import { t } from '../i18n/ko';

export interface ResultActions {
  retry(): void;
  back(): void;
}

const TITLE: Record<Outcome, string> = { victory: 'ui.victory', defeat: 'ui.defeat', retreat: 'ui.retreatResult' };

export function showResult(parent: HTMLElement, outcome: Outcome, units: UnitState[], nameOf: (u: UnitState) => string, act: ResultActions): HTMLElement {
  const el = document.createElement('div');
  el.className = `result-overlay ${outcome}`;
  el.dataset.testid = 'result';
  const rows = units
    .filter((u) => !u.summoned)
    .map((u) => `<tr class="${u.team}"><td>${nameOf(u)}${!u.alive ? ' ✝' : u.downed ? ' (쓰러짐)' : ''}</td>
      <td>${u.stats.kills}</td><td>${u.stats.damageDealt}</td><td>${u.stats.healingDone}</td><td>${u.stats.dodges}</td></tr>`)
    .join('');
  el.innerHTML = `
    <div class="panel result-panel">
      <h2>${t(TITLE[outcome])}</h2>
      <table><thead><tr><th></th><th>${t('ui.kills')}</th><th>${t('ui.damage')}</th><th>${t('ui.healing')}</th><th>${t('ui.dodges')}</th></tr></thead>
      <tbody>${rows}</tbody></table>
      <div class="result-actions">
        <button class="btn primary" data-testid="retry">${t('ui.retry')}</button>
        <button class="btn" data-testid="back">${t('ui.backToSandbox')}</button>
      </div>
    </div>`;
  el.querySelector('[data-testid="retry"]')!.addEventListener('click', act.retry);
  el.querySelector('[data-testid="back"]')!.addEventListener('click', act.back);
  parent.appendChild(el);
  return el;
}
