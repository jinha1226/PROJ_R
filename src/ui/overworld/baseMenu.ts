import type { BaseTool } from './baseTools';

/** what the base keys do */
export type BaseMenuAct = 'pod' | 'wall' | 'post';
const ITEMS: [BaseMenuAct, string][] = [['pod', '원정'], ['wall', '바리케이드'], ['post', '자리']];

/** The base keys (the tool in hand lit). */
export const baseMenuHtml = (tool: BaseTool | null): string =>
  ITEMS.map(([k, name]) => `<button type="button" data-menu="${k}" class="${k === tool ? 'on' : ''}">${name}</button>`).join('');

/** Base mode's keys along the bottom (spec 2026-10-09 §7): send a clone down, lay barricades, set posts. The modules are tapped where they stand. */
export class BaseMenu {
  readonly el = document.createElement('div');
  private html = '';
  constructor(act: (k: BaseMenuAct) => void) {
    this.el.className = 'base-menu'; this.el.hidden = true;
    this.el.addEventListener('click', (e) => { const k = (e.target as HTMLElement).closest<HTMLElement>('[data-menu]')?.dataset.menu; if (k) act(k as BaseMenuAct); });
  }
  update(on: boolean, tool: BaseTool | null): void {
    this.el.hidden = !on;
    const html = baseMenuHtml(tool);
    if (on && html !== this.html) { this.html = html; this.el.innerHTML = html; }
  }
}
