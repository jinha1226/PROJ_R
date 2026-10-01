import { describe, it, expect } from 'vitest';
import { createRng } from '../../src/core/rng';
import { Battle } from '../../src/sim/battle/battle';
import type { BattleEvent } from '../../src/sim/battle/types';
import { generateExploration } from '../../src/sim/explore/generate';
import { chooseExplore, leaveExploration, stageOf } from '../../src/sim/explore/progress';
import { roomBattleSetup } from '../../src/sim/explore/roomBattle';
import { settleRoomBattle } from '../../src/sim/explore/roomResult';
import type { Dir } from '../../src/sim/explore/types';
import { reportFromBattle } from '../../src/sim/roster/aftermath';
import { generateRecruit } from '../../src/sim/roster/generate';
import { finishBattle } from '../../src/sim/run/battleNode';
import type { RunState } from '../../src/sim/run/types';
import { newRunV2, restWeek, trainWeek } from '../../src/sim/week/week';

const company = (): RunState => {
  const r = newRunV2(6, 'x');
  const rng = createRng(1);
  const used = new Set<string>();
  const extra = [1, 2, 3].map((i) => generateRecruit(rng, { level: 4, usedNames: used, id: `m${i}` }));
  return { ...r, week: 4, phase: 'choose', visitors: undefined, startEvent: undefined, roster: { ...r.roster, mercs: [...r.roster.mercs, ...extra], nextId: 4 } };
};
const fight = (run: RunState, roomId: string) => {
  const setup = roomBattleSetup(run, roomId, run.formation);
  const b = new Battle(setup);
  const events: BattleEvent[] = [];
  while (!b.outcome) events.push(...b.step().events);
  const e = run.exploration!;
  return { setup, report: reportFromBattle(b.state, events, stageOf(e, e.rooms[roomId]!)) };
};

describe('final review fixes (Plan 5)', () => {
  it('a week takes exactly one action: train/rest/explore refuse once the week is underway', () => {
    const exploring = chooseExplore(company(), 0, ['m0', 'm1']);
    expect(() => trainWeek(exploring, ['m0'])).toThrow();
    expect(() => restWeek(exploring)).toThrow();
    expect(() => chooseExplore(exploring, 1, ['m0'])).toThrow();
    expect(() => trainWeek({ ...company(), phase: 'report' }, ['m0'])).toThrow();
  });

  it('a member benched in prep stays out of the room battle', () => {
    const run = chooseExplore(company(), 0, ['m0', 'm1', 'm2']);
    const room = Object.values(run.exploration!.rooms).find((r) => r.type === 'battle')!;
    const setup = roomBattleSetup({ ...run, exploration: { ...run.exploration!, enteredFrom: 'w' } }, room.id, { m0: { col: 2, row: 1 }, m1: { col: 1, row: 2 } });
    expect(setup.allies.map((a) => a.id).sort()).toEqual(['m0', 'm1']);
  });

  it('whatever door the party comes through, it starts in formation clear of the enemies', () => {
    const run = chooseExplore(company(), 0, ['m0', 'm1', 'm2', 'm3']);
    const formation = { m0: { col: 2, row: 1 }, m1: { col: 2, row: 2 }, m2: { col: 0, row: 1 }, m3: { col: 1, row: 3 } } as RunState['formation'];
    let min = Infinity;
    for (let seed = 0; seed < 30; seed++) {
      const e = generateExploration(seed, 6, { theme: (['forest', 'dungeon', 'graveyard'] as const)[seed % 3]!, stars: ((seed % 3) + 1) as 1 | 2 | 3, reward: 'gold', rooms: 8 }, ['m0', 'm1', 'm2', 'm3']);
      for (const room of Object.values(e.rooms).filter((r) => r.type === 'battle' || r.type === 'elite'))
        for (const dir of ['n', 's', 'e', 'w'] as Dir[]) {
          const s = roomBattleSetup({ ...run, exploration: { ...e, at: room.id, enteredFrom: dir } }, room.id, formation);
          for (const a of s.allies) for (const en of s.enemies) min = Math.min(min, Math.hypot(a.spawn!.x - en.spawn!.x, a.spawn!.y - en.spawn!.y));
        }
    }
    expect(min).toBeGreaterThanOrEqual(2.5);
  });

  it('the exploration report carries the battles: xp, moments, and the retreat penalty', () => {
    let run = chooseExplore(company(), 0, ['m0', 'm1', 'm2', 'm3']);
    const room = Object.values(run.exploration!.rooms).find((r) => r.type === 'battle')!;
    run = { ...run, exploration: { ...run.exploration!, at: room.id, enteredFrom: 'w' } };
    const { setup, report } = fight(run, room.id);
    const won = settleRoomBattle(run, room.id, setup.allies.map((a) => a.id), { ...report, outcome: 'victory' }).run;
    const left = leaveExploration(won);
    const survivors = setup.allies.map((a) => a.id).filter((id) => won.roster.mercs.some((m) => m.id === id && m.alive));
    expect(survivors.length).toBeGreaterThan(0);
    for (const id of survivors) expect(left.report!.xp[id] ?? 0).toBeGreaterThan(0);
    expect(left.report!.moments.length).toBeGreaterThan(0);
    const lost = settleRoomBattle(run, room.id, setup.allies.map((a) => a.id), { ...report, outcome: 'defeat' }).run;
    expect(lost.report!.notes.some((n) => n.key === 'retreatGold')).toBe(true);
  });

  it('a room battle does not heal the members at home (healing is weekly)', () => {
    let run = chooseExplore(company(), 0, ['m0', 'm1']);
    run = { ...run, roster: { ...run.roster, mercs: run.roster.mercs.map((m) => (m.id === 'm3' ? { ...m, injury: 2 } : m)) } };
    const room = Object.values(run.exploration!.rooms).find((r) => r.type === 'battle')!;
    run = { ...run, exploration: { ...run.exploration!, at: room.id, enteredFrom: 'w' } };
    const { setup, report } = fight(run, room.id);
    const out = finishBattle(run, { kind: 'battle', stage: 4, key: 1 }, setup.allies.map((a) => a.id), report).run;
    expect(out.roster.mercs.find((m) => m.id === 'm3')!.injury).toBe(2);
  });
});
