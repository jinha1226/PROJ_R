/** Keywords coloured by kind, as Path of Achra marks its damage types and states. */
const KEYS: [RegExp, string][] = [
  [/(화상|화염|불씨)/g, 'k-fire'], [/(냉기|빙결|서리)/g, 'k-ice'], [/(감전|번개|전기)/g, 'k-shock'], [/(중독|독)/g, 'k-poison'],
  [/(출혈|흡혈)/g, 'k-blood'], [/(기절|실명|도발|표식|약점)/g, 'k-stun'], [/(보호막|막기|무적)/g, 'k-guard'], [/(치유|회복|체력)/g, 'k-heal'],
  [/(치명)/g, 'k-crit'], [/(은신|회피)/g, 'k-shade'],
];

/** A terse effect text with its numbers in bold and its keywords coloured (plain text in, HTML out). */
export function richText(text: string): string {
  let s = text.replace(/[&<>]/g, (c) => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;'));
  s = s.replace(/([+\-×]?\d+(?:\.\d+)?%?)/g, '<b class="k-num">$1</b>');
  for (const [re, cls] of KEYS) s = s.replace(re, `<i class="${cls}">$1</i>`);
  return s;
}

/** A trigger's condition as Achra puts it, "적중 시" — the event, then 시 (a few read better whole). */
export function whenText(when: string): string {
  if (when === '제자리') return '제자리 공격 시';
  if (when === '이동 후') return '이동 후 공격 시';
  if (when.endsWith('마다') || when === '상시' || when.startsWith('직접')) return when;
  return `${when} 시`;
}

/** A "cause → effect" text as one Achra line: the cause as a bold condition, the effect coloured; a text without a cause is always on. */
export function achraLine(text: string): string {
  const i = text.indexOf('→');
  if (i < 0) return `<i class="k-when">상시</i> ${richText(text)}`;
  return `<i class="k-when">${whenText(text.slice(0, i).trim())}</i> ${richText(text.slice(i + 1).trim())}`;
}
