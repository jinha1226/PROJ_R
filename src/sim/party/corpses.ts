import { dist, type Cell } from '../grid/types';
import { entOf, posOf, type Party, type Unit } from './partyCore';

/** A fallen foe's body that nothing has used yet (bursts, skeletons and golems use bodies up). */
export const isCorpse = (p: Party, u: Unit): boolean => u.side === 'foe' && !!entOf(p, u.id) && !entOf(p, u.id)!.alive && !u.raised;
/** The unused bodies within `r` cells of a cell, nearest first. */
export const corpsesNear = (p: Party, at: Cell, r: number): Unit[] =>
  p.units.filter((u) => isCorpse(p, u) && dist(posOf(p, u), at) <= r).sort((a, b) => dist(posOf(p, a), at) - dist(posOf(p, b), at));
/** A body is used up. */
export const consume = (u: Unit): void => { u.raised = true; };
