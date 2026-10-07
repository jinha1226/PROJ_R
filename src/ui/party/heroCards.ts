import { kitOf } from '../../sim/party/classKit';
import { ULT_NAMES } from '../../sim/party/ultimate';
import { entOf, unitOf, type Party } from '../../sim/party/partyCore';
import { CLASSES, HERO_IDS, WEAPONS } from '../../sim/party/partyDefs';

/** The three hero cards: health (and shield), the two skills with their cooldowns or queued mark, . */
export function heroCardsHtml(p: Party, sel: string, ids: string[] = HERO_IDS): string {
  const t = p.time;
  return ids.map((id, i) => {
    const u = unitOf(p, id)!, e = entOf(p, id)!, cls = CLASSES[u.cls!];
    const kit=kitOf(u), left=Math.max(0,u.ultReady-t);
    const skills=kit.ultimate?`<button type="button" data-skill="0" ${left>0||!e.alive?'disabled':''}>R ${ULT_NAMES[kit.ultimate]} ${left>0?Math.ceil(left):''}</button>`:'';
    return `<div class="pd-card${id === sel ? ' on' : ''}${e.alive ? '' : ' dead'}" data-hero="${id}"><b>${i + 1} ${cls.name} <small>${WEAPONS[u.weapon!].name}</small></b><div class="pd-hp"><i style="width:${(e.hp / e.maxHp) * 100}%"></i><span>${e.hp}/${e.maxHp}${u.shield ? ` +${u.shield}` : ''}</span></div><div class="pd-skills">${skills || '<small class="pd-adv">영혼 없음</small>'}</div></div>`;
  }).join('');
}
