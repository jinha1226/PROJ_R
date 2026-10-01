export interface Vec { x: number; y: number }
export type TouchButton = 'attack' | 'skill1' | 'skill2' | 'ult' | 'pick' | 'quick0' | 'quick1' | 'quick2' | 'quick3';

/** What touch contributes to the input state (merged by Input as its virtual source). */
export interface VirtualInput {
  move?: Vec;
  attack?: boolean;
  skill1?: boolean;
  skill2?: boolean;
  ult?: boolean;
  pick?: boolean;
  quick?: number | null;
}

/** Floating stick: the vector from where the thumb landed, clamped to the radius, with a dead zone. */
export function stickVector(origin: Vec, at: Vec, radius: number, dead: number): Vec {
  const dx = at.x - origin.x;
  const dy = at.y - origin.y;
  const m = Math.hypot(dx, dy) / radius;
  if (m <= dead) return { x: 0, y: 0 };
  const k = Math.min(1, (m - dead) / (1 - dead)) / m / radius;
  return { x: Math.round(dx * k * 1000) / 1000, y: Math.round(dy * k * 1000) / 1000 };
}

/** Multi-touch state: one finger may steer while others hold buttons (tracked per pointer id). */
export class TouchState {
  private stick: { id: number; origin: Vec; at: Vec } | null = null;
  private readonly held = new Map<number, TouchButton>();

  constructor(private readonly width: number, private readonly radius: number, private readonly dead = 0.15) {}

  /** A touch on the left half starts the stick where the thumb lands. */
  down(id: number, x: number, y: number): boolean {
    if (this.stick || x >= this.width / 2) return false;
    this.stick = { id, origin: { x, y }, at: { x, y } };
    return true;
  }

  move(id: number, x: number, y: number): void {
    if (this.stick?.id === id) this.stick.at = { x, y };
  }

  press(id: number, b: TouchButton): void {
    this.held.set(id, b);
  }

  up(id: number): void {
    if (this.stick?.id === id) this.stick = null;
    this.held.delete(id);
  }

  stickOrigin(): Vec | null {
    return this.stick ? { ...this.stick.origin } : null;
  }

  state(): VirtualInput {
    const on = new Set(this.held.values());
    const q = [...on].find((b) => b.startsWith('quick'));
    return {
      move: this.stick ? stickVector(this.stick.origin, this.stick.at, this.radius, this.dead) : { x: 0, y: 0 },
      attack: on.has('attack'), skill1: on.has('skill1'), skill2: on.has('skill2'), ult: on.has('ult'), pick: on.has('pick'),
      quick: q ? Number(q.slice(5)) : null,
    };
  }
}
