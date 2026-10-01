import type { Screen } from '../../app/router';
import { xitem } from '../../data/extract';
import type { Stack } from '../../sim/extract/inventory';
import { itemCell } from './itemCell';

export interface SortieResult {
  outcome: 'extracted' | 'failed';
  gained: Stack[];
  lost: Stack[];
  xp: number;
  members: { name: string; state: 'home' | 'carried' | 'dead'; levels: number }[];
}

const STATE: Record<SortieResult['members'][number]['state'], string> = { home: '귀환', carried: '업혀서 귀환 (중상)', dead: '돌아오지 못함' };
const esc = (v: unknown): string => String(v).replace(/[&"<>]/g, (c) => `&#${c.charCodeAt(0)};`);

/** After a sortie: who came home, what came with them, what was left behind. */
export class ResultScreen implements Screen {
  private readonly el = document.createElement('div');

  constructor(private readonly r: SortieResult, private readonly done: () => void) {}

  mount(root: HTMLElement): void {
    const r = this.r;
    const ok = r.outcome === 'extracted';
    const value = (l: Stack[]) => l.reduce((a, s) => a + xitem(s.id).value * s.n, 0);
    const cells = (l: Stack[]) => (l.length ? l.map((s) => itemCell(s)).join('') : '<p class="muted">없음</p>');
    this.el.className = 'screen node-screen';
    this.el.innerHTML = `<div class="panel node-panel xresult ${ok ? 'ok' : 'lost'}" data-testid="sortie-result">
      <h2>${ok ? '탈출 성공' : '탐험대 전멸'}</h2>
      <ul class="xresult-members">${r.members.map((m) => `<li class="st-${m.state}"><b>${esc(m.name)}</b> ${STATE[m.state]}${m.levels > 0 ? ` · 레벨 +${m.levels}` : ''}</li>`).join('')}</ul>
      ${ok ? `<h4>가져온 전리품 <small>${value(r.gained)}G — 창고에 보관했다</small></h4><div class="xgrid">${cells(r.gained)}</div>` : ''}
      ${r.lost.length ? `<h4>잃은 것 <small>${value(r.lost)}G</small></h4><div class="xgrid">${cells(r.lost)}</div>` : ''}
      ${ok ? `<p>경험치 +${r.xp} (돌아온 용병 모두)</p>` : ''}
      <div class="choice-list"><button class="btn primary" data-testid="to-base">계속</button></div></div>`;
    this.el.querySelector('[data-testid="to-base"]')!.addEventListener('click', this.done, { once: true });
    root.appendChild(this.el);
  }

  unmount(): void {
    this.el.remove();
  }
}
