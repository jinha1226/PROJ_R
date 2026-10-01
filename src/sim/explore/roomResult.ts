import type { BattleReport } from '../roster/aftermath';
import { addXp } from '../roster/leveling';
import { finishBattle } from '../run/battleNode';
import type { RunState } from '../run/types';
import { gain, leaveExploration, markDone, stageOf } from './progress';

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 17);

/** Settles a room battle: a win clears the room and banks its loot, a loss retreats out of the exploration. */
export function settleRoomBattle(run: RunState, roomId: string, deployed: string[], report: BattleReport): { run: RunState; out: ReturnType<typeof finishBattle> } {
  const e = run.exploration!;
  const room = e.rooms[roomId]!;
  const out = finishBattle(run, { kind: room.type === 'elite' ? 'elite' : 'battle', stage: stageOf(e, room), key: hash(roomId) + run.week }, deployed, report);
  let next: RunState = { ...out.run, exploration: gain(e, out.aftermath.xp, out.aftermath.moments) };
  if (report.outcome === 'victory') {
    next = markDone(next, roomId, { gold: out.reward.gold, items: out.reward.items });
    if (e.reward === 'xp') {
      next = { ...next, roster: { ...next.roster, mercs: next.roster.mercs.map((m) => (deployed.includes(m.id) ? addXp(m, 10 * e.stars) : m)) } };
      next = { ...next, exploration: gain(next.exploration!, Object.fromEntries(deployed.map((id) => [id, 10 * e.stars]))) };
    }
  } else {
    next = leaveExploration(next, true);
    next = { ...next, report: { ...next.report!, notes: [...next.report!.notes, { key: 'retreatGold', vars: { gold: String(-out.reward.gold) } }] } };
  }
  return { run: next, out };
}
