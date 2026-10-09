import type { WorldParty } from '../overworld/worldSim';

/**
 * The base's skill tree (spec 2026-10-09 §5): bought with the shards the horde leaves, and about the base alone — the
 * dome, its gun, what the base does for the clones standing at it, the income, what runs by itself. (A clone's own strength
 * is the dungeon's to give.) It spreads out from the core in five branches; a node opens once the one it grows from has
 * been taken far enough. Five of its nodes are plain numbers that rise without end, each on one node; every other node
 * changes a rule.
 */
export type NodeId =
  | 'domeHp' | 'domeRegen' | 'domeSize' | 'thorns' | 'overcharge' | 'emergency' | 'grace'
  | 'gun' | 'gunRate' | 'gunChain' | 'gunRange' | 'gunCrit' | 'gunElite' | 'gunExec'
  | 'cloneRevive' | 'cloneUlt' | 'medbay' | 'frontLine' | 'earlyCall'
  | 'bounty' | 'reach' | 'clearBonus' | 'flawless' | 'streak' | 'eliteBounty' | 'away'
  | 'autoRestart';
export type Branch = 'dome' | 'gun' | 'support' | 'income' | 'auto';
export interface TreeNode {
  id: NodeId; branch: Branch; name: string;
  /** what it does, in a line */
  desc: string;
  /** the first level's price, and what a price grows by a level (1.15 unless told) */
  cost: number; growth?: number;
  /** the last level (none: no end) */
  max?: number;
  /** the node it grows from (none: the core) and the level that one must stand at */
  needs?: [NodeId, number];
  /** where it sits on the tree's map: which ring out from the core, and how many degrees off its branch's own line */
  at: [number, number];
  /** what the node changes, in a word or two, and that thing's value at a level */
  what: string; val: (lv: number) => string;
}
/** a price grows by this much a level unless the node says otherwise (the plain numbers that rise without end grow dearer faster than they give: the horde must win in the end) */
export const COST_GROWTH = 1.15;
const pct = (x: number): string => `${x >= 0 ? '+' : '−'}${Math.round(Math.abs(x) * 100)}%`;
const SEC = 3.6;

/** what each node is worth at a level (the rules read these; the tree's own lines are written from them) */
export const WORTH = {
  domeHp: (lv: number) => 1.12 ** lv,
  domeRegen: (lv: number) => 1.1 ** lv,
  /** cells added to the dome's reach */
  domeSize: (lv: number) => 0.5 * lv,
  /** the share of its own health a raider loses with each blow it lands on the dome (an elite, half of it) */
  thorns: (lv: number) => 0.03 * lv,
  /** how far past full the dome charges, as a share of its strength */
  overcharge: (lv: number) => 0.1 * lv,
  /** the share of its strength the dome wins back at once when it falls under three tenths (once a wave) */
  emergency: (lv: number) => 0.2 * lv,
  /** how long the dome holds at nothing before it gives (once a wave), in game time */
  grace: (lv: number) => (lv ? 3 * SEC : 0),
  /** a shot of the dome's gun (0: no gun) */
  gun: (lv: number) => (lv ? 6 * 1.15 ** (lv - 1) : 0),
  /** game time between its shots */
  gunRate: (lv: number) => Math.max(0.25 * SEC, 2 * SEC * 0.95 ** lv),
  /** foes a shot leaps on to */
  gunChain: (lv: number) => lv,
  /** cells added to the gun's reach */
  gunRange: (lv: number) => 2 * lv,
  /** the chance of a shot worth three */
  gunCrit: (lv: number) => 0.1 * lv,
  /** 1: the gun picks the horde's elites first */
  gunElite: (lv: number) => lv,
  /** a raider (not the general) at or under this share of its health dies of any shot */
  gunExec: (lv: number) => 0.05 * lv,
  cloneRevive: (lv: number) => 0.94 ** lv,
  cloneUlt: (lv: number) => Math.max(0.5, 1 - 0.04 * lv),
  /** what a clone under the dome mends by is multiplied by this */
  medbay: (lv: number) => 1 + 0.5 * lv,
  /** cells added to how far before the dome a melee clone goes for a foe */
  frontLine: (lv: number) => lv,
  /** 1: the next wave can be called before its count runs down */
  earlyCall: (lv: number) => lv,
  bounty: (lv: number) => 1.07 ** lv,
  /** cells added to how far shards are gathered from */
  reach: (lv: number) => 0.5 * lv,
  /** a cleared wave's prize is multiplied by this */
  clearBonus: (lv: number) => 1 + 0.4 * lv,
  /** …and by this again when the dome took no blow in it */
  flawless: (lv: number) => 1 + 0.5 * lv,
  /** the most the run of cleared waves can add to what raiders leave (2% a wave) */
  streak: (lv: number) => 0.1 * lv,
  /** what an elite or the general leaves is multiplied by this */
  eliteBounty: (lv: number) => 1 + 0.5 * lv,
  /** the share of the base's income that comes in while a clone is below */
  away: (lv: number) => Math.min(1, 0.5 + 0.05 * lv),
  /** how long after a breach the wave is called again by itself, in game time (0: never) */
  autoRestart: (lv: number) => (lv ? [10, 6, 3][Math.min(lv, 3) - 1]! * SEC : 0),
};
const secs = (t: number): string => `${Math.round((t / SEC) * 100) / 100}초`;

export const TREE: TreeNode[] = [
  { id: 'domeHp', branch: 'dome', name: '돔 강도', desc: '돔이 더 많이 버틴다', cost: 10, growth: 1.25, at: [1, 0], what: '강도', val: (lv) => pct(WORTH.domeHp(lv) - 1) },
  { id: 'domeRegen', branch: 'dome', name: '재충전', desc: '돔이 더 빨리 차오른다', cost: 15, growth: 1.25, needs: ['domeHp', 2], at: [2, 0], what: '재충전', val: (lv) => pct(WORTH.domeRegen(lv) - 1) },
  { id: 'domeSize', branch: 'dome', name: '돔 크기', desc: '돔이 넓어진다', cost: 50, growth: 1.8, max: 6, needs: ['domeRegen', 3], at: [3, 0], what: '반지름', val: (lv) => `+${WORTH.domeSize(lv)}칸` },
  { id: 'grace', branch: 'dome', name: '붕괴 유예', desc: '돔이 0이 돼도 잠깐 버틴다 (파도당 한 번)', cost: 400, max: 1, needs: ['domeSize', 2], at: [4, 0], what: '버티는 시간', val: (lv) => secs(WORTH.grace(lv)) },
  { id: 'thorns', branch: 'dome', name: '가시', desc: '돔을 친 적이 제 체력을 잃는다 (정예는 절반)', cost: 40, growth: 1.8, max: 5, needs: ['domeHp', 3], at: [2, -25], what: '칠 때마다 체력', val: (lv) => `−${Math.round(WORTH.thorns(lv) * 100)}%` },
  { id: 'emergency', branch: 'dome', name: '긴급 충전', desc: '돔이 30% 밑으로 떨어지면 즉시 회복 (파도당 한 번)', cost: 80, growth: 2.2, max: 3, needs: ['thorns', 2], at: [3, -17], what: '회복', val: (lv) => `${Math.round(WORTH.emergency(lv) * 100)}%` },
  { id: 'overcharge', branch: 'dome', name: '과충전', desc: '가득 찬 뒤에도 더 충전된다', cost: 60, growth: 1.8, max: 5, needs: ['domeRegen', 3], at: [3, 17], what: '초과분', val: (lv) => pct(WORTH.overcharge(lv)) },

  { id: 'gun', branch: 'gun', name: '포격', desc: '돔이 가까운 적을 쏜다', cost: 30, growth: 1.25, at: [1, 0], what: '피해', val: (lv) => String(Math.round(WORTH.gun(lv))) },
  { id: 'gunRate', branch: 'gun', name: '포격 속도', desc: '더 자주 쏜다', cost: 40, growth: 1.3, needs: ['gun', 1], at: [2, 0], what: '간격', val: (lv) => secs(WORTH.gunRate(lv)) },
  { id: 'gunChain', branch: 'gun', name: '연쇄', desc: '한 발이 근처 적에게 튄다', cost: 200, growth: 2, max: 5, needs: ['gunRate', 3], at: [3, 0], what: '더 튐', val: (lv) => `${lv}마리` },
  { id: 'gunExec', branch: 'gun', name: '처형탄', desc: '체력이 바닥난 적은 맞으면 죽는다 (장군 제외)', cost: 300, growth: 2.2, max: 3, needs: ['gunChain', 2], at: [4, 0], what: '체력', val: (lv) => `${Math.round(WORTH.gunExec(lv) * 100)}% 이하` },
  { id: 'gunRange', branch: 'gun', name: '사거리', desc: '더 멀리서 쏘기 시작한다', cost: 70, growth: 2, max: 3, needs: ['gun', 2], at: [2, -25], what: '사거리', val: (lv) => `+${WORTH.gunRange(lv)}칸` },
  { id: 'gunCrit', branch: 'gun', name: '치명', desc: '가끔 세 배로 꽂힌다', cost: 90, growth: 1.8, max: 5, needs: ['gunRange', 1], at: [3, -17], what: '확률', val: (lv) => `${Math.round(WORTH.gunCrit(lv) * 100)}%` },
  { id: 'gunElite', branch: 'gun', name: '정예 우선', desc: '오우거·궁수·장군부터 쏜다', cost: 150, max: 1, needs: ['gunRate', 2], at: [3, 17], what: '조준', val: (lv) => (lv ? '정예 먼저' : '가까운 적') },

  { id: 'cloneRevive', branch: 'support', name: '재기동', desc: '쓰러진 클론이 더 빨리 일어난다', cost: 25, growth: 1.25, max: 22, at: [1, 0], what: '쓰러진 시간', val: (lv) => pct(WORTH.cloneRevive(lv) - 1) },
  { id: 'cloneUlt', branch: 'support', name: '궁극기 충전', desc: '거점에서 궁극기가 더 빨리 돌아온다', cost: 40, growth: 1.3, max: 13, needs: ['cloneRevive', 3], at: [2, 0], what: '재사용', val: (lv) => pct(WORTH.cloneUlt(lv) - 1) },
  { id: 'earlyCall', branch: 'support', name: '조기 호출', desc: '다음 파도를 미리 부른다. 그 파도의 적은 파편을 20% 더 남긴다', cost: 200, max: 1, needs: ['cloneUlt', 2], at: [3, 0], what: '호출', val: (lv) => (lv ? '가능' : '불가') },
  { id: 'medbay', branch: 'support', name: '의무실', desc: '돔 안에서 클론이 더 빨리 회복한다', cost: 35, growth: 1.7, max: 5, needs: ['cloneRevive', 1], at: [2, 25], what: '회복 속도', val: (lv) => pct(WORTH.medbay(lv) - 1) },
  { id: 'frontLine', branch: 'support', name: '전열 거리', desc: '근접 클론이 더 멀리 나가 맞선다', cost: 60, growth: 2, max: 3, needs: ['cloneRevive', 2], at: [2, -25], what: '나가는 거리', val: (lv) => `+${WORTH.frontLine(lv)}칸` },

  { id: 'bounty', branch: 'income', name: '처치 보상', desc: '적이 파편을 더 남긴다', cost: 15, growth: 1.3, at: [1, 0], what: '파편', val: (lv) => pct(WORTH.bounty(lv) - 1) },
  { id: 'reach', branch: 'income', name: '수거 범위', desc: '더 멀리 있는 파편까지 거둔다', cost: 30, growth: 1.5, max: 10, needs: ['bounty', 3], at: [2, 0], what: '범위', val: (lv) => `+${WORTH.reach(lv)}칸` },
  { id: 'streak', branch: 'income', name: '연속 클리어', desc: '파도를 연달아 깰수록 파편이 늘어난다 (파도당 2%, 돔이 깨지면 처음부터)', cost: 150, growth: 1.8, max: 5, needs: ['reach', 2], at: [3, 0], what: '최대', val: (lv) => pct(WORTH.streak(lv)) },
  { id: 'away', branch: 'income', name: '부재 수입', desc: '클론이 지하에 있는 동안에도 수입이 들어온다', cost: 60, growth: 1.5, max: 10, needs: ['streak', 1], at: [4, 0], what: '원정 중 수입', val: (lv) => `${Math.round(WORTH.away(lv) * 100)}%` },
  { id: 'clearBonus', branch: 'income', name: '클리어 보너스', desc: '파도를 깬 덤이 커진다', cost: 45, growth: 1.8, max: 5, needs: ['bounty', 2], at: [2, -25], what: '덤', val: (lv) => pct(WORTH.clearBonus(lv) - 1) },
  { id: 'eliteBounty', branch: 'income', name: '정예 현상금', desc: '정예와 장군이 파편을 더 남긴다', cost: 90, growth: 1.8, max: 5, needs: ['clearBonus', 2], at: [3, -17], what: '정예 파편', val: (lv) => pct(WORTH.eliteBounty(lv) - 1) },
  { id: 'flawless', branch: 'income', name: '무피해 보너스', desc: '돔이 한 대도 안 맞고 깬 파도는 덤이 더 커진다', cost: 120, growth: 2.2, max: 3, needs: ['reach', 2], at: [3, 17], what: '무피해 덤', val: (lv) => pct(WORTH.flawless(lv) - 1) },

  { id: 'autoRestart', branch: 'auto', name: '자동 재시작', desc: '돔이 깨져도 잠시 뒤 그 파도를 알아서 다시 부른다', cost: 250, growth: 2.5, max: 3, at: [1, 0], what: '기다리는 시간', val: (lv) => secs(WORTH.autoRestart(lv)) },
];
const BY_ID = new Map(TREE.map((n) => [n.id, n]));
export const nodeOf = (id: NodeId): TreeNode => BY_ID.get(id)!;

type Held = { tree?: Partial<Record<NodeId, number>> };
/** the level a node stands at (0: not taken) */
export const treeLevel = (p: Held, id: NodeId): number => p.tree?.[id] ?? 0;
/** what a node is worth to this base right now */
export const worth = (p: Held, id: NodeId): number => WORTH[id](treeLevel(p, id));
/** the price of a node's next level (undefined: it is at its last) */
export function nodeCost(p: WorldParty, id: NodeId): number | undefined {
  const n = nodeOf(id), lv = treeLevel(p, id);
  return n.max !== undefined && lv >= n.max ? undefined : Math.round(n.cost * (n.growth ?? COST_GROWTH) ** lv);
}
/** whether the node it grows from has been taken far enough (a node once taken stays open) */
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
