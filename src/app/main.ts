import '../ui/styles/main.css';
import '../ui/styles/screens.css';
import '../ui/styles/hud.css';
import { setupFromPresets } from '../sim/battle/setup';
import { BattleScreen } from '../ui/screens/battleScreen';
import { SandboxScreen, type SandboxChoice } from '../ui/screens/sandboxScreen';
import { TitleScreen } from '../ui/run/titleScreen';
import { HallScreen } from '../ui/run/endScreens';
import { getAssets } from './assetCache';
import { CompanyFlow } from './companyFlow';
import { showFatal } from './fatal';
import { Router } from './router';
import { WeekFlow } from './weekFlow';
import { ExtractFlow } from './extractFlow';
import { GridFlow } from './gridFlow';
import '../ui/styles/pipTheme.css';
import { UalLibrary } from '../view/grid/ualActor';
import { DungeonKit } from '../view/grid/dungeonKit';
import { setWeaponKit, WeaponKit } from '../view/grid/weaponKit';
import { clearRun, loadHall, loadRun } from './save';
import { BootTitle } from '../ui/grid/bootTitle';
import { GRID_ASSETS } from './gridAssets';
import { loadRun as loadGridRun } from './gridRun';

const root = document.getElementById('app')!;
const router = new Router(root);
const params = new URLSearchParams(location.search);
// the pixel phosphor terminal look is the default (?ui=classic shows the older teal terminal)
if (params.get('ui') !== 'classic') document.documentElement.classList.add('ui-pip');
const urlSeed = Number(params.get('seed')) || 0;
let choice: SandboxChoice = { ally: 'solo', enemy: 'tutorial', seed: urlSeed || 1 };

const gridSeed = (): number => urlSeed || Math.floor(Math.random() * 99999) + 1;

/** The game's title: the ship's boot log (`?legacy=1` shows the old prototype menu). */
function title(): void {
  if (params.get('legacy') === '1') return legacyTitle();
  router.go(new BootTitle({
    assets: GRID_ASSETS,
    hasRun: () => loadGridRun() !== null,
    start: () => new GridFlow(router, root, title).start(gridSeed()),
    resume: () => new GridFlow(router, root, title).continue(),
  }));
}

function legacyTitle(): void {
  router.go(new TitleScreen({
    hasSave: () => loadRun() !== null,
    newRun: (seed) => new WeekFlow(router, root, title).start(seed),
    continueRun: () => {
      const r = loadRun();
      if (!r) return legacyTitle();
      try {
        new WeekFlow(router, root, title).resume(r);
      } catch (e) {
        console.error('broken save discarded', e);
        clearRun();
        legacyTitle();
      }
    },
    hall: () => router.go(new HallScreen(loadHall(), title)),
    sandbox,
    extract: () => new ExtractFlow(router, root, title).start(urlSeed || Math.floor(Math.random() * 99999) + 1),
    grid: () => new GridFlow(router, root, title).start(urlSeed || Math.floor(Math.random() * 99999) + 1),
  }, urlSeed || Math.floor(Math.random() * 99999) + 1));
}

function sandbox(): void {
  router.go(new SandboxScreen(choice, (c) => { choice = c; void battle(); }, (seed) => new CompanyFlow(router, root, sandbox, seed).hub(), title));
}

async function battle(): Promise<void> {
  try {
    const lib = await getAssets();
    router.go(new BattleScreen(setupFromPresets(choice.seed, choice.ally, choice.enemy), lib, {
      retry: () => void battle(),
      back: sandbox,
      fatal: (e) => showFatal(root, e),
    }));
  } catch (e) {
    showFatal(root, e);
  }
}

/** `?demo=kata`: the scripted gun-kata look in the game view. */
async function kataDemo(): Promise<void> {
  try {
    const [{ KataDemo }, lib, kit, weapons] = await Promise.all([import('../ui/grid/kataDemo'), UalLibrary.load(import.meta.env.BASE_URL), DungeonKit.load(import.meta.env.BASE_URL), WeaponKit.load(import.meta.env.BASE_URL)]);
    setWeaponKit(weapons);
    router.go(new KataDemo(lib, kit));
  } catch (e) {
    showFatal(root, e);
  }
}

/** `?demo=workbench`: the workbench screen on sample data. */
async function workbenchDemo(): Promise<void> {
  const [{ WorkbenchScreen }, { MockBench }] = await Promise.all([import('../ui/grid/ship/workbenchScreen'), import('../ui/grid/ship/workbenchMock')]);
  await import('../ui/styles/grid.css');
  await import('../ui/styles/gridSf.css');
  const bench = new MockBench();
  const host = document.createElement('div');
  host.className = 'screen grid';
  root.replaceChildren(host);
  const screen = new WorkbenchScreen({ model: () => bench.model(), craft: (id) => bench.craft(id), fit: (slot, id) => bench.fit(slot, id), close: () => screen.render() });
  host.appendChild(screen.el);
}

/** `?demo=chain`: the longest chain the engravings make, looping (for a look, or a recording with `&clean=1`). */
async function chainDemo(): Promise<void> {
  try {
    const [{ ChainShowcase }, lib, kit, weapons] = await Promise.all([import('../ui/grid/chainShowcase'), UalLibrary.load(import.meta.env.BASE_URL), DungeonKit.load(import.meta.env.BASE_URL), WeaponKit.load(import.meta.env.BASE_URL)]);
    setWeaponKit(weapons);
    router.go(new ChainShowcase(lib, kit));
  } catch (e) {
    showFatal(root, e);
  }
}

if (params.get('demo') === 'kata') void kataDemo();
else if (params.get('demo') === 'chain') void chainDemo();
else if (params.get('demo') === 'workbench') void workbenchDemo();
else if (params.get('screen') === 'sandbox') sandbox();
else title();
