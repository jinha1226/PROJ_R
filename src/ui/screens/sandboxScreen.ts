import type { Screen } from '../../app/router';
import { ALLY_PRESETS, ENEMY_PRESETS } from '../../data/presets';
import { t } from '../i18n/ko';

export interface SandboxChoice {
  ally: string;
  enemy: string;
  seed: number;
}

const ALLY_LABEL: Record<string, string> = { solo: '혼자인 견습 모험가', standard: '기본 5인 파티', elemental: '원소 연계 파티', bonds: '관계 시연 파티' };
const ENEMY_LABEL: Record<string, string> = {
  tutorial: '해골 졸개 무리', bandits: '산적단', skeletons: '해골 부대', ambush: '산적 매복', boss: '보스: 잿빛 기사', empty: '(빈 전장)',
};

const options = (keys: string[], labels: Record<string, string>, selected: string): string =>
  keys.map((k) => `<option value="${k}"${k === selected ? ' selected' : ''}>${labels[k] ?? k}</option>`).join('');

export class SandboxScreen implements Screen {
  constructor(private readonly last: SandboxChoice, private readonly onStart: (c: SandboxChoice) => void, private readonly onCompany?: (seed: number) => void) {}

  mount(root: HTMLElement): void {
    const el = document.createElement('div');
    el.className = 'screen sandbox';
    el.innerHTML = `
      <div class="panel sandbox-panel">
        <h1 class="logo">${t('ui.title')}</h1>
        <p class="subtitle">${t('ui.sandbox')}</p>
        <label>${t('ui.allies')}<select data-testid="ally-preset">${options(Object.keys(ALLY_PRESETS), ALLY_LABEL, this.last.ally)}</select></label>
        <label>${t('ui.enemies')}<select data-testid="enemy-preset">${options(Object.keys(ENEMY_PRESETS), ENEMY_LABEL, this.last.enemy)}</select></label>
        <label>${t('ui.seed')}<input data-testid="seed" type="number" value="${this.last.seed}" /></label>
        <button class="btn primary" data-testid="start-battle">${t('ui.start')}</button>
        <button class="btn" data-testid="company-mode">용병단 모드 (성장 체험)</button>
        <div class="loading" hidden></div>
      </div>`;
    root.appendChild(el);
    el.querySelector('[data-testid="start-battle"]')!.addEventListener('click', () => {
      const get = (id: string) => el.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-testid="${id}"]`)!.value;
      const loading = el.querySelector<HTMLDivElement>('.loading')!;
      loading.hidden = false;
      loading.textContent = t('ui.loading');
      this.onStart({ ally: get('ally-preset'), enemy: get('enemy-preset'), seed: Number(get('seed')) || 1 });
    });
    el.querySelector('[data-testid="company-mode"]')!.addEventListener('click', () => {
      const seed = Number(el.querySelector<HTMLInputElement>('[data-testid="seed"]')!.value) || 1;
      this.onCompany?.(seed);
    });
  }

  unmount(): void {}
}
