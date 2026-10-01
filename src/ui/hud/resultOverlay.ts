import type { Outcome, UnitState } from '../../sim/battle/types';
import { t } from '../i18n/ko';
import { iconBadge, type IconKey } from '../../view/overlay/icons';

export interface ResultActions {
  retry(): void;
  back(): void;
  /** show a single "continue" button (calls retry) */
  continueOnly?: boolean;
}

const TITLE: Record<Outcome, string> = { victory: 'ui.victory', defeat: 'ui.defeat', retreat: 'ui.retreatResult' };

export interface ResultStory {
  moments: { icon: IconKey; text: string }[];
  bonds: { text: string; delta: number; label?: string }[];
}

function storyHtml(story: ResultStory): string {
  const moments = story.moments.map((m) => `<li>${iconBadge(m.icon, 18)}<span>${m.text}</span></li>`).join('');
  const bonds = story.bonds
    .map((b) => `<li><span class="delta ${b.delta >= 0 ? 'up' : 'down'}">${b.delta >= 0 ? '+' : ''}${b.delta}</span>${b.text}${b.label ? ` <em>${b.label}</em>` : ''}</li>`)
    .join('');
  return `${moments ? `<h3>${t('ui.moments')}</h3><ul class="moments" data-testid="moments">${moments}</ul>` : ''}
    ${bonds ? `<h3>${t('ui.bondChanges')}</h3><ul class="bonds">${bonds}</ul>` : ''}`;
}

export function showResult(
  parent: HTMLElement, outcome: Outcome, units: UnitState[], nameOf: (u: UnitState) => string, act: ResultActions, story?: ResultStory,
): HTMLElement {
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
      ${story ? storyHtml(story) : ''}
      <div class="result-actions">
        ${act.continueOnly ? `<button class="btn primary" data-testid="continue">계속</button>`
          : `<button class="btn primary" data-testid="retry">${t('ui.retry')}</button><button class="btn" data-testid="back">${t('ui.backToSandbox')}</button>`}
      </div>
    </div>`;
  el.querySelector('[data-testid="retry"]')?.addEventListener('click', act.retry);
  el.querySelector('[data-testid="back"]')?.addEventListener('click', act.back);
  el.querySelector('[data-testid="continue"]')?.addEventListener('click', act.retry);
  parent.appendChild(el);
  return el;
}
