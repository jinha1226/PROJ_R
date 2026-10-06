export interface MenuState { speed: number; speeds: number[]; turnBased?: boolean; dot?: boolean; keys: string }
export interface MenuActions { speed(v: number): void; mode?: () => void; dot?: () => void; restart(): void; quit?: () => void; close(): void;
  /** the record windows (roster, status, gear, bag) and, on the surface, the build panel: the top bar keeps only this menu */
  pip?: (tab: 'roster' | 'stat' | 'gear' | 'bag') => void; build?: () => void }

/** The menu (top right): fight mode, speed, start over, back to the title — in the Pip-Boy frame. The game waits while it is open. */
export class OptionsMenu {
  readonly el = document.createElement('div');

  constructor(private readonly state: () => MenuState, private readonly a: MenuActions) {
    this.el.className = 'pip-win menu-win';
    this.el.hidden = true;
    this.el.addEventListener('click', (e) => {
      const t = e.target as HTMLElement, b = t.closest<HTMLElement>('[data-m]');
      if (t === this.el || b?.dataset.m === 'close') { this.close(); return; }
      if (!b) return;
      const m = b.dataset.m!;
      if (m.startsWith('speed:')) a.speed(Number(m.slice(6)));
      if (m === 'turn' || m === 'real') { const s = this.state(); if ((m === 'turn') !== !!s.turnBased) a.mode?.(); }
      if (m === 'dot-on' || m === 'dot-off') { if ((m === 'dot-on') !== !!this.state().dot) a.dot?.(); }
      if (m.startsWith('pip:')) { this.close(); a.pip?.(m.slice(4) as 'roster'); return; }
      if (m === 'build') { this.close(); a.build?.(); return; }
      if (m === 'restart') { this.close(); a.restart(); return; }
      if (m === 'quit') { this.close(); a.quit?.(); return; }
      this.draw();
    });
  }

  get open(): boolean { return !this.el.hidden; }
  toggle(): void { if (this.open) this.close(); else { this.el.hidden = false; this.draw(); } }
  close(): void { if (this.el.hidden) return; this.el.hidden = true; this.a.close(); }

  private draw(): void {
    const s = this.state();
    const on = (k: boolean) => (k ? ' class="on"' : '');
    const mode = this.a.mode ? `<div class="menu-row"><span>전투</span><button type="button" data-m="turn"${on(!!s.turnBased)}>턴제</button><button type="button" data-m="real"${on(!s.turnBased)}>실시간</button></div>` : '';
    const dot = this.a.dot ? `<div class="menu-row"><span>도트</span><button type="button" data-m="dot-on"${on(!!s.dot)}>켬</button><button type="button" data-m="dot-off"${on(!s.dot)}>끔</button></div>` : '';
    const speeds = s.speeds.map((v) => `<button type="button" data-m="speed:${v}"${on(s.speed === v)}>×${v}</button>`).join('');
    this.el.innerHTML = `<div class="pip-frame menu-frame"><header><span class="pip-title">메뉴</span><button type="button" data-m="close">✕</button></header>
      <div class="menu-body">${this.a.pip ? `<div class="menu-row"><button type="button" data-m="pip:roster">명단</button><button type="button" data-m="pip:stat">상태</button><button type="button" data-m="pip:gear">장비</button><button type="button" data-m="pip:bag">가방</button>${this.a.build ? '<button type="button" data-m="build">건설</button>' : ''}</div>` : ''}${mode}<div class="menu-row"><span>속도</span>${speeds}</div>${dot}
      <div class="menu-row"><button type="button" data-m="restart">다시 시작</button>${this.a.quit ? '<button type="button" data-m="quit">타이틀</button>' : ''}</div>
      <p class="menu-keys">${s.keys}</p></div></div>`;
  }
}
