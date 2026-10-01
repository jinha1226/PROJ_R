import type { ItemSlot } from '../../data/types';
import { canEquip } from '../../sim/roster/equipment';
import type { Mercenary, Roster } from '../../sim/roster/types';
import { t } from '../i18n/ko';
import { itemLabel } from './text';

const SLOTS: ItemSlot[] = ['weapon', 'armor', 'trinket'];

const itemHtml = (id: string) => {
  const l = itemLabel(id);
  return `<span class="item tier-${l.tier}"><b>${l.name}</b> <small>${t(`tier.${l.tier}`)}</small></span><small class="muted">${l.detail}</small>`;
};

/** Equipment tab: worn slots (unequip) and the shared inventory (equip if allowed). Buttons carry data-act. */
export function renderEquip(m: Mercenary, r: Roster): string {
  const slots = SLOTS.map((slot) => {
    const id = m.gear[slot];
    return `<li><span class="kind">${t(`slot.${slot}`)}</span>${id ? itemHtml(id) : '<span class="muted">없음</span>'}
      ${id ? `<button class="btn small" data-act="unequip" data-slot="${slot}">해제</button>` : ''}</li>`;
  }).join('');
  const inv = r.inventory.map((id, i) => {
    const ok = canEquip(m, id);
    return `<li class="${ok ? '' : 'disabled'}">${itemHtml(id)}<button class="btn small" data-act="equip" data-item="${id}" data-index="${i}" ${ok ? '' : 'disabled'}>${ok ? '장착' : '불가'}</button></li>`;
  }).join('');
  return `<ul class="equip-slots">${slots}</ul><h4>보관함</h4>${inv ? `<ul class="inventory" data-testid="inventory">${inv}</ul>` : '<p class="muted">보관 중인 장비가 없다.</p>'}`;
}
