import { KITS, PROMOTIONS, tagsOf, promotionOptions, type PromotionRule } from '../../sim/party/classKit';
import { CLASSES, BASE_CLASSES, type BaseClass } from '../../sim/party/partyDefs';
import { levelOf, PROMOTE_LEVEL } from '../../sim/party/partyLevel';
import { ULT_NAMES } from '../../sim/party/ultimate';
import type { Party, Unit } from '../../sim/party/partyCore';
import { classIcon, CLASS_TINT } from './classIcons';
import { FAMILY_NAME } from './pipGear';
import { ULT_TEXT } from './ultText';

const ult = (cls: keyof typeof KITS): string => { const k = KITS[cls].ultimate; return k ? `<span class="pc-ult"><b>${ULT_NAMES[k]}</b> ${ULT_TEXT[k]}</span>` : ''; };

/** A promotion's conditions: each tag count (traits and worn gear together) against what it needs, the weapon to wear. */
function needs(r: PromotionRule, have: Partial<Record<string, number>>): string {
  const tags = Object.entries(r.need).map(([t, n]) => { const h = have[t] ?? 0; return `<span class="${h >= (n ?? 0) ? 'ok' : ''}">#${t} ${h}/${n}</span>`; });
  if (r.wear) tags.push(`<span>${r.wear === 'shield' ? '방패' : FAMILY_NAME[r.wear]} 착용</span>`);
  return tags.join(' ');
}

/** The status tab's promotion part: the two advanced classes of the clone's line with their progress, a button once met, and the veteran fallback. */
export function promotionHtml(p: Party, u: Unit): string {
  if (!BASE_CLASSES.includes(u.cls as BaseClass)) return '';
  const mine = u.cls as BaseClass, have = tagsOf(u), opts = promotionOptions(p, u), lv = levelOf(u);
  const row = (to: Parameters<typeof classIcon>[0], need: string, met: boolean | undefined, extra = '') =>
    `<div class="pc-row${met ? ' met' : ''}" style="--tint:${CLASS_TINT[mine] ?? '#5dff8a'}">${classIcon(to)}<b>${CLASSES[to].name}</b><span class="pc-need">${need}</span>${met ? `<button type="button" data-promote-to="${to}">전직</button>` : ''}${extra}</div>`;
  return `<h4>전직 <small>레벨 ${lv}/${PROMOTE_LEVEL}</small></h4>`
    + PROMOTIONS[mine].map((r) => row(r.to, needs(r, have), opts.find((o) => o.to === r.to)?.met, ult(r.to))).join('')
    + row('veteran', '레벨 10 · 다른 전직 조건 없음', opts.find((o) => o.to === 'veteran')?.met);
}
