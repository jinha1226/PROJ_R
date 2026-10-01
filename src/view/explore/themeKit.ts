import type { Dir } from '../../sim/explore/types';
import type { Theme } from '../../sim/run/types';

/** Env model refs are `<theme>/<key>` → public/assets/models/env/<theme>/<key>.glb. */
export interface ThemeKit {
  ground: string;
  groundAccent: string;
  floorTile?: { key: string; size: number };
  boundary: { keys: string[]; spacing: number; height: number };
  props: Record<string, string[]>;
  chest: string;
  sky: string;
  light: string;
}

export const THEME_KITS: Record<Theme, ThemeKit> = {
  forest: {
    ground: '#6f8a4a', groundAccent: '#58703a', boundary: { keys: ['forest/trees', 'forest/treesB'], spacing: 3.2, height: 4.2 },
    props: { tree: ['forest/tree', 'forest/treeB'], rock: ['forest/rock', 'forest/rockB'], bush: ['forest/bush'] },
    chest: 'dungeon/chest', sky: '#7a8f6a', light: '#fff2d0',
  },
  dungeon: {
    ground: '#5c574f', groundAccent: '#4a453e', floorTile: { key: 'dungeon/floor', size: 4 }, boundary: { keys: ['dungeon/wall'], spacing: 4, height: 4 },
    props: { pillar: ['dungeon/pillar'], crates: ['dungeon/crates'], barrel: ['dungeon/barrel'] },
    chest: 'dungeon/chest', sky: '#2a2622', light: '#ffc890',
  },
  graveyard: {
    ground: '#5d5a48', groundAccent: '#4a4838', boundary: { keys: ['graveyard/fence'], spacing: 2.2, height: 1.4 },
    props: { grave: ['graveyard/grave', 'graveyard/graveB'], deadtree: ['graveyard/deadtree', 'graveyard/deadtreeB'], crypt: ['graveyard/crypt'] },
    chest: 'dungeon/chest', sky: '#3e4450', light: '#c8d0ff',
  },
};

const HALF = { x: 12, y: 7 };
const DOOR_GAP = 2.2;

/** Positions along the room edge (room-local, rot = yaw facing inward), skipping the door gaps. */
export function boundarySegments(doors: Dir[], spacing: number): { x: number; y: number; rot: number; edge: Dir }[] {
  const out: { x: number; y: number; rot: number; edge: Dir }[] = [];
  const edges: { edge: Dir; len: number; at: (t: number) => { x: number; y: number }; rot: number }[] = [
    { edge: 'n', len: HALF.x * 2, at: (t) => ({ x: t, y: -HALF.y }), rot: 0 },
    { edge: 's', len: HALF.x * 2, at: (t) => ({ x: t, y: HALF.y }), rot: Math.PI },
    { edge: 'w', len: HALF.y * 2, at: (t) => ({ x: -HALF.x, y: t }), rot: Math.PI / 2 },
    { edge: 'e', len: HALF.y * 2, at: (t) => ({ x: HALF.x, y: t }), rot: -Math.PI / 2 },
  ];
  for (const e of edges) {
    const n = Math.max(1, Math.round(e.len / spacing));
    const step = e.len / n;
    for (let i = 0; i < n; i++) {
      const t = -e.len / 2 + step * (i + 0.5);
      if (doors.includes(e.edge) && Math.abs(t) < DOOR_GAP) continue;
      out.push({ ...e.at(t), rot: e.rot, edge: e.edge });
    }
  }
  return out;
}
