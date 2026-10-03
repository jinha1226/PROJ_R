import { buy, type MetaState } from '../../../sim/grid/meta';
import type { EngraveId } from '../../../sim/grid/engraveCore';
import type { GunGroup } from '../../../sim/grid/items';
import type { RunOptions } from '../../../sim/grid/runSetup';
import { STATIONS, type StationId } from '../../../sim/grid/ship';
import type { GEvent } from '../../../sim/grid/types';
import type { GridRuntime } from '../../../view/grid/gridRuntime';
import type { ShipKit } from '../../../view/grid/shipKit';
import { launchOptions, panelContents, toggleStartSuit } from './panelContents';
import '../../styles/ship.css';
export interface ShipDeckApi {
  meta: MetaState; kit: ShipKit; lastEnergy: number; wake: boolean; saved: boolean;
  save(meta: MetaState): void; launch(options: RunOptions): void; resume(): void; quit(): void;
}
/** Ship UI layered over GridScreen: it owns no walking input or animation loop. */
export class ShipDeck {
  readonly el = document.createElement('div');
  private readonly hud = document.createElement('div');
  private readonly panel = document.createElement('div');
  private selected: StationId | null = null;
  private options: RunOptions = { gun: 'pistol', start: 1, startSuit: [] };
  private runtime?: GridRuntime;
  get blocked(): boolean { return this.selected !== null; }
  constructor(readonly api: ShipDeckApi) {
    this.el.className = 'ship-overlay'; this.el.dataset.testid = 'ship-deck';
    this.hud.className = 'ship-hud'; this.panel.className = 'ship-modal'; this.panel.hidden = true;
    this.el.append(this.hud, this.panel);
  }
  mount(root: HTMLElement, runtime: GridRuntime): void { this.runtime = runtime; root.classList.add('ship'); root.append(this.el); this.drawHud(); }
  private drawHud(): void {
    const m = this.api.meta;
    this.hud.innerHTML = `<b>우주선 · ⚡${m.energy} · 최고 ${m.best}층</b><p>${m.suit ? `${m.suit.floor}층에 슈트가 남아 있다` : '시설에 부딪치면 시설 창이 열린다'}</p><small>${this.api.wake ? '복제 포드에서 깨어났다 · ' : ''}WASD · 스틱 · 바닥 탭으로 이동</small><div class="row"></div>`;
    const row = this.hud.querySelector('.row')!;
    if (this.api.saved) this.button(row, '이어하기', () => this.api.resume(), 'ship-continue');
    this.button(row, '타이틀', () => this.api.quit(), 'ship-quit');
  }
  event(e: GEvent): void {
    if (e.type !== 'station' || !e.text || !(e.text in STATIONS)) return;
    this.selected = e.text as StationId; this.drawPanel();
  }
  close(): void { this.selected = null; this.panel.hidden = true; }
  private button(parent: Element, label: string, click: () => void, testid?: string): HTMLButtonElement {
    const b = document.createElement('button'); b.className = 'btn'; b.textContent = label;
    if (testid) b.dataset.testid = testid;
    b.onclick = click; parent.append(b); return b;
  }
  private drawPanel(): void {
    const id = this.selected!;
    const model = panelContents(this.api.meta, id, this.options, this.api.lastEnergy);
    this.panel.hidden = false; this.panel.replaceChildren(); this.panel.dataset.testid = `ship-panel-${id}`;
    const body = document.createElement('div'); body.className = 'panel'; body.setAttribute('role', 'dialog'); body.setAttribute('aria-label', model.title);
    const title = document.createElement('h2'); title.textContent = model.title; body.append(title);
    for (const line of model.lines) { const p = document.createElement('p'); p.textContent = line; body.append(p); }
    for (const item of model.shop) {
      const b = this.button(body, item.label, () => {
        if (!buy(this.api.meta, item.id)) return;
        this.api.save(this.api.meta); this.runtime?.powerShip(this.api.meta); this.drawHud(); this.drawPanel();
      }, `ship-buy-${item.id}`); b.disabled = !item.enabled;
    }
    for (const choice of model.choices) {
      const b = this.button(body, `${choice.selected ? '✓ ' : ''}${choice.label}`, () => {
        if (id === 'armory') this.options.gun = choice.id as GunGroup;
        if (id === 'nav') this.options = launchOptions(this.api.meta, { ...this.options, start: Number(choice.id) as 1 | 6 | 11 });
        if (id === 'hatch') this.options = toggleStartSuit(this.api.meta, this.options, choice.id as EngraveId);
        this.drawPanel();
      }, `ship-choice-${choice.id}`);
      b.disabled = !choice.enabled; b.setAttribute('aria-pressed', String(choice.selected));
    }
    if (id === 'hatch') {
      if (this.api.saved) { const p = document.createElement('p'); p.textContent = '진행 중인 출격이 있다. 이어하기로 돌아갈 수 있다.'; body.append(p); this.button(body, '이어하기', () => this.api.resume()); }
      const launch = this.button(body, '출격', () => this.api.launch(launchOptions(this.api.meta, this.options)), 'ship-launch');
      launch.disabled = this.api.saved;
    }
    this.button(body, '닫기', () => this.close(), 'ship-panel-close'); this.panel.append(body);
  }
}
