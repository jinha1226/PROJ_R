import type { GEvent } from '../../sim/grid/types';
import { unitOf, type Party, type Unit } from '../../sim/party/partyCore';
import { CLASSES } from '../../sim/party/partyDefs';
import { FOE_NAME } from './classIcons';
import { effectLine } from './pipSkills';

/** `text`: the sentence as plain words; `html`: the same with its names, numbers and effects coloured */
export interface LogLine { at: number; text: string; tone: 'info' | 'warn' | 'good'; html: string }

const clock = (t: number) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const KOREAN = /[가-힣]/;

type Pair = '이/가' | '을/를' | '은/는' | '과/와';
/** letters and digits whose Korean reading ends in a closed sound (엘, 엠, 엔, 알; 영, 일, 삼, 육, 칠, 팔): MODEL M이, MODEL W가 */
const CLOSED = new Set([...'LMNR013678']);
/** the Korean particle that fits a word's last sound (a letter or a digit by how it is read; anything else takes the second) */
function particle(word: string, pair: Pair): string {
  const last = word.charAt(word.length - 1), code = last.charCodeAt(0) - 0xac00;
  const closed = code >= 0 && code <= 11171 ? code % 28 !== 0 : CLOSED.has(last.toUpperCase());
  const [a, b] = pair.split('/') as [string, string];
  return closed ? a : b;
}
/** A word with the Korean particle that fits its last sound: 이/가, 을/를, 은/는, 과/와. */
export const josa = (word: string, pair: Pair): string => word + particle(word, pair);

// A sentence carries marks for what is coloured (a name, a number, an effect); the plain text drops them, the html turns them into spans.
const MARK = /\uE000([\w-]+)\uE001([^\uE002]*)\uE002/g;
const m = (cls: string, s: string | number): string => `\uE000${cls}\uE001${s}\uE002`;
const escape = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const plain = (s: string): string => s.replace(MARK, '$2');
const rich = (s: string): string => escape(s).replace(MARK, '<i class="l-$1">$2</i>');

/** a state laid on a unit: the particle after its name, and what is said of it */
const STATE: Record<string, [Pair | '에게' | '의', string]> = {
  burn: ['이/가', '불타기 시작했다'], chill: ['이/가', '냉기에 휩싸였다'], freeze: ['이/가', '얼어붙었다'], shock: ['이/가', '감전되었다'], poison: ['이/가', '중독되었다'],
  bleed: ['이/가', '피를 흘린다'], mark: ['에게', '표식이 찍혔다'], exposed: ['의', '약점이 드러났다'], stun: ['이/가', '기절했다'],
};

/**
 * What happened, told as it happens in short sentences (the newest last): every blow, every effect of a chain in its order.
 * Names are coloured by side (a clone, its summon, a foe), numbers by what they are (harm dealt, harm taken, health back),
 * effects and states by their own colours.
 */
export class WorldLog {
  lines: LogLine[] = [];
  /** effects already explained once per clone (the skills tab has them all after) */
  private readonly told = new Set<string>();
  /** names (and sides) by unit id, kept after the unit is gone (a fallen skeleton, a body that was cleared) */
  private readonly names = new Map<string, { name: string; cls: string }>();
  /** an attack on its way: the blow that follows is told with it, in one sentence */
  private swing: { src: string; dst: string } | undefined;

  add(at: number, text: string, tone: LogLine['tone'] = 'info'): void {
    this.lines.push({ at, text: plain(text), tone, html: rich(text) });
    if (this.lines.length > 400) this.lines.shift();
  }

  /** who a unit is and which side's colour its name wears */
  private who(p: Party, id?: string): { name: string; cls: string } {
    const u = id ? unitOf(p, id) : undefined, n = u ? nameOf(u) : undefined;
    const known = n && u ? { name: n, cls: u.summoner ? 'sum' : u.side === 'hero' ? 'ally' : 'foe' } : undefined;
    if (id && known) this.names.set(id, known);
    return known ?? (id ? this.names.get(id) : undefined) ?? { name: '무언가', cls: 'foe' };
  }

  /** Turns a batch of world events into log lines. */
  read(p: Party, ev: GEvent[]): void { for (const e of ev) this.tell(p, e); }

  /** One event, as a sentence (or nothing: a step, a swing that has not landed yet). */
  tell(p: Party, e: GEvent): void {
    // a name in its side's colour, with the particle that follows it
    const n = (id?: string, tail: Pair | string = '') => { const w = this.who(p, id); return m(w.cls, w.name) + (tail.includes('/') ? particle(w.name, tail as Pair) : tail); };
    const u = e.dst ? unitOf(p, e.dst) : undefined, src = e.src ? unitOf(p, e.src) : undefined;
    const swing = this.swing;
    if (e.type === 'bump' || e.type === 'shoot') { this.swing = e.src && e.dst ? { src: e.src, dst: e.dst } : undefined; this.who(p, e.src); this.who(p, e.dst); return; }
    if (e.type === 'hit' && e.src && e.dst) {
      const ours = this.who(p, e.dst).cls !== 'foe', tone = ours ? 'warn' : 'info', crit = e.crit ? `${m('crit', '치명타!')} ` : '', harm = m(ours ? 'hurt' : 'dmg', e.amount ?? 0);
      // the blow of an attack names who struck; damage an effect dealt (a blast, a burn, a burst) names only who took it
      if (swing && swing.src === e.src && swing.dst === e.dst) { this.swing = undefined; this.add(e.t, `${crit}${n(e.src, '이/가')} ${n(e.dst, '을/를')} 공격해 ${harm} 피해를 입혔다.`, tone); }
      else this.add(e.t, `${crit}${n(e.dst, '이/가')} ${harm} 피해를 입었다.`, tone);
    }
    else if (e.type === 'miss' && e.src && e.dst) { this.swing = undefined; this.add(e.t, e.text === 'block' ? `${n(e.dst, '이/가')} ${n(e.src, '의')} 공격을 ${m('miss', '막았다')}.` : `${n(e.src, '의')} 공격이 ${m('miss', '빗나갔다')}.`); }
    else if (e.type === 'heal' && u?.side === 'hero' && e.text !== 'regen' && (e.amount ?? 0) > 0) this.add(e.t, `${n(e.dst, '이/가')} 체력을 ${m('heal', e.amount ?? 0)} 회복했다.`, 'good');
    else if (e.type === 'die' && e.dst) this.add(e.t, `${n(e.dst, '이/가')} ${m('dead', '쓰러졌다')}.`, u?.side === 'hero' && !u.summoner ? 'warn' : 'info');
    else if (e.type === 'summon' && e.dst) this.add(e.t, `${n(e.dst, '이/가')} ${u?.mirror ? '나타났다' : '일어섰다'}.`, 'good');
    else if (e.type === 'react' && e.text) this.add(e.t, `${m('react', e.text)} 반응이 일어났다.`, 'good');
    else if (e.type === 'wake') this.add(e.t, Number(e.text) >= 200 ? '떠돌이 고블린이 이쪽을 알아챘다.' : Number(e.text) >= 100 ? '진지가 깨어났다.' : '적이 이쪽을 알아챘다.', 'warn');
    else if (e.type === 'drop') this.add(e.t, e.text === 'gear' ? '장비가 바닥에 떨어졌다.' : '영혼이 소멸했다.', 'warn');
    else if (e.type === 'levelUp') this.add(e.t, `${n(e.src, '이/가')} ${m('loot', `레벨 ${e.amount}`)}에 올랐다.`, 'good');
    else if (e.type === 'pickup') this.add(e.t, e.text === 'soul' || !e.text ? `${m('loot', '영혼석')}을 주웠다.` : `${m('loot', e.text)}${particle(e.text, '을/를')} 주웠다.`);
    else if (e.type === 'open') this.add(e.t, '상자를 열었다.');
    else if (e.type === 'loot' && e.text === 'ore') this.add(e.t, `광석을 ${m('loot', e.amount ?? 0)} 얻었다.`);
    else if (e.type === 'loot' && e.text === 'crystal') this.add(e.t, `마정석을 ${m('loot', e.amount ?? 0)} 얻었다.`, 'good');
    else if (e.type === 'loot' && e.text) this.add(e.t, `${m('loot', e.text)}${particle(e.text, '을/를')} 얻었다.`, 'good');
    else if (e.type === 'trap') this.add(e.t, e.text === 'alarm' ? '경보 함정이 울렸다.' : '가시 함정을 밟았다.', 'warn');
    else if (e.type === 'trapFound') this.add(e.t, '함정을 발견했다.');
    else if (e.type === 'victory') this.add(e.t, '마왕군 장군을 쓰러뜨렸다.', 'good');
    else if (e.type === 'buff') this.effect(p, e, src, n);
  }

  /** An effect going off, a state laid on a unit. (A chain is told by its lines: no count closes it.) */
  private effect(p: Party, e: GEvent, src: Unit | undefined, n: (id?: string, tail?: string) => string): void {
    const text = e.text ?? '', state = STATE[text];
    if (text === 'shrine') this.add(e.t, '성소의 축복을 받았다.', 'good');
    else if (text === 'soul') this.add(e.t, `${n(e.dst, '에게')} 영혼이 깃들었다.`, 'good');
    else if (text === 'print') this.add(e.t, '복제 포드가 새 몸을 출력했다.', 'good');
    else if (text === 'claim') this.add(e.t, '진지를 부수고 영역을 확보했다.', 'good');
    else if (state && e.dst) this.add(e.t, `${n(e.dst, state[0])} ${m(`st-${text}`, state[1])}.`);
    else if (text === '운석 낙하') this.add(e.t, `${m('fx', '운석')}이 ${n(e.dst)} 위로 떨어졌다.`, 'good');
    else if (text === '해골 자폭') this.add(e.t, `${m('sum', '해골')}이 적에게 달려들어 ${m('fx', '터졌다')}.`, 'good');
    else if (text !== 'chain' && KOREAN.test(text) && src?.side === 'hero') {
      // a card, an innate, an ultimate, a gear effect going off: said every time, with what it does the first time this clone sets it off
      const who = src.summoner ? unitOf(p, src.summoner) ?? src : src, key = `${who.id}:${text}`, first = !this.told.has(key);
      this.told.add(key);
      const what = first ? effectLine(text, who) : text, note = what.includes('→') ? ` ${m('note', `(${what.slice(what.indexOf('→') + 1).trim()})`)}` : '';
      this.add(e.t, `${n(who.id, '의')} ${m('fx', text)}${particle(text, '이/가')} 발동했다.${note}`, 'good');
    }
  }

  private row(l: LogLine, opacity = 1): string { return `<div class="wl-line ${l.tone}"${opacity < 1 ? ` style="opacity:${opacity}"` : ''}><b>${clock(l.at)}</b> ${l.html}</div>`; }
  /** the latest lines, the older ones dimmer (the corner panel) */
  html(): string { return this.lines.slice(-12).map((l, i, all) => this.row(l, 0.45 + (0.55 * (i + 1)) / all.length)).join(''); }
  /** every line kept, oldest first (the full log window) */
  fullHtml(): string { return this.lines.map((l) => this.row(l)).join(''); }
}

/** What a unit is called in the log: a clone by its class, a summon by what it is, a foe by its kind. */
function nameOf(u: Unit): string | undefined {
  if (u.summoner) return u.golem ? '골렘' : u.mirror ? '분신' : '해골';
  return u.cls ? CLASSES[u.cls].name : u.foe ? FOE_NAME[u.foe] : undefined;
}
