import type { Screen } from '../../app/router';
import '../styles/run.css';

export interface TitleApi {
  hasSave(): boolean;
  newRun(seed: number): void;
  continueRun(): void;
  hall(): void;
  sandbox(): void;
  extract(): void;
  grid(): void;
}

export class TitleScreen implements Screen {
  private el = document.createElement('div');

  constructor(private readonly api: TitleApi, private readonly defaultSeed: number) {}

  mount(root: HTMLElement): void {
    this.el.className = 'screen title';
    this.el.innerHTML = `<div class="panel title-panel">
      <h1 class="logo">PROJ_R</h1>
      <p class="tagline">이름 없는 모험가 한 명으로 시작해, 최고의 용병단이 되어라.</p>
      ${this.api.hasSave() ? '<button class="btn primary" data-act="continue" data-testid="continue-run">이어하기</button>' : ''}
      <div class="seed-row"><button class="btn ${this.api.hasSave() ? '' : 'primary'}" data-act="new" data-testid="new-run">새 여정</button>
        <label>시드 <input type="number" data-testid="run-seed" value="${this.defaultSeed}" /></label></div>
      <button class="btn" data-act="hall" data-testid="hall">명예의 전당</button>
      <button class="btn primary" data-act="extract" data-testid="to-extract">출격 (시험)</button>
      <button class="btn primary" data-act="grid" data-testid="to-grid">격자 던전 (시험)</button>
      <button class="btn" data-act="sandbox" data-testid="to-sandbox">전투 샌드박스</button></div>`;
    this.el.addEventListener('click', (e) => {
      const act = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
      const seed = Number(this.el.querySelector<HTMLInputElement>('[data-testid="run-seed"]')!.value) || 1;
      if (act === 'continue') this.api.continueRun();
      else if (act === 'new') this.api.newRun(seed);
      else if (act === 'hall') this.api.hall();
      else if (act === 'sandbox') this.api.sandbox();
      else if (act === 'extract') this.api.extract();
      else if (act === 'grid') this.api.grid();
    });
    root.appendChild(this.el);
  }

  unmount(): void {
    this.el.remove();
  }
}
