/**
 * How the action plays: `classic` slows on every engraving; `kata` keeps the tempo up and puts weight in short stops —
 * a hit-stop on each kill, a kick on each shot, a slightly heavier tracer — and saves slow motion for the last blow.
 */
export interface Feel {
  /** seconds and speed of the slow on an engraving, and on a chain (null: none) */
  engraveSlow: [number, number] | null;
  chainSlow: [number, number] | null;
  /** beats held after an engraving's name, a hero shot, a kill and a dash, so a burst of moves keeps a rhythm */
  engraveHold: number;
  shotHold: number;
  dieHold: number;
  dashHold: number;
  /** hit-stop on a hit and on a kill */
  hitStop: number;
  killStop: number;
  /** camera jolt on the hero's shots, tracer thickness and muzzle flash power */
  shotKick: number;
  bolt: number;
  flash: number;
}
export const FEELS: Record<'classic' | 'kata', Feel> = {
  classic: { engraveSlow: [0.5, 0.45], chainSlow: [1.4, 0.35], engraveHold: 0.12, shotHold: 0, dieHold: 0, dashHold: 0.1, hitStop: 0.06, killStop: 0.06, shotKick: 0, bolt: 1, flash: 22 },
  kata: { engraveSlow: null, chainSlow: null, engraveHold: 0.03, shotHold: 0.05, dieHold: 0.08, dashHold: 0.12, hitStop: 0.04, killStop: 0.11, shotKick: 0.08, bolt: 1.3, flash: 30 },
};
let current: Feel = FEELS.classic;
export const feel = (): Feel => current;
export const setFeel = (k: keyof typeof FEELS): void => { current = FEELS[k]; };
