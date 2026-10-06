import { expect, it } from 'vitest';
import { KITS } from '../../src/sim/party/classKit';
import { CATALOG } from '../../src/sim/delve/catalog';
import { TRIGGER_TEXT, triggerText } from '../../src/sim/party/triggerText';

const innateIds = [...new Set(Object.values(KITS).flatMap((k) => k.innate.map((d) => d.id)))];
const gearIds = [...new Set(Object.values(CATALOG).flatMap((i) => i.triggers.map((d) => d.id)))];

it.each([...innateIds, ...gearIds])('%s has a clean description', (id) => {
  const text = triggerText(id);
  expect(text).not.toBe('');
  expect(text).not.toMatch(/undefined|NaN|\{n\}/);
});

it('has no entry for an unknown trigger', () => {
  expect(triggerText('없는 발동')).toBe('');
  expect(Object.keys(TRIGGER_TEXT).filter((id) => !innateIds.includes(id) && !gearIds.includes(id))).toEqual([]);
});

it('spot checks use the real numbers', () => {
  expect(triggerText('방벽')).toBe('막기 → 2칸 안 아군 보호막 5');
  expect(triggerText('피의 마무리')).toBe('처치 → 다음 공격 피해 ×2 (출혈 중인 적)');
  expect(triggerText('구원의 손')).toBe('2칸 안 아군 위기 → 그 아군 치유 22 (대기 8턴)');
});
