import type { Screen } from '../../app/router';
import type { EventView } from '../../sim/run/types';
import { t } from '../i18n/ko';

export interface EventApi {
  view: EventView;
  choose(choiceId: string): { resultKey: string; vars: Record<string, string> };
  done(): void;
}

export class EventScreen implements Screen {
  private el = document.createElement('div');

  constructor(private readonly api: EventApi) {}

  mount(root: HTMLElement): void {
    const v = this.api.view;
    const vars = (actor?: string) => ({ ...v.vars, ...(actor ? { actor } : {}) });
    const choices = v.choices.map((c) => `<button class="btn" data-choice="${c.id}" data-testid="choice-${c.id}" ${c.available ? '' : 'disabled'}>
      ${t(`event.${c.textKey}`, vars(c.actor))}${c.reasonKey ? `<span class="reason">(${t(c.reasonKey)})</span>` : ''}</button>`).join('');
    this.el.className = 'screen node-screen';
    this.el.innerHTML = `<div class="panel node-panel"><h2>${t(`event.${v.eventId}.title`)}</h2><p>${t(`event.${v.eventId}.body`, v.vars)}</p>
      <div class="choice-list">${choices}</div></div>`;
    this.el.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-choice]');
      if (!b || b.disabled) return;
      const res = this.api.choose(b.dataset.choice!);
      this.el.querySelector('.choice-list')!.innerHTML = `<p class="result" data-testid="event-result">${t(`event.${res.resultKey}`, res.vars)}</p>
        <button class="btn primary" data-testid="event-done">계속</button>`;
      this.el.querySelector('[data-testid="event-done"]')!.addEventListener('click', () => this.api.done());
    });
    root.appendChild(this.el);
  }

  unmount(): void {
    this.el.remove();
  }
}
