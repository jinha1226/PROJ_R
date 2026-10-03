import { afterEach, expect, it, vi } from 'vitest';
import { UpgradePanel } from '../../src/ui/grid/upgradePanel';
import { UPGRADES } from '../../src/sim/grid/upgrades';

// Only the panel's DOM boundary is needed to exercise rendering and choice dispatch.
function panelDom() {
  let click: (e: { target: unknown }) => void = () => {};
  const el = {
    className: '', dataset: {} as Record<string, string>, innerHTML: '',
    addEventListener: (_type: string, handler: typeof click) => { click = handler; },
  };
  vi.stubGlobal('document', { createElement: () => el });
  return { el, click: (dataset: Record<string, string> | null) => click({ target: { closest: () => dataset && ({ dataset }) } }) };
}

afterEach(() => vi.unstubAllGlobals());

it('renders the Korean upgrade title, names, notes, card testids and skip', () => {
  const { el } = panelDom();
  new UpgradePanel(['charge', 'hp', 'evasion'], 3, vi.fn());
  expect(el.innerHTML).toContain('레벨 3! 슈트 강화');
  for (const [i, id] of (['charge', 'hp', 'evasion'] as const).entries()) {
    expect(el.innerHTML).toContain(UPGRADES[id].name);
    expect(el.innerHTML).toContain(UPGRADES[id].note);
    expect(el.innerHTML).toContain(`data-testid="grid-upgrade-${i}"`);
  }
  expect(el.innerHTML).toContain('data-testid="grid-upgrade-skip"');
  expect(el.innerHTML).toContain('넘기기');
});

it('dispatches upgrade choices and skipping, ignoring clicks outside buttons', () => {
  const { click } = panelDom();
  const act = vi.fn();
  new UpgradePanel(['charge', 'hp', 'evasion'], 2, act);
  click(null);
  expect(act).not.toHaveBeenCalled();
  click({ i: '1' });
  expect(act).toHaveBeenLastCalledWith({ kind: 'upgrade', i: 1 });
  click({ do: 'skip' });
  expect(act).toHaveBeenLastCalledWith({ kind: 'upgrade', i: null });
});
