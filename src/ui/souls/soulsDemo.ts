import * as THREE from 'three';
import type { Screen } from '../../app/router';
import { GridSim } from '../../sim/grid/gridSim';
import { DIRS, same, type Cell, type GEvent } from '../../sim/grid/types';
import { FOES, HERO, WEAPONS, type FoeId, type WeaponId } from '../../sim/souls/soulsDefs';
import { act, arena, cloneSouls, type Souls, type SoulsAction } from '../../sim/souls/soulsSim';
import { GridRuntime } from '../../view/grid/gridRuntime';
import type { DungeonKit } from '../../view/grid/dungeonKit';
import type { UalLibrary } from '../../view/grid/ualActor';
import '../styles/grid.css';
import '../styles/gridSf.css';
import '../styles/soulsDemo.css';

const SCENES: { name: string; foes: { id: FoeId; x: number; y: number }[] }[] = [
  { name: '병사', foes: [{ id: 'soldier', x: 5, y: 3 }, { id: 'soldier', x: 8, y: 2 }] },
  { name: '기사', foes: [{ id: 'knight', x: 6, y: 3 }] },
  { name: '브루트', foes: [{ id: 'brute', x: 6, y: 3 }] },
  { name: '혼합', foes: [{ id: 'soldier', x: 3, y: 3 }, { id: 'knight', x: 6, y: 2 }, { id: 'brute', x: 9, y: 3 }] },
];
const KEY_DIR: Record<string, Cell> = { ArrowUp: { x: 0, y: -1 }, w: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 }, s: { x: 0, y: 1 }, ArrowLeft: { x: -1, y: 0 }, a: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 }, d: { x: 1, y: 0 }, q: { x: -1, y: -1 }, e: { x: 1, y: -1 }, z: { x: -1, y: 1 }, c: { x: 1, y: 1 } };

/** What an action would come to if taken now (played out on a copy). */
function outcome(g: Souls, a: SoulsAction): { text: string; tone: 'ok' | 'bad' | 'warn' | '' } {
  const c = cloneSouls(g);
  const ev = act(c, a);
  if (ev.length === 1 && ev[0]!.type === 'blocked') return { text: '불가', tone: '' };
  const hurt = ev.filter((e) => e.type === 'hit' && e.dst === 'hero').reduce((n, e) => n + (e.amount ?? 0), 0);
  const dealt = ev.filter((e) => e.type === 'hit' && e.src === 'hero').reduce((n, e) => n + (e.amount ?? 0), 0);
  if (ev.some((e) => e.type === 'parry' && e.src === 'hero')) return { text: '패링 ✓', tone: 'ok' };
  if (ev.some((e) => e.type === 'shield' && e.src === 'hero')) return { text: `막음 −${hurt}`, tone: 'warn' };
  if (hurt) return { text: dealt ? `${dealt} 주고 −${hurt}` : `피격 −${hurt}`, tone: 'bad' };
  if (ev.some((e) => e.type === 'miss' && e.dst === 'hero')) return { text: dealt ? `${dealt} · 회피 ✓` : '회피 ✓', tone: 'ok' };
  return { text: dealt ? `타격 ${dealt}` : '안전', tone: dealt ? 'ok' : '' };
}

/** `?demo=souls`: the turn-based souls combat prototype on the game's own view. */
export class SoulsDemo implements Screen {
  private readonly el = document.createElement('div');
  private stage!: HTMLElement;
  private rt: GridRuntime | null = null;
  private g!: Souls;
  private scene = 0;
  private raf = 0;
  private readonly onKey = (e: KeyboardEvent) => this.key(e);

  constructor(private readonly lib: UalLibrary, private readonly kit: DungeonKit) {}

  mount(root: HTMLElement): void {
    this.el.className = 'screen grid landscape souls';
    this.el.innerHTML = `<div class="grid-stage"></div><div class="sd-labels"></div>
      <div class="sd-hud"><div class="sd-bar hp"><i></i><span></span></div><div class="sd-bar st"><i></i><span></span></div><div class="sd-bar po"><i></i><span></span></div><p class="sd-info"></p></div>
      <div class="sd-top"><nav class="sd-scenes">${SCENES.map((sc, i) => `<button type="button" data-scene="${i}">${sc.name}</button>`).join('')}</nav>
        <nav class="sd-weapons">${(Object.keys(WEAPONS) as WeaponId[]).map((w) => `<button type="button" data-weapon="${w}">${WEAPONS[w].name}</button>`).join('')}</nav></div>
      <div class="sd-acts"></div><p class="sd-help">이동 WASD·QEZC·클릭 · 구르기 Shift+방향 · 공격 J · 방어 L · 회복 H</p>`;
    root.appendChild(this.el);
    this.stage = this.el.querySelector<HTMLElement>('.grid-stage')!;
    this.el.querySelector('.sd-scenes')!.addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest<HTMLElement>('[data-scene]'); if (b) { this.scene = Number(b.dataset.scene); this.restart(); } });
    this.el.querySelector('.sd-weapons')!.addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest<HTMLElement>('[data-weapon]'); if (b) this.do({ kind: 'weapon', id: b.dataset.weapon as WeaponId }); });
    this.el.querySelector('.sd-acts')!.addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest<HTMLElement>('[data-act]'); if (b) this.do(this.actionFor(b.dataset.act!)); });
    this.stage.addEventListener('pointerup', (e) => this.click(e));
    addEventListener('keydown', this.onKey);
    this.restart();
    let last = performance.now();
    const loop = (now: number) => { // a frame's timestamp can come just before the moment the loop began: never a step back in time
      const dt = Math.max(0, Math.min(0.1, (now - last) / 1000)); last = now; this.rt?.update(dt); this.labels(); this.raf = requestAnimationFrame(loop); };
    this.raf = requestAnimationFrame(loop);
  }

  unmount(): void { removeEventListener('keydown', this.onKey); cancelAnimationFrame(this.raf); this.rt?.dispose(); this.el.remove(); }

  private restart(): void {
    const weapon = this.g?.hero.weapon ?? 'longsword';
    this.g = arena(SCENES[this.scene]!.foes, weapon);
    this.rt?.dispose();
    this.stage.replaceChildren();
    this.rt = new GridRuntime(this.stage, GridSim.fromState(this.g.s), this.lib, this.kit, false);
    this.rt.setZoom(8.5);
    this.rt.stayInMap = true;
    this.el.querySelectorAll<HTMLElement>('[data-scene]').forEach((b) => b.classList.toggle('on', Number(b.dataset.scene) === this.scene));
    this.draw();
  }

  /** The dodge a button press takes: the safest of the eight ways (away from the blow first). */
  private bestDodge(): SoulsAction {
    const opts = DIRS.map((dir) => ({ dir, o: outcome(this.g, { kind: 'dodge', dir }) })).filter((x) => x.o.text !== '불가');
    const pick = opts.find((x) => x.o.tone === 'ok') ?? opts.find((x) => x.o.tone !== 'bad') ?? opts[0];
    return { kind: 'dodge', dir: pick?.dir ?? { x: 0, y: 1 } };
  }

  /** The three buttons: the weapon's attack, one defence (parry early, guard late), heal; a roll stays on Shift+direction. */
  private actionFor(id: string): SoulsAction {
    if (id === 'dodge') return this.bestDodge();
    if (id === 'attack') return { kind: 'light' };
    return { kind: id } as SoulsAction;
  }

  private do(a: SoulsAction): void {
    if (!this.rt || this.g.s.outcome || this.g.s.foes.every((f) => !f.alive)) return;
    const t0 = this.g.s.time;
    const ev: GEvent[] = act(this.g, a);
    if (ev.length === 1 && ev[0]!.type === 'blocked') return;
    this.rt.apply(ev, t0);
    if (a.kind === 'guard' || a.kind === 'parry') this.rt.actors.anim('hero', 'parry');
    this.draw();
  }

  private key(e: KeyboardEvent): void {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const dir = KEY_DIR[k];
    if (dir) { e.preventDefault(); this.do(e.shiftKey ? { kind: 'dodge', dir } : { kind: 'move', dir }); return; }
    const map: Record<string, string> = { j: 'attack', l: 'defend', h: 'heal', ' ': 'dodge' };
    if (map[k]) { e.preventDefault(); this.do(this.actionFor(map[k]!)); }
    if (k === 'r') this.restart();
  }

  /** A click on a floor cell steps toward it; on a foe it turns to face it. */
  private click(e: PointerEvent): void {
    const c = this.rt?.cellAt(e.clientX, e.clientY);
    if (!c) return;
    const h = this.g.s.hero.pos;
    const dir = { x: Math.sign(c.x - h.x), y: Math.sign(c.y - h.y) };
    if (!dir.x && !dir.y) return;
    if (this.g.s.foes.some((f) => f.alive && same(f.pos, c))) { this.do({ kind: 'face', dir }); this.draw(); return; }
    this.do({ kind: 'move', dir });
  }

  private draw(): void {
    const g = this.g, h = g.hero, s = g.s;
    const bar = (cls: string, v: number, max: number, label: string) => {
      const el = this.el.querySelector<HTMLElement>(`.sd-bar.${cls}`)!;
      el.querySelector('i')!.style.width = `${Math.max(0, Math.min(100, (v / max) * 100))}%`;
      el.querySelector('span')!.textContent = `${label} ${Math.max(0, Math.round(v))}`;
    };
    bar('hp', s.hero.hp, s.hero.maxHp, '체력');
    bar('st', h.stamina, HERO.stamina, '스태미나');
    bar('po', h.poise, HERO.poise + WEAPONS[h.weapon].armor, '자세');
    const end = s.outcome === 'dead' ? '쓰러졌다 · R 다시' : s.foes.every((f) => !f.alive) ? '모두 쓰러뜨렸다 · R 다시' : '';
    this.el.querySelector('.sd-info')!.textContent = end || `시간 ${s.time.toFixed(1)} · 회복약 ${h.flasks} · ${WEAPONS[h.weapon].name}`;
    this.el.querySelectorAll<HTMLElement>('[data-weapon]').forEach((b) => b.classList.toggle('on', b.dataset.weapon === h.weapon));
    const w = WEAPONS[h.weapon];
    const acts: [string, string, string][] = [['attack', `공격 · ${w.light.name}`, `${w.light.cost}`], ['defend', '방어', '0.8'], ['heal', `회복 ${h.flasks}`, '1.6']];
    this.el.querySelector('.sd-acts')!.innerHTML = acts.map(([id, name, cost]) => {
      const o = end ? { text: '', tone: '' } : outcome(g, this.actionFor(id));
      return `<button type="button" data-act="${id}" class="${o.tone}"><b>${name}</b><small>${cost}</small><em>${o.text}</em></button>`;
    }).join('');
  }

  /** Over each foe: what it is about to do and how long until it lands, or that it is broken. */
  private labels(): void {
    if (!this.rt) return;
    const layer = this.el.querySelector<HTMLElement>('.sd-labels')!;
    const g = this.g, now = g.s.time;
    layer.innerHTML = g.foes.map((b) => {
      const e = g.s.foes.find((f) => f.id === b.id)!;
      if (!e.alive) return '';
      const p = this.rt!.project(new THREE.Vector3(e.pos.x, 2.4, e.pos.y));
      const def = FOES[b.def];
      const what = now < b.staggerUntil ? `<b class="broke">무너짐 ${(b.staggerUntil - now).toFixed(1)}</b>`
        : b.intent ? `<b class="${b.intent.parry ? 'pa' : 'np'}">${b.intent.name} ${(b.intent.at - now).toFixed(1)}</b><small>${b.intent.parry ? '패링 가능' : '패링 불가'}</small>` : '';
      return `<div class="sd-label" style="left:${p.left}px;top:${p.top}px"><span>${def.name}</span>${what}<i style="width:${(b.poise / def.poise) * 100}%"></i></div>`;
    }).join('');
  }
}
