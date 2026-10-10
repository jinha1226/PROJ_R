/**
 * What a clone knows how to do in a fight by itself, each thing switched by itself (2026-10-10, the incremental idea: the
 * tree buys know-how, and a clone that begins a fool ends up playing well). Outside the test page (`?demo=brain`) the
 * switches are not read: the clones know what they always knew.
 */
export const KNACKS = ['target', 'kite', 'ult', 'item', 'snipe', 'choke'] as const;
export type Knack = (typeof KNACKS)[number];
export const KNACK_NAME: Record<Knack, string> = { target: '표적 고르기', kite: '물러나며 쏘기', ult: '궁극기', item: '물약·폭탄', snipe: '먼저 쏘기', choke: '길목에서 받기' };
export const KNACK_DESC: Record<Knack, string> = {
  target: '가장 가까운 놈 대신, 칠 값어치가 큰 놈을 고른다', kite: '붙은 적에게서 한 칸 물러나 쏜다', ult: '쓸 만한 때 궁극기를 쓴다',
  item: '체력이 낮으면 물약을 먹고, 뭉친 적에게 폭탄을 던진다', snipe: '아직 눈치채지 못한 적을 사거리 끝에서 먼저 쏜다', choke: '싸움이 나면 좁은 길목으로 물러나 한 놈씩 받는다',
};
/** what the game's clones always knew (the rest is new with the test page) */
const OLD: Knack[] = ['target', 'kite', 'ult', 'item'];
export const BRAIN: { on: boolean; knows: Record<Knack, boolean> } = { on: false, knows: { target: false, kite: false, ult: false, item: false, snipe: false, choke: false } };
export const knows = (k: Knack): boolean => (BRAIN.on ? BRAIN.knows[k] : OLD.includes(k));
