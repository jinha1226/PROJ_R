import { afterEach, expect, it, vi } from 'vitest';
import { ShipDeck, type ShipDeckApi } from '../../src/ui/grid/ship/shipDeck';
import { freshMeta } from '../../src/sim/grid/meta';
import type { RunOptions } from '../../src/sim/grid/runSetup';
// Minimal DOM surface used by the ship panel; exercise real button callbacks across decks.
class Node {
  dataset: Record<string, string> = {};
  children: Node[] = [];
  onclick?: () => void;
  append(...children: Node[]) { this.children.push(...children); }
  replaceChildren() { this.children = []; }
  setAttribute() {}
  querySelector() { return new Node(); }
}
afterEach(() => vi.unstubAllGlobals());
it('remembers a selected round across ship decks without applying other unlocked rounds', () => {
  vi.stubGlobal('document', { createElement: () => new Node() });
  const meta = freshMeta(); meta.rounds = ['fire', 'shock'];
  let launched: RunOptions | undefined;
  const api = { meta, lastEnergy: 0, wake: false, saved: false, launch: (o: RunOptions) => { launched = o; } } as ShipDeckApi;
  const click = (deck: ShipDeck, id: string) => {
    const find = (n: Node): Node | undefined => n.dataset.testid === id ? n : n.children.map(find).find(Boolean);
    const button = find(deck.el as unknown as Node); expect(button).toBeDefined(); button!.onclick!();
  };
  const first = new ShipDeck(api); first.event({ t: 0, type: 'station', text: 'armory' });
  click(first, 'ship-choice-fire');
  const second = new ShipDeck(api); second.event({ t: 0, type: 'station', text: 'hatch' }); click(second, 'ship-launch');
  expect(launched?.round).toBe('fire');
  meta.rounds = ['shock'];
  const third = new ShipDeck(api); third.event({ t: 0, type: 'station', text: 'hatch' }); click(third, 'ship-launch');
  expect(launched?.round).toBe('plain');
});
