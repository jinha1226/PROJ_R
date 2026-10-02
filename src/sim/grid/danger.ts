import { dist, FOES, idx, same, tileAt, type Cell, type GridState } from './types';

export const DANGER = { alarm: 200, reinforce: 300 };
export const EXIT_TIME = 3;
const REINFORCEMENTS = 3;

/** Sleepers within `r` tiles of a loud noise wake up. */
export function noise(s: GridState, at: Cell, r: number): void {
  for (const f of s.foes) if (f.alive && !f.awake && dist(f.pos, at) <= r) wake(s, f.id);
}

export function wake(s: GridState, id: string): void {
  const f = s.foes.find((x) => x.id === id)!;
  if (f.awake) return;
  f.awake = true;
  f.lastSeen = { ...s.hero.pos };
  s.events.push({ t: s.time, type: 'wake', src: f.id, to: { ...f.pos } });
}

/** After the hero's turn: anyone who can see the hero wakes (and rouses their room), awake foes remember where the hero is. */
export function updateAwareness(s: GridState): void {
  for (const f of s.foes) {
    if (!f.alive || !s.visible.has(idx(s.map, f.pos)) || dist(f.pos, s.hero.pos) > 8) continue;
    if (!f.awake) for (const g of s.foes) if (g.alive && g.group === f.group) wake(s, g.id);
    f.lastSeen = { ...s.hero.pos };
  }
}

/** The clock: at 200 the crypt stirs, at 300 more dead arrive and an exit seals. */
export function updateDanger(s: GridState): void {
  if (s.danger < 1 && s.time >= DANGER.alarm) {
    s.danger = 1;
    s.events.push({ t: s.time, type: 'alarm', text: '발소리가 늘었다' });
    for (const f of s.foes) if (f.alive && !f.awake && s.rng.chance(0.5)) wake(s, f.id);
  }
  if (s.danger < 2 && s.time >= DANGER.reinforce) {
    s.danger = 2;
    s.events.push({ t: s.time, type: 'reinforce', text: '묘지 깊은 곳에서 증원이 몰려온다' });
    const spots: Cell[] = [];
    for (let y = 0; y < s.map.h; y++) for (let x = 0; x < s.map.w; x++) {
      const c = { x, y };
      if (tileAt(s.map, c) === 'floor' && !s.visible.has(idx(s.map, c)) && dist(c, s.hero.pos) >= 10 && !s.foes.some((f) => f.alive && same(f.pos, c))
        && !s.chests.some((ch) => same(ch.pos, c)) && !s.map.exits.some((e) => dist(e, c) < 4)) spots.push(c);
    }
    for (let n = 0; n < REINFORCEMENTS && spots.length; n++) {
      const pos = spots.splice(s.rng.int(0, spots.length - 1), 1)[0]!;
      s.foes.push({ id: `f${s.nextFoeId++}`, kind: 'minion', pos, hp: FOES.minion.hp, maxHp: FOES.minion.hp, nextAt: s.time, alive: true, awake: true, group: -1, lastSeen: { ...s.hero.pos } });
    }
    const open = s.map.exits.map((_, i) => i).filter((i) => !s.closedExits.includes(i));
    if (open.length > 1) {
      const i = s.rng.pick(open);
      s.closedExits.push(i);
      s.events.push({ t: s.time, type: 'exitClosed', to: { ...s.map.exits[i]! }, text: '탈출 지점 하나가 무너졌다' });
    }
  }
}

/** Standing on an open exit for EXIT_TIME gets the hero out; stepping off resets it. */
export function updateExtraction(s: GridState, spent: number): void {
  const on = s.map.exits.some((e, i) => same(e, s.hero.pos) && !s.closedExits.includes(i));
  if (!on) { s.hero.exitTime = 0; return; }
  s.hero.exitTime += spent;
  s.events.push({ t: s.time, type: 'extracting', src: s.hero.id, amount: Math.min(1, s.hero.exitTime / EXIT_TIME) });
  if (s.hero.exitTime >= EXIT_TIME) {
    s.outcome = 'extracted';
    s.events.push({ t: s.time, type: 'extracted', src: s.hero.id });
  }
}
