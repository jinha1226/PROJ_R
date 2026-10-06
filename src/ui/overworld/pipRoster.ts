import { itemName } from '../../sim/delve/items';
import { promotionOptions } from '../../sim/party/classKit';
import { entOf, type Party } from '../../sim/party/partyCore';
import { CLASSES } from '../../sim/party/partyDefs';
import { levelOf } from '../../sim/party/partyLevel';
import { clones, type RoamParty } from '../../sim/roam/roam';
import { CLASS_TINT, classIcon } from './classIcons';

/** The roster: every living clone on one line — class and level, health, the three slots, a promotion that is ready. Click a row to open its record. */
export function rosterHtml(p: RoamParty): string {
  const rows = clones(p).filter((u) => entOf(p, u.id)?.alive).map((u) => {
    const e = entOf(p, u.id)!, g = u.gear;
    const slot = (it: Parameters<typeof itemName>[0] | null | undefined) => (it ? itemName(it) : '—');
    const ready = promotionOptions(p as Party, u).some((o) => o.met);
    return `<button type="button" class="pr-row" data-who="${u.id}" data-tab="stat" style="--tint:${CLASS_TINT[u.cls!] ?? '#5dff8a'}">
      <span class="pr-cls">${classIcon(u.cls!)}<b>${CLASSES[u.cls!].name}</b>${u.cls === 'shell' ? '' : `<small>레벨 ${levelOf(u)}</small>`}</span>
      <span class="pr-hp"><i style="width:${Math.round((e.hp / e.maxHp) * 100)}%"></i><em>${e.hp}/${e.maxHp}</em></span>
      <span class="pr-gear">${g ? `${slot(g.weapon)} · ${slot(g.armor)} · ${slot(g.accessory)}` : '맨몸'}</span>
      ${ready ? '<span class="pr-promo">전직 가능</span>' : ''}${u.picks ? `<span class="pr-promo">특성 ${u.picks}</span>` : ''}</button>`;
  }).join('');
  return `<section class="pr"><h4>클론 <small>${clones(p).filter((u) => entOf(p, u.id)?.alive).length}명</small></h4>${rows || '<p class="pg-none">없음</p>'}</section>`;
}
