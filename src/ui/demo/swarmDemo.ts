import { COMPACT } from '../../sim/delve/delveGen';
import type { DelveParty } from '../../sim/delve/delveSim';
import { AUTOHIT, rouseBand } from '../../sim/party/autoHit';
import { entOf, unitOf } from '../../sim/party/partyCore';
import { CLASSES, type BaseClass } from '../../sim/party/partyDefs';
import { BRIGHT } from '../../view/grid/zoneLook';
import { DPAD } from '../delve/dPad';
import { brainParty, type Drive } from './brainDemo';
import '../styles/swarmDemo.css';

/** the pace of the world (the fight runs by itself: slower than the watch pages, to be walked through by hand) */
const SPEEDS: [number, string][] = [[0.5, '느리게'], [0.75, '보통'], [1, '빠르게']];
/** as far out as the view goes */
const ZOOM = 26;
/** every so often (game time) the nearest sleeping band wakes and comes */
const ROUSE = 45;
/** a band this many times the usual in every room */
const PACK = 3;

/**
 * `?demo=swarm` (`&c=<class>`, a warrior unless told): the dungeon crawl met with a survivors game, to try by hand. The
 * player only walks (the key pad); blows land by themselves on what comes in reach, potions and ultimates go off by
 * themselves, a level-up stops the world for its card. Small floors of large rooms with big bands, and the floor closes
 * in: a sleeping band wakes and comes every so often. Bright look, zoomed all the way out. `stage` puts a run on screen.
 */
export function runSwarmDemo(cls: BaseClass, firstSeed: number, stage: (p: DelveParty) => Drive): void {
  AUTOHIT.on = true; COMPACT.on = true; COMPACT.pack = PACK; BRIGHT.on = true; DPAD.on = true;
  document.documentElement.classList.add('swarm-demo');
  let seed = firstSeed, run = 0, speed = 0.75, d!: Drive;
  let floor = 0, before = 0, here = 0, rouseAt = 0, downAt = 0, lastText = '';
  const best = { floor: 0, kills: 0 };
  const panel = document.createElement('div');
  panel.className = 'swarm';
  panel.innerHTML = `<div class="swarm-now"></div><div class="swarm-best"></div>
    <div class="swarm-row">${SPEEDS.map(([v, name]) => `<button type="button" data-v="${v}">${name}</button>`).join('')}</div>
    <div class="swarm-row"><span>걷기만 하면 된다</span><button type="button" data-new>새 판</button></div>`;
  document.body.appendChild(panel);
  const now = panel.querySelector<HTMLElement>('.swarm-now')!, bestEl = panel.querySelector<HTMLElement>('.swarm-best')!;
  const paint = (): void => { for (const b of panel.querySelectorAll<HTMLElement>('[data-v]')) b.classList.toggle('on', Number(b.dataset.v) === speed); };
  const begin = (): void => {
    run++; floor = 0; before = 0; here = 0; downAt = 0;
    d = stage(brainParty(seed++, cls));
    d.speed(speed);
  };
  panel.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('button');
    if (!b) return;
    if (b.dataset.v) { speed = Number(b.dataset.v); d.speed(speed); }
    if (b.dataset.new !== undefined) begin();
    paint();
  });
  setInterval(() => {
    const p = d.p(), id = p.leader ?? 'hero', e = entOf(p, id), u = unitOf(p, id);
    // a new floor: the view goes all the way out again, the floor's own count starts, the first band is given a while
    if (p.floor !== floor) { floor = p.floor; before += here; here = 0; rouseAt = p.time + ROUSE * 1.5; d.zoom(ZOOM); }
    here = p.units.filter((f) => f.side === 'foe' && !entOf(p, f.id)?.alive).length;
    const kills = before + here, text = `${CLASSES[cls].name} · ${run}판 · 지하 ${p.floor}층 · 처치 ${kills}`;
    if (text !== lastText) { lastText = text; now.textContent = text; }
    if (!e?.alive) {
      if (!downAt) {
        downAt = performance.now();
        if (p.floor > best.floor || (p.floor === best.floor && kills > best.kills)) { best.floor = p.floor; best.kills = kills; }
        bestEl.textContent = `최고 지하 ${best.floor}층 · ${best.kills}`;
      } else if (performance.now() - downAt > 3000) begin();
      return;
    }
    // a level gained: the world stops for its card
    if (u?.picks && u.offer?.length && !d.picking()) d.pick();
    if (p.time >= rouseAt) { rouseAt = p.time + ROUSE; if (rouseBand(p, p.time)) d.say('발소리가 몰려온다'); }
  }, 250);
  paint();
  begin();
}
