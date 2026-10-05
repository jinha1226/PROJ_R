import type { Screen } from '../../app/router';
import { ENGRAVES, type EngraveId } from '../../sim/grid/engraveCore';
import { GridSim } from '../../sim/grid/gridSim';
import { makeWeapon } from '../../sim/grid/items';
import { newState, refreshSight } from '../../sim/grid/state';
import type { FoeKind, GAction, GEvent, GridMap, GridState } from '../../sim/grid/types';
import { GridRuntime } from '../../view/grid/gridRuntime';
import { setFeel } from '../../view/grid/feel';
import type { DungeonKit } from '../../view/grid/dungeonKit';
import type { UalLibrary } from '../../view/grid/ualActor';
import '../styles/grid.css';
import '../styles/gridSf.css';
import '../styles/chainShowcase.css';

/**
 * One turn, one long and varied chain, found by searching real layouts (tests/bot/varietySearch.bot.ts): dashes, leaps into a pack,
 * spinning shots when surrounded, ricochets, blade kills firing the gun — and each chain sets off 흐름 so the next move takes no time.
 * Everything is the real simulation; only the opening, the moves, and the free first move are chosen.
 */
const ROWS = ['#############', '#...........#', '#...........#', '#...........#', '#...........#', '#...........#', '#...........#', '#...........#', '#############'];
export type ShowFoe = { kind: FoeKind; x: number; y: number; hp: number };
const SEED = 33586;
const SUIT: EngraveId[] = ['flow', 'gunRelay', 'spinShot', 'dash', 'leap', 'ricochet'];
const FOES: ShowFoe[] = [
  { kind: 'minion', x: 7, y: 2, hp: 8 }, { kind: 'minion', x: 5, y: 1, hp: 3 }, { kind: 'archer', x: 6, y: 1, hp: 1 }, { kind: 'minion', x: 7, y: 1, hp: 4 },
  { kind: 'minion', x: 5, y: 2, hp: 4 }, { kind: 'ghoul', x: 9, y: 3, hp: 3 }, { kind: 'minion', x: 8, y: 1, hp: 4 }, { kind: 'archer', x: 10, y: 1, hp: 2 },
  { kind: 'archer', x: 10, y: 3, hp: 1 }, { kind: 'minion', x: 10, y: 2, hp: 8 }, { kind: 'minion', x: 11, y: 1, hp: 8 }, { kind: 'minion', x: 11, y: 2, hp: 6 },
  { kind: 'archer', x: 11, y: 6, hp: 3 }, { kind: 'archer', x: 11, y: 5, hp: 4 }, { kind: 'minion', x: 10, y: 5, hp: 7 }, { kind: 'brute', x: 4, y: 4, hp: 6 },
  { kind: 'ghoul', x: 3, y: 5, hp: 8 }, { kind: 'ghoul', x: 3, y: 3, hp: 1 }, { kind: 'minion', x: 5, y: 3, hp: 2 },
];
const D = (x: number, y: number): GAction => ({ kind: 'move', dir: { x, y } });
const PLAN: GAction[] = [D(-1, 0), D(1, -1), D(1, -1), D(1, -1), D(1, 0), D(1, 0), D(0, 1), D(1, 0)];
/** the showcase's opening and moves (for tests and tuning) */
export const SHOWCASE = { seed: SEED, suit: SUIT, foes: FOES, plan: PLAN };
/** the fast (gun-kata) tempo: the show runs quicker, the next move starts over the end of the last one, slow motion waits for the last blow */
const KATA = { speed: 1, beatMs: 140, zoom: 6.2, finalSlow: [1.1, 0.22] as const };
const OPEN_MS = 1400;
const BEAT_MS = 90;
const END_MS = 3200;

/** The showcase room: the hero (blade in hand, a tough body so the show is not cut short) and the placed foes, all awake. */
export function showcaseState(seed: number, suit: EngraveId[], foes: ShowFoe[], hero = { x: 6, y: 4 }): GridState {
  const m: GridMap = { w: ROWS[0]!.length, h: ROWS.length, tiles: [], rooms: [], start: hero, exits: [], chests: [], spawns: foes.map((f, i) => ({ kind: f.kind, pos: { x: f.x, y: f.y }, group: i + 1 })), barrels: [] };
  for (const row of ROWS) for (const c of row) m.tiles.push(c === '#' ? 'wall' : 'floor');
  const s = newState(m, seed, 'pistol', 3);
  s.hero.gear.hands[1] = { ...makeWeapon('dagger', 2), name: '요원 칼' };
  s.hero.gear.active = 1;
  s.hero.suit = [...suit];
  s.hero.charge = s.hero.maxCharge = 20;
  s.hero.hp = s.hero.maxHp = 200;
  s.foes.forEach((f, i) => { f.awake = true; f.hp = Math.min(f.maxHp, foes[i]!.hp); });
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
  private start = 0;
  private fast = new URLSearchParams(location.search).get('feel') !== 'classic';
  /** the last kill of the show, where the fast tempo turns to slow motion */
  private lastDie: GEvent | null = null;

  constructor(private readonly lib: UalLibrary, private readonly kit: DungeonKit) {}

  mount(root: HTMLElement): void {
    const clean = new URLSearchParams(location.search).get('clean') === '1';
    this.el.className = `screen grid landscape chain-show${clean ? ' clean' : ''}`;
    this.el.innerHTML = `<div class="grid-stage"></div>
      <div class="cs-bars"></div>
      <div class="cs-count"><b>0</b><span>연계</span><em>경과 <i>0</i>턴</em></div>
      <div class="cs-suit">${SUIT.map((id) => `<span data-id="${id}">${ENGRAVES[id].name}</span>`).join('')}</div>
      <div class="cs-stamp"></div>
      <button type="button" class="cs-feel" data-testid="chain-feel"></button>`;
    this.el.querySelector('.cs-feel')!.addEventListener('click', () => { this.fast = !this.fast; this.restart(); });
    root.appendChild(this.el);
    this.stage = this.el.querySelector<HTMLElement>('.grid-stage')!;
    addEventListener('resize', this.onResize);
    this.restart();
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      this.rt?.update(dt * (this.fast ? KATA.speed : 1));
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  private readonly onResize = () => this.fit();

  unmount(): void {
    removeEventListener('resize', this.onResize);
    setFeel('classic');
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
    if (e === this.lastDie && this.rt) { this.rt.fx.slow(KATA.finalSlow[0], KATA.finalSlow[1]); this.rt.fx.shake(0.25, 0.3); }
  }

  /** Close on a wide screen; on a tall one the room's width still fits. */
  private fit(): void {
    const aspect = this.stage.clientWidth / Math.max(1, this.stage.clientHeight);
    this.rt?.setZoom(Math.max(this.fast ? KATA.zoom : 7.6, 12 / Math.max(0.1, aspect)));
  }

  private restart(): void {
    clearTimeout(this.timer);
    setFeel(this.fast ? 'kata' : 'classic');
    this.el.classList.toggle('fast', this.fast);
    this.el.querySelector('.cs-feel')!.textContent = this.fast ? '템포: 빠름' : '템포: 기존';
    this.lastDie = null;
    this.rt?.dispose();
    this.stage.replaceChildren();
    this.chain = 0; this.kills = 0;
    this.el.querySelector('.cs-count b')!.textContent = '0';
    this.el.querySelector('.cs-stamp')!.className = 'cs-stamp';
    const s = showcaseState(SEED, SUIT, FOES);
    // it opens on a free move (as if the chain before it had set off 흐름)
    s.hero.fx.free = true;
    this.start = s.hero.nextAt;
    this.sim = GridSim.fromState(s);
    this.rt = new GridRuntime(this.stage, this.sim, this.lib, this.kit, false, (e) => this.cue(e));
    this.rt.stayInMap = true;
    this.fit();
    this.timer = setTimeout(() => this.play(0), OPEN_MS);
  }

  /** The chosen moves one by one, each played out before the next. */
  private play(i: number): void {
    const s = this.sim.s;
    const a = PLAN[i];
    if (!a || s.outcome) return this.finish();
    const t0 = s.hero.nextAt;
    const ev = this.sim.act(a);
    if (this.fast && i === PLAN.length - 1) this.lastDie = [...ev].reverse().find((e) => e.type === 'die') ?? null;
    // the show keeps to the fight: level-up pillars and energy beams would cover the moves
    this.rt?.apply(ev.filter((e) => e.type !== 'levelUp' && e.type !== 'energy'), t0);
    this.el.querySelector('.cs-count i')!.textContent = String(Math.round((s.hero.nextAt - this.start) * 10) / 10);
    this.el.classList.add('slow');
    const wait = () => {
      if (this.rt?.busy) this.timer = setTimeout(wait, 30);
      else this.timer = setTimeout(() => this.play(i + 1), this.fast ? KATA.beatMs : BEAT_MS);
    };
    wait();
  }

  private finish(): void {
    this.el.classList.remove('slow');
    const stamp = this.el.querySelector('.cs-stamp')!;
    stamp.innerHTML = `<b>${this.best}연계</b><span>${this.kills}처치 · 한 턴</span>`;
    stamp.className = 'cs-stamp on';
    this.timer = setTimeout(() => this.restart(), END_MS);
  }
}
