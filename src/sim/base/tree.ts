import type { WorldParty } from '../overworld/worldSim';

/**
 * The base's skill tree (spec 2026-10-09 §5): three branches out of the core — the dome, the clones, the income — bought
 * with the shards the horde leaves. A node has levels (most without end): each costs 1.15 times the last. A node opens
 * once the one before it in its branch has been taken far enough.
 */
export type NodeId = 'domeHp' | 'gun' | 'domeRegen' | 'gunRate' | 'domeSize' | 'gunChain' | 'cloneDmg' | 'cloneGuard' | 'cloneRevive' | 'cloneUlt' | 'bounty' | 'reach' | 'away';
export type Branch = 'dome' | 'clone' | 'income';
export interface TreeNode {
  id: NodeId; branch: Branch; name: string;
  /** the first level's price */
  cost: number;
  /** the last level (none: no end) */
  max?: number;
  /** opens when that node stands at that level */
  needs?: [NodeId, number];
  /** what the node changes, in a word or two, and that thing's value at a level */
  what: string; val: (lv: number) => string;
}
/** a price grows by this much a level */
export const COST_GROWTH = 1.15;
const pct = (x: number): string => `${x >= 0 ? '+' : '−'}${Math.round(Math.abs(x) * 100)}%`;
const SEC = 3.6;

/** what each node is worth at a level (the rules read these; the tree's own lines are written from them) */
export const WORTH = {
  domeHp: (lv: number) => 1.12 ** lv,
  domeRegen: (lv: number) => 1.1 ** lv,
  /** cells added to the dome's reach */
  domeSize: (lv: number) => 0.5 * lv,
  /** a shot of the dome's gun (0: no gun) */
  gun: (lv: number) => (lv ? 6 * 1.15 ** (lv - 1) : 0),
  /** game time between its shots */
  gunRate: (lv: number) => 2 * SEC * 0.95 ** lv,
  /** foes a shot leaps on to */
  gunChain: (lv: number) => lv,
  cloneDmg: (lv: number) => 1.06 ** lv,
  /** the share of a blow a clone at the base still takes */
  cloneGuard: (lv: number) => Math.max(0.4, 1 - 0.04 * lv),
  cloneRevive: (lv: number) => 0.94 ** lv,
  cloneUlt: (lv: number) => Math.max(0.5, 1 - 0.04 * lv),
  bounty: (lv: number) => 1.08 ** lv,
  /** cells added to how far shards are gathered from */
  reach: (lv: number) => 0.5 * lv,
  /** the share of the base's income that comes in while a clone is below */
  away: (lv: number) => Math.min(1, 0.5 + 0.05 * lv),
};

export const TREE: TreeNode[] = [
  { id: 'domeHp', branch: 'dome', name: '돔 강도', cost: 10, what: '강도', val: (lv) => pct(WORTH.domeHp(lv) - 1) },
  { id: 'gun', branch: 'dome', name: '포격', cost: 30, needs: ['domeHp', 2], what: '가까운 적 포격 · 피해', val: (lv) => String(Math.round(WORTH.gun(lv))) },
  { id: 'domeRegen', branch: 'dome', name: '재충전', cost: 15, needs: ['gun', 1], what: '재충전', val: (lv) => pct(WORTH.domeRegen(lv) - 1) },
  { id: 'gunRate', branch: 'dome', name: '포격 속도', cost: 40, needs: ['domeRegen', 3], what: '간격', val: (lv) => `${(WORTH.gunRate(lv) / SEC).toFixed(2)}초` },
  { id: 'domeSize', branch: 'dome', name: '돔 크기', cost: 50, max: 6, needs: ['gunRate', 3], what: '반지름', val: (lv) => `+${WORTH.domeSize(lv)}칸` },
  { id: 'gunChain', branch: 'dome', name: '포격 연쇄', cost: 200, max: 5, needs: ['domeSize', 2], what: '더 튐', val: (lv) => `${lv}마리` },
  { id: 'cloneDmg', branch: 'clone', name: '화력', cost: 20, what: '피해', val: (lv) => pct(WORTH.cloneDmg(lv) - 1) },
  { id: 'cloneGuard', branch: 'clone', name: '내구', cost: 20, max: 15, needs: ['cloneDmg', 3], what: '받는 피해', val: (lv) => pct(WORTH.cloneGuard(lv) - 1) },
  { id: 'cloneRevive', branch: 'clone', name: '재기동', cost: 25, max: 22, needs: ['cloneGuard', 3], what: '쓰러진 시간', val: (lv) => pct(WORTH.cloneRevive(lv) - 1) },
  { id: 'cloneUlt', branch: 'clone', name: '궁극기 충전', cost: 40, max: 13, needs: ['cloneRevive', 3], what: '재사용', val: (lv) => pct(WORTH.cloneUlt(lv) - 1) },
  { id: 'bounty', branch: 'income', name: '처치 보상', cost: 15, what: '파편', val: (lv) => pct(WORTH.bounty(lv) - 1) },
  { id: 'reach', branch: 'income', name: '수거 범위', cost: 30, max: 10, needs: ['bounty', 3], what: '범위', val: (lv) => `+${WORTH.reach(lv)}칸` },
  { id: 'away', branch: 'income', name: '부재 수입', cost: 60, max: 10, needs: ['reach', 2], what: '원정 중 수입', val: (lv) => `${Math.round(WORTH.away(lv) * 100)}%` },
];
const BY_ID = new Map(TREE.map((n) => [n.id, n]));
export const nodeOf = (id: NodeId): TreeNode => BY_ID.get(id)!;

/** the level a node stands at (0: not taken) */
export const treeLevel = (p: { tree?: Partial<Record<NodeId, number>> }, id: NodeId): number => p.tree?.[id] ?? 0;
/** what a node is worth to this base right now */
export const worth = <K extends NodeId>(p: { tree?: Partial<Record<NodeId, number>> }, id: K): number => WORTH[id](treeLevel(p, id));
/** the price of a node's next level (undefined: it is at its last) */
export function nodeCost(p: WorldParty, id: NodeId): number | undefined {
  const n = nodeOf(id), lv = treeLevel(p, id);
  return n.max !== undefined && lv >= n.max ? undefined : Math.round(n.cost * COST_GROWTH ** lv);
}
/** whether the node before it has been taken far enough */
export const nodeOpen = (p: WorldParty, id: NodeId): boolean => { const need = nodeOf(id).needs; return !need || treeLevel(p, id) > 0 || treeLevel(p, need[0]) >= need[1]; };
export function canBuyNode(p: WorldParty, id: NodeId): boolean {
  const cost = nodeCost(p, id);
  return cost !== undefined && nodeOpen(p, id) && p.shards >= cost;
}
/** One more level of a node, paid in shards. False if it is shut, at its last level, or too dear. */
export function buyNode(p: WorldParty, id: NodeId): boolean {
  if (!canBuyNode(p, id)) return false;
  p.shards -= nodeCost(p, id)!;
  p.tree = { ...p.tree, [id]: treeLevel(p, id) + 1 };
  return true;
}
/** whether anything at all can be bought now (the screen lights its key) */
export const anyNodeAffordable = (p: WorldParty): boolean => TREE.some((n) => canBuyNode(p, n.id));
