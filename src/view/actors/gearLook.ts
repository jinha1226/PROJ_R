import type { GearVisual, ModelId } from '../../data/types';
import { MODELS } from './modelManifest';

export interface TierLook {
  color: string;
  /** lerp amount toward color */
  amount: number;
  metalness: number;
  emissive: number;
}

/** worn · common · elite · master · legendary */
export const TIER_LOOK: Record<number, TierLook> = {
  0: { color: '#8a7a66', amount: 0.5, metalness: 0, emissive: 0 },
  1: { color: '#ffffff', amount: 0, metalness: 0.15, emissive: 0 },
  2: { color: '#7ab0ff', amount: 0.25, metalness: 0.3, emissive: 0 },
  3: { color: '#c08aff', amount: 0.3, metalness: 0.45, emissive: 0.05 },
  4: { color: '#ffd060', amount: 0.4, metalness: 0.6, emissive: 0.15 },
};

export interface GearLookInput {
  model: ModelId;
  gear: GearVisual;
  gearTiers?: { weapon?: number; armor?: number };
  rank?: 'rookie' | 'skilled' | 'veteran' | 'hero';
}

const isProp = (n?: string) => !!n && n.startsWith('prop:');

/** Per-mesh tier tints for equipment (body meshes untouched), prop tint, and the hero aura flag. */
export function gearLook(input: GearLookInput): { tints: Record<string, TierLook>; propTint?: TierLook; aura: boolean } {
  const m = MODELS[input.model];
  const tints: Record<string, TierLook> = {};
  const wt = input.gearTiers?.weapon;
  const at = input.gearTiers?.armor;
  const weapon = m.weapons[input.gear.weapon];
  const offhand = input.gear.offhand ? m.offhands[input.gear.offhand] : undefined;
  if (wt !== undefined) for (const n of [weapon, offhand]) if (n && !isProp(n)) tints[n] = TIER_LOOK[wt]!;
  if (at !== undefined) for (const n of [...(input.gear.helmet ? m.helmet : []), ...(input.gear.cape ? m.cape : [])]) tints[n] = TIER_LOOK[at]!;
  return { tints, propTint: wt !== undefined ? TIER_LOOK[wt] : undefined, aura: input.rank === 'hero' };
}
