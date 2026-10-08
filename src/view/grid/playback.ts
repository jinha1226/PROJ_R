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
const CHAIN_GAP = 0.04;
/** ...but one clone's chain never holds its show longer than this */
const CHAIN_MAX = 0.6;
/** party fights: what falls from the sky (a meteor, a blizzard's first ice) lands before its hits show */
const FALL = 0.09;
const FALLS = new Set(['운석 낙하', 'blizzard']);
/** party fights: a fall holds that clone's next effect this long (a chain of kills must not drag) */
const FALL_HOLD = 0.05;
/** party fights: how long a figure takes to walk one cell (a swing or shot waits for the step before it to land, so nobody slides while attacking) */
const STEP_SEC = 0.24;
/** party fights: when the show falls this far behind, it plays faster until it catches up */
const BEHIND = 0.9;
const korean = (s?: string) => !!s && /[가-힣]/.test(s);
/**
 * A party fight is told in beats. A beat opens with an attack, a named effect or a reaction, and everything it does shows
 * with it, at once: the harm it deals to every foe it reaches, the states it leaves, who falls. (A whirlwind's numbers
 * come up with the blade, not one foe after another once it has passed.)
 */
/** one arrow of a volley: loosed with the rest off a single draw, no beat of its own */
const loose = (ev: GEvent): boolean => ev.type === 'shoot' && ev.text === 'volley';
const opens = (ev: GEvent): boolean => ev.type === 'bump' || (ev.type === 'shoot' && !loose(ev)) || ev.type === 'react' || (ev.type === 'buff' && korean(ev.text));
/** what holds a beat's own harm back, not only the beats after: a swing still on its way, a rock still falling */
const lands = (ev: GEvent): boolean => ev.type === 'bump' || (ev.type === 'shoot' && !loose(ev)) || (ev.type === 'buff' && FALLS.has(ev.text ?? ''));
/** In a party fight, how long this event holds the same clone's show (see `opens`, `lands`). */
function partyHold(ev: GEvent): number {
  if (loose(ev)) return 0;
  if (ev.type === 'bump' || ev.type === 'shoot') return SWING_HOLD;
  if (ev.type === 'buff' && FALLS.has(ev.text ?? '')) return FALL;
  if ((ev.type === 'buff' && korean(ev.text)) || ev.type === 'react') return CHAIN_GAP;
  if (ev.type === 'die') return FALL_HOLD;
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
  /** per clone: the moment (sim time) whose chain is being spaced out, how much it has held so far, and whether a fall already held this beat */
  private chains = new Map<string, { at: number; held: number; fell: boolean }>();

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
        // only this clone's later cues wait (the others go on acting at the same time), and of those only from its next
        // beat on: what this beat does shows with it — unless the blow or the rock has yet to land
        const hold = this.partyHold(ev), who = ev.src ?? '';
        if (hold) {
          let later = lands(ev);
          for (const c of this.cues) {
            if ((c.ev.src ?? '') !== who || c.ev.type === 'move') continue;
            later ||= opens(c.ev);
            if (later) c.at += hold;
          }
          this.cues.sort((a, b) => a.at - b.at);
        }
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
    const h = partyHold(ev), who = ev.src ?? '', c = this.chains.get(who);
    const chain = c && c.at === ev.t ? c : { at: ev.t, held: 0, fell: false };
    this.chains.set(who, chain);
    if (opens(ev)) chain.fell = false;
    if (h !== CHAIN_GAP && h !== FALL_HOLD) return h;
    // however many fall in one beat, the next beat waits for them once
    if (h === FALL_HOLD) { if (chain.fell) return 0; chain.fell = true; }
    const step = Math.min(h, Math.max(0, CHAIN_MAX - chain.held));
    chain.held += step;
    return step;
  }

  get busy(): boolean {
    return this.cues.length > 0;
  }
}
