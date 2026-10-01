import { GEAR_SLOTS, type GearSlot } from '../../data/extract';
import { canDeploy, MAX_MERCS, type XCompany } from '../../sim/extract/company';
import { heroSetup } from '../../sim/extract/heroSetup';
import { t } from '../i18n/ko';
import { itemCell, SLOT_NAME } from './itemCell';

const esc = (v: unknown): string => String(v).replace(/[&"<>]/g, (c) => `&#${c.charCodeAt(0)};`);
export const injuryText = (n: number): string => (n >= 2 ? '중상' : n === 1 ? '부상' : '');

/** The company list (party order marked, leader first) and the selected mercenary's gear. */
export function rosterHtml(c: XCompany, selected: string | null, selSlot: GearSlot | null): string {
  const rows = c.mercs.map((m) => {
    const at = c.party.indexOf(m.id);
    const hurt = injuryText(m.injury);
    return `<button class="xmerc ${m.id === selected ? 'sel' : ''} ${canDeploy(m) ? '' : 'out'}" data-merc="${m.id}" data-testid="merc-${m.id}" style="--c:${m.color}">
      <span class="xmerc-dot"></span><b>${esc(m.name)}</b><small>Lv${m.level} ${t(`class.${m.classId}`)}${m.pendingLevelUps ? ' · ⬆' : ''}</small>
      ${hurt ? `<em class="hurt">${hurt}</em>` : ''}${at >= 0 ? `<i class="xorder">${at === 0 ? '리더' : at + 1}</i>` : ''}</button>`;
  }).join('');
  const m = selected ? c.mercs.find((x) => x.id === selected) : undefined;
  let detail = '<p class="muted">용병을 눌러 장비와 편성을 본다</p>';
  if (m) {
    const g = c.gear[m.id]!;
    const st = heroSetup(m, g).stats;
    const inParty = c.party.includes(m.id);
    const slots = GEAR_SLOTS.map((slot) => `<div class="xslot"><small>${SLOT_NAME[slot]}</small>${itemCell(g.equipped[slot] ? { id: g.equipped[slot]!, n: 1 } : null, { empty: slot, data: `data-gear="${slot}"`, testid: `gear-${slot}`, selected: selSlot === slot })}</div>`).join('');
    detail = `<div class="xmerc-detail"><h4>${esc(m.name)} <small>Lv${m.level} ${t(`class.${m.classId}`)}</small></h4>
      <p class="muted">체력 ${st.maxHp} · 공격 ${Math.round(st.atk)} · 방어 ${Math.round(st.def)}${m.injury ? ` · ${injuryText(m.injury)}` : ''}</p>
      <div class="xacts">
        <button class="btn" data-act="party" data-testid="toggle-party" ${!inParty && (!canDeploy(m) || c.party.length >= 5) ? 'disabled' : ''}>${inParty ? '파티에서 빼기' : '파티에 넣기'}</button>
        ${inParty && c.party.indexOf(m.id) > 0 ? '<button class="btn" data-act="up">앞으로 (리더 쪽)</button>' : ''}
        <button class="btn" data-act="starter" data-testid="starter">기본 장비 받기</button>
        ${m.pendingLevelUps ? '<button class="btn primary" data-act="levelup" data-testid="xlevelup">레벨업</button>' : ''}
      </div><div class="xgear">${slots}</div></div>`;
  }
  return `<h3>용병단 <small>${c.mercs.length}/${MAX_MERCS} · 출격 ${c.party.length}/5</small></h3><div class="xmercs">${rows}</div>${detail}`;
}
