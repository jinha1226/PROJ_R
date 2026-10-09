import { buyNode, canBuyNode, nodeCost, nodeOf, nodeOpen, TREE, treeLevel, type Branch, type TreeNode } from '../../sim/base/tree';
import type { WorldParty } from '../../sim/overworld/worldSim';
import { big } from './bigNum';
import '../styles/treeWindow.css';

const BRANCHES: [Branch, string][] = [['dome', '돔'], ['clone', '클론'], ['income', '수입']];

/** One node's tile: its name and level, what it gives (now → at the next level), and its price — or what must be taken first. */
export function nodeHtml(p: WorldParty, n: TreeNode): string {
  const lv = treeLevel(p, n.id), cost = nodeCost(p, n.id), open = nodeOpen(p, n.id), can = canBuyNode(p, n.id);
  if (!open) { const [id, need] = n.needs!; return `<button type="button" class="tr-node shut" disabled><b>${n.name}</b><small>${nodeOf(id).name} ${need}단계 필요</small></button>`; }
  // what it gives: at its first level; then now → next; at its last, what it stands at
  const gives = cost === undefined ? `${n.what} ${n.val(lv)}` : lv ? `${n.what} ${n.val(lv)} → ${n.val(lv + 1)}` : `${n.what} ${n.val(1)}`;
  return `<button type="button" class="tr-node${can ? ' can' : ''}${cost === undefined ? ' top' : ''}" data-node="${n.id}" ${can ? '' : 'disabled'}><b>${n.name}<i>${lv ? `Lv ${lv}` : ''}</i></b><small>${gives}</small><em>${cost === undefined ? '최대' : `◆ ${big(cost)}`}</em></button>`;
}

/** The three branches side by side, each a chain from the core outward. */
export function treeHtml(p: WorldParty): string {
  const cols = BRANCHES.map(([b, name]) => `<div class="tr-col"><h4>${name}</h4>${TREE.filter((n) => n.branch === b).map((n) => nodeHtml(p, n)).join('')}</div>`).join('');
  return `<header><span class="tr-title">강화</span><span class="tr-have">◆ <b>${big(p.shards)}</b></span><button type="button" data-close>✕</button></header><div class="tr-cols">${cols}</div>`;
}

/**
 * The skill tree's sheet (spec 2026-10-09 §5): it rises over the lower part of the screen and the fight goes on above it —
 * an upgrade is bought in the middle of a wave. A tap on a node buys one level of it.
 */
export class TreeWindow {
  readonly el = document.createElement('div');
  private html = '';
  constructor(private readonly p: () => WorldParty) {
    this.el.className = 'tree-win'; this.el.hidden = true;
    this.el.addEventListener('click', (e) => {
      const t = e.target as HTMLElement, node = t.closest<HTMLElement>('[data-node]');
      if (t.closest('[data-close]')) { this.close(); return; }
      if (node && buyNode(this.p(), node.dataset.node as TreeNode['id'])) { this.update(); this.el.querySelector(`[data-node="${node.dataset.node}"]`)?.classList.add('bought'); }
    });
  }
  get open(): boolean { return !this.el.hidden; }
  toggle(): void { this.el.hidden = !this.el.hidden; this.update(); }
  close(): void { this.el.hidden = true; }
  update(): void {
    if (this.el.hidden) return;
    const html = treeHtml(this.p());
    if (html !== this.html) { this.html = html; this.el.innerHTML = html; }
  }
}
