import { buyNode, canBuyNode, nodeCost, nodeOf, nodeOpen, TREE, treeLevel, type Branch, type NodeId, type TreeNode } from '../../sim/base/tree';
import type { WorldParty } from '../../sim/overworld/worldSim';
import { big } from './bigNum';
import { treeIcon } from './treeIcons';
import '../styles/treeWindow.css';

/** each branch's line out of the core (degrees, clockwise from east) and its name */
const BRANCH: Record<Branch, { angle: number; name: string }> = { dome: { angle: -90, name: '돔' }, gun: { angle: -18, name: '포' }, income: { angle: 54, name: '수입' }, auto: { angle: 126, name: '자동화' }, support: { angle: 198, name: '지원' } };
/** how far out each ring lies (px at full size), and how far out a branch's name is written */
export const RINGS = [0, 96, 168, 240, 312];
const NAME_R = 50;
/** where a node sits on the map, the core at (0, 0) */
export function nodeSpot(n: TreeNode): { x: number; y: number } {
  const a = ((BRANCH[n.branch].angle + n.at[1]) * Math.PI) / 180, r = RINGS[n.at[0]]!;
  return { x: Math.round(Math.cos(a) * r), y: Math.round(Math.sin(a) * r) };
}

type State = 'own' | 'can' | 'open' | 'shut';
const stateOf = (p: WorldParty, id: NodeId): State => (treeLevel(p, id) > 0 ? 'own' : !nodeOpen(p, id) ? 'shut' : canBuyNode(p, id) ? 'can' : 'open');

/** The map: rings round the core, a line from each node to the one it grows from, the nodes themselves (icon, and under it the level held or the price). */
export function treeMapHtml(p: WorldParty, sel: NodeId | null): string {
  const rings = RINGS.slice(1).map((r) => `<circle class="tr-ring" r="${r}"/>`).join('');
  const links = TREE.map((n) => { const a = nodeSpot(n), b = n.needs ? nodeSpot(nodeOf(n.needs[0])) : { x: 0, y: 0 }; return `<line class="tr-link ${stateOf(p, n.id)}" x1="${b.x}" y1="${b.y}" x2="${a.x}" y2="${a.y}"/>`; }).join('');
  const nodes = TREE.map((n) => {
    const at = nodeSpot(n), st = stateOf(p, n.id), lv = treeLevel(p, n.id), cost = nodeCost(p, n.id);
    const tag = st === 'shut' ? '' : lv ? (cost === undefined ? '최대' : `Lv ${lv}`) : `◆ ${big(cost ?? 0)}`;
    // (a node already held that can take another level carries a small mark; the gold ring is for what is new)
    const more = lv > 0 && canBuyNode(p, n.id) ? '<em>▲</em>' : '';
    return `<button type="button" class="tr-node ${st}${sel === n.id ? ' sel' : ''}" data-node="${n.id}" style="left:${at.x}px;top:${at.y}px">${treeIcon(n.id)}${more}<i>${tag}</i></button>`;
  }).join('');
  // each branch's name on its line out of the core
  const names = (Object.keys(BRANCH) as Branch[]).map((b) => { const a = (BRANCH[b].angle * Math.PI) / 180; return `<span class="tr-branch" style="left:${Math.round(Math.cos(a) * NAME_R)}px;top:${Math.round(Math.sin(a) * NAME_R)}px">${BRANCH[b].name}</span>`; }).join('');
  return `<svg class="tr-lines" viewBox="-400 -400 800 800">${rings}${links}</svg><div class="tr-node tr-core">${treeIcon('core')}</div>${names}${nodes}`;
}

/** The chosen node told in full: its name and level, what it does, what it gives now and at the next level, and the key that buys a level (or why it cannot be bought). */
export function treeDetailHtml(p: WorldParty, id: NodeId | null): string {
  if (!id) return '<div class="td-text"><p>노드를 눌러 고른다 · 끌어서 둘러본다</p></div>';
  const n = nodeOf(id), lv = treeLevel(p, id), cost = nodeCost(p, id), open = nodeOpen(p, id), can = canBuyNode(p, id);
  const level = n.max === 1 ? (lv ? '보유' : '') : n.max ? `Lv ${lv} / ${n.max}` : `Lv ${lv}`;
  const gives = cost === undefined || n.max === 1 ? (lv ? `${n.what} <b>${n.val(lv)}</b>` : `${n.what} <b>${n.val(1)}</b>`) : lv ? `${n.what} <b>${n.val(lv)}</b> → <b>${n.val(lv + 1)}</b>` : `${n.what} <b>${n.val(1)}</b>`;
  const key = cost === undefined ? '<button type="button" disabled><b>최대</b></button>'
    : !open ? `<button type="button" disabled><b>잠김</b>${nodeOf(n.needs![0]).name} ${n.needs![1]}단계 필요</button>`
    : `<button type="button" data-buy="${id}" ${can ? '' : 'disabled'}><b>◆ ${big(cost)}</b>${can ? (lv ? '한 단계 사기' : '사기') : '파편 부족'}</button>`;
  return `<div class="td-text"><h3>${n.name}<small>${level}</small></h3><p>${n.desc}</p><p>${gives}</p></div>${key}`;
}

/**
 * The skill tree's page (spec 2026-10-09 §5): a map spreading out from the core in five branches, dragged about and
 * pinched in and out. A tap on a node chooses it — it is told in full under the map — and the key there buys a level of
 * it. The siege goes on behind: the base's own top lines stay in view above the page.
 */
export class TreeWindow {
  readonly el = document.createElement('div');
  private readonly map = document.createElement('div');
  private readonly world = document.createElement('div');
  private readonly detail = document.createElement('div');
  private sel: NodeId | null = null;
  private html = ''; private told = '';
  /** the map's place and size: where the core lies from the map's middle (px), and the scale */
  private view = { x: 0, y: 0, k: 1 };
  private readonly pts = new Map<number, { x: number; y: number }>();
  private moved = 0;
  private pinch = 0;

  constructor(private readonly p: () => WorldParty) {
    this.el.className = 'tree-win'; this.el.hidden = true;
    this.map.className = 'tr-map'; this.world.className = 'tr-world'; this.detail.className = 'tr-detail';
    this.map.innerHTML = '<button type="button" class="tr-close" data-close>✕</button>';
    this.map.prepend(this.world); this.el.append(this.map, this.detail);
    const spread = () => { const [a, b] = [...this.pts.values()]; return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0; };
    this.map.addEventListener('pointerdown', (e) => { if (!this.pts.size) this.moved = 0; this.pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); this.pinch = spread(); });
    addEventListener('pointermove', (e) => {
      const at = this.pts.get(e.pointerId);
      if (!at || this.el.hidden) return;
      const dx = e.clientX - at.x, dy = e.clientY - at.y;
      at.x = e.clientX; at.y = e.clientY;
      if (this.pts.size >= 2) { const d = spread(); if (this.pinch > 0 && d > 0) this.zoom(d / this.pinch); this.pinch = d; this.moved = 99; }
      else { this.moved += Math.abs(dx) + Math.abs(dy); if (this.moved > 8) this.pan(dx, dy); }
    });
    const up = (e: PointerEvent) => { this.pts.delete(e.pointerId); this.pinch = spread(); };
    addEventListener('pointerup', up); addEventListener('pointercancel', up);
    this.map.addEventListener('wheel', (e) => { e.preventDefault(); this.zoom(e.deltaY > 0 ? 0.9 : 1.1); }, { passive: false });
    this.el.addEventListener('click', (e) => {
      const t = e.target as HTMLElement, node = t.closest<HTMLElement>('[data-node]'), buy = t.closest<HTMLElement>('[data-buy]');
      if (t.closest('[data-close]')) { this.close(); return; }
      if (buy) { if (buyNode(this.p(), buy.dataset.buy as NodeId)) { this.update(); this.world.querySelector(`[data-node="${buy.dataset.buy}"]`)?.classList.add('bought'); } return; }
      // (a drag that ends on a node chooses nothing)
      if (node && this.moved <= 8) { this.sel = node.dataset.node as NodeId; this.update(); }
    });
  }

  private pan(dx: number, dy: number): void { const lim = 340 * this.view.k; this.view.x = Math.max(-lim, Math.min(lim, this.view.x + dx)); this.view.y = Math.max(-lim, Math.min(lim, this.view.y + dy)); this.place(); }
  private zoom(by: number): void { const k = Math.max(0.5, Math.min(1.5, this.view.k * by)), r = k / this.view.k; this.view = { x: this.view.x * r, y: this.view.y * r, k }; this.place(); }
  private place(): void { this.world.style.transform = `translate(${this.view.x.toFixed(1)}px, ${this.view.y.toFixed(1)}px) scale(${this.view.k.toFixed(3)})`; }

  get open(): boolean { return !this.el.hidden; }
  toggle(): void { this.el.hidden = !this.el.hidden; if (!this.el.hidden) { this.pts.clear(); this.place(); } this.update(); }
  close(): void { this.el.hidden = true; this.pts.clear(); }
  update(): void {
    if (this.el.hidden) return;
    const p = this.p(), html = treeMapHtml(p, this.sel), told = treeDetailHtml(p, this.sel);
    if (html !== this.html) { this.html = html; this.world.innerHTML = html; }
    if (told !== this.told) { this.told = told; this.detail.innerHTML = told; }
  }
}
