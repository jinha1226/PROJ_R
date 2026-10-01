import type { Intent } from '../../sim/battle/types';
import { t } from '../../ui/i18n/ko';
import type { IconKey } from './icons';

const TARGETED = new Set(['attack', 'approach', 'rescue', 'protect']);

/** Short in-world description of what a unit is doing; null when there is nothing worth showing. */
export function intentLabel(intent: Intent | null, nameOf: (id: string) => string): { icon: IconKey; text: string } | null {
  if (!intent || intent.kind === 'idle') return null;
  const target = intent.targetId ? nameOf(intent.targetId) : '';
  const icon: IconKey = intent.reason === 'comboPair' ? 'relation:combo' : `intent:${intent.kind}`;
  if (intent.kind === 'skill' && intent.skillId) return { icon, text: target ? `${t(`skill.${intent.skillId}`)} → ${target}` : t(`skill.${intent.skillId}`) };
  const verb = t(`intent.${intent.kind}`);
  return { icon, text: TARGETED.has(intent.kind) && target ? `${verb} → ${target}` : verb };
}
