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
const D = (x: number, y: number): GAction => ({ kind: 'move', dir: { x, y } });
const S = (target: string): GAction => ({ kind: 'shoot', target });
const F = (kind: FoeKind, x: number, y: number, hp: number): ShowFoe => ({ kind, x, y, hp });
export interface Scene { id: string; name: string; seed: number; hand: 'blade' | 'gun'; suit: EngraveId[]; foes: ShowFoe[]; plan: GAction[] }
/** One scene per build, each searched for the most varied single turn (tests/bot/varietySearch.bot.ts). */
export const SCENES: Scene[] = [
  { id: 'fusion', name: '퓨전', seed: 33586, hand: 'blade', suit: ['flow', 'gunRelay', 'spinShot', 'dash', 'leap', 'ricochet'],
    foes: [F('minion', 7, 2, 8), F('minion', 5, 1, 3), F('archer', 6, 1, 1), F('minion', 7, 1, 4), F('minion', 5, 2, 4), F('ghoul', 9, 3, 3), F('minion', 8, 1, 4),
      F('archer', 10, 1, 2), F('archer', 10, 3, 1), F('minion', 10, 2, 8), F('minion', 11, 1, 8), F('minion', 11, 2, 6), F('archer', 11, 6, 3), F('archer', 11, 5, 4),
      F('minion', 10, 5, 7), F('brute', 4, 4, 6), F('ghoul', 3, 5, 8), F('ghoul', 3, 3, 1), F('minion', 5, 3, 2)],
    plan: [D(-1, 0), D(1, -1), D(1, -1), D(1, -1), D(1, 0), D(1, 0), D(0, 1), D(1, 0)] },
  { id: 'blade', name: '칼', seed: 32967, hand: 'blade', suit: ['flow', 'dash', 'leap', 'tempest', 'cull', 'fury'],
    foes: [F('archer', 2, 3, 8), F('minion', 1, 1, 5), F('brute', 1, 2, 4), F('ghoul', 2, 2, 4), F('brute', 3, 2, 1), F('archer', 3, 1, 8), F('brute', 8, 4, 1),
      F('minion', 9, 4, 6), F('minion', 9, 3, 7), F('archer', 7, 2, 7), F('minion', 8, 2, 5), F('minion', 6, 1, 8), F('archer', 5, 1, 3), F('minion', 4, 1, 6)],
    plan: [D(1, -1), D(-1, -1), D(-1, 0), D(-1, 0), D(-1, 0), D(1, 0)] },
  { id: 'gun', name: '총', seed: 32915, hand: 'gun', suit: ['flow', 'rapid', 'volley', 'ricochet', 'pierce', 'thrift'],
    foes: [F('archer', 1, 5, 4), F('ghoul', 1, 3, 7), F('minion', 2, 3, 2), F('minion', 1, 4, 1), F('archer', 10, 4, 3), F('minion', 10, 3, 3), F('archer', 9, 3, 1),
      F('brute', 9, 4, 5), F('ghoul', 2, 4, 1), F('ghoul', 2, 6, 7)],
    plan: [S('f9'), S('f4'), S('f8'), S('f3'), S('f10')] },
];
/** the fast (gun-kata) tempo: the show runs quicker, the next move starts over the end of the last one, slow motion waits for the last blow */
const KATA = { speed: 1, beatMs: 140, zoom: 6.2, finalSlow: [1.1, 0.22] as const };
const OPEN_MS = 1400;
const BEAT_MS = 90;
const END_MS = 3200;

/** The showcase room: the hero (blade in hand, a tough body so the show is not cut short) and the placed foes, all awake. */
export function showcaseState(seed: number, suit: EngraveId[], foes: ShowFoe[], hero = { x: 6, y: 4 }, hand: 'blade' | 'gun' = 'blade'): GridState {
  const m: GridMap = { w: ROWS[0]!.length, h: ROWS.length, tiles: [], rooms: [], start: hero, exits: [], chests: [], spawns: foes.map((f, i) => ({ kind: f.kind, pos: { x: f.x, y: f.y }, group: i + 1 })), barrels: [] };
  for (const row of ROWS) for (const c of row) m.tiles.push(c === '#' ? 'wall' : 'floor');
  const s = newState(m, seed, 'pistol', 3);
  s.hero.gear.hands[1] = { ...makeWeapon('dagger', 2), name: '요원 칼' };
  s.hero.gear.active = hand === 'gun' ? 0 : 1;
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
  /** the pixel look (`?px=0` starts with the smooth one) */
  private pixel = new URLSearchParams(location.search).get('px') !== '0';
  /** the last kill of the show, where the fast tempo turns to slow motion */
  private lastDie: GEvent | null = null;
  /** which build is showing (`?scene=fusion|blade|gun`) */
  private scene = Math.max(0, SCENES.findIndex((sc) => sc.id === new URLSearchParams(location.search).get('scene')));
  private get current(): Scene { return SCENES[this.scene]!; }

  constructor(private readonly lib: UalLibrary, private readonly kit: DungeonKit) {}

  mount(root: HTMLElement): void {
    const clean = new URLSearchParams(location.search).get('clean') === '1';
    this.el.className = `screen grid landscape chain-show${clean ? ' clean' : ''}`;
    this.el.innerHTML = `<div class="grid-stage"></div>
      <div class="cs-bars"></div>
      <div class="cs-count"><b>0</b><span>연계</span><em>경과 <i>0</i>턴</em></div>
      <div class="cs-suit"></div>
      <div class="cs-stamp"></div>
      <div class="cs-top"><nav class="cs-scenes">${SCENES.map((sc, i) => `<button type="button" data-scene="${i}" data-testid="chain-scene-${sc.id}">${sc.name}</button>`).join('')}</nav>
        <button type="button" class="cs-feel" data-testid="chain-feel"></button>
        <button type="button" class="cs-feel cs-px" data-testid="chain-pixel"></button></div>`;
    this.el.querySelector('.cs-px')!.addEventListener('click', () => { this.pixel = !this.pixel; if (this.rt) this.rt.pixelated = this.pixel; this.showPixel(); });
    this.el.querySelector('.cs-feel')!.addEventListener('click', () => { this.fast = !this.fast; this.restart(); });
    this.el.querySelector('.cs-scenes')!.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-scene]');
      if (b) { this.scene = Number(b.dataset.scene); this.restart(); }
    });
    root.appendChild(this.el);
    this.stage = this.el.querySelector<HTMLElement>('.grid-stage')!;
    addEventListener('resize', this.onResize);
    this.restart();
    let last = performance.now();
    const loop = (now: number) => {
      // a frame's timestamp can come just before the moment the loop began: never a step back in time
      const dt = Math.max(0, Math.min(0.1, (now - last) / 1000));
      last = now;
      this.rt?.update(dt * (this.fast ? KATA.speed : 1));
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  private readonly onResize = () => this.fit();

  private showPixel(): void { this.el.querySelector('.cs-px')!.textContent = this.pixel ? '화면: 도트' : '화면: HD'; }

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
    const sc = this.current;
    this.el.querySelector('.cs-suit')!.innerHTML = sc.suit.map((id) => `<span data-id="${id}">${ENGRAVES[id].name}</span>`).join('');
    this.el.querySelectorAll<HTMLElement>('[data-scene]').forEach((b) => b.classList.toggle('on', Number(b.dataset.scene) === this.scene));
    const s = showcaseState(sc.seed, sc.suit, sc.foes, undefined, sc.hand);
    // it opens on a free move (as if the chain before it had set off 흐름)
    s.hero.fx.free = true;
    this.start = s.hero.nextAt;
    this.sim = GridSim.fromState(s);
    this.rt = new GridRuntime(this.stage, this.sim, this.lib, this.kit, false, (e) => this.cue(e));
    this.rt.stayInMap = true;
    this.rt.pixelated = this.pixel;
    this.showPixel();
    this.fit();
    this.timer = setTimeout(() => this.play(0), OPEN_MS);
  }

  /** The chosen moves one by one, each played out before the next. */
  private play(i: number): void {
    const s = this.sim.s;
    const plan = this.current.plan;
    const a = plan[i];
    if (!a || s.outcome) return this.finish();
    const t0 = s.hero.nextAt;
    const ev = this.sim.act(a);
    if (this.fast && i === plan.length - 1) this.lastDie = [...ev].reverse().find((e) => e.type === 'die') ?? null;
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
