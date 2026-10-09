import type { Unit } from '../../sim/party/partyCore';
import type { StatusId } from '../../sim/party/status';

const STATUS: Record<StatusId, string> = { burn: '화상', chill: '냉기', freeze: '빙결', poison: '중독', shock: '감전', bleed: '출혈', stun: '기절', mark: '표식', exposed: '약점' };

/**
 * What is on a unit right now, as short chips: what its triggers gave it (a powered-up next blow, a crit or dodge readied,
 * stealth, haste, immunity, leech, fury, steady aim) in green, what ails it (statuses with stacks, blindness) in red,
 * each with the turns it has left.
 */
export function unitChips(u: Unit, t: number): string {
  const left = (until?: number) => (until && until > t ? Math.ceil(until - t) : 0);
  const good: string[] = [], bad: string[] = [];
  if (u.empower > 1) good.push(`강화 ×${Math.round(u.empower * 10) / 10}`);
  if (u.nextCrit) good.push('다음 치명');
  if ((u.hotRounds ?? 0) > 0) good.push(`강화탄 ${u.hotRounds}`);
  if (u.dodgeNext) good.push('회피 준비');
  if ((u.steady ?? 0) > 0) good.push(`정조준 ${u.steady}`);
  for (const [name, until] of [['은신', u.hiddenUntil], ['신속', u.hasteUntil], ['무적', u.immuneUntil], ['흡혈', u.leechUntil], ['분노', u.damageBuffUntil], ['광분', u.furyUntil]] as const) {
    const n = left(until); if (n) good.push(`${name} ${n}`);
  }
  for (const [id, s] of Object.entries(u.status) as [StatusId, { until: number; stacks?: number }][]) {
    const n = left(s?.until); if (n) bad.push(`${STATUS[id]}${(s.stacks ?? 1) > 1 ? `×${s.stacks}` : ''} ${n}`);
  }
  const blind = left(u.blindUntil); if (blind) bad.push(`실명 ${blind}`);
  const frozen = left(u.frozenUntil); if (frozen && !u.status.freeze) bad.push(`빙결 ${frozen}`);
  if (!good.length && !bad.length) return '';
  return `<div class="u-chips">${good.map((c) => `<i class="good">${c}</i>`).join('')}${bad.map((c) => `<i class="bad">${c}</i>`).join('')}</div>`;
}
