import {
  Angry, ArrowDownToLine, BicepsFlexed, Crown, Droplet, Droplets, Ellipsis, Flag, Flame, Footprints, Frown,
  HandHeart, HeartCrack, Laugh, Link, Medal, Megaphone, Rabbit, Shield, ShieldHalf, ShieldPlus, Skull, Snail,
  Sparkles, Star, Sword, Target, Undo2, Wind, Handshake, Bandage, Swords, ScrollText, Tent, Store, type IconNode,
} from 'lucide';
import type { EmotionId, RelationTriggerKind, TagId } from '../../data/types';
import type { IntentKind } from '../../sim/battle/types';
import type { MomentKind } from '../../sim/roster/relationships';
import type { RoomType } from '../../sim/explore/types';
import { t } from '../../ui/i18n/ko';

export type IconKey = 'status:injured' | `room:${RoomType}` | TagId | `intent:${IntentKind}` | `emotion:${EmotionId}` | `relation:${RelationTriggerKind}` | `moment:${MomentKind}`;

interface IconDef {
  icon: IconNode;
  color: string;
  label: string;
}

const def = (icon: IconNode, color: string, label: string): IconDef => ({ icon, color, label });

export const ICONS: Record<IconKey, IconDef> = {
  'status:injured': def(Bandage, '#d8c8b0', '부상'),
  'room:start': def(Flag, '#c0c0c0', '입구'),
  'room:battle': def(Swords, '#c8a070', '적'),
  'room:elite': def(Skull, '#e06040', '정예'),
  'room:chest': def(Store, '#e0c04a', '보물'),
  'room:event': def(ScrollText, '#b08ae0', '사건'),
  'room:campfire': def(Tent, '#4ab0d0', '모닥불'),
  'room:exit': def(Crown, '#7ad08a', '출구'),
  marked: def(Target, '#e8962e', t('tag.marked')),
  knockdown: def(ArrowDownToLine, '#9c8a74', t('tag.knockdown')),
  wet: def(Droplets, '#3d8fe6', t('tag.wet')),
  stun: def(Star, '#e6c22e', t('tag.stun')),
  burn: def(Flame, '#ee5a24', t('tag.burn')),
  bleed: def(Droplet, '#c0283a', t('tag.bleed')),
  slow: def(Snail, '#8a6ad8', t('tag.slow')),
  shield: def(Shield, '#5ab4e8', t('tag.shield')),
  taunted: def(Megaphone, '#e04040', t('tag.taunted')),
  'intent:attack': def(Sword, '#d8d0c0', t('intent.attack')),
  'intent:skill': def(Sparkles, '#f0c040', t('intent.skill')),
  'intent:approach': def(Footprints, '#c8c0b0', t('intent.approach')),
  'intent:kite': def(Undo2, '#8ad0a0', t('intent.kite')),
  'intent:dodge': def(Wind, '#a0d8f0', t('intent.dodge')),
  'intent:rescue': def(HandHeart, '#8cd8ff', t('intent.rescue')),
  'intent:guard': def(ShieldHalf, '#80b0e0', t('intent.guard')),
  'intent:retreat': def(Flag, '#c0c0c0', t('intent.retreat')),
  'intent:idle': def(Ellipsis, '#909090', t('intent.idle')),
  'intent:protect': def(ShieldPlus, '#6ac8ff', t('intent.protect')),
  'intent:flee': def(Rabbit, '#d0b080', t('intent.flee')),
  'emotion:rage': def(Angry, '#e8402e', t('emotion.rage')),
  'emotion:fear': def(Frown, '#9a8ad0', t('emotion.fear')),
  'emotion:elation': def(Laugh, '#f0c040', t('emotion.elation')),
  'emotion:revenge': def(Skull, '#c02020', t('emotion.revenge')),
  'emotion:resolve': def(BicepsFlexed, '#e0a040', t('emotion.resolve')),
  'emotion:courage': def(Medal, '#f0d060', t('emotion.courage')),
  'relation:protect': def(ShieldPlus, '#6ac8ff', t('trigger.protect')),
  'relation:rivalry': def(Flame, '#ff8a2a', t('trigger.rivalry')),
  'relation:revenge': def(Skull, '#e02a2a', t('trigger.revenge')),
  'relation:courage': def(Medal, '#f0d060', t('trigger.courage')),
  'relation:combo': def(Link, '#fff0b0', t('trigger.combo')),
  'relation:feud': def(HeartCrack, '#b070e0', t('trigger.feud')),
  'relation:mentor': def(Crown, '#f0c040', t('trigger.mentor')),
  'moment:rescue': def(HandHeart, '#8cd8ff', t('intent.rescue')),
  'moment:protect': def(ShieldPlus, '#6ac8ff', t('trigger.protect')),
  'moment:rivalry': def(Flame, '#ff8a2a', t('trigger.rivalry')),
  'moment:revenge': def(Skull, '#e02a2a', t('trigger.revenge')),
  'moment:courage': def(Medal, '#f0d060', t('trigger.courage')),
  'moment:combo': def(Link, '#e8d070', t('trigger.combo')),
  'moment:newFriend': def(Handshake, '#7ad08a', t('relation.friend')),
  'moment:newComrade': def(Link, '#f0c040', t('relation.comrade')),
  'moment:newRival': def(Flame, '#ff8a2a', t('relation.rival')),
  'moment:newFeud': def(HeartCrack, '#b070e0', t('relation.feud')),
  'moment:death': def(Skull, '#8a8a8a', '전사'),
};

const esc = (v: unknown): string => String(v).replace(/[&"<>]/g, (c) => `&#${c.charCodeAt(0)};`);

/** Inline SVG markup for an icon (stroke uses currentColor). */
export function iconSvg(key: IconKey, size = 14): string {
  const body = ICONS[key].icon
    .map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).map(([k, v]) => `${k}="${esc(v)}"`).join(' ')}/>`)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}

/** Round colored badge with a white icon; `title` gives the Korean name. */
export function iconBadge(key: IconKey, size = 16, extraClass = ''): string {
  const d = ICONS[key];
  return `<span class="icon-badge ${extraClass}" style="background:${d.color};width:${size}px;height:${size}px" title="${esc(d.label)}">${iconSvg(key, Math.round(size * 0.72))}</span>`;
}
