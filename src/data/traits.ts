import type { TraitDef, TraitId } from './types';

const tr = (id: TraitId, likes: TraitId[] = [], dislikes: TraitId[] = [], affinityMult = 1): TraitDef =>
  ({ id, likes, dislikes, affinityMult });

export const TRAITS: Record<TraitId, TraitDef> = {
  reckless: tr('reckless', [], ['cautious']),
  cautious: tr('cautious', [], ['reckless']),
  protective: tr('protective', ['coward', 'altruist']),
  coward: tr('coward', ['protective', 'altruist']),
  competitive: tr('competitive'),
  vengeful: tr('vengeful'),
  hotheaded: tr('hotheaded', [], ['hotheaded']),
  calm: tr('calm', ['hotheaded']),
  glory: tr('glory', [], ['glory']),
  loner: tr('loner', [], [], 0.5),
  chatty: tr('chatty', [], [], 1.5),
  altruist: tr('altruist', ['coward', 'protective']),
};
