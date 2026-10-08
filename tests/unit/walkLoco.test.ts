import { expect, it } from 'vitest';
import { gait } from '../../src/view/grid/ualActor';

it('on the base ground clones walk (the whole walk, arms too) instead of jogging under a held stance', () => {
  expect(gait({}, false)).toEqual({ clip: 'Jog_Fwd_Loop', whole: false });
  expect(gait({ fullRun: true }, false).whole).toBe(true);
  const w = gait({}, true);
  expect(w.clip).toBe('Walk_Loop'); expect(w.whole).toBe(true);
});
