import { idx, same, type Cell, type GridState } from '../../sim/grid/types';

/** Capture foe touches even over the stick pad. Never issues a simulation action. */
export function attachFoePress(root: HTMLElement, state: () => GridState, cellAt: (x: number, y: number) => Cell | null | undefined, select: (id: string) => void): () => void {
  let press: { pointer: number; x: number; y: number; foe: string; selected: boolean } | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const touches = new Set<number>();
  const cancel = () => { clearTimeout(timer); press = null; };
  const choose = () => {
    if (!press) return;
    const s = state();
    if (s.foes.some((f) => f.id === press!.foe && f.alive && s.visible.has(idx(s.map, f.pos)))) select(press.foe);
    press.selected = true;
  };
  const down = (e: PointerEvent) => {
    if (e.pointerType !== 'touch') return;
    if (!root.contains(e.target as Node) && !touches.size) return;
    touches.add(e.pointerId);
    if (touches.size > 1) { cancel(); return; }
    if (!(e.target instanceof Element) || !e.target.closest('.grid-stage, .gt-pad')) return;
    const s = state(), cell = cellAt(e.clientX, e.clientY);
    const foe = cell && s.foes.find((f) => f.alive && same(f.pos, cell) && s.visible.has(idx(s.map, cell)));
    if (!foe) return;
    press = { pointer: e.pointerId, x: e.clientX, y: e.clientY, foe: foe.id, selected: false };
    e.stopPropagation();
    e.preventDefault();
    timer = setTimeout(choose, 400);
  };
  const move = (e: PointerEvent) => {
    if (press?.pointer === e.pointerId && Math.hypot(e.clientX - press.x, e.clientY - press.y) >= 12) cancel();
  };
  const up = (e: PointerEvent) => {
    touches.delete(e.pointerId);
    if (press?.pointer !== e.pointerId) return;
    e.stopPropagation();
    if (e.type === 'pointerup' && !press.selected) choose();
    cancel();
  };
  const blur = () => { cancel(); touches.clear(); };
  window.addEventListener('pointerdown', down, true);
  window.addEventListener('pointermove', move, true);
  window.addEventListener('pointerup', up, true);
  window.addEventListener('pointercancel', up, true);
  window.addEventListener('blur', blur);
  return () => {
    blur();
    window.removeEventListener('pointerdown', down, true);
    window.removeEventListener('pointermove', move, true);
    window.removeEventListener('pointerup', up, true);
    window.removeEventListener('pointercancel', up, true);
    window.removeEventListener('blur', blur);
  };
}
