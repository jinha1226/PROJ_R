import type { GEvent } from '../../sim/grid/types';
import { unitOf, type Party } from '../../sim/party/partyCore';
import { CLASSES } from '../../sim/party/partyDefs';
import { FOE_NAME } from './classIcons';

export interface LogLine { at: number; text: string; tone: 'info' | 'warn' | 'good' }

const clock = (t: number) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

/** What happened, in short lines (the newest last); the log keeps the latest few. */
export class WorldLog {
  lines: LogLine[] = [];

  add(at: number, text: string, tone: LogLine['tone'] = 'info'): void {
    this.lines.push({ at, text, tone });
    if (this.lines.length > 40) this.lines.shift();
  }

  /** Turns a batch of world events into log lines. */
  read(p: Party, ev: GEvent[]): void {
    const name = (id?: string) => { const u = id ? unitOf(p, id) : undefined; return u?.cls ? CLASSES[u.cls].name : u?.foe ? FOE_NAME[u.foe] : '?'; };
    for (const e of ev) {
      const u = e.dst ? unitOf(p, e.dst) : undefined;
      if (e.type === 'die' && u?.side === 'foe') this.add(e.t, `${name(e.dst)} 처치`);
      else if (e.type === 'die' && u?.side === 'hero') this.add(e.t, `${name(e.dst)} 쓰러짐`, 'warn');
      else if (e.type === 'wake') this.add(e.t, Number(e.text) >= 200 ? '떠돌이 고블린이 알아챔' : Number(e.text) >= 100 ? '진지가 깨어남' : '적이 알아챔', 'warn');
      else if (e.type === 'drop') this.add(e.t, '영혼석이 떨어짐', 'warn');
      else if (e.type === 'pickup') this.add(e.t, '영혼석 습득');
      else if (e.type === 'buff' && e.text === 'soul') this.add(e.t, `${name(e.dst)} 영혼이 깃듦`, 'good');
      else if (e.type === 'buff' && e.text === 'print') this.add(e.t, '복제 포드가 새 몸을 출력', 'good');
      else if (e.type === 'buff' && e.text === 'claim') this.add(e.t, '진지 파괴 · 영역 확보', 'good');
    }
  }

  html(): string {
    return this.lines.slice(-8).map((l, i, all) => `<div class="wl-line ${l.tone}" style="opacity:${0.45 + (0.55 * (i + 1)) / all.length}"><b>${clock(l.at)}</b> ${l.text}</div>`).join('');
  }
}
