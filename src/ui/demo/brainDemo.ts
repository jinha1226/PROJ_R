import { COMPACT } from '../../sim/delve/delveGen';
import { canDescend, newDelve, type DelveParty } from '../../sim/delve/delveSim';
import { BRAIN, KNACKS, KNACK_DESC, KNACK_NAME, type Knack } from '../../sim/party/brain';
import { entOf } from '../../sim/party/partyCore';
import { CLASSES, type BaseClass } from '../../sim/party/partyDefs';
import { clones, implant } from '../../sim/roam/roam';
import type { AutoRun } from '../delve/autoRun';
import '../styles/brainDemo.css';

/** what the dungeon screen hands a watch page (DelveScreen.drive) */
export interface Drive { p(): DelveParty; auto: AutoRun; down(): void; speed(v: number): void; zoom(z: number): void; say(text: string): void; picking(): boolean; pick(): void }

/** A lone clone of a class at the top of the dungeon, as a run begins. */
export function brainParty(seed: number, cls: BaseClass): DelveParty {
  const p = newDelve(seed, 1), u = clones(p)[0]!;
  implant(p, u, cls, []);
  const e = entOf(p, u.id)!; e.hp = e.maxHp;
  return p;
}

const SPEEDS = [1, 2, 4];
/** between fights the run hurries on by this much more (walking is not what is being watched) */
const TRAVEL = 3;

/**
 * `?demo=brain` (`&c=<class>`, an archer unless told): a clone goes down the dungeon by itself, run after run, and the
 * panel switches what it knows how to do — to see whether know-how bought piece by piece (the incremental idea of
 * 2026-10-10) shows on screen. It starts a fool: every switch off. `stage` puts a fresh run on screen and hands back its drive.
 */
export function runBrainDemo(cls: BaseClass, firstSeed: number, stage: (p: DelveParty) => Drive): void {
  BRAIN.on = true; COMPACT.on = true;
  document.documentElement.classList.add('brain-demo');
  let seed = firstSeed, run = 0, speed = 2, d!: Drive;
  let before = 0, idle = 0, nudges = 0, downAt = 0, lastText = '';
  const best = { floor: 0, kills: 0 };
  const panel = document.createElement('div');
  panel.className = 'brain';
  panel.innerHTML = `<div class="brain-top"><b>${CLASSES[cls].name} 혼자</b><span data-now></span><span data-best></span></div>
    <div class="brain-knacks">${KNACKS.map((k) => `<button type="button" data-k="${k}">${KNACK_NAME[k]}</button>`).join('')}</div>
    <div class="brain-desc">아무것도 모르는 상태다. 하나씩 켜 보자.</div>
    <div class="brain-row"><span>속도</span>${SPEEDS.map((v) => `<button type="button" data-v="${v}">×${v}</button>`).join('')}<button type="button" data-new>새 판</button></div>`;
  document.body.appendChild(panel);
  const now = panel.querySelector<HTMLElement>('[data-now]')!, bestEl = panel.querySelector<HTMLElement>('[data-best]')!, desc = panel.querySelector<HTMLElement>('.brain-desc')!;
  const paint = (): void => {
    for (const b of panel.querySelectorAll<HTMLElement>('[data-k]')) b.classList.toggle('on', BRAIN.knows[b.dataset.k as Knack]);
    for (const b of panel.querySelectorAll<HTMLElement>('[data-v]')) b.classList.toggle('on', Number(b.dataset.v) === speed);
  };
  const begin = (): void => {
    run++; before = 0; idle = 0; nudges = 0; downAt = 0;
    d = stage(brainParty(seed++, cls));
    d.speed(speed);
    d.auto.toggle();
  };
  panel.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('button');
    if (!b) return;
    if (b.dataset.k) { const k = b.dataset.k as Knack; BRAIN.knows[k] = !BRAIN.knows[k]; desc.textContent = `${KNACK_NAME[k]} ${BRAIN.knows[k] ? '배움' : '잊음'} — ${KNACK_DESC[k]}`; }
    if (b.dataset.v) speed = Number(b.dataset.v);
    if (b.dataset.new !== undefined) begin();
    paint();
  });
  const fallen = (p: DelveParty): number => p.units.filter((u) => u.side === 'foe' && !entOf(p, u.id)?.alive).length;
  setInterval(() => {
    const p = d.p(), e = entOf(p, p.leader ?? 'hero'), kills = before + fallen(p);
    d.speed(p.combat ? speed : speed * TRAVEL);
    const text = `${run}판 · 지하 ${p.floor}층 · 처치 ${kills}`;
    if (text !== lastText) { lastText = text; now.textContent = text; }
    if (!e?.alive) {
      // down: the run is scored, and after a breath the next begins
      if (!downAt) {
        downAt = performance.now();
        if (p.floor > best.floor || (p.floor === best.floor && kills > best.kills)) { best.floor = p.floor; best.kills = kills; }
        bestEl.textContent = `최고 지하 ${best.floor}층 · ${best.kills}`;
      } else if (performance.now() - downAt > 2600) begin();
      return;
    }
    if (d.auto.on) { idle = 0; return; }
    // the run by itself has stopped: at the stairs it goes down; handed back by a tap, or with nowhere left to go, it is set going again (a few times, then a new run)
    if (canDescend(p)) { before += fallen(p); d.down(); d.auto.toggle(); nudges = 0; return; }
    if (++idle < 6) return;
    idle = 0;
    if (++nudges > 4) begin(); else d.auto.toggle();
  }, 250);
  paint();
  begin();
}
