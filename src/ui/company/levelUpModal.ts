import type { LevelOffer } from '../../sim/roster/offers';
import type { Mercenary } from '../../sim/roster/types';
import { t } from '../i18n/ko';
import { displayName } from './text';

function offerText(o: LevelOffer, m: Mercenary): { title: string; desc: string } {
  switch (o.kind) {
    case 'newActive': return { title: `새 기술: ${t(`skill.${o.skillId}`)}`, desc: m.actives.length >= 2 ? '기존 기술 하나와 교체' : '빈 슬롯에 배움' };
    case 'upgrade': return { title: `강화: ${t(`skill.${o.skillId}`)}`, desc: `Lv${(m.skillLevels[o.skillId] ?? 1) + 1} — 위력 +20%, 재사용 대기 −10%` };
    case 'passive': return { title: `패시브: ${t(`passive.${o.passiveId}`)}`, desc: t(`passiveDesc.${o.passiveId}`) };
    case 'tactic': return { title: `전술: ${t(`tactic.${o.tacticId}`)}`, desc: '두 번째 전술 슬롯에 장착' };
    case 'promote': return { title: `승급: ${t(`class.${o.classId}`)}`, desc: '직업이 바뀌고 해당 직업 기술을 얻는다' };
  }
}

/**
 * Shows level-up choices; resolves with the chosen offer (and replace slot when needed).
 * With no offers it resolves immediately with null (stats still grow).
 */
export function openLevelUp(parent: HTMLElement, m: Mercenary, offers: LevelOffer[]): Promise<{ offer: LevelOffer; slot?: 0 | 1 } | null> {
  if (offers.length === 0) return Promise.resolve(null);
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'modal-backdrop';
    el.dataset.testid = 'levelup';
    const cards = offers.map((o, i) => {
      const { title, desc } = offerText(o, m);
      return `<button class="offer offer-${o.kind}" data-i="${i}" data-testid="offer-${i}"><b>${title}</b><span>${desc}</span></button>`;
    }).join('');
    el.innerHTML = `<div class="panel modal"><h2>레벨 업! ${displayName(m)} — Lv${m.level - m.pendingLevelUps + 1}</h2><div class="offers">${cards}</div><div class="slot-pick" hidden></div></div>`;
    parent.appendChild(el);
    const done = (v: { offer: LevelOffer; slot?: 0 | 1 }) => { el.remove(); resolve(v); };
    el.querySelectorAll<HTMLButtonElement>('.offer').forEach((b) => b.addEventListener('click', () => {
      const offer = offers[Number(b.dataset.i)]!;
      if (offer.kind !== 'newActive' || m.actives.length < 2) return done({ offer });
      const pick = el.querySelector<HTMLDivElement>('.slot-pick')!;
      pick.hidden = false;
      pick.innerHTML = `<p>어떤 기술과 교체할까?</p>${m.actives.map((a, s) => `<button class="btn" data-slot="${s}" data-testid="slot-${s}">${t(`skill.${a}`)}</button>`).join('')}`;
      pick.querySelectorAll<HTMLButtonElement>('[data-slot]').forEach((sb) => sb.addEventListener('click', () => done({ offer, slot: Number(sb.dataset.slot) as 0 | 1 })));
    }));
  });
}
