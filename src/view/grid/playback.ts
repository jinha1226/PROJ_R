import type { GEvent } from '../../sim/grid/types';

/** One game turn (time 1.0) plays in this many seconds. */
export const TURN_SEC = 0.18;
/** Different actors acting at the same moment are offset by this much (nobody waits for anybody). */
export const STAGGER = 0.03;
/** A new input plays what is left of the previous turn this many times faster. */
export const CATCHUP = 3;

interface Cue { at: number; ev: GEvent }

/** Turns a batch of time-stamped sim events into a short, overlapping show. */
export class Playback {
  private cues: Cue[] = [];
  private now = 0;
  private rate = 1;

  push(events: GEvent[], startTime: number): void {
    const base = Math.max(this.now, this.cues.length ? this.cues[this.cues.length - 1]!.at : 0);
    const order = new Map<number, string[]>();
    for (const ev of events) {
      const list = order.get(ev.t) ?? [];
      const src = ev.src ?? '';
      if (!list.includes(src)) list.push(src);
      order.set(ev.t, list);
      const at = base + Math.max(0, ev.t - startTime) * TURN_SEC + list.indexOf(src) * STAGGER;
      this.cues.push({ at, ev });
    }
    this.cues.sort((a, b) => a.at - b.at);
  }

  hurry(): void {
    if (this.cues.length) this.rate = CATCHUP;
  }

  /** Events whose moment has come. */
  update(dt: number): GEvent[] {
    this.now += dt * this.rate;
    const out: GEvent[] = [];
    while (this.cues.length && this.cues[0]!.at <= this.now + 1e-9) out.push(this.cues.shift()!.ev);
    if (!this.cues.length) this.rate = 1;
    return out;
  }

  get busy(): boolean {
    return this.cues.length > 0;
  }
}
