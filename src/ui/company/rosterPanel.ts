import type { ItemSlot, TacticId } from '../../data/types';
import type { Roster } from '../../sim/roster/types';
import { renderSheet, type SheetTab } from './characterSheet';
import { renderCard } from './rosterCards';

export interface RosterPanelApi {
  roster(): Roster;
  equip(mercId: string, itemId: string): void;
  unequip(mercId: string, slot: ItemSlot): void;
  setTactic(mercId: string, slot: number, tactic: TacticId): void;
  /** optional deploy checkboxes (company mode) */
  deployed?(): string[];
  toggleDeploy?(id: string): void;
  /** called after any change so the host can refresh its own parts */
  changed(): void;
}

/** Mercenary cards plus the character sheet (stats/skills/gear/relations/chronicle) with its actions. */
export class RosterPanel {
  readonly el = document.createElement('div');
  private open: { id: string; tab: SheetTab } | null = null;

  constructor(private readonly api: RosterPanelApi) {
    this.el.className = 'roster-panel';
    this.el.addEventListener('click', (e) => this.onClick(e));
    this.el.addEventListener('change', (e) => this.onChange(e));
  }

  render(): void {
    const r = this.api.roster();
    const deployed = new Set(this.api.deployed?.() ?? []);
    const withDeploy = !!this.api.toggleDeploy;
    const sheetMerc = this.open ? r.mercs.find((m) => m.id === this.open!.id) : undefined;
    if (!sheetMerc) this.open = null;
    this.el.innerHTML = `<div class="cards ${withDeploy ? '' : 'no-deploy'}">${r.mercs.map((m) => renderCard(m, deployed.has(m.id))).join('')}</div>
      ${sheetMerc ? `<div class="sheet-wrap">${renderSheet(sheetMerc, r, this.open!.tab)}</div>` : ''}`;
  }

  openSheet(id: string, tab: SheetTab = 'stats'): void {
    this.open = { id, tab };
    this.render();
  }

  private onChange(e: Event): void {
    const t = e.target as HTMLInputElement | HTMLSelectElement;
    if (t instanceof HTMLInputElement && t.dataset.deploy) this.api.toggleDeploy?.(t.dataset.deploy);
    if (t instanceof HTMLSelectElement && t.dataset.act === 'tactic' && this.open && t.value)
      this.api.setTactic(this.open.id, Number(t.dataset.slot), t.value as TacticId);
    this.render();
    this.api.changed();
  }

  private onClick(e: Event): void {
    const target = e.target as HTMLElement;
    if (target.closest('label.deploy') || target.closest('select')) return;
    const btn = target.closest<HTMLElement>('[data-act],[data-tab]');
    const card = target.closest<HTMLElement>('.merc-card');
    const sheet = this.open;
    if (btn?.dataset.tab && sheet) { this.open = { ...sheet, tab: btn.dataset.tab as SheetTab }; return this.render(); }
    if (btn?.dataset.act === 'close') { this.open = null; return this.render(); }
    if (btn?.dataset.act === 'equip' && sheet && btn.dataset.item) { this.api.equip(sheet.id, btn.dataset.item); this.render(); return this.api.changed(); }
    if (btn?.dataset.act === 'unequip' && sheet && btn.dataset.slot) { this.api.unequip(sheet.id, btn.dataset.slot as ItemSlot); this.render(); return this.api.changed(); }
    if (card?.dataset.merc) this.openSheet(card.dataset.merc, this.open?.tab ?? 'stats');
  }
}
