import type { Screen } from '../../app/router';
import { HEAL_COST, PRICE } from '../../sim/run/shop';
import { getItem } from '../../data/items';
import type { RunState, ShopStock } from '../../sim/run/types';
import { t } from '../i18n/ko';
import { itemLabel } from '../company/text';

export interface RestApi {
  run(): RunState;
  heal(): void;
  talk(a: string, b: string): void;
}

export class RestScreen implements Screen {
  private el = document.createElement('div');

  constructor(private readonly api: RestApi) {}

  mount(root: HTMLElement): void {
    const mercs = this.api.run().roster.mercs;
    const hurt = mercs.filter((m) => m.injury > 0).map((m) => m.name).join(', ') || '없음';
    const opts = mercs.map((m) => `<option value="${m.id}">${m.name}</option>`).join('');
    const optsB = mercs.map((m, i) => `<option value="${m.id}" ${i === 1 ? 'selected' : ''}>${m.name}</option>`).join('');
    this.el.className = 'screen node-screen';
    this.el.innerHTML = `<div class="panel node-panel"><h2>휴식</h2><p>모닥불을 피웠다. 무엇을 할까?</p>
      <div class="choice-list"><button class="btn" data-testid="rest-heal">상처를 돌본다 — 모든 부상 회복 (부상자: ${hurt})</button>
      ${mercs.length >= 2 ? `<div class="talk"><select data-testid="talk-a">${opts}</select> 와(과) <select data-testid="talk-b">${optsB}</select>
        <button class="btn" data-testid="rest-talk">이야기를 나눈다 — 친밀도 ↑</button></div>` : ''}</div></div>`;
    this.el.addEventListener('click', (e) => {
      const id = (e.target as HTMLElement).closest<HTMLElement>('button')?.dataset.testid;
      if (id === 'rest-heal') this.api.heal();
      if (id === 'rest-talk') {
        const a = this.el.querySelector<HTMLSelectElement>('[data-testid="talk-a"]')!.value;
        const b = this.el.querySelector<HTMLSelectElement>('[data-testid="talk-b"]')!.value;
        if (a !== b) this.api.talk(a, b);
      }
    });
    root.appendChild(this.el);
  }

  unmount(): void {
    this.el.remove();
  }
}

export interface ShopApi {
  run(): RunState;
  stock(): ShopStock;
  buy(i: number): void;
  sell(i: number): void;
  heal(id: string): void;
  leave(): void;
}

const CLICK_LOCK_MS = 350;

export class ShopScreen implements Screen {
  private el = document.createElement('div');
  private lastAction = -Infinity;

  constructor(private readonly api: ShopApi) {}

  mount(root: HTMLElement): void {
    this.el.className = 'screen node-screen';
    this.el.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
      if (!b || b.disabled) return;
      // the list re-renders and shifts after each action: ignore the second half of a double-click
      const now = performance.now();
      if (now - this.lastAction < CLICK_LOCK_MS) return;
      this.lastAction = now;
      if (b.dataset.buy) this.api.buy(Number(b.dataset.buy));
      else if (b.dataset.sell) this.api.sell(Number(b.dataset.sell));
      else if (b.dataset.heal) this.api.heal(b.dataset.heal);
      else if (b.dataset.testid === 'leave-shop') return this.api.leave();
      this.render();
    });
    root.appendChild(this.el);
    this.render();
  }

  private render(): void {
    const run = this.api.run();
    const row = (id: string) => { const l = itemLabel(id); return `<span class="item tier-${l.tier}"><b>${l.name}</b> <small>${t(`tier.${l.tier}`)}</small></span><small class="muted">${l.detail}</small>`; };
    const buy = this.api.stock().items.map((it, i) => `<li class="${it.sold ? 'sold' : ''}">${row(it.itemId)}<span class="price">${it.price}G</span>
      <button class="btn small" data-buy="${i}" data-testid="buy-${i}" ${it.sold || run.gold < it.price ? 'disabled' : ''}>${it.sold ? '판매됨' : '구매'}</button></li>`).join('');
    const sell = run.roster.inventory.map((id, i) => `<li>${row(id)}<span class="price">${Math.floor(PRICE[getItem(id).tier]! / 2)}G</span><button class="btn small" data-sell="${i}">판매</button></li>`).join('');
    const heal = run.roster.mercs.filter((m) => m.injury > 0).map((m) => `<li>${m.name} (부상 ${m.injury})<button class="btn small" data-heal="${m.id}" ${run.gold < HEAL_COST ? 'disabled' : ''}>치료 ${HEAL_COST}G</button></li>`).join('');
    this.el.innerHTML = `<div class="panel node-panel"><h2>상점</h2><p>보유 골드 <b class="gold">${run.gold}G</b></p>
      <h3>판매 중</h3><ul class="shop-list">${buy}</ul>
      ${sell ? `<h3>보관함 판매</h3><ul class="shop-list">${sell}</ul>` : ''}
      ${heal ? `<h3>치료</h3><ul class="shop-list">${heal}</ul>` : ''}
      <div class="choice-list"><button class="btn primary" data-testid="leave-shop">떠난다</button></div></div>`;
  }

  unmount(): void {
    this.el.remove();
  }
}
