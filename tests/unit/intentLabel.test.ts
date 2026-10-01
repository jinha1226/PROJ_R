import { describe, it, expect } from 'vitest';
import { intentLabel } from '../../src/view/overlay/intentLabel';

const names = (id: string) => ({ e1: '해골 졸개', a1: '오웬' })[id] ?? id;

describe('intent label', () => {
  it('describes each intent briefly with its target', () => {
    expect(intentLabel({ kind: 'attack', targetId: 'e1', reason: 'attack' }, names)).toEqual({ icon: 'intent:attack', text: '공격 → 해골 졸개' });
    expect(intentLabel({ kind: 'skill', skillId: 'fireball', targetId: 'e1', reason: 'skill' }, names)?.text).toBe('화염구 → 해골 졸개');
    expect(intentLabel({ kind: 'approach', targetId: 'e1', reason: 'approach' }, names)?.text).toBe('접근 → 해골 졸개');
    expect(intentLabel({ kind: 'rescue', targetId: 'a1', reason: 'rescue' }, names)?.text).toBe('구출 → 오웬');
    expect(intentLabel({ kind: 'kite', reason: 'kite' }, names)?.text).toBe('거리 벌림');
    expect(intentLabel({ kind: 'dodge', reason: 'dodge' }, names)).toEqual({ icon: 'intent:dodge', text: '회피' });
  });
  it('pair combos use the link icon', () => {
    expect(intentLabel({ kind: 'skill', skillId: 'fireball', targetId: 'e1', reason: 'comboPair' }, names)?.icon).toBe('relation:combo');
  });
  it('idle and missing intents show nothing', () => {
    expect(intentLabel({ kind: 'idle', reason: 'idle' }, names)).toBeNull();
    expect(intentLabel(null, names)).toBeNull();
  });
});
