import type { Screen } from '../../app/router';
import { ENGRAVES, type EngraveId } from '../../sim/grid/engraveCore';
import { GridSim } from '../../sim/grid/gridSim';
import { makeWeapon } from '../../sim/grid/items';
import { newState, refreshSight } from '../../sim/grid/state';
import type { FoeKind, GAction, GEvent, GridMap, GridState } from '../../sim/grid/types';
import { GridRuntime } from '../../view/grid/gridRuntime';
import type { DungeonKit } from '../../view/grid/dungeonKit';
import type { UalLibrary } from '../../view/grid/ualActor';
import '../styles/grid.css';
import '../styles/gridSf.css';
import '../styles/chainShowcase.css';

/**
 * The longest chain found by searching real layouts (tests/bot/chainSearch.bot.ts): one slash sets off six engravings,
 * and the free actions after it keep the chain going. Everything here is the real simulation, only the opening is placed.
 */
const ROWS = ['#############', '#...........#', '#...........#', '#...........#', '#...........#', '#...........#', '#...........#', '#...........#', '#############'];
const SEED = 4056;
const SUIT: EngraveId[] = ['tempest', 'gunRelay', 'momentum', 'ricochet', 'mark', 'flow'];
const FOES: { kind: FoeKind; x: number; y: number; hp: number }[] = [
  { kind: 'minion', x: 7, y: 4, hp: 1 }, { kind: 'minion', x: 9, y: 5, hp: 3 }, { kind: 'archer', x: 11, y: 7, hp: 4 }, { kind: 'minion', x: 9, y: 1, hp: 2 },
  { kind: 'minion', x: 1, y: 2, hp: 2 }, { kind: 'ghoul', x: 1, y: 4, hp: 4 }, { kind: 'minion', x: 5, y: 3, hp: 1 }, { kind: 'ghoul', x: 8, y: 7, hp: 5 },
  { kind: 'minion', x: 2, y: 6, hp: 5 }, { kind: 'minion', x: 2, y: 7, hp: 5 },
];
const OPEN_MS = 1400;
const BEAT_MS = 450;
const END_MS = 3200;

function setup(): GridState {
  const hero = { x: 6, y: 4 };
  const m: GridMap = { w: ROWS[0]!.length, h: ROWS.length, tiles: [], rooms: [], start: hero, exits: [], chests: [], spawns: FOES.map((f, i) => ({ kind: f.kind, pos: { x: f.x, y: f.y }, group: i + 1 })), barrels: [] };
  for (const row of ROWS) for (const c of row) m.tiles.push(c === '#' ? 'wall' : 'floor');
  const s = newState(m, SEED, 'pistol', 3);
  s.hero.gear.hands[1] = { ...makeWeapon('dagger', 2), name: '요원 칼' };
  s.hero.gear.active = 1;
  s.hero.suit = [...SUIT];
  s.hero.charge = s.hero.maxCharge = 20;
  s.foes.forEach((f, i) => { f.awake = true; f.hp = Math.min(f.maxHp, FOES[i]!.hp); });
  refreshSight(s);
  return s;
}

/** `?demo=chain`: the maximum chain in the game view, looping; `&clean=1` leaves only the game picture (for recording). */
export class ChainShowcase implements Screen {
  private readonly el = document.createElement('div');
  private rt: GridRuntime | null = null;
  private sim!: GridSim;
  private raf = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private chain = 0;
  private kills = 0;
  private best = 0;
  private stage!: HTMLElement;

  constructor(private readonly lib: UalLibrary, private readonly kit: DungeonKit) {}

  mount(root: HTMLElement): void {
    const clean = new URLSearchParams(location.search).get('clean') === '1';
    this.el.className = `screen grid landscape chain-show${clean ? ' clean' : ''}`;
    this.el.innerHTML = `<div class="grid-stage"></div>
      <div class="cs-bars"></div>
      <div class="cs-count"><b>0</b><span>연계</span></div>
      <div class="cs-suit">${SUIT.map((id) => `<span data-id="${id}">${ENGRAVES[id].name}</span>`).join('')}</div>
      <div class="cs-stamp"></div>`;
    root.appendChild(this.el);
    this.stage = this.el.querySelector<HTMLElement>('.grid-stage')!;
    addEventListener('resize', this.onResize);
    this.restart();
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      this.rt?.update(dt);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  private readonly onResize = () => this.fit();

  unmount(): void {
    removeEventListener('resize', this.onResize);
    cancelAnimationFrame(this.raf);
    clearTimeout(this.timer);
    this.rt?.dispose();
    this.el.remove();
  }

  /** Each played event: count engravings and kills as the show reaches them, light the suit slot that fired. */
  private cue(e: GEvent): void {
    if (e.type === 'engrave') {
      this.chain++;
      this.best = Math.max(this.best, this.chain);
      const b = this.el.querySelector('.cs-count b')!;
      b.textContent = String(this.chain);
      this.el.querySelector('.cs-count')!.classList.remove('pop');
      void (this.el.querySelector('.cs-count') as HTMLElement).offsetWidth;
      this.el.querySelector('.cs-count')!.classList.add('pop');
      const slot = this.el.querySelector<HTMLElement>(`.cs-suit [data-id="${e.text}"]`);
      if (slot) { slot.classList.remove('lit'); void slot.offsetWidth; slot.classList.add('lit'); }
    }
    if (e.type === 'die') this.kills++;
  }

  /** Close on a wide screen; on a tall one the room's width still fits. */
  private fit(): void {
    const aspect = this.stage.clientWidth / Math.max(1, this.stage.clientHeight);
    this.rt?.setZoom(Math.max(7.6, 12 / Math.max(0.1, aspect)));
  }

  private restart(): void {
    clearTimeout(this.timer);
    this.rt?.dispose();
    this.stage.replaceChildren();
    this.chain = 0; this.kills = 0;
    this.el.querySelector('.cs-count b')!.textContent = '0';
    this.el.querySelector('.cs-stamp')!.className = 'cs-stamp';
    this.sim = GridSim.fromState(setup());
    this.rt = new GridRuntime(this.stage, this.sim, this.lib, this.kit, false, (e) => this.cue(e));
    this.fit();
    this.timer = setTimeout(() => this.play(0), OPEN_MS);
  }

  /** The opening slash, then free shots while anything is left to shoot. */
  private play(i: number): void {
    const s = this.sim.s;
    const a: GAction | null = i === 0 ? { kind: 'move', dir: { x: 1, y: 0 } }
      : s.hero.gear.active !== 0 ? { kind: 'swap' }
      : (() => { const t = this.sim.autoTarget(); return t ? { kind: 'shoot', target: t } as GAction : null; })();
    if (!a || i > 8 || s.outcome) return this.finish();
    const t0 = s.hero.nextAt;
    const ev = this.sim.act(a);
    this.rt?.apply(ev, t0);
    this.el.classList.add('slow');
    const wait = () => { if (this.rt?.busy) this.timer = setTimeout(wait, 60); else this.timer = setTimeout(() => this.play(i + 1), BEAT_MS); };
    wait();
  }

  private finish(): void {
    this.el.classList.remove('slow');
    const stamp = this.el.querySelector('.cs-stamp')!;
    stamp.innerHTML = `<b>${this.best}연계</b><span>${this.kills}처치</span>`;
    stamp.className = 'cs-stamp on';
    this.timer = setTimeout(() => this.restart(), END_MS);
  }
}
