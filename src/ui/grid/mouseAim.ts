import { idx, same, type Cell, type GridState } from '../../sim/grid/types';
import { attackChoice, type AttackChoice } from './attackChoice';

export function mouseHoverTarget(s: GridState, cell: Cell | null | undefined): string | undefined {
  return cell ? s.foes.find(f => f.alive && same(f.pos, cell) && s.visible.has(idx(s.map, cell)))?.id : undefined;
}

type MouseClickChoice = Exclude<AttackChoice, { kind: 'swap' }> | { kind: 'target'; foe: string } | { kind: 'walk' };

/** Mouse attacks share the button rule, but never automatically swap hands. */
export function mouseClickChoice(s: GridState, cell: Cell | null | undefined): MouseClickChoice {
  if (!cell) return null;
  const foe = mouseHoverTarget(s, cell);
  if (!foe) return { kind: 'walk' };
  const choice = attackChoice(s, foe);
  return choice && choice.kind !== 'swap' ? choice : { kind: 'target', foe };
}

/** Hover and secondary click only; primary clicks go through the screen's tap threshold. */
export function attachMouseAim(stage: HTMLElement, state: () => GridState,
  cellAt: (x: number, y: number) => Cell | null | undefined,
  enabled: () => boolean, cancel: () => void): () => void {
  const previousCursor = stage.style.cursor;
  const move = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    const s = state();
    const foe = enabled() ? mouseHoverTarget(s, cellAt(e.clientX, e.clientY)) : undefined;
    stage.style.cursor = foe ? 'crosshair' : 'default';
    if (foe && s.hero.target !== foe) s.hero.target = foe;
  };
  const leave = (e: PointerEvent) => { if (e.pointerType === 'mouse') stage.style.cursor = 'default'; };
  // some browsers send the context menu as a plain mouse event (no pointerType): treat that as the mouse too
  const context = (e: MouseEvent) => {
    const type = (e as PointerEvent).pointerType;
    if (type && type !== 'mouse') return;
    e.preventDefault();
    cancel();
  };
  stage.addEventListener('pointermove', move);
  stage.addEventListener('pointerleave', leave);
  stage.addEventListener('contextmenu', context);
  return () => {
    stage.removeEventListener('pointermove', move);
    stage.removeEventListener('pointerleave', leave);
    stage.removeEventListener('contextmenu', context);
    stage.style.cursor = previousCursor;
  };
}
