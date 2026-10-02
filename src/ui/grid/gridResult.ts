import type { Screen } from '../../app/router';

export interface GridResultData {
  ok: boolean;
  value: number;
  loot: { name: string; value: number }[];
  turns: number;
  gold: number;
  again(): void;
  quit(): void;
}

const esc = (v: unknown): string => String(v).replace(/[&"<>]/g, (c) => `&#${c.charCodeAt(0)};`);

/** End of a grid sortie: what came home (or was lost), the running total, and another go. */
export class GridResult implements Screen {
  private readonly el = document.createElement('div');

  constructor(private readonly d: GridResultData) {}

  mount(root: HTMLElement): void {
    const d = this.d;
    this.el.className = 'screen grid-result';
    this.el.dataset.testid = 'grid-result';
    this.el.innerHTML = `<div class="panel">
      <h2 class="${d.ok ? 'ok' : 'lost'}">${d.ok ? '탈출 성공' : '쓰러졌다'}</h2>
      <p>${d.turns}턴 · 가져온 가치 <b>${d.value}G</b></p>
      ${d.loot.length ? `<ul>${d.loot.map((l) => `<li>${esc(l.name)} <small>${l.value}G</small></li>`).join('')}</ul>` : `<p class="muted">${d.ok ? '빈손으로 나왔다' : '이번에 주운 것은 모두 잃었다'}</p>`}
      <p>모은 골드 합계 <b>${d.gold}G</b></p>
      <div class="row"><button class="btn primary" data-act="again" data-testid="grid-again">다시</button><button class="btn" data-act="quit" data-testid="grid-quit">타이틀</button></div>
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
