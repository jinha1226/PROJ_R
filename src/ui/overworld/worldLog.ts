import type { GEvent } from '../../sim/grid/types';
import { unitOf, type Party } from '../../sim/party/partyCore';
import { CLASSES } from '../../sim/party/partyDefs';
import { FOE_NAME } from './classIcons';
import { effectLine } from './pipSkills';

export interface LogLine { at: number; text: string; tone: 'info' | 'warn' | 'good' }

const clock = (t: number) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

/** What happened, in short lines (the newest last); the log keeps the latest few. */
export class WorldLog {
  lines: LogLine[] = [];
  /** effects already explained once per clone (the skills tab has them all after) */
  private readonly told = new Set<string>();

  add(at: number, text: string, tone: LogLine['tone'] = 'info'): void {
    this.lines.push({ at, text, tone });
    if (this.lines.length > 40) this.lines.shift();
  }

  /** Turns a batch of world events into log lines. */
  read(p: Party, ev: GEvent[]): void {
    const name = (id?: string) => { const u = id ? unitOf(p, id) : undefined; return u?.cls ? CLASSES[u.cls].name : u?.foe ? FOE_NAME[u.foe] : '?'; };
    // what fired at this moment, in order, for the chain line
    let moment = NaN, fired: { text: string; src?: string }[] = [];
    for (const e of ev) {
      if (e.t !== moment) { moment = e.t; fired = []; }
      if ((e.type === 'buff' || e.type === 'react') && e.text && /[가-힣]/.test(e.text)) fired.push({ text: e.text, src: e.src });
      if (e.type === 'buff' && e.text === 'chain') {
        // only what this clone's action set off (others acting at the same moment are their own story)
        const own = fired.filter((f) => f.src === e.src).map((f) => f.text).filter((t, i, a) => t !== a[i - 1]);
        const shown = own.length > 6 ? [...own.slice(0, 5), '…'] : own;
        this.add(e.t, `${name(e.src)} 연쇄 ×${e.amount} · ${shown.join(' → ')}`, 'good'); fired = []; continue;
      }
      const u = e.dst ? unitOf(p, e.dst) : undefined;
      const src = e.src ? unitOf(p, e.src) : undefined;
      // the blow-by-blow, as a roguelike tells it: who hit whom for how much, misses and blocks, heals
      if (e.type === 'hit' && src && u) this.add(e.t, `${name(e.src)} → ${name(e.dst)} ${e.amount}${e.crit ? ' 치명!' : ''}`, u.side === 'hero' ? 'warn' : 'info');
      else if (e.type === 'miss' && src && u) this.add(e.t, e.text === 'block' ? `${name(e.dst)}이(가) 막음` : `${name(e.src)}의 공격 빗나감`);
      else if (e.type === 'heal' && u?.side === 'hero' && e.text !== 'regen' && (e.amount ?? 0) > 0) this.add(e.t, `${name(e.dst)} 체력 +${e.amount}`, 'good');
      else if (e.type === 'die' && u?.side === 'foe') this.add(e.t, `${name(e.dst)} 처치`);
      else if (e.type === 'die' && u?.side === 'hero') this.add(e.t, `${name(e.dst)} 쓰러짐`, 'warn');
      else if (e.type === 'wake') this.add(e.t, Number(e.text) >= 200 ? '떠돌이 고블린이 알아챔' : Number(e.text) >= 100 ? '진지가 깨어남' : '적이 알아챔', 'warn');
      else if (e.type === 'drop') this.add(e.t, e.text === 'gear' ? '장비가 떨어짐' : '영혼 소멸', 'warn');
      else if (e.type === 'levelUp') this.add(e.t, `${name(e.src)} 레벨 ${e.amount}`, 'good');
      else if (e.type === 'pickup') this.add(e.t, e.text === 'soul' || !e.text ? '영혼석 습득' : `${e.text} 주움`);
      else if (e.type === 'open') this.add(e.t, '상자 열림');
      else if (e.type === 'loot' && e.text === 'ore') this.add(e.t, `광석 +${e.amount}`);
      else if (e.type === 'loot' && e.text === 'crystal') this.add(e.t, `마정석 +${e.amount}`, 'good');
      else if (e.type === 'loot' && e.text && e.text !== 'bio') this.add(e.t, `${e.text} 획득`, 'good');
      else if (e.type === 'trap') this.add(e.t, e.text === 'alarm' ? '경보 함정' : '가시 함정', 'warn');
      else if (e.type === 'trapFound') this.add(e.t, '함정 발견');
      else if (e.type === 'buff' && e.text === 'shrine') this.add(e.t, '성소의 축복', 'good');
      else if (e.type === 'buff' && e.text && /[가-힣]/.test(e.text) && e.src && unitOf(p, e.src)?.side === 'hero' && !this.told.has(`${e.src}:${e.text}`)) {
        // a trigger, an ultimate or a trait firing: said with what it does, the first time this clone sets it off
        this.told.add(`${e.src}:${e.text}`);
        this.add(e.t, `${name(e.src)} · ${effectLine(e.text, unitOf(p, e.src)!)}`, 'good');
      }
      else if (e.type === 'victory') this.add(e.t, '마왕군 장군 처치', 'good');
      else if (e.type === 'buff' && e.text === 'soul') this.add(e.t, `${name(e.dst)} 영혼이 깃듦`, 'good');
      else if (e.type === 'buff' && e.text === 'print') this.add(e.t, '복제 포드가 새 몸을 출력', 'good');
      else if (e.type === 'buff' && e.text === 'claim') this.add(e.t, '진지 파괴 · 영역 확보', 'good');
    }
  }

  html(): string {
    return this.lines.slice(-8).map((l, i, all) => `<div class="wl-line ${l.tone}" style="opacity:${0.45 + (0.55 * (i + 1)) / all.length}"><b>${clock(l.at)}</b> ${l.text}</div>`).join('');
  }
}
