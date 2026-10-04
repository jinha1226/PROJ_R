import { buy, type MetaState } from '../../../sim/grid/meta';
import type { EngraveId } from '../../../sim/grid/engraveCore';
import type { Round } from '../../../sim/grid/rounds';
import type { RunOptions } from '../../../sim/grid/runSetup';
import { STATIONS, type StationId } from '../../../sim/grid/ship';
import type { GEvent } from '../../../sim/grid/types';
import type { GridRuntime } from '../../../view/grid/gridRuntime';
import type { ShipKit } from '../../../view/grid/shipKit';
import { launchOptions, panelContents, toggleStartSuit } from './panelContents';
import { workbenchModel } from '../../../sim/grid/workbench';
import { craft, fit } from '../../../sim/grid/mods';
import { repair } from '../../../sim/grid/repairs';
import { MATERIAL_NAME, MATERIALS } from '../../../sim/grid/materials';
import { WorkbenchScreen } from './workbenchScreen';
import { RepairScreen } from './repairScreen';
import '../../styles/ship.css';
export interface ShipDeckApi {
  meta: MetaState; kit: ShipKit; lastEnergy: number; wake: boolean; saved: boolean;
  save(meta: MetaState): void; launch(options: RunOptions): void; resume(): void; abandon(): void; quit(): void;
}
let remembered: RunOptions | null = null;

/** Ship UI layered over GridScreen: it owns no walking input or animation loop. */
export class ShipDeck {
  readonly el = document.createElement('div');
  private readonly hud = document.createElement('div');
  private readonly panel = document.createElement('div');
  private selected: StationId | null = null;
  /** the loadout picked last time (kept while the game is open) */
  private options: RunOptions = remembered ?? { gun: 'pistol', round: 'plain', start: 1, startSuit: [] };
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
    const mats = MATERIALS.map((k) => `${MATERIAL_NAME[k]} ${m.materials[k]}`).join(' · ');
    this.hud.innerHTML = `<b>⚡${m.energy}</b><span>최고 ${m.best}층</span>${m.suit ? `<em>${m.suit.floor}층에 슈트</em>` : ''}<small class="ship-mats">${mats}</small><div class="row"></div>${this.api.wake ? '<p>복제 포드 기동</p>' : ''}`;
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
  /** The workbench or the repair blueprint over the deck; closing returns to the station's panel. */
  private openScreen(which: 'workbench' | 'repair'): void {
    const m = this.api.meta;
    const changed = () => { this.api.save(m); this.runtime?.powerShip(m); this.drawHud(); };
    const close = () => { screen.el.remove(); this.drawPanel(); };
    const screen = which === 'workbench'
      ? new WorkbenchScreen({ model: () => workbenchModel(m), craft: (id) => { if (craft(m, id)) changed(); }, fit: (slot, id) => { if (fit(m, slot, id)) changed(); }, close })
      : new RepairScreen({ meta: () => m, repair: (id) => { if (repair(m, id)) changed(); }, close });
    this.panel.hidden = true;
    this.el.append(screen.el);
  }
  private drawPanel(): void {
    const id = this.selected!;
    const model = panelContents(this.api.meta, id, this.options, this.api.lastEnergy);
    this.panel.hidden = false; this.panel.replaceChildren(); this.panel.dataset.testid = `ship-panel-${id}`;
    const body = document.createElement('div'); body.className = 'panel'; body.setAttribute('role', 'dialog'); body.setAttribute('aria-label', model.title);
    const title = document.createElement('h2'); title.textContent = model.title; body.append(title);
    for (const line of model.lines) { const p = document.createElement('p'); p.textContent = line; body.append(p); }
    for (const item of model.shop) {
      const group = model.groups.find(g => g.shop[0]?.id === item.id);
      if (group) { const heading = document.createElement('h3'); heading.textContent = group.label; body.append(heading); }
      const b = this.button(body, item.label, () => {
        if (!buy(this.api.meta, item.id)) return;
        this.api.save(this.api.meta); this.runtime?.powerShip(this.api.meta); this.drawHud(); this.drawPanel();
      }, `ship-buy-${item.id}`); b.disabled = !item.enabled;
    }
    for (const choice of model.choices) {
      const b = this.button(body, `${choice.selected ? '✓ ' : ''}${choice.label}`, () => {
        if (id === 'armory') this.options.round = choice.id as Round;
        if (id === 'nav') this.options = launchOptions(this.api.meta, { ...this.options, start: Number(choice.id) as 1 | 6 | 11 });
        if (id === 'hatch') this.options = toggleStartSuit(this.api.meta, this.options, choice.id as EngraveId);
        remembered = this.options;
        this.drawPanel();
      }, `ship-choice-${choice.id}`);
      b.disabled = !choice.enabled; b.setAttribute('aria-pressed', String(choice.selected));
    }
    if (id === 'armory') this.button(body, '작업대 열기', () => this.openScreen('workbench'), 'ship-workbench');
    if (id === 'core') this.button(body, '우주선 수리', () => this.openScreen('repair'), 'ship-repair');
    if (id === 'hatch') {
      if (this.api.saved) { const p = document.createElement('p'); p.textContent = '진행 중인 출격'; body.append(p); this.button(body, '이어하기', () => this.api.resume()); this.button(body, '출격 포기 (에너지는 남음)', () => this.api.abandon(), 'ship-abandon'); }
      const launch = this.button(body, '출격', () => this.api.launch(launchOptions(this.api.meta, this.options)), 'ship-launch');
      launch.disabled = this.api.saved;
    }
    this.button(body, '닫기', () => this.close(), 'ship-panel-close'); this.panel.append(body);
  }
}
