import { entOf, type Party, type Unit } from '../../sim/party/partyCore';
import { levelOf } from '../../sim/party/partyLevel';
import { CLASSES } from '../../sim/party/partyDefs';
import { EL_NAME, ELEMENTS, learn, MAX_SKILL, pointsLeft, raise, SCHOOL_NAME, SCHOOLS, skillLine, skillName, skillsOf, SLOT_NAME, type Element, type School, type Slot } from '../../sim/party/skills';
import '../styles/skillSheet.css';

/** what is chosen on the sheet: the place looked at, and (for an empty place) the school and element being weighed */
export interface SheetPick { slot: Slot; school: School; el: Element }
export const sheetPick = (): SheetPick => ({ slot: 'hand', school: 'emit', el: 'none' });

/** how a place reads to the player: the part of the body, and when it answers */
const PLACE_SAYS: Record<Slot, string> = { hand: '칠 때', heart: '처치할 때', body: '맞을 때', eye: '피할 때', foot: '걸을 때', head: '대기할 때' };
const LEFT: Slot[] = ['head', 'hand', 'foot'], RIGHT: Slot[] = ['eye', 'heart', 'body'];

/**
 * `?skill`: the clone's skills as a figure with six places round it (a paper doll). A place is tapped; an empty one takes
 * a school and an element, shown as the line of what the skill will do, and is learnt for a point; a held one is stepped up.
 */
export function skillSheetHtml(p: Party, u: Unit | undefined, pick: SheetPick): string {
  const e = u && entOf(p, u.id);
  if (!u || !e) return '';
  const held = skillsOf(u), pts = pointsLeft(u);
  const tile = (slot: Slot) => {
    const s = held[slot];
    return `<button type="button" class="ss-slot${pick.slot === slot ? ' on' : ''}${s ? '' : ' empty'}" data-ss-slot="${slot}">
      <small>${SLOT_NAME[slot]} · ${PLACE_SAYS[slot]}</small><b>${s ? `${SCHOOL_NAME[s.school]}${s.el === 'none' ? '' : ` · ${EL_NAME[s.el]}`}` : '빈 자리'}</b>
      <i>${[1, 2, 3, 4].map((n) => `<u class="${s && s.lv >= n ? 'f' : ''}"></u>`).join('')}</i></button>`;
  };
  const s = held[pick.slot];
  const chips = <T extends string>(k: string, all: readonly T[], names: Record<T, string>, now: T) =>
    `<div class="ss-chips">${all.map((v) => `<button type="button" data-ss-${k}="${v}" class="${v === now ? 'on' : ''}">${names[v]}</button>`).join('')}</div>`;
  const detail = s
    ? `<h4>${skillName(pick.slot, s)} <small>${s.lv} / ${MAX_SKILL}단계</small></h4><p>${skillLine(pick.slot, s, u, p)}</p>
       ${s.lv < MAX_SKILL ? `<p class="ss-next">다음 단계: ${skillLine(pick.slot, { ...s, lv: s.lv + 1 }, u, p)}</p>` : ''}
       <button type="button" class="ss-do" data-ss-do="raise" ${pts > 0 && s.lv < MAX_SKILL ? '' : 'disabled'}>${s.lv >= MAX_SKILL ? '끝까지 올렸다' : pts > 0 ? '단계 올리기 (포인트 1)' : '포인트가 없다'}</button>`
    : `<h4>${SLOT_NAME[pick.slot]} <small>${PLACE_SAYS[pick.slot]} 나간다</small></h4>
       ${chips('school', SCHOOLS, SCHOOL_NAME, pick.school)}${chips('el', ELEMENTS, EL_NAME, pick.el)}
       <p>${skillLine(pick.slot, { school: pick.school, el: pick.el, lv: 1 }, u, p)}</p>
       <button type="button" class="ss-do" data-ss-do="learn" ${pts > 0 ? '' : 'disabled'}>${pts > 0 ? '배우기 (포인트 1)' : '포인트가 없다'}</button>`;
  return `<section class="ss">
    <header><b>${CLASSES[u.cls!].name} · 레벨 ${levelOf(u)}</b><span class="${pts ? 'due' : ''}">포인트 ${pts}</span></header>
    <div class="ss-doll"><div class="ss-col">${LEFT.map(tile).join('')}</div>
      <div class="ss-fig"><div class="ss-head"></div><div class="ss-trunk"></div><small>체력 ${e.hp} / ${e.maxHp}</small></div>
      <div class="ss-col">${RIGHT.map(tile).join('')}</div></div>
    <div class="ss-detail">${detail}</div></section>`;
}

/** A tap on the sheet: a place chosen, a school or element weighed, a skill learnt or stepped up. True when it was the sheet's. */
export function skillSheetClick(t: HTMLElement, p: Party, who: string, pick: SheetPick): boolean {
  const at = (k: string) => t.closest<HTMLElement>(`[data-ss-${k}]`)?.dataset[`ss${k[0]!.toUpperCase()}${k.slice(1)}`];
  const slot = at('slot') as Slot | undefined, school = at('school') as School | undefined, el = at('el') as Element | undefined, act = at('do');
  if (slot) pick.slot = slot;
  if (school) pick.school = school;
  if (el) pick.el = el;
  if (act === 'learn') learn(p, who, pick.slot, pick.school, pick.el);
  if (act === 'raise') raise(p, who, pick.slot);
  return !!(slot || school || el || act);
}
