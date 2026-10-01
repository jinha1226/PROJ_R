import {
  Axe, Backpack, Bone, Coins, Crosshair, Crown, FlaskConical, Footprints, Gem, Hand, HardHat, KeyRound, Package, Ribbon, Scroll,
  Shirt, Sword, Wand, WandSparkles, CloudFog, Leaf, type IconNode,
} from 'lucide';
import { xitem, type GearSlot, type XItemDef } from '../../data/extract';
import type { Stack } from '../../sim/extract/inventory';

export const SLOT_NAME: Record<GearSlot, string> = { weapon: '무기', head: '머리', chest: '가슴', hands: '장갑', feet: '신발', belt: '벨트', trinket: '장신구', bag: '가방' };
export const KIND_NAME: Record<XItemDef['kind'], string> = { gear: '장비', consumable: '소모품', part: '부산물', junk: '잡동사니', relic: '유물', key: '열쇠' };
export const TIER_NAME = ['일반', '고급', '희귀', '영웅', '전설'];
export const STAT_NAME: Record<string, string> = { maxHp: '체력', atk: '공격', def: '방어', atkSpeed: '공격 속도', moveSpeed: '이동 속도', dodge: '회피', crit: '치명', range: '사거리' };

const WEAPON_ICON: Record<string, IconNode> = { sword_shield: Sword, axe2h: Axe, daggers: Sword, crossbow: Crosshair, staff: WandSparkles, wand: Wand };
const SLOT_ICON: Record<GearSlot, IconNode> = { weapon: Sword, head: HardHat, chest: Shirt, hands: Hand, feet: Footprints, belt: Ribbon, trinket: Gem, bag: Backpack };

function iconFor(d: XItemDef): IconNode {
  if (d.slot === 'weapon') return WEAPON_ICON[d.weaponType ?? ''] ?? Sword;
  if (d.slot) return SLOT_ICON[d.slot];
  if (d.kind === 'consumable') return d.use?.kind === 'recall' ? Scroll : d.use?.kind === 'smoke' ? CloudFog : d.use?.kind === 'antidote' ? Leaf : FlaskConical;
  if (d.kind === 'part') return Bone;
  if (d.kind === 'relic') return Crown;
  if (d.kind === 'key') return KeyRound;
  return d.id === 'x_coins' || d.id === 'x_gem_shard' ? Coins : Package;
}

const esc = (v: unknown): string => String(v).replace(/[&"<>]/g, (c) => `&#${c.charCodeAt(0)};`);
const svg = (node: IconNode, size: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${node.map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).map(([k, v]) => `${k}="${esc(v)}"`).join(' ')}/>`).join('')}</svg>`;

/** An item slot: kind icon, rarity border colour, stack count. Empty slots show the slot's own icon faintly. */
export function itemCell(s: Stack | null | undefined, opts: { testid?: string; data?: string; empty?: GearSlot; selected?: boolean; small?: boolean } = {}): string {
  const attrs = `${opts.testid ? ` data-testid="${opts.testid}"` : ''}${opts.data ? ` ${opts.data}` : ''}`;
  const size = opts.small ? 22 : 28;
  if (!s) return `<button class="icell empty${opts.small ? ' small' : ''}"${attrs}>${opts.empty ? svg(SLOT_ICON[opts.empty], size) : ''}</button>`;
  const d = xitem(s.id);
  return `<button class="icell r${d.tier}${opts.selected ? ' sel' : ''}${opts.small ? ' small' : ''}" title="${esc(d.name)}"${attrs}>${svg(iconFor(d), size)}${s.n > 1 ? `<b class="icell-n">${s.n}</b>` : ''}</button>`;
}

/** Detail lines for the item panel. */
export function itemDetail(id: string): string {
  const d = xitem(id);
  const stats = Object.entries(d.stats ?? {}).filter(([, v]) => v).map(([k, v]) => `${STAT_NAME[k] ?? k} +${k === 'crit' || k === 'dodge' || k === 'atkSpeed' ? Math.round(v * 100) + (k === 'atkSpeed' ? '%' : '%p') : v}`);
  if (d.bag) stats.push(`가방 ${d.bag.slots}칸 · 무게 한도 ${d.bag.carry}`);
  if (d.belt) stats.push(`퀵슬롯 ${d.belt.quickSlots}칸`);
  const use = d.use ? { heal: `체력 ${Math.round((d.use as { frac?: number }).frac! * 100)}% 회복`, antidote: '독 면역 60초', smoke: '주변 적의 추적을 끊고 4초간 숨는다', recall: '10초 시전 후 그 자리에서 탈출' }[d.use.kind] : '';
  return `<div class="idetail r${d.tier}"><b>${esc(d.name)}</b><small>${TIER_NAME[d.tier]} ${d.slot ? SLOT_NAME[d.slot] : KIND_NAME[d.kind]}</small>
    ${stats.length ? `<p>${stats.join(' · ')}</p>` : ''}${use ? `<p>${use}</p>` : ''}<p class="muted">가치 ${d.value}G · 무게 ${d.weight}</p></div>`;
}
