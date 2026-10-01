import type { Screen } from '../../app/router';
import { xitem, type GearSlot } from '../../data/extract';
import { canDeploy, type XCompany } from '../../sim/extract/company';
import { sellPrice } from '../../sim/extract/merchant';
import { MERCHANT_STOCK, STASH_SLOTS } from '../../sim/extract/profile';
import { t } from '../i18n/ko';
import { itemCell, itemDetail } from './itemCell';
import { rosterHtml } from './rosterPanel';
import '../styles/extract.css';

export type HubOp =
  | { op: 'equip'; merc: string; i: number } | { op: 'unequip'; merc: string; slot: GearSlot } | { op: 'starter'; merc: string }
  | { op: 'toPack'; i: number } | { op: 'fromPack'; i: number } | { op: 'toPouch'; i: number } | { op: 'fromPouch' }
  | { op: 'sell'; i: number; all: boolean } | { op: 'buy'; id: string } | { op: 'hire'; i: number }
  | { op: 'party'; merc: string } | { op: 'up'; merc: string };

export interface HubApi {
  company(): XCompany;
  act(op: HubOp): void;
  sortie(): void;
  levelUp(merc: string): void;
  quit(): void;
}

type Sel = { from: 'stash' | 'pack' | 'shop'; i: number } | { from: 'pouch' } | { from: 'gear'; slot: GearSlot } | null;

/** The company base: mercenaries and their gear, stash, sortie pack, merchant, and tavern. */
export class HubScreen implements Screen {
  private readonly el = document.createElement('div');
  private merc: string | null = null;
  private sel: Sel = null;
  private tab: 'shop' | 'tavern' = 'shop';
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
    const c = this.api.company();
    if (this.merc && !c.mercs.some((m) => m.id === this.merc)) this.merc = null;
    this.merc ??= c.party[0] ?? c.mercs[0]?.id ?? null;
    const sel = this.sel;
    const isSel = (from: string, i: number) => !!sel && sel.from === from && 'i' in sel && sel.i === i;
    const ready = c.party.length > 0 && c.party.every((id) => canDeploy(c.mercs.find((m) => m.id === id)!)) && c.stash.length <= STASH_SLOTS;
    const stash = Array.from({ length: Math.max(STASH_SLOTS, c.stash.length) }, (_, i) => itemCell(c.stash[i], { data: c.stash[i] ? `data-stash="${i}"` : '', testid: `stash-${i}`, selected: isSel('stash', i) })).join('');
    const pack = c.pack.map((s, i) => itemCell(s, { data: `data-pack="${i}"`, selected: isSel('pack', i), small: true })).join('') || '<p class="muted">비어 있음 — 창고에서 물약 등을 챙긴다</p>';
    const detailId = !sel ? null : sel.from === 'gear' ? c.gear[this.merc!]?.equipped[sel.slot] : sel.from === 'stash' ? c.stash[sel.i]?.id : sel.from === 'pack' ? c.pack[sel.i]?.id : sel.from === 'shop' ? MERCHANT_STOCK[sel.i] : c.pouch?.id;
    this.el.innerHTML = `<header class="xhub-head">
        <div><h1>거점</h1><span class="gold" data-testid="xgold">${c.gold} G</span>
          <span class="muted">출격 ${c.sorties} · 탈출 ${c.extracted} · 최고 회수 ${c.bestHaul}G · 전사 ${c.fallen.length}</span></div>
        <div class="xhub-actions"><button class="btn primary" data-act="sortie" data-testid="start-sortie" ${ready ? '' : 'disabled'}>출격 (${c.party.length}명)</button>
          <button class="btn" data-act="quit">타이틀로</button></div></header>
      ${c.stash.length > STASH_SLOTS ? '<p class="xwarn">창고가 넘쳤다 — 정리해야 출격할 수 있다</p>' : ''}${this.error ? `<p class="xwarn">${this.error}</p>` : ''}
      <div class="xhub-body">
        <section class="xhub-col">${rosterHtml(c, this.merc, sel?.from === 'gear' ? sel.slot : null)}</section>
        <section class="xhub-col wide"><h3>창고 <small>${c.stash.length}/${STASH_SLOTS}</small></h3><div class="xgrid stash">${stash}</div>
          <h4>출격 짐 <small>파티 공용 · 현장에서 함께 쓴다</small></h4><div class="xgrid">${pack}</div>
          <h4>안전 주머니 <small>전멸해도 남는다</small></h4><div class="xgrid">${itemCell(c.pouch, { data: c.pouch ? 'data-pouch="0"' : '', selected: sel?.from === 'pouch' })}</div>
          <div class="xbag-detail">${detailId ? itemDetail(detailId) + this.actions(c) : '<p class="muted">출격 중 죽은 용병은 돌아오지 않는다. 시체의 장비는 그 자리에서 되찾을 수 있다.</p>'}</div></section>
        <section class="xhub-col"><div class="xtabs"><button class="btn ${this.tab === 'shop' ? 'primary' : ''}" data-tab="shop">상인</button>
          <button class="btn ${this.tab === 'tavern' ? 'primary' : ''}" data-tab="tavern" data-testid="tab-tavern">선술집</button></div>
          ${this.tab === 'shop' ? this.shopHtml(isSel) : this.tavernHtml(c)}</section>
      </div>`;
  }

  private shopHtml(isSel: (from: string, i: number) => boolean): string {
    return `<p class="muted">판매 = 가치 · 구매 = 가치 ×2</p><div class="xshop-list">${MERCHANT_STOCK.map((id, i) => `<div class="xshop">${itemCell({ id, n: 1 }, { data: `data-shop="${i}"`, testid: `shop-${id}`, selected: isSel('shop', i), small: true })}<small>${xitem(id).value * 2}G</small></div>`).join('')}</div>`;
  }

  private tavernHtml(c: XCompany): string {
    if (!c.tavern.length) return '<p class="muted">지금은 일거리를 찾는 이가 없다. 다음 출격 뒤에 다시 와 보자.</p>';
    return c.tavern.map((cand, i) => `<div class="xcand" style="--c:${cand.merc.color}"><b>${cand.merc.name}</b>
      <small>Lv${cand.merc.level} ${t(`class.${cand.merc.classId}`)} · ${t(`trait.${cand.merc.revealed[0]}`)}</small>
      <button class="btn primary" data-hire="${i}" data-testid="hire-${i}" ${c.gold < cand.fee ? 'disabled' : ''}>영입 ${cand.fee}G</button></div>`).join('');
  }

  private actions(c: XCompany): string {
    const s = this.sel!;
    const b = (act: string, label: string, dis = false) => `<button class="btn" data-act="${act}" data-testid="hub-${act}" ${dis ? 'disabled' : ''}>${label}</button>`;
    if (s.from === 'stash') {
      const st = c.stash[s.i]!;
      const d = xitem(st.id);
      return `<div class="xacts">${d.kind === 'gear' && this.merc ? b('take', `${c.mercs.find((m) => m.id === this.merc)?.name ?? ''}에게 장착`) : ''}${b('pack', '출격 짐에')}${b('pouch', '안전 주머니에')}${b('sell1', `팔기 ${sellPrice(st.id)}G`)}${st.n > 1 ? b('sellAll', '전부 팔기') : ''}</div>`;
    }
    if (s.from === 'shop') return `<div class="xacts">${b('buy', `사기 ${xitem(MERCHANT_STOCK[s.i]!).value * 2}G`, c.gold < xitem(MERCHANT_STOCK[s.i]!).value * 2)}</div>`;
    return `<div class="xacts">${b('store', '창고로')}</div>`;
  }

  private onClick(e: Event): void {
    const el = (e.target as HTMLElement).closest<HTMLElement>('button');
    if (!el || (el as HTMLButtonElement).disabled) return;
    const ds = el.dataset;
    this.error = '';
    if (ds.merc) { this.merc = ds.merc; this.sel = null; }
    else if (ds.stash !== undefined) this.sel = { from: 'stash', i: Number(ds.stash) };
    else if (ds.pack !== undefined) this.sel = { from: 'pack', i: Number(ds.pack) };
    else if (ds.shop !== undefined) this.sel = { from: 'shop', i: Number(ds.shop) };
    else if (ds.pouch !== undefined) this.sel = { from: 'pouch' };
    else if (ds.gear && this.merc && this.api.company().gear[this.merc]?.equipped[ds.gear as GearSlot]) this.sel = { from: 'gear', slot: ds.gear as GearSlot };
    else if (ds.tab) this.tab = ds.tab as 'shop' | 'tavern';
    else if (ds.hire !== undefined) this.run({ op: 'hire', i: Number(ds.hire) });
    else if (ds.act === 'sortie') return this.api.sortie();
    else if (ds.act === 'quit') return this.api.quit();
    else if (ds.act === 'levelup' && this.merc) return this.api.levelUp(this.merc);
    else if (ds.act) this.act(ds.act);
    this.render();
  }

  private act(act: string): void {
    const s = this.sel;
    const m = this.merc;
    if (act === 'party' && m) return this.run({ op: 'party', merc: m });
    if (act === 'up' && m) return this.run({ op: 'up', merc: m });
    if (act === 'starter' && m) return this.run({ op: 'starter', merc: m });
    if (!s) return;
    if (s.from === 'stash' && act === 'take' && m) this.run({ op: 'equip', merc: m, i: s.i });
    else if (s.from === 'stash' && act === 'pack') this.run({ op: 'toPack', i: s.i });
    else if (s.from === 'stash' && act === 'pouch') this.run({ op: 'toPouch', i: s.i });
    else if (s.from === 'stash' && (act === 'sell1' || act === 'sellAll')) this.run({ op: 'sell', i: s.i, all: act === 'sellAll' });
    else if (s.from === 'shop' && act === 'buy') return this.run({ op: 'buy', id: MERCHANT_STOCK[s.i]! });
    else if (act === 'store' && s.from === 'gear' && m) this.run({ op: 'unequip', merc: m, slot: s.slot });
    else if (act === 'store' && s.from === 'pack') this.run({ op: 'fromPack', i: s.i });
    else if (act === 'store' && s.from === 'pouch') this.run({ op: 'fromPouch' });
    this.sel = null;
  }

  private run(op: HubOp): void {
    try {
      this.api.act(op);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.error = msg.includes('gold') ? '골드가 부족하다' : msg.includes('full') ? '자리가 없다' : msg.includes('room') ? '짐에 자리가 없다' : msg.includes('weapon') ? '이 직업은 쓸 수 없는 무기다' : '할 수 없다';
    }
  }

  unmount(): void {
    this.el.remove();
  }
}
