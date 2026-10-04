import * as THREE from 'three';
import type { Screen } from '../../app/router';
import { GridSim } from '../../sim/grid/gridSim';
import { GridRuntime, setCameraElevation } from '../../view/grid/gridRuntime';
import { setFigureScale } from '../../view/grid/gridActors';
import { CELL } from '../../view/grid/gridTerrain';
import type { DungeonKit } from '../../view/grid/dungeonKit';
import type { UalLibrary } from '../../view/grid/ualActor';
import { isTouchDevice } from '../extract/touchControls';
import { refreshSight, SCENES, type Scene } from './kataScenes';
import '../styles/grid.css';
import '../styles/gridSf.css';
import '../styles/kataDemo.css';

/** game seconds per demo step at normal speed, and how slow a replay runs */
const SLOW = 0.3;

/** A scripted look at the gun-kata idea in the real game view: the same figures, camera and effects, step by step, with a slow-motion replay. */
export class KataDemo implements Screen {
  private readonly el = document.createElement('div');
  private rt: GridRuntime | null = null;
  private sim: GridSim | null = null;
  private scene = 0;
  private step = 0;
  private speed = 1;
  private raf = 0;
  private auto: ReturnType<typeof setTimeout> | undefined;
  private stage!: HTMLElement;
  private readonly tags = document.createElement('div');
  private zoom = 10;

  constructor(private readonly lib: UalLibrary, private readonly kit: DungeonKit) {}

  mount(root: HTMLElement): void {
    this.el.className = 'screen grid landscape kata';
    this.el.innerHTML = `<div class="grid-stage"></div>
      <div class="kata-bars"></div><div class="kata-slow">● 슬로모</div>
      <div class="kata-panel">
        <div class="kata-head"><b class="kata-name"></b><span class="kata-clock"></span><span class="kata-step"></span></div>
        <p class="kata-cap"></p>
        <ol class="kata-chain"></ol>
        <div class="kata-btns">
          <button type="button" class="btn" data-k="next">다음 ▸</button>
          <button type="button" class="btn" data-k="replay">다시보기 ×0.3</button>
          <button type="button" class="btn" data-k="s0">예시 1</button>
          <button type="button" class="btn" data-k="s1">예시 2</button>
          <button type="button" class="btn" data-k="px">도트</button>
        </div>
      </div>`;
    this.tags.className = 'kata-tags';
    this.el.appendChild(this.tags);
    root.appendChild(this.el);
    this.stage = this.el.querySelector<HTMLElement>('.grid-stage')!;
    this.el.querySelector('.kata-btns')!.addEventListener('click', (e) => {
      const k = (e.target as HTMLElement).closest<HTMLElement>('[data-k]')?.dataset.k;
      if (k === 'next') this.next(1);
      if (k === 'replay') this.replay();
      if (k === 's0' || k === 's1') this.load(Number(k[1]));
      if (k === 'px' && this.rt) { this.rt.pixelated = !this.rt.pixelated; (e.target as HTMLElement).textContent = this.rt.pixelated ? '도트' : 'HD'; }
    });
    const q = new URLSearchParams(location.search);
    this.zoom = Number(q.get('zoom')) || 10;
    if (q.get('elev')) setCameraElevation(Number(q.get('elev')));
    if (q.get('fig')) setFigureScale(Number(q.get('fig')));
    this.load(Math.min(SCENES.length - 1, Number(q.get('scene')) || 0));
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      this.rt?.update(dt * this.speed);
      this.drawTags();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  private get current(): Scene {
    return SCENES[this.scene]!;
  }

  /** Builds the scene from its first frame (a fresh runtime puts every figure in place at once). */
  private load(scene: number): void {
    clearTimeout(this.auto);
    clearTimeout(this.slowT);
    this.scene = scene;
    this.step = 0;
    this.setSpeed(1);
    const pixel = this.rt?.pixelated ?? true;
    this.rt?.dispose();
    this.stage.replaceChildren();
    this.sim = GridSim.fromState(this.current.setup());
    this.rt = new GridRuntime(this.stage, this.sim, this.lib, this.kit, isTouchDevice());
    this.rt.pixelated = pixel;
    this.rt.setZoom(this.zoom);
    this.show();
  }

  /** Plays the next step; a long chain turns to slow motion where it peaks (all of it in a replay). */
  private next(speed: number): void {
    const steps = this.current.steps;
    if (!this.sim || !this.rt || this.step >= steps.length - 1) return;
    this.step++;
    const st = steps[this.step]!;
    const s = this.sim.s;
    const events = st.run?.(s) ?? [];
    for (const e of events) e.t += s.time;
    refreshSight(s);
    this.setSpeed(speed);
    if (st.slowAt !== undefined && speed === 1) {
      clearTimeout(this.slowT);
      // the show plays one game turn in TURN_SEC (0.18 s)
      this.slowT = setTimeout(() => { this.setSpeed(SLOW); this.slowT = setTimeout(() => this.setSpeed(1), 1700); }, st.slowAt * 180);
    }
    this.rt.apply(events, s.time);
    s.time += 2;
    this.show();
  }

  private slowT: ReturnType<typeof setTimeout> | undefined;

  private setSpeed(v: number): void {
    this.speed = v;
    this.el.classList.toggle('slow', v < 1);
  }

  /** The whole scene again from the top, the decisive steps in slow motion. */
  private replay(): void {
    this.load(this.scene);
    const play = () => {
      if (this.step >= this.current.steps.length - 1) { this.auto = setTimeout(() => this.setSpeed(1), 2600); return; }
      this.next(SLOW);
      this.auto = setTimeout(play, 4200);
    };
    this.auto = setTimeout(play, 600);
  }

  private show(): void {
    const st = this.current.steps[this.step]!;
    this.el.querySelector('.kata-name')!.textContent = `예시 ${this.scene + 1} · ${this.current.name}`;
    this.el.querySelector('.kata-step')!.textContent = `${this.step + 1}/${this.current.steps.length}`;
    this.el.querySelector('.kata-cap')!.textContent = st.input;
    this.el.querySelector('.kata-clock')!.textContent = '';
    this.el.querySelector('.kata-chain')!.innerHTML = st.chain.map((c) => `<li>${c}</li>`).join('');
    this.rt?.fx.setAim(st.aims.map(([a, b]) => [new THREE.Vector3(a.x * CELL, 0, a.y * CELL), new THREE.Vector3(b.x * CELL, 0, b.y * CELL)]));
  }

  /** Hearts and the coming move over each figure, following it on screen. */
  private drawTags(): void {
    const rt = this.rt;
    if (!rt) return;
    const tags = this.current.steps[this.step]!.tags;
    const html: string[] = [];
    for (const [id, t] of Object.entries(tags)) {
      const p = rt.actors.pos(id);
      if (!p) continue;
      const { left, top } = rt.project(p.clone().setY(2.5));
      if (t.intent || t.stun) html.push(`<div class="kata-tag" style="left:${left}px;top:${top}px">${t.stun ? '<em>기절</em>' : ''}${t.intent ? `<b>${t.intent}</b>` : ''}</div>`);
    }
    const out = html.join('');
    if (this.tags.innerHTML !== out) this.tags.innerHTML = out;
  }

  unmount(): void {
    cancelAnimationFrame(this.raf);
    clearTimeout(this.auto);
    this.rt?.dispose();
    this.el.remove();
  }
}
