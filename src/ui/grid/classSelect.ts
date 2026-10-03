import type { Screen } from '../../app/router';
import { CLASS_NAME, type ClassId } from '../../sim/grid/gear';
import { icon } from './icons';

const CARDS: { id: ClassId; ic: string; kit: string; lean: string }[] = [
  { id: 'warrior', ic: 'sword', kit: '장검 · 석궁 · 가죽 갑옷 · 물약 2', lean: '근접 피해 +20% · 체력 +10' },
  { id: 'hunter', ic: 'bow', kit: '활 · 단검 · 화살 20', lean: '원거리 명중 +10% · 원거리 공격 20% 빠름' },
  { id: 'mage', ic: 'staff', kit: '화염 지팡이 · 단검 · 화염병 · 냉기병', lean: '지팡이 충전 +1 · 회복 2배 · 원소 지속 +1턴' },
];

/** Pick a class before the run (leanings only: every class can use every weapon). */
export class ClassSelect implements Screen {
  private readonly el = document.createElement('div');

  constructor(private readonly pick: (c: ClassId) => void, private readonly back: () => void) {}

  mount(root: HTMLElement): void {
    this.el.className = 'screen grid-classes';
    this.el.innerHTML = `<div class="gcl-panel">
      <h2>직업 선택</h2>
      <p class="muted">지하 묘지 3층. 3층의 해골 챔피언을 쓰러뜨리면 승리.</p>
      <div class="gcl-cards">${CARDS.map((c) => `<button class="gcl-card" data-cls="${c.id}" data-testid="class-${c.id}">
        <span class="gcl-ic">${icon(c.ic)}</span><b>${CLASS_NAME[c.id]}</b><small>${c.kit}</small><em>${c.lean}</em></button>`).join('')}</div>
      <button class="btn" data-back="1">타이틀</button>
    </div>`;
    this.el.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      const c = t.closest<HTMLElement>('[data-cls]')?.dataset.cls as ClassId | undefined;
      if (c) this.pick(c);
      else if (t.closest('[data-back]')) this.back();
    });
    root.appendChild(this.el);
  }

  unmount(): void {
    this.el.remove();
  }
}
