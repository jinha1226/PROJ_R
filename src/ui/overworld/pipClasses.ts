import { KITS, PROMOTIONS, tagsOf, promotionOptions, type PromotionRule } from '../../sim/party/classKit';
import { CLASSES, BASE_CLASSES, type BaseClass } from '../../sim/party/partyDefs';
import { levelOf, PROMOTE_LEVEL } from '../../sim/party/partyLevel';
import { ULT_NAMES } from '../../sim/party/ultimate';
import type { Party, Unit } from '../../sim/party/partyCore';
import { classIcon, CLASS_TINT } from './classIcons';
import { FAMILY_NAME } from './pipGear';
import { ULT_TEXT } from './ultText';

const ult = (cls: keyof typeof KITS): string => { const k = KITS[cls].ultimate; return k ? `<span class="pc-ult"><b>${ULT_NAMES[k]}</b> ${ULT_TEXT[k]} · 대기 ${KITS[cls].ultCd}턴</span>` : ''; };

/** A promotion's conditions: each tag count against what the clone has, the weapon it must wear. */
function needs(r: PromotionRule, have: Partial<Record<string, number>>): string {
  const tags = Object.entries(r.need).map(([t, n]) => { const h = have[t] ?? 0; return `<span class="${h >= (n ?? 0) ? 'ok' : ''}">#${t} ${h}/${n}</span>`; });
  if (r.wear) tags.push(`<span>${r.wear === 'shield' ? '방패' : FAMILY_NAME[r.wear]} 착용</span>`);
  return tags.join(' ');
}

/** The class tab: the chosen clone's two promotions with their progress (and a button once met), then every advanced class by line. */
export function classesHtml(p: Party, u: Unit | undefined): string {
  const mine = u?.cls && BASE_CLASSES.includes(u.cls as BaseClass) ? (u.cls as BaseClass) : undefined;
  const have = u ? tagsOf(u) : {};
  const opts = u ? promotionOptions(p, u) : [];
  const head = u && mine ? `<h4>${CLASSES[mine].name} 전직 <small>레벨 ${levelOf(u)}/${PROMOTE_LEVEL}</small></h4>` + PROMOTIONS[mine].map((r) => {
    const met = opts.find((o) => o.to === r.to)?.met;
    return `<div class="pc-row${met ? ' met' : ''}" style="--tint:${CLASS_TINT[mine] ?? '#5dff8a'}">${classIcon(r.to)}<b>${CLASSES[r.to].name}</b><span class="pc-need">${needs(r, have)}</span>${met ? `<button type="button" data-promote-to="${r.to}">전직</button>` : ''}${ult(r.to)}</div>`;
  }).join('') + `<div class="pc-row${opts.find((o) => o.to === 'veteran')?.met ? ' met' : ''}">${classIcon('veteran')}<b>베테랑</b><span class="pc-need">레벨 10 · 다른 전직 조건 없음</span>${opts.find((o) => o.to === 'veteran')?.met ? '<button type="button" data-promote-to="veteran">전직</button>' : ''}</div>` : '';
  const all = BASE_CLASSES.map((b) => `<div class="pc-line" style="--tint:${CLASS_TINT[b] ?? '#5dff8a'}"><h5>${classIcon(b)}${CLASSES[b].name}</h5>${ult(b)}${PROMOTIONS[b].map((r) => `<div class="pc-row small">${classIcon(r.to)}<b>${CLASSES[r.to].name}</b><span class="pc-need">${needs(r, b === mine ? have : {})}</span>${ult(r.to)}</div>`).join('')}</div>`).join('');
  return `<section class="pc">${head}<h4>상위 직업</h4>${all}</section>`;
}
