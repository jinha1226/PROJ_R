import { overlaySvg, paintBench, type ArtColors } from './workbenchArt';
import { MATERIAL_NAME, modLine, type Material, type ModSlot, type WorkbenchModel, type WorkbenchOption } from './workbenchTypes';
import '../../styles/workbench.css';

export interface WorkbenchApi { model(): WorkbenchModel; craft(id: string): void; fit(slot: ModSlot, id: string | null): void; close(): void }

/** The workbench: an exploded drawing of the pistol or the suit, the selected part's modules with costs, and what fitting one changes. */
export class WorkbenchScreen {
  readonly el = document.createElement('div');
  private tab: 'pistol' | 'suit' = 'pistol';
  private slot: ModSlot = 'barrel';
  private preview: string | null | undefined;
  private flash: ModSlot | null = null;
  private flashT: ReturnType<typeof setTimeout> | undefined;
  /** crafting needs the workbench repaired; fitting owned mods does not */
  private open = true;

  constructor(private readonly api: WorkbenchApi) {
    this.el.className = 'wb';
    this.el.dataset.testid = 'workbench';
    this.el.addEventListener('click', (e) => this.onClick(e));
    this.el.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.api.close();
      const g = (e.target as Element).closest?.('[data-slot]');
      if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); this.pick(g.getAttribute('data-slot') as ModSlot); }
    });
    this.render();
  }

  private onClick(e: Event): void {
    const t = e.target as Element;
    const tab = t.closest('[data-tab]')?.getAttribute('data-tab');
    if (tab === 'pistol' || tab === 'suit') { this.tab = tab; this.slot = tab === 'pistol' ? 'barrel' : 'chest'; this.preview = undefined; return this.render(); }
    if (t.closest('[data-close]')) return this.api.close();
    const slot = t.closest('[data-slot]')?.getAttribute('data-slot');
    if (slot) return this.pick(slot as ModSlot);
    const act = t.closest('[data-act]');
    if (act) {
      const id = act.getAttribute('data-id')!;
      const kind = act.getAttribute('data-act');
      if (kind === 'craft') this.api.craft(id);
      if (kind === 'fit') { this.api.fit(this.slot, id); this.pulse(); }
      if (kind === 'unfit') { this.api.fit(this.slot, null); this.pulse(); }
      this.preview = undefined;
      return this.render();
    }
    const row = t.closest('[data-row]')?.getAttribute('data-row');
    if (row) { this.preview = row; this.render(); }
  }

  private pick(slot: ModSlot): void {
    this.slot = slot;
    this.preview = undefined;
    this.render();
  }

  /** the fitted part lights up for a moment */
  private pulse(): void {
    this.flash = this.slot;
    clearTimeout(this.flashT);
    this.flashT = setTimeout(() => { this.flash = null; this.render(); }, 700);
  }

  private option(o: WorkbenchOption): string {
    const cost = Object.entries(o.mod.cost).map(([k, n]) => {
      const short = o.missing[k as Material];
      return `<span class="wb-cost${short ? ' short' : ''}">${MATERIAL_NAME[k as Material]} ${n}</span>`;
    }).join('');
    const btn = o.fitted ? `<button type="button" class="btn" data-act="unfit" data-id="${o.mod.id}">해제</button>`
      : o.owned ? `<button type="button" class="btn primary" data-act="fit" data-id="${o.mod.id}">장착</button>`
      : o.locked ? '<span class="wb-lock">마석 필요</span>'
      : `<button type="button" class="btn" data-act="craft" data-id="${o.mod.id}" ${o.craftable && this.open ? '' : 'disabled'}>제작</button>`;
    const state = o.fitted ? '<em>장착됨</em>' : o.owned ? '<em class="own">보유</em>' : '';
    return `<li class="wb-opt${this.preview === o.mod.id ? ' on' : ''}${o.fitted ? ' fitted' : ''}${o.locked ? ' locked' : ''}" data-row="${o.mod.id}">
      <div class="wb-opt-top"><b>${o.mod.name}</b>${state}</div>
      <div class="wb-opt-stat">${modLine(o.mod)}</div>
      <div class="wb-opt-foot">${o.owned || o.locked ? '' : cost}${btn}</div></li>`;
  }

  render(): void {
    const m = this.api.model();
    this.open = m.open;
    const slots = m.slots.filter((s) => s.part === this.tab);
    const sel = slots.find((s) => s.slot === this.slot) ?? slots[0]!;
    const opts = m.options(sel.slot);
    const preview = this.preview !== undefined ? { slot: sel.slot, mod: this.preview } : undefined;
    const stats = m.stats(preview).map((r) => {
      const pct = r.label === '명중' || r.label === '회피';
      const f = (v: number) => (pct ? `${Math.round(v * 100)}%` : `${Math.round(v * 100) / 100}`);
      const delta = r.next !== undefined && r.next !== r.now;
      return `<tr class="${delta ? (r.next! > r.now === (r.label !== '소음') ? 'up' : 'down') : ''}"><th>${r.label}</th><td>${f(r.now)}</td><td>${delta ? `→ ${f(r.next!)}` : ''}</td></tr>`;
    }).join('');
    const mats = (Object.keys(m.materials) as Material[]).map((k) => `<span><i>${MATERIAL_NAME[k]}</i> ${m.materials[k]}</span>`).join('');
    this.el.innerHTML = `
      <header class="wb-head"><b>작업대</b>${m.open ? '' : '<em class="wb-locked">고장 · 수리 필요</em>'}
        <div class="wb-tabs" role="tablist">
          <button type="button" role="tab" data-tab="pistol" aria-selected="${this.tab === 'pistol'}">권총</button>
          <button type="button" role="tab" data-tab="suit" aria-selected="${this.tab === 'suit'}">슈트</button>
        </div>
        <button type="button" class="wb-close" data-close aria-label="닫기">✕</button></header>
      <div class="wb-main">
        <div class="wb-draw"><div class="wb-stage"><canvas class="wb-px" width="320" height="195"></canvas>${overlaySvg(this.tab, m.slots, sel.slot)}</div></div>
        <aside class="wb-side">
          <div class="wb-slot"><span>${sel.label}</span>${sel.fitted ? sel.fitted.name : '비어 있음'}</div>
          <ul class="wb-opts">${opts.map((o) => this.option(o)).join('')}</ul>
          <table class="wb-stats">${stats}</table>
        </aside>
      </div>
      <footer class="wb-mats">${mats}</footer>`;
    const draw = () => { void paintBench(this.el.querySelector<HTMLCanvasElement>('.wb-px')!, this.tab, m.slots, sel.slot, this.flash, this.colors()); };
    draw();
    // once attached the theme's colours can be read
    requestAnimationFrame(draw);
  }

  /** The theme's colours for the canvas drawing (CSS variables cannot reach into it). */
  private colors(): ArtColors {
    const css = getComputedStyle(this.el);
    const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
    return { fg: v('--t-fg', '#5dff8a'), dim: v('--t-dim', '#34a85c'), line: v('--t-line', '#1f7a3e'), warn: v('--t-warn', '#e6ffb0'), ch: v('--t-ch', '#9dffb8'), fill: '#04200b', fitted: '#073a16' };
  }
}
