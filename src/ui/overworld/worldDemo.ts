import * as THREE from 'three';
import type { Screen } from '../../app/router';
import { GridSim } from '../../sim/grid/gridSim';
import { findPath } from '../../sim/grid/path';
import { idx, same, walkable, tileAt, type GEvent } from '../../sim/grid/types';
import { entOf, unitOf } from '../../sim/party/partyCore';
import { CLASSES } from '../../sim/party/partyDefs';
import { promote } from '../../sim/party/partySim';
import { queueSkill } from '../../sim/party/partySkills';
import { claimedShare, clones, newWorld, orderTo, worldTick, type WorldParty } from '../../sim/overworld/worldSim';
import { GridRuntime } from '../../view/grid/gridRuntime';
import { LOOK_BY_ID } from '../../view/grid/gridActors';
import type { DungeonKit } from '../../view/grid/dungeonKit';
import type { UalLibrary } from '../../view/grid/ualActor';
import { heroCardsHtml } from '../party/heroCards';
import { lookOf } from '../party/partyPick';
import { WorldMinimap } from './worldMinimap';
import '../styles/grid.css';
import '../styles/gridSf.css';
import '../styles/partyDemo.css';
import '../styles/worldDemo.css';

/** game time per real second at normal speed */
const RATE = 2.4;
/** figures animate at most this much faster (a quicker game just covers more ground per second) */
const SHOW_MAX = 2;
const SPEEDS = [1, 2, 4];

/** `?demo=world`: an empty clone wakes by the crashed ship, finds souls that give it a class (more souls carried home become new clones), and the party takes the land round the goblin camps — in real time, pause any time. */
export class WorldDemo implements Screen {
  private readonly el = document.createElement('div');
  private stage!: HTMLElement;
  private rt: GridRuntime | null = null;
  private p!: WorldParty;
  private mini: WorldMinimap | null = null;
  private sel = 'hero';
  private paused = false;
  private speed = 1;
  private zoom = 14;
  private warned = new Set<string>();
  private cardsHtml = '';
  private raf = 0;
  private readonly onKey = (e: KeyboardEvent) => this.key(e);

  private readonly seed: number;

  constructor(private readonly lib: UalLibrary, private readonly kit: DungeonKit, private readonly opts: { seed?: number; quit?: () => void } = {}) {
    this.seed = opts.seed ?? (Number(new URLSearchParams(location.search).get('seed')) || 1);
  }

  mount(root: HTMLElement): void {
    this.el.className = 'screen grid landscape party world';
    this.el.innerHTML = `<div class="grid-stage"></div><div class="pd-labels"></div><div class="pd-pause">일시정지</div>
      <div class="pd-top"><button type="button" data-k="pause"></button><button type="button" data-k="speed"></button><button type="button" data-k="restart">다시</button>${this.opts.quit ? '<button type="button" data-k="quit">타이틀</button>' : ''}<span class="pd-wave"></span><span class="pd-msg"></span></div>
      <div class="wd-mini-box"></div>
      <div class="pd-cards"></div><p class="pd-help">영웅 클릭·1 2 3 선택 · 바닥 클릭 파티 이동 · 전투 중엔 그 영웅만 이동 후 고수 · 적 클릭 공격 · Q W 기술 · Space 일시정지 · 휠 확대</p>`;
    root.appendChild(this.el);
    this.stage = this.el.querySelector<HTMLElement>('.grid-stage')!;
    this.el.querySelector('.pd-top')!.addEventListener('click', (e) => {
      const k = (e.target as HTMLElement).closest<HTMLElement>('[data-k]')?.dataset.k;
      if (k === 'pause') this.paused = !this.paused;
      if (k === 'speed') { this.speed = SPEEDS[(SPEEDS.indexOf(this.speed) + 1) % SPEEDS.length]!; this.pace(); }
      if (k === 'restart') this.restart();
      if (k === 'quit') { this.opts.quit?.(); return; }
      this.draw();
    });
    this.el.querySelector('.pd-cards')!.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      const card = t.closest<HTMLElement>('[data-hero]');
      if (card) this.select(card.dataset.hero!);
      const skill = t.closest<HTMLElement>('[data-skill]');
      if (skill) queueSkill(this.p, this.sel, Number(skill.dataset.skill) as 0 | 1);
      if (t.closest('[data-promote]')) this.live(promote(this.p, this.sel));
      this.draw();
    });
    this.stage.addEventListener('pointerup', (e) => this.click(e));
    this.stage.addEventListener('contextmenu', (e) => e.preventDefault());
    this.stage.addEventListener('wheel', (e) => { e.preventDefault(); this.zoom = Math.min(26, Math.max(8, this.zoom * (e.deltaY > 0 ? 1.1 : 0.9))); this.rt?.setZoom(this.zoom); }, { passive: false });
    addEventListener('keydown', this.onKey);
    this.restart();
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (!this.paused) {
        const t0 = this.p.time;
        this.live(worldTick(this.p, dt * RATE * this.speed), t0);
        this.autoPause();
      }
      this.rt?.update(dt * Math.min(this.speed, SHOW_MAX));
      this.marks();
      this.labels();
      this.draw();
      this.mini?.draw();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  unmount(): void { removeEventListener('keydown', this.onKey); cancelAnimationFrame(this.raf); this.rt?.dispose(); this.el.remove(); }

  private live(ev: GEvent[], t0 = this.p.time): void {
    if (!ev.length) return;
    // a new body or a soul taken: the figure's look must be set before the view builds it again
    for (const e of ev) {
      if (e.type !== 'buff' || (e.text !== 'soul' && e.text !== 'print')) continue;
      const u = unitOf(this.p, e.dst!)!;
      LOOK_BY_ID.set(u.id, lookOf(u.cls!, u.weapon!));
      if (e.text === 'soul') this.rt?.actors.rebuild(u.id);
    }
    this.rt?.applyLive(ev, t0);
    for (const e of ev) {
      if (e.type === 'wake') this.alert(`wake${e.text}`, '진지 발견');
      if (e.type === 'buff' && e.text === 'claim') this.message(`영역 확보 · ${Math.round(claimedShare(this.p) * 100)}%`);
      if (e.type === 'buff' && e.text === 'soul') this.message(`${this.name(e.dst!)} 영혼 깃듦`);
      if (e.type === 'buff' && e.text === 'print') { this.message(unitOf(this.p, e.dst!)!.cls === 'shell' ? '새 몸이 깨어남' : '클론 출력'); if (!entOf(this.p, this.sel)?.alive) this.select(e.dst!); }
      if (e.type === 'pickup' && unitOf(this.p, e.src!)!.cls !== 'shell' && this.p.carried.length) this.message('영혼 회수 · 우주선으로');
      if (e.type === 'drop') this.alert(`drop${e.src}`, '영혼석 떨어짐');
    }
  }

  private restart(): void {
    LOOK_BY_ID.clear();
    LOOK_BY_ID.set('hero', lookOf('shell', 'fists'));
    this.p = newWorld(this.seed);
    this.warned.clear();
    this.rt?.dispose();
    this.stage.replaceChildren();
    this.rt = new GridRuntime(this.stage, GridSim.fromState(this.p.s), this.lib, this.kit, false, undefined, { theme: 'world', look: this.p });
    this.rt.setZoom(this.zoom);
    this.rt.pixelated = false;
    this.pace();
    this.select('hero');
    this.paused = false;
    this.message('');
    this.mini = new WorldMinimap(this.p, (c) => this.walk(c));
    this.el.querySelector('.wd-mini-box')!.replaceChildren(this.mini.el);
  }

  private select(id: string): void { this.sel = id; if (this.rt) this.rt.focusId = id; }
  /** the living clones, in the order they were made (keys 1 2 3) */
  private ids(): string[] { return clones(this.p).filter((u) => entOf(this.p, u.id)?.alive).map((u) => u.id); }

  /** A hero falling low or falling, or a camp waking, stops the clock so the player can react. */
  private autoPause(): void {
    for (const id of this.ids()) {
      const e = entOf(this.p, id)!;
      if (e.hp < e.maxHp * 0.35) this.alert(`${id}:low${this.p.combat ? Math.floor(this.p.time / 60) : ''}`, `${this.name(id)} 위험`);
      else if (unitOf(this.p, id)!.promoteReady) this.alert(`${id}:promo`, `${this.name(id)} 전직 가능`);
    }
  }

  private alert(key: string, text: string): void {
    if (this.warned.has(key)) return;
    this.warned.add(key);
    this.paused = true;
    this.message(text);
  }

  private name(id: string): string { return CLASSES[unitOf(this.p, id)!.cls!].name; }
  private message(text: string): void { this.el.querySelector('.pd-msg')!.textContent = text; }
  /** Walk speed in cells per second of shown time: units step about every 0.85 of game time, and the show runs at min(speed, SHOW_MAX). */
  private pace(): void { this.rt?.setWalkSpeed((RATE * this.speed) / 0.85 / Math.min(this.speed, SHOW_MAX)); }

  private key(e: KeyboardEvent): void {
    const k = e.key.toLowerCase();
    if (k === ' ') { e.preventDefault(); this.paused = !this.paused; }
    const pick = this.ids()[Number(k) - 1];
    if ((k === '1' || k === '2' || k === '3') && pick) this.select(pick);
    if (k === 'q') queueSkill(this.p, this.sel, 0);
    if (k === 'w') queueSkill(this.p, this.sel, 1);
    if (k === 'r') this.restart();
  }

  /** A walk toward a cell, seen or not (the minimap uses it too). */
  private walk(c: { x: number; y: number }): void {
    // into the dark is fine (that is exploring); a tree or rock means the nearest open cell by it
    const m = this.p.s.map;
    for (let r = 0; r <= 3; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const n = { x: c.x + dx, y: c.y + dy };
      if (Math.max(Math.abs(dx), Math.abs(dy)) === r && walkable(tileAt(m, n))) { orderTo(this.p, this.sel, n); return; }
    }
  }

  /** On a hero: select it. Otherwise a foe is the chosen hero's target, a cell the place to go. */
  private click(e: PointerEvent): void {
    const c = this.rt?.cellAt(e.clientX, e.clientY);
    if (!c) return;
    const at = this.p.units.find((u) => entOf(this.p, u.id)?.alive && same(entOf(this.p, u.id)!.pos, c) && this.p.s.visible.has(idx(this.p.s.map, c)));
    if (at?.side === 'hero') { this.select(at.id); return; }
    if (!entOf(this.p, this.sel)?.alive) this.select(this.p.leader ?? 'hero');
    const me = unitOf(this.p, this.sel);
    if (!me || !entOf(this.p, me.id)?.alive) return;
    if (at) me.order = { kind: 'attack', target: at.id };
    else this.walk(c);
  }

  private marks(): void {
    if (!this.rt) return;
    const me = unitOf(this.p, this.sel);
    const e = me && entOf(this.p, me.id);
    const o = me?.order;
    this.rt.showAim(e?.alive ? [e.pos, ...(o?.kind === 'move' || o?.kind === 'hold' ? [o.cell] : [])] : null, true);
    this.rt.showPath(o?.kind === 'move' && e?.alive ? findPath(this.p.s.map, e.pos, o.cell) : null);
  }

  private labels(): void {
    if (!this.rt) return;
    this.el.querySelector('.pd-labels')!.innerHTML = this.p.units.filter((u) => u.side === 'hero' && entOf(this.p, u.id)?.alive).map((u) => {
      const e = entOf(this.p, u.id)!;
      const pt = this.rt!.project(new THREE.Vector3(e.pos.x, 2.3, e.pos.y));
      return `<div class="pd-label${u.id === this.sel ? ' on' : ''}" style="left:${pt.left}px;top:${pt.top}px">${this.ids().indexOf(u.id) + 1} ${CLASSES[u.cls!].name}${u.order?.kind === 'hold' ? ' ▣' : ''}</div>`;
    }).join('');
  }

  private draw(): void {
    this.el.querySelector<HTMLElement>('[data-k="pause"]')!.textContent = this.paused ? '▶ 재개' : '❚❚ 정지';
    this.el.querySelector<HTMLElement>('[data-k="speed"]')!.textContent = `속도 ×${this.speed}`;
    const taken = this.p.camps.filter((c) => c.cleared).length;
    const carried = this.p.carried.length ? ` · 들고 있는 영혼 ${this.p.carried.length}` : '';
    this.el.querySelector<HTMLElement>('.pd-wave')!.textContent = `${this.p.combat ? '전투' : '탐색'} · 영역 ${Math.round(claimedShare(this.p) * 100)}% · 진지 ${taken}/${this.p.camps.length}${carried}`;
    this.el.classList.toggle('paused', this.paused);
    if (taken === this.p.camps.length) this.message('모든 진지 확보');
    const cards = heroCardsHtml(this.p, this.sel, this.ids());
    // only when something shown changed (a rebuilt button mid-click would swallow the click)
    if (cards !== this.cardsHtml) { this.cardsHtml = cards; this.el.querySelector('.pd-cards')!.innerHTML = cards; }
  }
}
