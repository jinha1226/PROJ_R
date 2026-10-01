import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { BattleCamera } from '../../src/view/scene/camera';

const make = () => {
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  cam.userData.aspect = 16 / 9;
  return { cam, bc: new BattleCamera(cam) };
};
const height = (cam: THREE.OrthographicCamera) => cam.top - cam.bottom;

describe('battle camera', () => {
  it('zoom clamps to [6, 24] and switches to manual', () => {
    const { cam, bc } = make();
    for (let i = 0; i < 50; i++) bc.zoomBy(1.2);
    expect(height(cam)).toBeCloseTo(24);
    for (let i = 0; i < 50; i++) bc.zoomBy(0.8);
    expect(height(cam)).toBeCloseTo(6);
    expect(bc.mode).toBe('manual');
  });
  it('pan clamps to the arena', () => {
    const { cam, bc } = make();
    bc.panBy(100, 100);
    const target = new THREE.Vector3();
    cam.getWorldDirection(target);
    expect(bc.center.x).toBeLessThanOrEqual(13);
    expect(bc.center.z).toBeLessThanOrEqual(8);
    bc.panBy(-500, -500);
    expect(bc.center.x).toBeGreaterThanOrEqual(-13);
    expect(bc.center.z).toBeGreaterThanOrEqual(-8);
  });
  it('manual mode ignores auto framing until reset', () => {
    const { bc } = make();
    bc.panBy(5, 0);
    const x = bc.center.x;
    bc.frame([{ x: -10, y: 0 }, { x: -8, y: 0 }], 1);
    expect(bc.center.x).toBe(x);
    bc.resetAuto();
    expect(bc.mode).toBe('auto');
    bc.frame([{ x: -10, y: 0 }, { x: -8, y: 0 }], 1);
    expect(bc.center.x).toBeLessThan(x);
  });
  it('screen drag pans opposite to the drag direction', () => {
    const { bc } = make();
    const x = bc.center.x;
    bc.panScreen(100, 0, 1280, 720);
    expect(bc.center.x).toBeLessThan(x);
  });
});
