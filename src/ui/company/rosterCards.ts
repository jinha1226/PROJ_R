import { CLASSES } from '../../data/classes';
import { rankOf, type Mercenary } from '../../sim/roster/types';
import { xpToNext } from '../../sim/roster/leveling';
import { t } from '../i18n/ko';
import { displayName } from './text';

export function renderCard(m: Mercenary, deployed: boolean): string {
  const badges = [
    m.pendingLevelUps ? `<span class="badge up">레벨업 ${m.pendingLevelUps}</span>` : '',
    m.injury ? `<span class="badge hurt">부상 ${m.injury}</span>` : '',
    m.protagonist ? '<span class="badge lead">리더</span>' : '',
  ].join('');
  const xp = m.level >= 10 ? 100 : Math.round((m.xp / xpToNext(m.level)) * 100);
  return `<div class="merc-card ${deployed ? 'deployed' : ''}" data-merc="${m.id}" data-testid="card-${m.id}" style="--c:${m.color}">
    <label class="deploy" title="출전"><input type="checkbox" data-deploy="${m.id}" ${deployed ? 'checked' : ''}/> 출전</label>
    <div class="card-name">${displayName(m)}</div>
    <div class="card-sub">Lv${m.level} ${t(`class.${m.classId}`)} · ${t(`rank.${rankOf(m.level)}`)} · ${t(`role.${CLASSES[m.classId].role}`)}</div>
    <div class="xpbar"><div style="width:${xp}%"></div></div>
    <div class="badges">${badges}</div></div>`;
}
