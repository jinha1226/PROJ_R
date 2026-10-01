import { GEAR_SLOTS, xitem, type GearSlot } from '../../data/extract';
import { bagSlots, carriedValue, carryLimit, quickSlots, totalWeight } from '../../sim/extract/loadout';
import { lootSource } from '../../sim/world/interact';
import type { WorldSim } from '../../sim/world/worldSim';
import { itemCell, itemDetail, SLOT_NAME } from './itemCell';

export interface BagPanelOpts {
  sim: WorldSim;
  /** container or pile being looted (absent in the pause menu) */
  source?: string;
  close(): void;
  /** pause menu only: abandon the sortie */
  abandon?(): void;
}

type Sel = { where: 'bag' | 'quick' | 'pouch' | 'src'; i: number } | { where: 'gear'; slot: GearSlot } | null;

/** Loot window (container ↔ bag) and the pause-menu bag: take, drop, equip, quick slot, pouch. */
export class BagPanel {
  readonly el = document.createElement('div');
  private sel: Sel = null;
  private confirmLeave = false;
  private lastKey = '';
  private member: string | null = null;

  constructor(private readonly o: BagPanelOpts) {
    this.el.className = 'xbag';
    this.el.addEventListener('click', (e) => this.onClick(e));
    this.render();
  }

  render(): void {
    const w = this.o.sim.w;
    const l = w.hero.loadout;
    const src = this.o.source ? lootSource(w, this.o.source) ?? [] : null;
    // re-render only when something changed: replacing the DOM every frame swallows clicks
    const party = w.party.order.filter((id) => w.b.units.find((u) => u.id === id)?.alive);
    if (!this.member || !party.includes(this.member)) this.member = w.heroId;
    const worn = w.party.gear[this.member]?.equipped ?? {};
    const key = JSON.stringify([l, src, this.sel, this.confirmLeave, this.member, worn]);
    if (key === this.lastKey) return;
    this.lastKey = key;
    const sel = this.sel;
    const isSel = (where: string, i: number) => !!sel && sel.where === where && 'i' in sel && sel.i === i;
    const gear = GEAR_SLOTS.map((slot) => `<div class="xslot"><small>${SLOT_NAME[slot]}</small>${itemCell(worn[slot] ? { id: worn[slot]!, n: 1 } : null, { empty: slot, data: `data-gear="${slot}"`, selected: !!sel && sel.where === 'gear' && sel.slot === slot })}</div>`).join('');
    const who = party.map((id) => `<button class="btn ${id === this.member ? 'primary' : ''}" data-member="${id}">${w.party.mercs[id]!.name}</button>`).join('');
    const bag = Array.from({ length: bagSlots(l) }, (_, i) => itemCell(l.bag[i], { data: l.bag[i] ? `data-bag="${i}"` : '', testid: `bag-${i}`, selected: isSel('bag', i) })).join('');
    const quick = Array.from({ length: quickSlots(l) }, (_, i) => itemCell(l.quick[i], { data: l.quick[i] ? `data-quick="${i}"` : '', selected: isSel('quick', i) })).join('');
    const detailId = !sel ? null : sel.where === 'gear' ? worn[sel.slot] : sel.where === 'src' ? src?.[sel.i]?.id : sel.where === 'bag' ? l.bag[sel.i]?.id : sel.where === 'quick' ? l.quick[sel.i]?.id : l.pouch?.id;
    this.el.innerHTML = `<div class="xbag-panel" data-testid="${src ? 'loot-panel' : 'pause-panel'}">
      <header><h3>${src ? '전리품' : '일시정지 — 가방'}</h3><button class="btn" data-act="close" data-testid="bag-close">${src ? '닫기' : '계속'}</button></header>
      ${src ? `<section><h4>안에 든 것 <small>눌러서 가방에 넣기</small></h4><div class="xgrid">${src.length ? src.map((s, i) => itemCell(s, { data: `data-src="${i}"`, testid: `loot-${i}`, selected: isSel('src', i) })).join('') : '<p class="muted">비었다</p>'}</div></section>` : ''}
      <section><h4>가방 <small>${l.bag.length}/${bagSlots(l)}칸 · 무게 ${totalWeight(l)}/${carryLimit(l)} · 들고 있는 가치 ${carriedValue(l)}G</small></h4><div class="xgrid">${bag}</div></section>
      <section class="xbag-row">${l.quick.some((q) => q) ? `<div><h4>퀵슬롯</h4><div class="xgrid">${quick}</div></div>` : ''}
        <div><h4>안전 주머니 <small>죽어도 남는다</small></h4><div class="xgrid">${itemCell(l.pouch, { data: l.pouch ? 'data-pouch="0"' : '', selected: !!sel && sel.where === 'pouch' })}</div></div></section>
      <section><h4>장착 <small>세계는 계속 움직인다</small></h4><div class="xacts">${who}</div><div class="xgear">${gear}</div></section>
      <div class="xbag-detail">${detailId ? itemDetail(detailId) + this.actions(detailId) : '<p class="muted">아이템을 눌러 정보를 본다</p>'}</div>
      ${this.o.abandon ? `<footer><button class="btn ${this.confirmLeave ? 'danger' : ''}" data-act="abandon" data-testid="abandon">${this.confirmLeave ? '정말 나간다 (이번 출격은 없던 일)' : '거점으로 돌아가기 (출격 무효)'}</button></footer>` : ''}
    </div>`;
  }

  private actions(id: string): string {
    const sel = this.sel!;
    const d = xitem(id);
    const b = (act: string, label: string) => `<button class="btn" data-act="${act}" data-testid="act-${act}">${label}</button>`;
    if (sel.where === 'src') return `<div class="xacts">${b('take', '가방에 넣기')}</div>`;
    if (sel.where === 'gear') return `<div class="xacts">${b('unequip', '벗기')}</div>`;
    if (sel.where === 'pouch') return '';
    const out: string[] = [];
    if (sel.where === 'bag' && d.kind === 'gear') out.push(b('equip', `${this.o.sim.w.party.mercs[this.member!]?.name ?? ''}에게 장착 (2초)`));
    if (sel.where === 'bag' && d.kind === 'consumable') out.push(b('use', '사용'));
    if (sel.where === 'bag') out.push(b('pouch', '안전 주머니에'));
    out.push(b('drop', '버리기'));
    return `<div class="xacts">${out.join('')}</div>`;
  }

  private onClick(e: Event): void {
    const t = (e.target as HTMLElement).closest<HTMLElement>('button');
    if (!t) return;
    const sim = this.o.sim;
    const ds = t.dataset;
    if (ds.act === 'close') return this.o.close();
    if (ds.act === 'abandon') {
      if (this.confirmLeave) return this.o.abandon?.();
      this.confirmLeave = true;
      return this.render();
    }
    if (ds.src !== undefined) {
      // a tap on loot takes it straight away (looting is under time pressure)
      sim.lootTake(this.o.source!, Number(ds.src));
      this.sel = null;
      return this.render();
    }
    if (ds.bag !== undefined) this.sel = { where: 'bag', i: Number(ds.bag) };
    else if (ds.quick !== undefined) this.sel = { where: 'quick', i: Number(ds.quick) };
    else if (ds.pouch !== undefined) this.sel = { where: 'pouch', i: 0 };
    else if (ds.gear && sim.w.party.gear[this.member!]?.equipped[ds.gear as GearSlot]) this.sel = { where: 'gear', slot: ds.gear as GearSlot };
    else if (ds.member) { this.member = ds.member; this.sel = null; }
    else if (ds.act) this.act(ds.act);
    this.render();
  }

  private act(act: string): void {
    const sim = this.o.sim;
    const s = this.sel;
    if (!s) return;
    if (s.where === 'src' && act === 'take') sim.lootTake(this.o.source!, s.i);
    else if (s.where === 'gear' && act === 'unequip') sim.unequip(s.slot, this.member!);
    else if ((s.where === 'bag' || s.where === 'quick') && act === 'drop') sim.lootDrop(s.where, s.i);
    else if (s.where === 'bag' && act === 'equip') sim.equip(s.i, this.member!);
    else if (s.where === 'bag' && act === 'use') sim.useItem(s.i);
    else if (s.where === 'bag' && act === 'quick') {
      const l = sim.w.hero.loadout;
      const free = Array.from({ length: quickSlots(l) }, (_, i) => i).find((i) => !l.quick[i]) ?? 0;
      sim.toQuick(s.i, free);
    } else if (s.where === 'bag' && act === 'pouch') sim.toPouch(s.i);
    this.sel = null;
  }
}
