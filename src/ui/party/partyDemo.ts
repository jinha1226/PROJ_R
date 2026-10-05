import * as THREE from 'three';
import type { Screen } from '../../app/router';
import { GridSim } from '../../sim/grid/gridSim';
import { same } from '../../sim/grid/types';
import { CLASSES, SKILLS, entOf, partyRoom, tick, useSkill, type Party } from '../../sim/party/partySim';
import { findPath } from '../../sim/grid/path';
import { GridRuntime } from '../../view/grid/gridRuntime';
import { LOOK_BY_ID } from '../../view/grid/gridActors';
import type { DungeonKit } from '../../view/grid/dungeonKit';
import type { UalLibrary } from '../../view/grid/ualActor';
import '../styles/grid.css';
import '../styles/gridSf.css';
import '../styles/partyDemo.css';

/** game time per real second at normal speed */
const RATE = 1.6;
const HEROES = ['hero', 'ally-archer', 'ally-mage'];
LOOK_BY_ID.set('hero', { body: '#2a3a5a', trim: '#c8b080', scale: 1, weapon: 'sword', shield: true, idle: 'Sword_Idle' });
LOOK_BY_ID.set('ally-archer', { body: '#35502e', trim: '#8a6a3a', scale: 0.95, weapon: 'bow', idle: 'Idle_Loop' });
LOOK_BY_ID.set('ally-mage', { body: '#4a2a6a', trim: '#c8a0e0', scale: 0.95, weapon: 'none', idle: 'Spell_Simple_Idle_Loop' });

/** `?demo=party`: three heroes fight on their own in real time; select one and give it an order or a skill; pause any time. */
export class PartyDemo implements Screen {
  private readonly el = document.createElement('div');
  private stage!: HTMLElement;
  private rt: GridRuntime | null = null;
  private p!: Party;
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
      <div class="pd-top"><button type="button" data-k="pause"></button><button type="button" data-k="speed"></button><button type="button" data-k="restart">다시</button><span class="pd-msg"></span></div>
      <div class="pd-cards"></div><p class="pd-help">영웅 클릭·1 2 3 선택 · 적 클릭 공격 · 바닥 클릭 이동 · Q W 기술 · Space 일시정지</p>`;
    root.appendChild(this.el);
    this.stage = this.el.querySelector<HTMLElement>('.grid-stage')!;
    this.el.querySelector('.pd-top')!.addEventListener('click', (e) => {
      const k = (e.target as HTMLElement).closest<HTMLElement>('[data-k]')?.dataset.k;
      if (k === 'pause') this.paused = !this.paused;
      if (k === 'speed') this.speed = this.speed === 1 ? 2 : 1;
      if (k === 'restart') this.restart();
      this.draw();
    });
    this.el.querySelector('.pd-cards')!.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      const skill = t.closest<HTMLElement>('[data-skill]');
      const card = t.closest<HTMLElement>('[data-hero]');
      if (card) this.sel = card.dataset.hero!;
      if (skill) this.skill(Number(skill.dataset.skill) as 0 | 1);
      this.draw();
    });
    this.stage.addEventListener('pointerup', (e) => this.click(e));
    this.stage.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('keydown', this.onKey);
    this.restart();
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (!this.paused && !this.over()) {
        const t0 = this.p.time;
        const ev = tick(this.p, dt * RATE * this.speed);
        if (ev.length) this.rt?.applyLive(ev, t0);
        this.autoPause();
      }
      this.rt?.update(dt * this.speed);
      this.marks();
      this.labels();
      this.draw();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  unmount(): void { removeEventListener('keydown', this.onKey); cancelAnimationFrame(this.raf); this.rt?.dispose(); this.el.remove(); }

  private restart(): void {
    this.p = partyRoom();
    this.warned.clear();
    this.rt?.dispose();
    this.stage.replaceChildren();
    this.rt = new GridRuntime(this.stage, GridSim.fromState(this.p.s), this.lib, this.kit, false);
    this.rt.setZoom(9);
    this.rt.stayInMap = true;
    this.sel = 'hero';
    this.paused = false;
  }

  private alive(id: string): boolean { return entOf(this.p, id)?.alive ?? false; }
  private over(): boolean { return HEROES.every((h) => !this.alive(h)) || this.p.units.every((u) => u.side === 'hero' || !this.alive(u.id)); }

  /** A hero falling low, or falling, stops the clock so the player can react. */
  private autoPause(): void {
    for (const id of HEROES) {
      const e = entOf(this.p, id)!;
      const key = !e.alive ? `${id}:dead` : e.hp < e.maxHp * 0.35 ? `${id}:low` : '';
      if (key && !this.warned.has(key)) { this.warned.add(key); this.paused = true; this.message(`${CLASSES[this.p.units.find((u) => u.id === id)!.cls!].name} ${e.alive ? '위험' : '쓰러짐'}`); }
    }
  }

  private message(text: string): void { this.el.querySelector('.pd-msg')!.textContent = text; }

  private skill(slot: 0 | 1): void {
    const ev = useSkill(this.p, this.sel, slot);
    if (ev.length) this.rt?.applyLive(ev, this.p.time);
  }

  private key(e: KeyboardEvent): void {
    const k = e.key.toLowerCase();
    if (k === ' ') { e.preventDefault(); this.paused = !this.paused; }
    if (k === '1' || k === '2' || k === '3') this.sel = HEROES[Number(k) - 1]!;
    if (k === 'q') this.skill(0);
    if (k === 'w') this.skill(1);
    if (k === 'r') this.restart();
  }

  /** On a hero: select it. With a hero selected: a foe is its target, a floor cell its place to go. */
  private click(e: PointerEvent): void {
    const c = this.rt?.cellAt(e.clientX, e.clientY);
    if (!c) return;
    const at = this.p.units.find((u) => this.alive(u.id) && same(entOf(this.p, u.id)!.pos, c));
    if (at?.side === 'hero') { this.sel = at.id; return; }
    const me = this.p.units.find((u) => u.id === this.sel);
    if (!me || !this.alive(me.id)) return;
    me.order = at ? { kind: 'attack', target: at.id } : { kind: 'move', cell: c };
  }

  /** The selected hero's cell, and where its move order is taking it. */
  private marks(): void {
    if (!this.rt) return;
    const me = this.p.units.find((u) => u.id === this.sel);
    const e = me && entOf(this.p, me.id);
    this.rt.showAim(e?.alive ? [e.pos] : null, true);
    const o = me?.order;
    this.rt.showPath(o?.kind === 'move' && e?.alive ? findPath(this.p.s.map, e.pos, o.cell) : null);
  }

  private labels(): void {
    if (!this.rt) return;
    this.el.querySelector('.pd-labels')!.innerHTML = this.p.units.filter((u) => u.side === 'hero' && this.alive(u.id)).map((u) => {
      const e = entOf(this.p, u.id)!;
      const pt = this.rt!.project(new THREE.Vector3(e.pos.x, 2.3, e.pos.y));
      return `<div class="pd-label${u.id === this.sel ? ' on' : ''}" style="left:${pt.left}px;top:${pt.top}px">${HEROES.indexOf(u.id) + 1} ${CLASSES[u.cls!].name}</div>`;
    }).join('');
  }

  private draw(): void {
    this.el.querySelector<HTMLElement>('[data-k="pause"]')!.textContent = this.paused ? '▶ 재개' : '❚❚ 정지';
    this.el.querySelector<HTMLElement>('[data-k="speed"]')!.textContent = `속도 ×${this.speed}`;
    this.el.classList.toggle('paused', this.paused);
    if (this.over()) this.message(HEROES.some((h) => this.alive(h)) ? '승리 · R 다시' : '전멸 · R 다시');
    const t = this.p.time;
    const cards = HEROES.map((id, i) => {
      const u = this.p.units.find((x) => x.id === id)!, e = entOf(this.p, id)!, cls = CLASSES[u.cls!];
      const skills = cls.skills.map((s, k) => { const left = Math.max(0, u.ready[k]! - t); return `<button type="button" data-skill="${k}" ${left > 0 || !e.alive ? 'disabled' : ''}>${k ? 'W' : 'Q'} ${SKILLS[s].name}${left > 0 ? ` ${left.toFixed(0)}` : ''}</button>`; }).join('');
      return `<div class="pd-card${id === this.sel ? ' on' : ''}${e.alive ? '' : ' dead'}" data-hero="${id}"><b>${i + 1} ${cls.name}</b><div class="pd-hp"><i style="width:${(e.hp / e.maxHp) * 100}%"></i><span>${e.hp}/${e.maxHp}</span></div><div class="pd-skills">${skills}</div></div>`;
    }).join('');
    // only when something shown changed (a rebuilt button mid-click would swallow the click)
    if (cards !== this.cardsHtml) { this.cardsHtml = cards; this.el.querySelector('.pd-cards')!.innerHTML = cards; }
  }
}

