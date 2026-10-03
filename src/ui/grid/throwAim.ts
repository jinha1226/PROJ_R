import type { BeltItem } from '../../sim/grid/items';
import { potionName, type PotionKind } from '../../sim/grid/lore';
import type { Cell, GAction, GridState } from '../../sim/grid/types';
import { GridAim, type ThrowItem } from './gridAim';
import { ITEM_NAME } from './gridBelt';
import type { GridCmd } from './gridControls';

const potionOf = (it: ThrowItem): PotionKind | null => (it.startsWith('potion:') ? (it.slice(7) as PotionKind) : null);

/** How many of a throwable the hero carries. */
export function throwCount(s: GridState, it: ThrowItem): number {
  const p = potionOf(it);
  return p ? s.hero.gear.potions[p] ?? 0 : s.hero.gear.belt[it as Exclude<BeltItem, 'potion'>];
}

export function throwName(s: GridState, it: ThrowItem): string {
  const p = potionOf(it);
  return p ? potionName(s, p) : ITEM_NAME[it as Exclude<BeltItem, 'potion'>];
}

/** Throwing: the aim reticle, its bar (throw / cancel) and the area preview, for bombs, flasks and potions. */
export class ThrowAim {
  readonly bar = document.createElement('div');
  aim: GridAim | null = null;
  private key = '';

  constructor(private readonly s: () => GridState, push: (c: GridCmd) => void, private readonly act: (a: GAction) => boolean, private readonly show: (cells: Cell[] | null, ok: boolean) => void) {
    this.bar.className = 'gaim';
    this.bar.hidden = true;
    this.bar.innerHTML = '<span></span><button class="btn primary" data-a="go" data-testid="grid-aim-go">던지기</button><button class="btn" data-a="no">취소</button>';
    this.bar.addEventListener('click', (e) => { const a = (e.target as HTMLElement).closest<HTMLElement>('[data-a]')?.dataset.a; if (a) push(a === 'go' ? 'confirm' : 'cancel'); });
  }

  get item(): ThrowItem | null {
    return this.aim?.item ?? null;
  }

  /** Starts aiming something the hero carries (nothing happens with none left). */
  start(it: ThrowItem): void {
    this.aim = throwCount(this.s(), it) > 0 ? new GridAim(this.s(), it) : null;
  }

  /** A command while aiming, or a throwable picked; true when the aim took it (other commands wait while aiming). */
  command(c: GridCmd, it: ThrowItem | null): boolean {
    if (!this.aim) { if (it) this.start(it); return !!it; }
    if (c === 'confirm' || c === 'shoot' || it === this.aim.item) this.fire();
    else if (c === 'cancel' || it) { this.aim = null; if (it) this.start(it); }
    return true;
  }

  /** A tap on the map: the first moves the reticle, a second on the same cell throws. */
  tap(c: Cell): void {
    if (this.aim?.tap(c)) this.fire();
  }

  fire(): void {
    const a = this.aim;
    if (!a || !a.ok) return;
    const p = potionOf(a.item);
    const done = p ? this.act({ kind: 'throwPotion', p, at: a.cell }) : this.act({ kind: 'use', item: a.item as Exclude<BeltItem, 'potion'>, at: a.cell });
    if (done) this.aim = null;
  }

  label(): string {
    return this.aim ? throwName(this.s(), this.aim.item) : '';
  }

  /** The preview and the bar follow the reticle. */
  draw(): void {
    const a = this.aim;
    const key = a ? JSON.stringify([a.item, a.cell, a.ok]) : '';
    if (key === this.key) return;
    this.key = key;
    this.show(a ? a.area() : null, !!a?.ok);
    this.bar.hidden = !a;
    if (a) this.bar.querySelector('span')!.textContent = `${this.label()} — ${a.ok ? '칸을 다시 탭하거나 던지기' : '닿지 않는 곳'}`;
  }
}
