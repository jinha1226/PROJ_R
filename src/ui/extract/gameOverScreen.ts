import type { Screen } from '../../app/router';
import type { XCompany } from '../../sim/extract/company';
import { t } from '../i18n/ko';

const esc = (v: unknown): string => String(v).replace(/[&"<>]/g, (c) => `&#${c.charCodeAt(0)};`);

/** Nobody is left: the company's record, then a fresh start. */
export class GameOverScreen implements Screen {
  private readonly el = document.createElement('div');

  constructor(private readonly c: XCompany, private readonly restart: () => void, private readonly title: () => void) {}

  mount(root: HTMLElement): void {
    const c = this.c;
    this.el.className = 'screen node-screen';
    this.el.innerHTML = `<div class="panel node-panel xresult lost" data-testid="game-over">
      <h2>용병단이 사라졌다</h2>
      <p>출격 ${c.sorties}회 · 탈출 ${c.extracted}회 · 최고 회수 ${c.bestHaul}G</p>
      <h4>잠든 이들</h4><ul>${c.fallen.map((f) => `<li>${esc(f.name)} — Lv${f.level} ${t(`class.${f.classId}`)}, ${f.sortie}번째 출격</li>`).join('')}</ul>
      <div class="choice-list"><button class="btn primary" data-act="restart" data-testid="new-company">새 용병단</button><button class="btn" data-act="title">타이틀로</button></div></div>`;
    this.el.addEventListener('click', (e) => {
      const act = (e.target as HTMLElement).closest<HTMLElement>('button')?.dataset.act;
      if (act === 'restart') this.restart();
      else if (act === 'title') this.title();
    });
    root.appendChild(this.el);
  }

  unmount(): void {
    this.el.remove();
  }
}
