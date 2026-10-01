import type { BattleCamera } from './camera';

const DRAG_THRESHOLD = 5;
const KEY_PAN = 1;
const KEY_ZOOM = 1.1;

/**
 * Wheel zoom, drag pan (any button), WASD/arrow pan, Q/E zoom, C back to auto.
 * A press that moves ≤5px is treated as a click. Returns a detach function.
 */
export function attachCameraInput(el: HTMLElement, cam: BattleCamera, onClick: (x: number, y: number) => void): () => void {
  let down: { x: number; y: number; lastX: number; lastY: number; dragging: boolean; button: number } | null = null;

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    cam.zoomBy(e.deltaY > 0 ? KEY_ZOOM : 1 / KEY_ZOOM);
  };
  const onDown = (e: PointerEvent) => {
    down = { x: e.clientX, y: e.clientY, lastX: e.clientX, lastY: e.clientY, dragging: false, button: e.button };
    el.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: PointerEvent) => {
    if (!down) return;
    if (!down.dragging && Math.hypot(e.clientX - down.x, e.clientY - down.y) > DRAG_THRESHOLD) down.dragging = true;
    if (down.dragging) cam.panScreen(e.clientX - down.lastX, e.clientY - down.lastY, el.clientWidth, el.clientHeight);
    down.lastX = e.clientX;
    down.lastY = e.clientY;
  };
  const onUp = (e: PointerEvent) => {
    if (down && !down.dragging && down.button === 0) onClick(e.clientX, e.clientY);
    down = null;
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement) return;
    const k = e.key.toLowerCase();
    if (k === 'w' || k === 'arrowup') cam.panBy(0, -KEY_PAN);
    else if (k === 's' || k === 'arrowdown') cam.panBy(0, KEY_PAN);
    else if (k === 'a' || k === 'arrowleft') cam.panBy(-KEY_PAN, 0);
    else if (k === 'd' || k === 'arrowright') cam.panBy(KEY_PAN, 0);
    else if (k === 'q') cam.zoomBy(1 / KEY_ZOOM);
    else if (k === 'e') cam.zoomBy(KEY_ZOOM);
    else if (k === 'c') cam.resetAuto();
    else if (k === 'z') cam.rotateStep(-1);
    else if (k === 'x') cam.rotateStep(1);
  };
  const noMenu = (e: Event) => e.preventDefault();

  el.addEventListener('wheel', onWheel, { passive: false });
  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('contextmenu', noMenu);
  window.addEventListener('keydown', onKey);
  return () => {
    el.removeEventListener('wheel', onWheel);
    el.removeEventListener('pointerdown', onDown);
    el.removeEventListener('pointermove', onMove);
    el.removeEventListener('pointerup', onUp);
    el.removeEventListener('contextmenu', noMenu);
    window.removeEventListener('keydown', onKey);
  };
}
