import { entOf, unitOf, type Party } from '../../sim/party/partyCore';
import { CLASSES, HERO_IDS, PROMOTIONS, SKILLS, WEAPONS } from '../../sim/party/partyDefs';

/** The three hero cards: health (and shield), the two skills with their cooldowns or queued mark, and the road to the advanced class. */
export function heroCardsHtml(p: Party, sel: string): string {
  const t = p.time;
  return HERO_IDS.map((id, i) => {
    const u = unitOf(p, id)!, e = entOf(p, id)!, cls = CLASSES[u.cls!], promo = PROMOTIONS[u.cls!];
    const skills = cls.skills.map((s, k) => { const left = Math.max(0, u.ready[k]! - t); const q = u.queued === k; return `<button type="button" data-skill="${k}" class="${q ? 'queued' : ''}" ${left > 0 || !e.alive ? 'disabled' : ''}>${k ? 'W' : 'Q'} ${SKILLS[s].name}${q ? ' 예약' : left > 0 ? ` ${left.toFixed(0)}` : ''}</button>`; }).join('');
    const adv = promo && e.alive ? (u.promoteReady ? `<button type="button" class="pd-promote" data-promote>전직 → ${CLASSES[promo.to].name}</button>` : `<small class="pd-adv">${CLASSES[promo.to].name} ${u.progress}/${promo.need}</small>`) : '';
    return `<div class="pd-card${id === sel ? ' on' : ''}${e.alive ? '' : ' dead'}" data-hero="${id}"><b>${i + 1} ${cls.name} <small>${WEAPONS[u.weapon!].name}</small></b><div class="pd-hp"><i style="width:${(e.hp / e.maxHp) * 100}%"></i><span>${e.hp}/${e.maxHp}${u.shield ? ` +${u.shield}` : ''}</span></div><div class="pd-skills">${skills}</div>${adv}</div>`;
  }).join('');
}
