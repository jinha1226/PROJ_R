import type { Screen } from '../../app/router';
import { xitem } from '../../data/extract';
import type { Stack } from '../../sim/extract/inventory';
import { itemCell } from './itemCell';

export interface SortieResult { outcome: 'extracted' | 'downed'; gained: Stack[]; lost: Stack[]; xp: number; levelUps: number }

/** After a sortie: what came home, or what was left behind. */
export class ResultScreen implements Screen {
  private readonly el = document.createElement('div');

  constructor(private readonly r: SortieResult, private readonly done: () => void) {}

  mount(root: HTMLElement): void {
    const r = this.r;
    const ok = r.outcome === 'extracted';
    const list = ok ? r.gained : r.lost;
    const value = list.reduce((a, s) => a + xitem(s.id).value * s.n, 0);
    this.el.className = 'screen node-screen';
    this.el.innerHTML = `<div class="panel node-panel xresult ${ok ? 'ok' : 'lost'}" data-testid="sortie-result">
      <h2>${ok ? '탈출 성공' : '쓰러졌다'}</h2>
      <p>${ok ? `가져온 전리품 가치 <b>${value}G</b> — 창고에 보관했다` : `잃은 것 가치 <b>${value}G</b> — 안전 주머니만 남았다`}</p>
      <div class="xgrid">${list.length ? list.map((s) => itemCell(s)).join('') : '<p class="muted">없음</p>'}</div>
      <p>경험치 +${r.xp}${r.levelUps ? ` · <b>레벨업 ${r.levelUps}회</b> (거점에서 선택)` : ''}</p>
      <div class="choice-list"><button class="btn primary" data-testid="to-base">거점으로</button></div></div>`;
    this.el.querySelector('[data-testid="to-base"]')!.addEventListener('click', this.done, { once: true });
    root.appendChild(this.el);
  }

  unmount(): void {
    this.el.remove();
  }
}
