import type { PartyRow } from './hudState';

const esc = (v: unknown): string => String(v).replace(/[&"<>]/g, (c) => `&#${c.charCodeAt(0)};`);

/** Party status rows (a column in landscape, a strip of chips in portrait — CSS decides). */
export class PartyBar {
  readonly el = document.createElement('div');
  private key = '';

  constructor() {
    this.el.className = 'xhud-party';
    this.el.dataset.testid = 'party-status';
  }

  update(rows: PartyRow[]): void {
    const key = JSON.stringify(rows.map((r) => [r.id, r.dead, r.down, Math.round(r.hp * 40), r.lead]));
    if (key === this.key) return;
    this.key = key;
    this.el.innerHTML = rows.map((r) => `<div class="xp-row ${r.dead ? 'dead' : r.down ? 'down' : ''}" style="--c:${r.color}">
      <span class="xp-dot"></span><b>${esc(r.name)}${r.lead ? ' <i>리더</i>' : ''}</b><div class="xp-hp"><div style="width:${Math.round(r.hp * 100)}%"></div></div>
      <small>${r.dead ? '전사' : r.down ? '쓰러짐' : ''}</small></div>`).join('');
  }
}
