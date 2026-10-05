import { deathLine } from './deathRecap';
import { zoneOf } from '../../sim/grid/zones';
import { ENGRAVES, type EngraveId } from '../../sim/grid/engraveCore';
import type { RunState } from '../../sim/grid/types';
import { FLOORS } from '../../sim/grid/run';
import type { Screen } from '../../app/router';

export interface GridResultData {
  energy?: number;
  won: boolean;
  returned?: boolean;
  killedBy?: RunState['killedBy'];
  suit?: EngraveId[];
  floor: number;
  kills: number;
  level: number;
  turns: number;
  best: number;
  wins: number;
  again(): void;
  quit(): void;
}

/** End of a run: how deep, how many fell, the record so far, and another go. */
export class GridResult implements Screen {
  private readonly el = document.createElement('div');

  constructor(private readonly d: GridResultData) {}

  mount(root: HTMLElement): void {
    const d = this.d, safe = d.won || d.returned;
    this.el.className = 'screen grid-result';
    this.el.dataset.testid = 'grid-result';
    this.el.innerHTML = `<div class="panel">
      <h2 class="${safe ? 'ok' : 'lost'}">${d.returned ? '귀환' : d.won ? '에너지원을 손에 넣었다' : '쓰러졌다'}</h2>
      ${safe ? '' : `<p>${deathLine(d.killedBy, d.floor)}</p>`}
      <p>${d.floor}층 · ${zoneOf(d.floor).name}</p>
      <div class="gres-engravings">${(d.suit ?? []).map((id) => `<span>${ENGRAVES[id].name}</span>`).join('')}</div>
      <ul class="gres-stats">
        <li><span>도달한 층</span><b>${d.floor}층 / ${FLOORS}</b></li>
        <li><span>전송 에너지</span><b>⚡${d.energy ?? 0}</b></li>
        <li><span>처치</span><b>${d.kills}</b></li>
        <li><span>레벨</span><b>${d.level}</b></li>
        <li><span>턴</span><b>${d.turns}</b></li>
      </ul>
      <p class="muted">최고 기록 ${d.best}층 · 승리 ${d.wins}회</p>
      <div class="row"><button class="btn primary" data-act="again" data-testid="grid-again">우주선으로</button><button class="btn" data-act="quit" data-testid="grid-quit">타이틀</button></div>
    </div>`;
    this.el.addEventListener('click', (e) => {
      const act = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
      if (act === 'again') d.again();
      else if (act === 'quit') d.quit();
    });
    root.appendChild(this.el);
  }

  unmount(): void {
    this.el.remove();
  }
}
