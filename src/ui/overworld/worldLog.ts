import type { GEvent } from '../../sim/grid/types';
import { unitOf, type Party, type Unit } from '../../sim/party/partyCore';
import { CLASSES } from '../../sim/party/partyDefs';
import { FOE_NAME } from './classIcons';
import { effectLine } from './pipSkills';

export interface LogLine { at: number; text: string; tone: 'info' | 'warn' | 'good' }

const clock = (t: number) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const KOREAN = /[가-힣]/;

/** A word with the Korean particle that fits its last sound: 이/가, 을/를, 은/는, 와/과 (a word that does not end in Hangul takes the second). */
export function josa(word: string, pair: '이/가' | '을/를' | '은/는' | '과/와'): string {
  const code = word.charCodeAt(word.length - 1) - 0xac00, closed = code >= 0 && code <= 11171 && code % 28 !== 0;
  const [a, b] = pair.split('/') as [string, string];
  return word + (closed ? a : b);
}

/** a state laid on a unit, as a sentence about it */
const STATE: Record<string, (who: string) => string> = {
  burn: (w) => `${josa(w, '이/가')} 불타기 시작했다`, chill: (w) => `${josa(w, '이/가')} 냉기에 휩싸였다`, freeze: (w) => `${josa(w, '이/가')} 얼어붙었다`,
  shock: (w) => `${josa(w, '이/가')} 감전되었다`, poison: (w) => `${josa(w, '이/가')} 중독되었다`, bleed: (w) => `${josa(w, '이/가')} 피를 흘린다`,
  mark: (w) => `${w}에게 표식이 찍혔다`, exposed: (w) => `${w}의 약점이 드러났다`, stun: (w) => `${josa(w, '이/가')} 기절했다`,
};

/** What happened, told as it happens in short sentences (the newest last): every blow, every effect of a chain in its order. */
export class WorldLog {
  lines: LogLine[] = [];
  /** effects already explained once per clone (the skills tab has them all after) */
  private readonly told = new Set<string>();
  /** names by unit id, kept after the unit is gone (a fallen skeleton, a body that was cleared) */
  private readonly names = new Map<string, string>();
  /** an attack on its way: the blow that follows is told with it, in one sentence */
  private swing: { src: string; dst: string } | undefined;

  add(at: number, text: string, tone: LogLine['tone'] = 'info'): void {
    this.lines.push({ at, text, tone });
    if (this.lines.length > 200) this.lines.shift();
  }

  private name(p: Party, id?: string): string {
    const u = id ? unitOf(p, id) : undefined;
    const n = u ? nameOf(u) : undefined;
    if (id && n) this.names.set(id, n);
    return n ?? (id ? this.names.get(id) : undefined) ?? '무언가';
  }

  /** Turns a batch of world events into log lines. */
  read(p: Party, ev: GEvent[]): void { for (const e of ev) this.tell(p, e); }

  /** One event, as a sentence (or nothing: a step, a swing that has not landed yet). */
  tell(p: Party, e: GEvent): void {
    const name = (id?: string) => this.name(p, id);
    const u = e.dst ? unitOf(p, e.dst) : undefined, src = e.src ? unitOf(p, e.src) : undefined;
    const swing = this.swing;
    if (e.type === 'bump' || e.type === 'shoot') { this.swing = e.src && e.dst ? { src: e.src, dst: e.dst } : undefined; name(e.src); name(e.dst); return; }
    if (e.type === 'hit' && e.src && e.dst) {
      const tone = (u?.side ?? 'foe') === 'hero' ? 'warn' : 'info', crit = e.crit ? '치명타! ' : '';
      // the blow of an attack names who struck; damage an effect dealt (a blast, a burn, a burst) names only who took it
      if (swing && swing.src === e.src && swing.dst === e.dst) { this.swing = undefined; this.add(e.t, `${crit}${josa(name(e.src), '이/가')} ${josa(name(e.dst), '을/를')} 공격해 ${e.amount} 피해를 입혔다.`, tone); }
      else this.add(e.t, `${crit}${josa(name(e.dst), '이/가')} ${e.amount} 피해를 입었다.`, tone);
    }
    else if (e.type === 'miss' && e.src && e.dst) { this.swing = undefined; this.add(e.t, e.text === 'block' ? `${josa(name(e.dst), '이/가')} ${name(e.src)}의 공격을 막았다.` : `${name(e.src)}의 공격이 빗나갔다.`); }
    else if (e.type === 'heal' && u?.side === 'hero' && e.text !== 'regen' && (e.amount ?? 0) > 0) this.add(e.t, `${josa(name(e.dst), '이/가')} 체력을 ${e.amount} 회복했다.`, 'good');
    else if (e.type === 'die' && e.dst) this.add(e.t, `${josa(name(e.dst), '이/가')} 쓰러졌다.`, u?.side === 'hero' && !u.summoner ? 'warn' : 'info');
    else if (e.type === 'summon' && e.dst) this.add(e.t, `${josa(name(e.dst), '이/가')} ${u?.mirror ? '나타났다' : '일어섰다'}.`, 'good');
    else if (e.type === 'react' && e.text) this.add(e.t, `${e.text} 반응이 일어났다.`, 'good');
    else if (e.type === 'wake') this.add(e.t, Number(e.text) >= 200 ? '떠돌이 고블린이 이쪽을 알아챘다.' : Number(e.text) >= 100 ? '진지가 깨어났다.' : '적이 이쪽을 알아챘다.', 'warn');
    else if (e.type === 'drop') this.add(e.t, e.text === 'gear' ? '장비가 바닥에 떨어졌다.' : '영혼이 소멸했다.', 'warn');
    else if (e.type === 'levelUp') this.add(e.t, `${josa(name(e.src), '이/가')} 레벨 ${e.amount}에 올랐다.`, 'good');
    else if (e.type === 'pickup') this.add(e.t, e.text === 'soul' || !e.text ? '영혼석을 주웠다.' : `${josa(e.text, '을/를')} 주웠다.`);
    else if (e.type === 'open') this.add(e.t, '상자를 열었다.');
    else if (e.type === 'loot' && e.text === 'ore') this.add(e.t, `광석을 ${e.amount} 얻었다.`);
    else if (e.type === 'loot' && e.text === 'crystal') this.add(e.t, `마정석을 ${e.amount} 얻었다.`, 'good');
    else if (e.type === 'loot' && e.text && e.text !== 'bio') this.add(e.t, `${josa(e.text, '을/를')} 얻었다.`, 'good');
    else if (e.type === 'trap') this.add(e.t, e.text === 'alarm' ? '경보 함정이 울렸다.' : '가시 함정을 밟았다.', 'warn');
    else if (e.type === 'trapFound') this.add(e.t, '함정을 발견했다.');
    else if (e.type === 'victory') this.add(e.t, '마왕군 장군을 쓰러뜨렸다.', 'good');
    else if (e.type === 'buff') this.effect(p, e, src);
  }

  /** An effect going off, a state laid on a foe, the count that closes a chain. */
  private effect(p: Party, e: GEvent, src: Unit | undefined): void {
    const name = (id?: string) => this.name(p, id), text = e.text ?? '';
    if (text === 'chain') this.add(e.t, `연쇄가 ${e.amount}번 이어졌다.`, 'good');
    else if (text === 'shrine') this.add(e.t, '성소의 축복을 받았다.', 'good');
    else if (text === 'soul') this.add(e.t, `${name(e.dst)}에게 영혼이 깃들었다.`, 'good');
    else if (text === 'print') this.add(e.t, '복제 포드가 새 몸을 출력했다.', 'good');
    else if (text === 'claim') this.add(e.t, '진지를 부수고 영역을 확보했다.', 'good');
    else if (STATE[text] && e.dst) this.add(e.t, `${STATE[text]!(name(e.dst))}.`);
    else if (text === '운석 낙하') this.add(e.t, `운석이 ${name(e.dst)} 위로 떨어졌다.`, 'good');
    else if (text === '해골 자폭') this.add(e.t, '해골이 적에게 달려들어 터졌다.', 'good');
    else if (KOREAN.test(text) && src?.side === 'hero') {
      // a card, an innate, an ultimate, a gear effect going off: said every time, with what it does the first time this clone sets it off
      const who = src.summoner ? unitOf(p, src.summoner) ?? src : src, key = `${who.id}:${text}`, first = !this.told.has(key);
      this.told.add(key);
      const what = first ? effectLine(text, who) : text, note = what.includes('→') ? ` (${what.slice(what.indexOf('→') + 1).trim()})` : '';
      this.add(e.t, `${name(who.id)}의 ${josa(text, '이/가')} 발동했다.${note}`, 'good');
    }
  }

  html(): string {
    return this.lines.slice(-12).map((l, i, all) => `<div class="wl-line ${l.tone}" style="opacity:${0.45 + (0.55 * (i + 1)) / all.length}"><b>${clock(l.at)}</b> ${l.text}</div>`).join('');
  }
}

/** What a unit is called in the log: a clone by its class, a summon by what it is, a foe by its kind. */
function nameOf(u: Unit): string | undefined {
  if (u.summoner) return u.golem ? '골렘' : u.mirror ? '분신' : '해골';
  return u.cls ? CLASSES[u.cls].name : u.foe ? FOE_NAME[u.foe] : undefined;
}
