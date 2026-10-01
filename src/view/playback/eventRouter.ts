import { getSkill } from '../../data/skills';
import type { BattleEvent } from '../../sim/battle/types';
import type { Actor } from '../actors/actor';
import type { TransientFx } from '../fx/transientFx';
import type { DamageNumbers, NumberKind } from '../overlay/damageNumbers';

export interface RouterDeps {
  actors: Map<string, Actor>;
  fx: TransientFx;
  numbers: DamageNumbers;
  /** current world position of a unit (x, z) */
  posOf(id: string): { x: number; z: number; facing: number } | undefined;
  /** world → screen in CSS px */
  toScreen(x: number, y: number, z: number): { left: number; top: number };
  teamOf(id: string): 'ally' | 'enemy' | undefined;
  shake(sec: number): void;
  onSummon(id: string): void;
  onBerserk(mult: number): void;
  log(e: BattleEvent): void;
}

const MELEE_MAX_RANGE = 2.6;

export class EventRouter {
  private dodgeFlip = false;

  constructor(private readonly d: RouterDeps) {}

  private number(id: string | undefined, text: string, kind: NumberKind): void {
    const p = id ? this.d.posOf(id) : undefined;
    if (!p) return;
    const s = this.d.toScreen(p.x, 1.6, p.z);
    this.d.numbers.show(text, kind, s.left, s.top);
  }

  handle(e: BattleEvent): void {
    const d = this.d;
    const src = e.src ? d.actors.get(e.src) : undefined;
    const dst = e.dst ? d.actors.get(e.dst) : undefined;
    switch (e.type) {
      case 'action_start':
        if (src && e.skillId) src.play(getSkill(e.skillId).anim, { once: true });
        break;
      case 'damage': {
        if (e.skillId && e.skillId !== 'burn' && e.skillId !== 'bleed') {
          const skill = getSkill(e.skillId);
          const p = e.dst ? d.posOf(e.dst) : undefined;
          const sp = e.src ? d.posOf(e.src) : undefined;
          if (p && sp && skill.range <= MELEE_MAX_RANGE && !skill.projectile) d.fx.slash(p.x, p.z, sp.facing);
        }
        if (dst && !dst.isBusy && !dst.isDown) dst.play('hit', { once: true, fade: 0.05 });
        dst?.flash(0xffffff, 120);
        const kind: NumberKind = e.crit ? 'crit' : d.teamOf(e.dst ?? '') === 'ally' ? 'ally-hurt' : 'dmg';
        this.number(e.dst, `${e.amount}${e.crit ? '!' : ''}`, kind);
        break;
      }
      case 'miss':
        this.dodgeFlip = !this.dodgeFlip;
        if (dst && !dst.isDown) dst.play(this.dodgeFlip ? 'dodgeL' : 'dodgeR', { once: true, fade: 0.05 });
        this.number(e.dst, 'MISS', 'miss');
        break;
      case 'dodge_roll':
        src?.play('dodgeB', { once: true, fade: 0.05 });
        break;
      case 'heal': {
        const p = e.dst ? d.posOf(e.dst) : undefined;
        if (p) d.fx.glow(p.x, p.z, '#8cff9a');
        this.number(e.dst, `+${e.amount}`, 'heal');
        break;
      }
      case 'combo': {
        const p = e.dst ? d.posOf(e.dst) : undefined;
        if (p) d.fx.burst(p.x, p.z, '#ffe23a', 1.0, 0.5);
        dst?.flash(0xffd040, 260);
        this.number(e.dst, '연계!', 'combo');
        break;
      }
      case 'telegraph_fire':
        if (e.pos) d.fx.burst(e.pos.x, e.pos.y, '#ffb070', 1.2, 0.35);
        d.shake(0.12);
        break;
      case 'downed':
        dst?.setDowned(true);
        break;
      case 'rescued':
        dst?.setDowned(false);
        if (dst) {
          const p = e.dst ? d.posOf(e.dst) : undefined;
          if (p) d.fx.burst(p.x, p.z, '#8cd8ff', 1.0, 0.6);
        }
        break;
      case 'died':
        dst?.setDead();
        break;
      case 'phase':
        d.shake(0.35);
        break;
      case 'berserk':
        d.onBerserk(Number(e.data?.mult ?? 1.5));
        break;
      case 'summon':
        if (e.dst) d.onSummon(e.dst);
        break;
      default:
        break;
    }
    d.log(e);
  }
}
