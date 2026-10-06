import { entOf, unitOf, type Party, type Unit } from '../../sim/party/partyCore';
import { CLASSES, PROMOTIONS, SKILLS, WEAPONS } from '../../sim/party/partyDefs';
import { LEVEL_XP, MAX_LEVEL, PROMOTE_LEVEL, levelOf } from '../../sim/party/partyLevel';
import { CLASS_TINT, SKILL_DESC, classIcon } from './classIcons';

/** A skill as a square with its key and a dark sweep for the time left (or lit when queued). */
function skillTile(u: Unit, k: number, t: number, alive: boolean, big: boolean): string {
  const id = CLASSES[u.cls!].skills[k];
  if (!id) return '';
  const cd = SKILLS[id].cd, left = Math.max(0, u.ready[k]! - t), q = u.queued === k;
  const sweep = left > 0 ? `background:conic-gradient(#000a ${(left / cd) * 360}deg, transparent 0)` : '';
  // small tiles carry the name too (shown where there is room: phones, where the detail panel folds away)
  const label = big ? `<span class="nm">${SKILLS[id].name}</span><span class="ds">${SKILL_DESC[id]}</span>` : `<span class="sn">${SKILLS[id].name}</span>`;
  return `<button type="button" class="pf-skill${q ? ' queued' : ''}${left > 0 || !alive ? ' wait' : ''}${big ? ' big' : ''}" data-skill="${k}" title="${SKILLS[id].name}"><i style="${sweep}"></i><kbd>${k ? 'W' : 'Q'}</kbd>${left > 0 ? `<em>${Math.ceil(left)}</em>` : ''}${label}</button>`;
}

/** Health as ten segments, a shield laid over in light blue. */
function hpBar(hp: number, max: number, shield: number): string {
  const k = Math.max(0, hp / max), s = Math.min(1 - k, shield / max);
  return `<div class="pf-hp"><i style="width:${k * 100}%"></i><u style="left:${k * 100}%;width:${s * 100}%"></u><span>${hp}/${max}</span></div>`;
}

/** Level and the share of the way to the next one (a level-up waiting for its trait shows a button). */
function levelHtml(u: Unit): string {
  if (!u.cls || u.cls === 'shell') return '';
  const lv = levelOf(u), xp = u.xp ?? 0, from = LEVEL_XP[lv - 1]!, to = LEVEL_XP[lv] ?? from;
  const k = lv >= MAX_LEVEL ? 1 : (xp - from) / Math.max(1, to - from);
  return `<div class="pf-lv"><b>LV ${lv}</b><i><u style="width:${k * 100}%"></u></i>${u.picks ? '<button type="button" class="pf-trait" data-traits>특성</button>' : ''}</div>`;
}

/** The party along the bottom: a framed emblem per clone, health, skill tiles, what it is doing. */
export function partyFramesHtml(p: Party, ids: string[], sel: string): string {
  const t = p.time;
  return ids.map((id, i) => {
    const u = unitOf(p, id)!, e = entOf(p, id)!, cls = CLASSES[u.cls!];
    const state = u.order?.kind === 'hold' ? '고수' : u.order?.kind === 'attack' ? '공격' : u.order?.kind === 'move' ? '이동' : u.queued !== undefined ? '예약' : '';
    return `<div class="pf${id === sel ? ' on' : ''}${e.hp < e.maxHp * 0.35 ? ' low' : ''}" data-hero="${id}" style="--tint:${CLASS_TINT[u.cls!]}">
      <div class="pf-face">${classIcon(u.cls!)}<kbd>${i + 1}</kbd></div>
      <div class="pf-body"><div class="pf-name">${cls.name}${state ? `<small>${state}</small>` : ''}</div>${hpBar(e.hp, e.maxHp, u.shield)}${levelHtml(u)}
      <div class="pf-skills">${[0, 1].map((k) => skillTile(u, k, t, e.alive, false)).join('')}</div></div></div>`;
  }).join('');
}

/** The chosen clone in full at the bottom right: emblem, weapon and engraving, big skill buttons, the way to its advanced class. */
export function detailHtml(p: Party, id: string): string {
  const u = unitOf(p, id), e = entOf(p, id);
  if (!u || !e?.alive) return '';
  const cls = CLASSES[u.cls!], w = WEAPONS[u.weapon!], promo = PROMOTIONS[u.cls!];
  const adv = promo ? (u.promoteReady ? `<button type="button" class="pf-promote" data-promote>전직 → ${CLASSES[promo.to].name}</button>` : `<div class="pd-adv">전직 ${CLASSES[promo.to].name} · 레벨 ${PROMOTE_LEVEL} · ${promo.label} ${u.progress}/${promo.need}</div>`) : '';
  const skills = [0, 1].map((k) => skillTile(u, k, p.time, true, true)).join('');
  return `<div class="dt-head" style="--tint:${CLASS_TINT[u.cls!]}"><div class="pf-face big">${classIcon(u.cls!)}</div>
    <div><b>${cls.name}</b><div class="dt-sub">${w.name} · 피해 ${w.dmg[0]}–${w.dmg[1]} · 사거리 ${w.range}</div>${cls.passiveName ? `<div class="dt-pas">◆ ${cls.passiveName}</div>` : '<div class="dt-pas dim">영혼 없음</div>'}</div></div>
    ${hpBar(e.hp, e.maxHp, u.shield)}${levelHtml(u)}<div class="dt-skills">${skills}</div>${adv}`;
}
