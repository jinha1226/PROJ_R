import { ULT_NAMES, ultSlots } from '../../sim/party/ultimate';
import { entOf, unitOf, type Party, type Unit } from '../../sim/party/partyCore';
import { CLASSES, WEAPONS } from '../../sim/party/partyDefs';
import { LEVEL_XP, MAX_LEVEL, levelOf } from '../../sim/party/partyLevel';
import { CLASS_TINT, classIcon } from './classIcons';
import { unitChips } from './unitChips';

/** the keys of a body's ultimates, one per soul */
export const ULT_KEYS = ['r', 't', 'y', 'u', 'o'];
/** One square per soul's ultimate: its key, a dark sweep for the time left, lit when queued. */
export function skillTiles(u: Unit, t: number, alive: boolean, big: boolean): string {
  return ultSlots(u).map((s, i) => {
    const left = Math.max(0, s.ready - t), q = u.ultQueued && u.ultSlot === s.slot, name = ULT_NAMES[s.ult];
    const sweep = left > 0 ? `background:conic-gradient(#000a ${(left / s.cd) * 360}deg, transparent 0)` : '';
    const label = big ? `<span class="nm">${name}</span>` : `<span class="sn">${name}</span>`;
    return `<button type="button" class="pf-skill${q ? ' queued' : ''}${left > 0 || !alive ? ' wait' : ''}${big ? ' big' : ''}" data-skill="${s.slot}" title="${name}"><i style="${sweep}"></i><kbd>${(ULT_KEYS[i] ?? '').toUpperCase()}</kbd>${left > 0 ? `<em>${Math.ceil(left)}</em>` : ''}${label}</button>`;
  }).join('');
}

/** Health as ten segments, a shield laid over in light blue. */
function hpBar(hp: number, max: number, shield: number): string {
  const k = Math.max(0, hp / max), s = Math.min(1 - k, shield / max);
  return `<div class="pf-hp"><i style="width:${k * 100}%"></i><u style="left:${k * 100}%;width:${s * 100}%"></u><span>${hp}/${max}</span></div>`;
}

/** Level and the share of the way to the next one (a level-up waiting for its trait shows a button). */
function levelHtml(u: Unit): string {
  if (!u.cls) return '';
  const lv = levelOf(u), xp = u.xp ?? 0, from = LEVEL_XP[lv - 1]!, to = LEVEL_XP[lv] ?? from;
  const k = lv >= MAX_LEVEL ? 1 : (xp - from) / Math.max(1, to - from);
  return `<div class="pf-lv"><b>LV ${lv}</b><i><u style="width:${k * 100}%"></u></i>${u.picks ? '<button type="button" class="pf-trait" data-traits>특성</button>' : ''}</div>`;
}

/** The party along the bottom: a framed emblem per clone, health, skill tiles, what it is doing. */
export function partyFramesHtml(p: Party, ids: string[], sel: string): string {
  const t = p.time;
  return ids.map((id, i) => {
    const u = unitOf(p, id)!, e = entOf(p, id)!, cls = CLASSES[u.cls!];
    const state = u.order?.kind === 'hold' ? '고수' : u.order?.kind === 'attack' ? '공격' : u.order?.kind === 'move' ? '이동' : u.ultQueued ? '예약' : '';
    return `<div class="pf${id === sel ? ' on' : ''}${e.hp < e.maxHp * 0.35 ? ' low' : ''}" data-hero="${id}" style="--tint:${CLASS_TINT[u.cls!]}">
      <div class="pf-face">${classIcon(u.cls!)}<kbd>${i + 1}</kbd></div>
      <div class="pf-body"><div class="pf-name">${cls.name}${state ? `<small>${state}</small>` : ''}${unitChips(u, t)}</div>${hpBar(e.hp, e.maxHp, u.shield)}${levelHtml(u)}
      <div class="pf-skills">${skillTiles(u,t,e.alive,false)}</div></div></div>`;
  }).join('');
}

/** how many characters a status bar's gauge is wide */
export const GAUGE = 24;
/** A gauge told in characters, as Jupiter Hell tells one: `[######==------]` — filled, then a second kind laid after it (a shield), then what is missing. */
function gauge(filled: number, extra = 0): string {
  const f = Math.max(0, Math.min(GAUGE, filled)), x = Math.max(0, Math.min(GAUGE - f, extra));
  return `<span class="sb-cells">[<i>${'#'.repeat(f)}</i><u>${'#'.repeat(x)}</u><s>${'-'.repeat(GAUGE - f - x)}</s>]</span>`;
}

/**
 * One clone alone (the dungeon): a single bar along the bottom — who and what level, the states it is in, then two
 * gauges told in characters: health (its shield laid after it) and experience (a level-up waiting for its card shows the
 * button beside it), and the ultimates. No portrait, no second panel.
 */
export function soloBarHtml(p: Party, id: string): string {
  const u = unitOf(p, id), e = entOf(p, id);
  if (!u || !e) return '';
  const lv = levelOf(u), xp = u.xp ?? 0, from = LEVEL_XP[lv - 1]!, to = LEVEL_XP[lv] ?? from, k = lv >= MAX_LEVEL ? 1 : Math.max(0, Math.min(1, (xp - from) / Math.max(1, to - from)));
  // a living clone always shows one mark of health, however little is left
  const hp = e.hp <= 0 ? 0 : Math.max(1, Math.round((e.hp / e.maxHp) * GAUGE)), shield = Math.round((u.shield / e.maxHp) * GAUGE);
  return `<div class="sb${e.hp < e.maxHp * 0.35 ? ' low' : ''}" data-hero="${id}" style="--tint:${CLASS_TINT[u.cls!]}">
    <div class="sb-main">
      <div class="sb-top"><b>${CLASSES[u.cls!].name}</b><span class="sb-lv">Lv ${lv}</span>${unitChips(u, p.time)}</div>
      <div class="sb-row hp"><label>HP</label>${gauge(hp, shield)}<span class="sb-num">${e.hp}<small>/${e.maxHp}</small>${u.shield > 0 ? `<em>+${u.shield}</em>` : ''}</span></div>
      <div class="sb-row xp"><label>XP</label>${gauge(Math.round(k * GAUGE))}${u.picks ? '<button type="button" class="pf-trait" data-traits>특성</button>' : `<span class="sb-num">${lv >= MAX_LEVEL ? 'MAX' : `${Math.floor(k * 100)}%`}</span>`}</div>
    </div>
    <div class="sb-skills">${skillTiles(u, p.time, e.alive, false)}</div></div>`;
}

/** The chosen clone in full at the bottom right: emblem, weapon and engraving, big skill buttons. */
export function detailHtml(p: Party, id: string): string {
  const u = unitOf(p, id), e = entOf(p, id);
  if (!u || !e?.alive) return '';
  const cls = CLASSES[u.cls!], w = WEAPONS[u.weapon!];
  const skills = skillTiles(u,p.time,true,true);
  return `<div class="dt-head" style="--tint:${CLASS_TINT[u.cls!]}"><div class="pf-face big">${classIcon(u.cls!)}</div>
    <div><b>${cls.name}</b>${unitChips(u, p.time)}<div class="dt-sub">${w.name} · 피해 ${w.dmg[0]}–${w.dmg[1]} · 사거리 ${w.range}</div>${cls.passiveName ? `<div class="dt-pas">◆ ${cls.passiveName}</div>` : '<div class="dt-pas dim">영혼 없음</div>'}</div></div>
    ${hpBar(e.hp, e.maxHp, u.shield)}${levelHtml(u)}<div class="dt-skills">${skills}</div>`;
}
