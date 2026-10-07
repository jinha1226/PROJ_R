import type { Party, Unit } from '../../sim/party/partyCore';
import { LAW_TEXT, RESONANCE_AT, tagCount } from '../../sim/party/resonance';
import type { Tag } from '../../sim/party/traitTypes';

/** The status tab's resonance block: each tag the clone has, its count toward the next law, the lit laws bright and the next one dim. */
export function resonanceHtml(p: Party, u: Unit): string {
  const n = tagCount(p, u);
  const rows = (Object.entries(n) as [Tag, number][]).filter(([, k]) => k > 0).sort((a, b) => b[1] - a[1]).map(([tag, k]) => {
    const next = RESONANCE_AT.find((at) => k < at) ?? RESONANCE_AT[1];
    const laws = RESONANCE_AT.map((at, i) => k >= at ? `<span class="on">${LAW_TEXT[tag][i]}</span>` : at === next ? `<span>${LAW_TEXT[tag][i]}</span>` : '').join('');
    return `<li><b>#${tag} ${k}/${next}</b>${laws}</li>`;
  }).join('');
  return rows ? `<h4>공명</h4><ul class="pip-res">${rows}</ul>` : '';
}
