import type { TacticId } from './types';

export const TACTICS: readonly TacticId[] = [
  'weakHunt',
  'guardBack',
  'casterHunt',
  'keepDistance',
  'markHunt',
  'vanguard',
  'dangerFirst',
  'rescueDowned',
  'useCover',
  'followLeader',
];

export const STARTER_TACTICS: TacticId[] = ['weakHunt', 'guardBack', 'keepDistance', 'vanguard'];
