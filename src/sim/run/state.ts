import { newRoster } from '../roster/generate';
import { generateMap } from './mapgen';
import type { MapNode, RunState } from './types';

export const START_GOLD = 60;

export function newRun(seed: number, startedAt: string): RunState {
  return {
    version: 1, seed, gold: START_GOLD, roster: newRoster(seed, 0), map: generateMap(seed), at: null, visited: [],
    status: 'active', formation: {}, startedAt, namedProtagonist: false,
  };
}

export function reachable(run: RunState): MapNode[] {
  if (run.status !== 'active') return [];
  const nodes = Object.values(run.map.nodes);
  if (!run.at) return nodes.filter((n) => n.step === 1).sort((a, b) => a.lane - b.lane);
  return run.map.nodes[run.at]!.next.map((id) => run.map.nodes[id]!).filter((n) => !run.visited.includes(n.id));
}

export function enterNode(run: RunState, nodeId: string): RunState {
  if (!reachable(run).some((n) => n.id === nodeId)) throw new Error(`node not reachable: ${nodeId}`);
  return { ...run, at: nodeId, visited: [...run.visited, nodeId], pending: { nodeId } };
}

export const currentNode = (run: RunState): MapNode | undefined => (run.at ? run.map.nodes[run.at] : undefined);
