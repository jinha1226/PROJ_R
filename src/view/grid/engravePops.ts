import { ENGRAVES, type EngraveId } from '../../sim/grid/engraveCore';

const POP_SEC = 1.3;
const MAX_POPS = 3;
const COMBO_SEC = 1.6;

/** Engraving names as they fire (top of the stage, at most three, newest first) and the combo counter. */
export class EngravePops {
  readonly el = document.createElement('div');
  private readonly list = document.createElement('div');
  private readonly combo = document.createElement('div');
  private pops: { el: HTMLElement; left: number }[] = [];
  private comboLeft = 0;

  constructor(parent: HTMLElement) {
    this.el.className = 'gpops';
    this.list.className = 'gpops-list';
    this.combo.className = 'gpops-combo';
    this.combo.hidden = true;
    this.el.append(this.list, this.combo);
    parent.appendChild(this.el);
  }

  engrave(id: string): void {
    // a name that is not an engraving id is shown as it is (scripted scenes)
    const name = ENGRAVES[id as EngraveId]?.name ?? (/[가-힣]/.test(id) ? id : '');
    if (!name) return;
    // the same name again just refreshes its line
    const had = this.pops.find((p) => p.el.dataset.id === id);
    if (had) { had.left = POP_SEC; this.list.prepend(had.el); return; }
    const el = document.createElement('div');
    el.className = 'gpop';
    el.dataset.id = id;
    el.textContent = name;
    this.list.prepend(el);
    this.pops.unshift({ el, left: POP_SEC });
    for (const p of this.pops.splice(MAX_POPS)) p.el.remove();
  }

  hits(n: number, finisher: boolean): void {
    this.combo.hidden = false;
    this.combo.textContent = finisher ? '마무리!' : `${n} 콤보`;
    this.combo.classList.toggle('fin', finisher);
    this.combo.classList.remove('bump');
    void this.combo.offsetWidth;
    this.combo.classList.add('bump');
    this.comboLeft = COMBO_SEC;
  }

  update(dt: number): void {
    for (const p of this.pops) { p.left -= dt; p.el.style.opacity = `${Math.min(1, p.left / 0.3)}`; }
    for (const p of this.pops.filter((x) => x.left <= 0)) p.el.remove();
    this.pops = this.pops.filter((x) => x.left > 0);
    if (this.comboLeft > 0 && (this.comboLeft -= dt) <= 0) this.combo.hidden = true;
  }

  dispose(): void {
    this.el.remove();
  }
}
