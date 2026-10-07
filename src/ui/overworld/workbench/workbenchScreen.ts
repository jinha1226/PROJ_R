import type { SfPart } from '../../../sim/base/sfModules';
import { buySoulSlot, craft, dismantle, fit } from '../../../sim/base/workshop';
import type { GEvent } from '../../../sim/grid/types';
import type { RoamParty } from '../../../sim/roam/roam';
import { paintBench, type ArtColors } from './workbenchArt';
import { benchHtml, type BenchView } from './benchHtml';
import { benchModel, type BenchSlot } from './benchModel';
import '../../styles/workbench.css';

/** The workshop at the lab: dismantle fantasy gear into blueprints and gun/suit power, build and fit modules, buy a soul slot. The game waits while it is open. */
export class WorkbenchScreen {
  readonly el = document.createElement('div');
  private view: BenchView = { part: 'gun', slot: 'gun0' };

  constructor(private readonly p: () => RoamParty, private readonly onClose: () => void, private readonly onEvents?: (ev: GEvent[]) => void) {
    this.el.className = 'wb';
    this.el.dataset.testid = 'workbench';
    this.el.hidden = true;
    this.el.addEventListener('click', (e) => this.click(e.target as Element));
    this.el.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.close(); });
  }

  get open(): boolean { return !this.el.hidden; }
  show(): void { this.el.hidden = false; this.render(); }
  close(): void { if (this.el.hidden) return; this.el.hidden = true; this.onClose(); }
  toggle(): void { if (this.open) this.close(); else this.show(); }

  private click(t: Element): void {
    const p = this.p();
    const tab = t.closest('[data-tab]')?.getAttribute('data-tab') as SfPart | null;
    if (tab) { this.view = { part: tab, slot: tab === 'gun' ? 'gun0' : 'suit0' }; return this.render(); }
    if (t.closest('[data-close]')) return this.close();
    const slot = t.closest('[data-slot]')?.getAttribute('data-slot') as BenchSlot | null;
    if (slot) { this.view = { part: slot.startsWith('gun') ? 'gun' : 'suit', slot }; return this.render(); }
    const act = t.closest('[data-act]');
    if (!act) return;
    const id = act.getAttribute('data-id') ?? '', kind = act.getAttribute('data-act'), index = Number(this.view.slot.slice(-1));
    if (kind === 'dismantle') this.onEvents?.(dismantle(p, id));
    if (kind === 'craft') craft(p, id);
    if (kind === 'fit') fit(p, this.view.part, index, id);
    if (kind === 'unfit') fit(p, this.view.part, index, null);
    if (kind === 'soul') buySoulSlot(p);
    this.render();
  }

  render(): void {
    if (this.el.hidden) return;
    const m = benchModel(this.p());
    this.el.innerHTML = benchHtml(m, this.view);
    const sel = this.view.slot, part = this.view.part === 'gun' ? 'pistol' : 'suit';
    const draw = () => { const c = this.el.querySelector<HTMLCanvasElement>('.wb-px'); if (c) void paintBench(c, part, m.slots, sel, null, this.colors()); };
    draw();
    requestAnimationFrame(draw);
  }

  /** The theme's colours for the canvas drawing (CSS variables cannot reach into it). */
  private colors(): ArtColors {
    const css = getComputedStyle(this.el);
    const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
    return { fg: v('--t-fg', '#5dff8a'), dim: v('--t-dim', '#34a85c'), line: v('--t-line', '#1f7a3e'), warn: v('--t-warn', '#e6ffb0'), ch: v('--t-ch', '#9dffb8'), fill: '#04200b', fitted: '#073a16' };
  }
}
