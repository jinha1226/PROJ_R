import { feel } from './feel';
import type { GEvent } from '../../sim/grid/types';

/** One game turn (time 1.0) plays in this many seconds. */
export const TURN_SEC = 0.18;
/** Different actors acting at the same moment are offset by this much (nobody waits for anybody). */
export const STAGGER = 0.03;
/** A new input plays what is left of the previous turn this many times faster. */
export const CATCHUP = 3;

interface Cue { at: number; ev: GEvent }

/** party fights: a swing or a shot holds that clone's next cues until its (quickened) blow lands */
const SWING_HOLD = 0.15;
/** party fights: each effect of a clone's chain shows this long after the one before... */
const CHAIN_GAP = 0.06;
/** ...but one clone's chain never holds its show longer than this */
const CHAIN_MAX = 0.9;
/** party fights: one blast's hits and the states it leaves pop one after another (a blast ripples out, a chain crackles along) */
const RIPPLE = 0.035;
/** party fights: a meteor's hits wait for the rock to land */
const METEOR_FALL = 0.13;
const STATE_POP = new Set(['burn', 'chill', 'freeze', 'shock', 'poison', 'bleed', 'mark', 'exposed', 'stun']);
/** party fights: how long a figure takes to walk one cell (a swing or shot waits for the step before it to land, so nobody slides while attacking) */
const STEP_SEC = 0.24;
/** party fights: when the show falls this far behind, it plays faster until it catches up */
const BEHIND = 0.9;
const korean = (s?: string) => !!s && /[가-힣]/.test(s);
/** In a party fight, how long the rest of the show waits after this event (an attack's wind-up, a chain's beat, a fall). */
function partyHold(ev: GEvent): number {
  if (ev.type === 'bump' || ev.type === 'shoot') return SWING_HOLD;
  if (ev.type === 'buff' && ev.text === '운석 낙하') return METEOR_FALL;
  if ((ev.type === 'buff' && korean(ev.text)) || ev.type === 'react') return CHAIN_GAP;
  if (ev.type === 'die') return 0.12;
  if (ev.type === 'hit' || (ev.type === 'buff' && STATE_POP.has(ev.text ?? ''))) return RIPPLE;
  return 0;
}

/**
 * Moments the rest of a show waits for, so a combo reads in order: the dash step lands before its blow, a leap
 * lands before its strikes, a weave or parry shows before the counter, a shove before the shot that follows.
 */
function holdAfter(ev: GEvent): number {
  if (ev.type === 'move') return ev.text === 'leap' ? 0.26 : ev.text === 'dash' ? feel().dashHold : 0;
  if (ev.type === 'shoot' && ev.src === 'hero') return feel().shotHold;
  if (ev.type === 'die') return feel().dieHold;
  if (ev.type === 'dodge' || ev.type === 'parry') return 0.14;
  // an engraving's name shows a beat before the move it set off (a relay shot does not blur into the blow)
  if (ev.type === 'engrave') return feel().engraveHold;
  return ev.type === 'push' ? 0.12 : 0;
}

/** Turns a batch of time-stamped sim events into a short, overlapping show. */
export class Playback {
  private cues: Cue[] = [];
  private now = 0;
  private rate = 1;
  /** per clone: the moment (sim time) whose chain is being spaced out, and how much it has held so far */
  private chains = new Map<string, { at: number; held: number }>();

  /** party: the party screens' pacing (attacks play out, chains in sequence); otherwise the grid game's quick overlapping show */
  constructor(private readonly party = false) {}

  push(events: GEvent[], startTime: number): void {
    const base = Math.max(this.now, this.cues.length ? this.cues[this.cues.length - 1]!.at : 0);
    const order = new Map<number, string[]>();
    for (const ev of events) {
      const list = order.get(ev.t) ?? [];
      const src = ev.src ?? '';
      if (!list.includes(src)) list.push(src);
      order.set(ev.t, list);
      const at = this.party
        // a party fight: at its own moment, only after what is still to show of the same clone
        // (a step is not kept waiting behind a chain still flashing: the figure walks while its effects play)
        ? (ev.type === 'move' ? this.now + Math.max(0, ev.t - startTime) * TURN_SEC
          : Math.max(this.now + Math.max(0, ev.t - startTime) * TURN_SEC, this.tail(src), ev.type === 'bump' || ev.type === 'shoot' ? this.landed(src) : 0))
        : base + Math.max(0, ev.t - startTime) * TURN_SEC + list.indexOf(src) * STAGGER;
      this.cues.push({ at, ev });
    }
    this.cues.sort((a, b) => a.at - b.at);
  }

  /** when this clone's last step (shown or still to show) has landed */
  private landed(src: string): number {
    let t = (this.walked.get(src) ?? -Infinity) + STEP_SEC;
    for (const c of this.cues) if (c.ev.type === 'move' && (c.ev.src ?? '') === src && c.at + STEP_SEC > t) t = c.at + STEP_SEC;
    return t;
  }
  /** when each clone's last step was shown */
  private walked = new Map<string, number>();

  /** when the last cue still waiting for this clone shows (now if none) */
  private tail(src: string): number {
    let t = this.now;
    for (const c of this.cues) if ((c.ev.src ?? '') === src && c.at > t) t = c.at;
    return t;
  }

  hurry(): void {
    if (this.cues.length) this.rate = CATCHUP;
  }

  /** Events whose moment has come. */
  update(dt: number): GEvent[] {
    this.now += dt * this.rate;
    const out: GEvent[] = [];
    while (this.cues.length && this.cues[0]!.at <= this.now + 1e-9) {
      const ev = this.cues.shift()!.ev;
      out.push(ev);
      if (this.party) {
        if (ev.type === 'move') this.walked.set(ev.src ?? '', this.now);
        // only this clone's later cues wait: the others go on acting at the same time
        const hold = this.partyHold(ev), who = ev.src ?? '';
        if (hold) { for (const c of this.cues) if ((c.ev.src ?? '') === who && c.ev.type !== 'move') c.at += hold; this.cues.sort((a, b) => a.at - b.at); }
        continue;
      }
      const hold = holdAfter(ev);
      if (hold) { for (const c of this.cues) c.at += hold; break; }
    }
    if (this.party && this.cues.length && this.cues[this.cues.length - 1]!.at - this.now > BEHIND) this.rate = CATCHUP;
    if (!this.cues.length) this.rate = 1;
    return out;
  }

  private partyHold(ev: GEvent): number {
    const h = partyHold(ev);
    if (h !== CHAIN_GAP && h !== RIPPLE) return h;
    const who = ev.src ?? '', c = this.chains.get(who);
    const chain = c && c.at === ev.t ? c : { at: ev.t, held: 0 };
    const step = Math.min(h, Math.max(0, CHAIN_MAX - chain.held));
    chain.held += step; this.chains.set(who, chain);
    return step;
  }

  get busy(): boolean {
    return this.cues.length > 0;
  }
}
