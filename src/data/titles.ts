import type { TitleDef, TitleId } from './types';

export const TITLES: Record<TitleId, TitleDef> = {
  guardian: { id: 'guardian', check: (r) => r.rescues >= 3 },
  undying: { id: 'undying', check: (r) => r.downedSurvived >= 3 },
  giantSlayer: { id: 'giantSlayer', check: (r) => r.bossKills >= 1 },
  hundredCuts: { id: 'hundredCuts', check: (r) => r.kills >= 50 },
  shadow: { id: 'shadow', check: (r) => r.dodges >= 30 },
  healingHand: { id: 'healingHand', check: (r) => r.healing >= 3000 },
};

/** Priority order when several titles qualify at once. */
export const TITLE_ORDER: TitleId[] = ['giantSlayer', 'guardian', 'undying', 'hundredCuts', 'shadow', 'healingHand'];
