import { afterEach, expect, it, vi } from 'vitest';
import { GridResult } from '../../src/ui/grid/gridResult';
afterEach(() => vi.unstubAllGlobals());
it('renders returned as a safe result labelled 귀환 without a death recap', () => {
  const el = { className: '', dataset: {}, innerHTML: '', addEventListener: () => {} };
  vi.stubGlobal('document', { createElement: () => el });
  const result = new GridResult({ won: false, returned: true, floor: 5, kills: 1, level: 2, turns: 10, best: 5, wins: 0, again: () => {}, quit: () => {} });
  result.mount({ appendChild: () => {} } as unknown as HTMLElement);
  expect(el.innerHTML).toContain('<h2 class="ok">귀환</h2>'); expect(el.innerHTML).not.toContain('쓰러졌다');
});
