import type { GEvent } from '../grid/types';

/*
 * An effect is told as one beat: what it does itself comes first and together (its blows on every foe it reaches, the
 * states it leaves, who falls to it), then whatever those set off, each a beat of its own. The sim runs depth first: a
 * whirlwind's first cut may set off a chain before its second cut is dealt. Told in that order, the blade's numbers
 * would come up one foe at a time, long after it has passed. Only the order of the events changes here, never what happens.
 */
interface Beat { mine: Set<GEvent>; nested: Set<GEvent> }
const stack: Beat[] = [];
/** an event that names an effect (a card, an innate, a reaction): the screen and the log open a new beat on it */
const names = (e: GEvent): boolean => e.type === 'react' || (e.type === 'buff' && /[가-힣]/.test(e.text ?? ''));

/** Marks a naming event as part of the effect now running (a reaction it leaves in passing): told after its blows, before what they set off. */
export function own<E extends GEvent>(e: E): E { stack[stack.length - 1]?.mine.add(e); return e; }
/** Marks an event as belonging to an effect set off inside the one now running (the engine adds a name line after the fact). */
export function nest(e: GEvent): void { stack[stack.length - 1]?.nested.add(e); }

/**
 * Runs one effect as a beat. `head` is the event that opens it (pushed first; left out when the caller names the effect
 * itself). A naming event pushed in passing that is neither the effect's own nor a nested effect's (a second fireball's
 * line, a meteor's fall) stays where it is, and what comes after it is sorted apart from what came before.
 */
export function asBeat(ev: GEvent[], run: () => void, head?: GEvent): void {
  if (head) ev.push(head);
  const b: Beat = { mine: new Set(), nested: new Set() }, start = ev.length;
  stack.push(b);
  try { run(); } finally {
    stack.pop();
    const tail = ev.splice(start), out: GEvent[] = [];
    let mine: GEvent[] = [], late: GEvent[] = [], nested: GEvent[] = [];
    const flush = () => { out.push(...mine, ...late, ...nested); mine = []; late = []; nested = []; };
    for (const e of tail) {
      if (b.nested.has(e)) nested.push(e);
      else if (!names(e)) mine.push(e);
      else if (b.mine.has(e)) late.push(e);
      else { flush(); out.push(e); }
    }
    flush();
    ev.push(...out);
    const up = stack[stack.length - 1];
    if (up) { if (head) up.nested.add(head); for (const e of out) up.nested.add(e); }
  }
}
