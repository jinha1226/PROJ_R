import { describe, it, expect } from 'vitest';
import { ICONS, iconSvg, type IconKey } from '../../src/view/overlay/icons';

const TAGS = ['marked', 'knockdown', 'wet', 'stun', 'burn', 'bleed', 'slow', 'shield', 'taunted'];
const INTENTS = ['attack', 'skill', 'approach', 'kite', 'dodge', 'rescue', 'guard', 'retreat', 'idle', 'protect', 'flee'];
const EMOTIONS = ['rage', 'fear', 'elation', 'revenge', 'resolve', 'courage'];
const TRIGGERS = ['protect', 'rivalry', 'revenge', 'courage', 'combo', 'feud', 'mentor'];

describe('icons', () => {
  it('covers every tag, intent, emotion, and relation trigger', () => {
    const keys = [...TAGS, ...INTENTS.map((k) => `intent:${k}`), ...EMOTIONS.map((k) => `emotion:${k}`), ...TRIGGERS.map((k) => `relation:${k}`)];
    for (const k of keys) {
      expect(ICONS[k as IconKey], k).toBeDefined();
      expect(ICONS[k as IconKey].label, k).toBeTruthy();
    }
  });
  it('renders an svg string', () => {
    expect(iconSvg('burn')).toMatch(/^<svg/);
    expect(iconSvg('intent:attack', 20)).toContain('width="20"');
  });
});
