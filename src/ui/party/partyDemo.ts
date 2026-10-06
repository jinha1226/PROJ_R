import * as THREE from 'three';
import type { Screen } from '../../app/router';
import { GridSim } from '../../sim/grid/gridSim';
import { same, type GEvent } from '../../sim/grid/types';
import { entOf, unitOf, type Party } from '../../sim/party/partyCore';
import { CLASSES, DEFAULT_PICKS, HERO_IDS, WAVES, type Pick } from '../../sim/party/partyDefs';
import { nextWave, partyRoom, promote, tick } from '../../sim/party/partySim';
import { queueUltimate } from '../../sim/party/ultimate';
import { findPath } from '../../sim/grid/path';
import { GridRuntime } from '../../view/grid/gridRuntime';
import { LOOK_BY_ID } from '../../view/grid/gridActors';
import type { DungeonKit } from '../../view/grid/dungeonKit';
import type { UalLibrary } from '../../view/grid/ualActor';
import { PartyPick, lookOf } from './partyPick';
import { heroCardsHtml } from './heroCards';
import '../styles/grid.css';
import '../styles/gridSf.css';
import '../styles/partyDemo.css';

/** game time per real second at normal speed */
const RATE = 1.6;
/** figures animate at most this much faster (a quicker game just covers more ground per second) */
const SHOW_MAX = 2;

/** `?demo=party`: pick three of five classes; they fight on their own in real time; select one and give it an order or a skill; pause any time. */
export class PartyDemo implements Screen {
  private readonly el = document.createElement('div');
  private stage!: HTMLElement;
  private rt: GridRuntime | null = null;
  private p!: Party;
  private picks: Pick[] = DEFAULT_PICKS;
  private picker: PartyPick | null = null;
  private sel = 'hero';
  private paused = false;
  private speed = 1;
  private warned = new Set<string>();
  private cardsHtml = '';
  private raf = 0;
  private readonly onKey = (e: KeyboardEvent) => this.key(e);

  constructor(private readonly lib: UalLibrary, private readonly kit: DungeonKit) {}

  mount(root: HTMLElement): void {
    this.el.className = 'screen grid landscape party';
    this.el.innerHTML = `<div class="grid-stage"></div><div class="pd-labels"></div><div class="pd-pause">일시정지</div>
      <div class="pd-top"><button type="button" data-k="pause"></button><button type="button" data-k="speed"></button><button type="button" data-k="restart">다시</button><button type="button" data-k="pick">편성</button><span class="pd-wave"></span><button type="button" data-k="next" hidden>다음 무리</button><span class="pd-msg"></span></div>
      <div class="pd-cards"></div><p class="pd-help">영웅 클릭·1 2 3 선택 · 적 클릭 공격 · 바닥 클릭 이동 후 고수 · Q W 기술 · Space 일시정지</p>`;
    root.appendChild(this.el);
    this.stage = this.el.querySelector<HTMLElement>('.grid-stage')!;
    this.el.querySelector('.pd-top')!.addEventListener('click', (e) => {
      const k = (e.target as HTMLElement).closest<HTMLElement>('[data-k]')?.dataset.k;
      if (k === 'pause') this.paused = !this.paused;
      if (k === 'speed') { this.speed = this.speed === 1 ? 2 : 1; this.pace(); }
      if (k === 'restart') this.restart();
      if (k === 'pick') this.choose();
      if (k === 'next') this.next();
      this.draw();
    });
    this.el.querySelector('.pd-cards')!.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      const card = t.closest<HTMLElement>('[data-hero]');
      if (card) this.sel = card.dataset.hero!;
      const skill = t.closest<HTMLElement>('[data-skill]');
      if (skill) queueUltimate(this.p, this.sel);
      if (t.closest('[data-promote]')) this.live(promote(this.p, this.sel));
      this.draw();
    });
    this.stage.addEventListener('pointerup', (e) => this.click(e));
    this.stage.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('keydown', this.onKey);
    this.restart();
    this.choose();
    let last = performance.now();
    const loop = (now: number) => {
      // a frame's timestamp can come just before the moment the loop began: never a step back in time
      const dt = Math.max(0, Math.min(0.1, (now - last) / 1000));
      last = now;
      if (!this.paused && !this.picker && !this.over()) {
        const t0 = this.p.time;
        this.live(tick(this.p, dt * RATE * this.speed), t0);
        this.autoPause();
      }
      this.rt?.update(dt * Math.min(this.speed, SHOW_MAX));
      this.marks();
      this.labels();
      this.draw();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  unmount(): void { removeEventListener('keydown', this.onKey); cancelAnimationFrame(this.raf); this.rt?.dispose(); this.el.remove(); }

  private live(ev: GEvent[], t0 = this.p.time): void { if (ev.length) this.rt?.applyLive(ev, t0); }

  /** The chooser over the (still) room; going out starts a fresh fight with the new party. */
  private choose(): void {
    this.picker?.el.remove();
    this.picker = new PartyPick(this.picks, (picks) => { this.picks = picks; this.picker?.el.remove(); this.picker = null; this.restart(); });
    this.el.appendChild(this.picker.el);
  }

  private restart(): void {
    this.picks.forEach((pk, i) => LOOK_BY_ID.set(HERO_IDS[i]!, lookOf(pk.cls, pk.weapon)));
    this.p = partyRoom(this.picks);
    this.warned.clear();
    this.rt?.dispose();
    this.stage.replaceChildren();
    this.rt = new GridRuntime(this.stage, GridSim.fromState(this.p.s), this.lib, this.kit, false);
    this.rt.setZoom(9);
    this.rt.stayInMap = true;
    // the smooth look (no pixel pass)
    this.rt.pixelated = false;
    this.pace();
    this.sel = 'hero';
    this.paused = false;
    this.message('');
  }

  /** The next band walks in (the view picks up the new figures). */
  private next(): void { if (nextWave(this.p)) { this.rt?.applyLive([], this.p.time); this.message(''); } }

  private alive(id: string): boolean { return entOf(this.p, id)?.alive ?? false; }
  private cleared(): boolean { return this.p.units.every((u) => u.side === 'hero' || !this.alive(u.id)); }
  private over(): boolean { return HERO_IDS.every((h) => !this.alive(h)) || this.cleared(); }
  private name(id: string): string { return CLASSES[unitOf(this.p, id)!.cls!].name; }

  /** A hero falling low or falling, or able to advance, stops the clock so the player can react. */
  private autoPause(): void {
    for (const id of HERO_IDS) {
      const e = entOf(this.p, id)!, u = unitOf(this.p, id)!;
      const key = !e.alive ? `${id}:dead` : e.hp < e.maxHp * 0.35 ? `${id}:low` : u.promoteReady ? `${id}:promo` : '';
      if (!key || this.warned.has(key)) continue;
      this.warned.add(key);
      this.paused = true;
      this.message(`${this.name(id)} ${!e.alive ? '쓰러짐' : u.promoteReady ? '전직 가능' : '위험'}`);
    }
  }

  private message(text: string): void { this.el.querySelector('.pd-msg')!.textContent = text; }

  /** Walk speed in cells per second of shown time: units step about every 0.85 of game time, and the show runs at min(speed, SHOW_MAX). */
  private pace(): void { this.rt?.setWalkSpeed((RATE * this.speed) / 0.85 / Math.min(this.speed, SHOW_MAX)); }

  private key(e: KeyboardEvent): void {
    if (this.picker) return;
    const k = e.key.toLowerCase();
    if (k === ' ') { e.preventDefault(); this.paused = !this.paused; }
    if (k === '1' || k === '2' || k === '3') this.sel = HERO_IDS[Number(k) - 1]!;
    if (k === 'r') queueUltimate(this.p, this.sel);
    
    if (k === 'n') this.next();
    if (k === 'f5') this.restart();
  }

  /** On a hero: select it. With a hero selected: a foe is its target, a floor cell its place to go and hold. */
  private click(e: PointerEvent): void {
    const c = this.rt?.cellAt(e.clientX, e.clientY);
    if (!c || this.picker) return;
    const at = this.p.units.find((u) => this.alive(u.id) && same(entOf(this.p, u.id)!.pos, c));
    if (at?.side === 'hero') { this.sel = at.id; return; }
    const me = unitOf(this.p, this.sel);
    if (!me || !this.alive(me.id)) return;
    me.order = at ? { kind: 'attack', target: at.id } : { kind: 'move', cell: c };
  }

  /** The selected hero's cell, and where its move order is taking it (or the cell it holds). */
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
    this.el.querySelector('.pd-labels')!.innerHTML = this.p.units.filter((u) => u.side === 'hero' && this.alive(u.id)).map((u) => {
      const e = entOf(this.p, u.id)!;
      const pt = this.rt!.project(new THREE.Vector3(e.pos.x, 2.3, e.pos.y));
      return `<div class="pd-label${u.id === this.sel ? ' on' : ''}" style="left:${pt.left}px;top:${pt.top}px">${HERO_IDS.indexOf(u.id) + 1} ${CLASSES[u.cls!].name}${u.order?.kind === 'hold' ? ' ▣' : ''}</div>`;
    }).join('');
  }

  private draw(): void {
    this.el.querySelector<HTMLElement>('[data-k="pause"]')!.textContent = this.paused ? '▶ 재개' : '❚❚ 정지';
    this.el.querySelector<HTMLElement>('[data-k="speed"]')!.textContent = `속도 ×${this.speed}`;
    this.el.querySelector<HTMLElement>('.pd-wave')!.textContent = `무리 ${this.p.wave + 1}/${WAVES.length}`;
    const more = this.cleared() && this.p.wave < WAVES.length - 1 && HERO_IDS.some((h) => this.alive(h));
    this.el.querySelector<HTMLElement>('[data-k="next"]')!.hidden = !more;
    this.el.classList.toggle('paused', this.paused);
    if (this.over() && !more) this.message(HERO_IDS.some((h) => this.alive(h)) ? '승리 · R 다시' : '전멸 · R 다시');
    const cards = heroCardsHtml(this.p, this.sel);
    // only when something shown changed (a rebuilt button mid-click would swallow the click)
    if (cards !== this.cardsHtml) { this.cardsHtml = cards; this.el.querySelector('.pd-cards')!.innerHTML = cards; }
  }
}
