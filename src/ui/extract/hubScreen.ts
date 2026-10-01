import type { Screen } from '../../app/router';
import { GEAR_SLOTS, xitem, type GearSlot } from '../../data/extract';
import { heroSetup } from '../../sim/extract/heroSetup';
import { bagSlots, carryLimit, quickSlots, totalWeight } from '../../sim/extract/loadout';
import { canSortie, MERCHANT_STOCK, STASH_SLOTS, type XProfile } from '../../sim/extract/profile';
import { t } from '../i18n/ko';
import { itemCell, itemDetail, SLOT_NAME } from './itemCell';
import '../styles/extract.css';

export type HubOp =
  | { op: 'equipFromStash'; i: number } | { op: 'toStash'; where: 'bag' | 'quick' | 'pouch' | GearSlot; i: number }
  | { op: 'sell'; i: number; all: boolean } | { op: 'buy'; id: string } | { op: 'starter' };

export interface HubApi {
  profile(): XProfile;
  act(op: HubOp): void;
  sortie(): void;
  levelUp(): void;
  quit(): void;
}

type Sel = { from: 'stash' | 'bag' | 'quick' | 'pouch' | 'shop'; i: number } | { from: 'gear'; slot: GearSlot } | null;

/** The base: stash, loadout, merchant, and the sortie button. */
export class HubScreen implements Screen {
  private readonly el = document.createElement('div');
  private sel: Sel = null;
  private error = '';

  constructor(private readonly api: HubApi) {}

  mount(root: HTMLElement): void {
    this.el.className = 'screen xhub';
    this.el.dataset.testid = 'extract-hub';
    this.el.addEventListener('click', (e) => this.onClick(e));
    root.appendChild(this.el);
    this.render();
  }

  render(): void {
    const p = this.api.profile();
    const l = p.loadout;
    const st = heroSetup(p.hero, l).stats;
    const ok = canSortie(p);
    const sel = this.sel;
    const isSel = (from: string, i: number) => !!sel && sel.from === from && 'i' in sel && sel.i === i;
    const gear = GEAR_SLOTS.map((slot) => `<div class="xslot"><small>${SLOT_NAME[slot]}</small>${itemCell(l.equipped[slot] ? { id: l.equipped[slot]!, n: 1 } : null, { empty: slot, data: `data-gear="${slot}"`, testid: `gear-${slot}`, selected: !!sel && sel.from === 'gear' && sel.slot === slot })}</div>`).join('');
    const stash = Array.from({ length: Math.max(STASH_SLOTS, p.stash.length) }, (_, i) => itemCell(p.stash[i], { data: p.stash[i] ? `data-stash="${i}"` : '', testid: `stash-${i}`, selected: isSel('stash', i) })).join('');
    const shop = MERCHANT_STOCK.map((id, i) => `<div class="xshop">${itemCell({ id, n: 1 }, { data: `data-shop="${i}"`, testid: `shop-${id}`, selected: isSel('shop', i), small: true })}<small>${xitem(id).value * 2}G</small></div>`).join('');
    const detailId = !sel ? null : sel.from === 'gear' ? l.equipped[sel.slot] : sel.from === 'stash' ? p.stash[sel.i]?.id : sel.from === 'shop' ? MERCHANT_STOCK[sel.i] : sel.from === 'bag' ? l.bag[sel.i]?.id : sel.from === 'quick' ? l.quick[sel.i]?.id : l.pouch?.id;
    const pending = p.hero.pendingLevelUps > 0;
    this.el.innerHTML = `<header class="xhub-head">
        <div><h1>거점</h1><span class="gold" data-testid="xgold">${p.gold} G</span>
          <span>${p.hero.name} · Lv${p.hero.level} ${t(`class.${p.hero.classId}`)}</span>
          <span class="muted">출격 ${p.sorties} · 탈출 ${p.extracted} · 최고 회수 ${p.bestHaul}G</span></div>
        <div class="xhub-actions">
          ${pending ? '<button class="btn primary" data-act="levelup" data-testid="xlevelup">레벨업 선택</button>' : ''}
          <button class="btn" data-act="starter" data-testid="starter">기본 장비 받기 (무료)</button>
          <button class="btn primary" data-act="sortie" data-testid="start-sortie" ${ok.ok ? '' : 'disabled'}>출격</button>
          <button class="btn" data-act="quit">타이틀로</button></div>
      </header>
      ${ok.ok ? '' : '<p class="xwarn">창고가 넘쳤다 — 정리해야 출격할 수 있다</p>'}${this.error ? `<p class="xwarn">${this.error}</p>` : ''}
      <div class="xhub-body">
        <section class="xhub-col"><h3>장착</h3><div class="xgear">${gear}</div>
          <p class="muted">체력 ${st.maxHp} · 공격 ${Math.round(st.atk)} · 방어 ${Math.round(st.def)} · 이동 ${st.moveSpeed.toFixed(1)}</p>
          <h4>퀵슬롯</h4><div class="xgrid">${Array.from({ length: quickSlots(l) }, (_, i) => itemCell(l.quick[i], { data: l.quick[i] ? `data-quick="${i}"` : '', selected: isSel('quick', i) })).join('')}</div>
          <h4>안전 주머니 <small>죽어도 남는다</small></h4><div class="xgrid">${itemCell(l.pouch, { data: l.pouch ? 'data-pouch="0"' : '', selected: isSel('pouch', 0) })}</div>
          <h4>가방 <small>${l.bag.length}/${bagSlots(l)}칸 · 무게 ${totalWeight(l)}/${carryLimit(l)}</small></h4>
          <div class="xgrid">${Array.from({ length: bagSlots(l) }, (_, i) => itemCell(l.bag[i], { data: l.bag[i] ? `data-bag="${i}"` : '', selected: isSel('bag', i) })).join('')}</div></section>
        <section class="xhub-col wide"><h3>창고 <small>${p.stash.length}/${STASH_SLOTS}</small></h3><div class="xgrid stash">${stash}</div>
          <div class="xbag-detail">${detailId ? itemDetail(detailId) + this.actions() : '<p class="muted">아이템을 눌러 정보를 본다. 출격 중 쓰러지면 장착·가방·퀵슬롯을 모두 잃는다 (안전 주머니만 남음).</p>'}</div></section>
        <section class="xhub-col"><h3>상인 <small>판매 = 가치 · 구매 = 가치 ×2</small></h3><div class="xshop-list">${shop}</div></section>
      </div>`;
  }

  private actions(): string {
    const s = this.sel!;
    const b = (act: string, label: string) => `<button class="btn" data-act="${act}" data-testid="hub-${act}">${label}</button>`;
    if (s.from === 'stash') {
      const id = this.api.profile().stash[s.i]!.id;
      const d = xitem(id);
      return `<div class="xacts">${b('take', d.kind === 'gear' ? '장착' : d.kind === 'consumable' ? '퀵슬롯/가방에' : '가방에')}${b('sell1', `팔기 ${d.value}G`)}${this.api.profile().stash[s.i]!.n > 1 ? b('sellAll', '전부 팔기') : ''}</div>`;
    }
    if (s.from === 'shop') return `<div class="xacts">${b('buy', `사기 ${xitem(MERCHANT_STOCK[s.i]!).value * 2}G`)}</div>`;
    return `<div class="xacts">${b('store', '창고로')}</div>`;
  }

  private onClick(e: Event): void {
    const t = (e.target as HTMLElement).closest<HTMLElement>('button');
    if (!t || (t as HTMLButtonElement).disabled) return;
    const ds = t.dataset;
    this.error = '';
    if (ds.stash !== undefined) this.sel = { from: 'stash', i: Number(ds.stash) };
    else if (ds.shop !== undefined) this.sel = { from: 'shop', i: Number(ds.shop) };
    else if (ds.bag !== undefined) this.sel = { from: 'bag', i: Number(ds.bag) };
    else if (ds.quick !== undefined) this.sel = { from: 'quick', i: Number(ds.quick) };
    else if (ds.pouch !== undefined) this.sel = { from: 'pouch', i: 0 };
    else if (ds.gear && this.api.profile().loadout.equipped[ds.gear as GearSlot]) this.sel = { from: 'gear', slot: ds.gear as GearSlot };
    else if (ds.act === 'sortie') return this.api.sortie();
    else if (ds.act === 'levelup') return this.api.levelUp();
    else if (ds.act === 'quit') return this.api.quit();
    else if (ds.act) this.act(ds.act);
    this.render();
  }

  private act(act: string): void {
    const s = this.sel;
    try {
      if (act === 'starter') this.api.act({ op: 'starter' });
      else if (s?.from === 'stash' && act === 'take') this.api.act({ op: 'equipFromStash', i: s.i });
      else if (s?.from === 'stash' && (act === 'sell1' || act === 'sellAll')) this.api.act({ op: 'sell', i: s.i, all: act === 'sellAll' });
      else if (s?.from === 'shop' && act === 'buy') this.api.act({ op: 'buy', id: MERCHANT_STOCK[s.i]! });
      else if (s && act === 'store') this.api.act({ op: 'toStash', where: s.from === 'gear' ? s.slot : (s.from as 'bag' | 'quick' | 'pouch'), i: 'i' in s ? s.i : 0 });
      this.sel = act === 'buy' ? this.sel : null;
    } catch (err) {
      this.error = errorText(err);
    }
  }

  unmount(): void {
    this.el.remove();
  }
}

function errorText(err: unknown): string {
  const m = err instanceof Error ? err.message : String(err);
  if (m.includes('gold')) return '골드가 부족하다';
  if (m.includes('stash')) return '창고에 자리가 없다';
  if (m.includes('room')) return '가방에 자리가 없다 (칸 또는 무게)';
  if (m.includes('weapon')) return '이 직업은 쓸 수 없는 무기다';
  return '할 수 없다';
}
