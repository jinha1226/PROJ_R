import { dist, type Cell } from '../grid/types';
import { entOf, posOf, type Party, type Unit } from './partyCore';

/**
 * A fallen foe's body. It can burst once and be raised once, and the one does not use up the other: a skeleton or a golem
 * rises from the remains of a burst body too (2026-10-08: bursts took every body, so nothing was left to raise).
 */
export const isCorpse = (p: Party, u: Unit): boolean => u.side === 'foe' && !!entOf(p, u.id) && !entOf(p, u.id)!.alive && !u.raised;
/** A body that has not burst yet (and has not been raised: what stood up is no longer lying there). */
export const canBurst = (p: Party, u: Unit): boolean => isCorpse(p, u) && !u.burst;
/** The bodies within `r` cells of a cell that can still be raised, nearest first. */
export const corpsesNear = (p: Party, at: Cell, r: number): Unit[] =>
  p.units.filter((u) => isCorpse(p, u) && dist(posOf(p, u), at) <= r).sort((a, b) => dist(posOf(p, a), at) - dist(posOf(p, b), at));
/** A body is raised (a skeleton, a golem): nothing more comes of it. */
export const consume = (u: Unit): void => { u.raised = true; };
/** A body has burst; it can still be raised. */
export const burst = (u: Unit): void => { u.burst = true; };
/** the share of a body's full health its burst deals to the foes beside it */
export const BURST = 0.5;
