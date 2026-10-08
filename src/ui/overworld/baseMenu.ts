/** what the base menu's buttons do */
export type BaseMenuAct = 'build' | 'pod' | 'lab' | 'bench' | 'roster' | 'souls';
const ITEMS: [BaseMenuAct, string, string][] = [['build', '건설', 'B'], ['pod', '원정', ''], ['lab', '연구실', ''], ['bench', '작업장', ''], ['roster', '클론', 'L'], ['souls', '영혼석', 'J']];

/** The base menu's buttons (the build button lit while the building list is open). */
export const baseMenuHtml = (building: boolean): string =>
  ITEMS.map(([k, name, key]) => `<button type="button" data-menu="${k}" class="${k === 'build' && building ? 'on' : ''}">${name}${key ? `<small>${key}</small>` : ''}</button>`).join('');

/** Base mode's bar along the bottom (spec 2026-10-08 §1): build, send a clone down, the lab, the workshop, the clones, the soul stones. */
export class BaseMenu {
  readonly el = document.createElement('div');
  private html = '';
  constructor(act: (k: BaseMenuAct) => void) {
    this.el.className = 'base-menu'; this.el.hidden = true;
    this.el.addEventListener('click', (e) => { const k = (e.target as HTMLElement).closest<HTMLElement>('[data-menu]')?.dataset.menu; if (k) act(k as BaseMenuAct); });
  }
  update(on: boolean, building: boolean): void {
    this.el.hidden = !on;
    const html = baseMenuHtml(building);
    if (on && html !== this.html) { this.html = html; this.el.innerHTML = html; }
  }
}
