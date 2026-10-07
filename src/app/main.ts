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
import { Expedition } from './expedition';
import '../ui/styles/pipTheme.css';
import { UalLibrary } from '../view/grid/ualActor';
import { setWeaponKit, WeaponKit } from '../view/grid/weaponKit';
import { DungeonKit } from '../view/grid/dungeonKit';
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

/** The game's title: the colony ship's boot log, then the world map (`?dungeon=1`: the earlier dungeon game; `?legacy=1`: the old prototype menu). */
function title(): void {
  if (params.get('legacy') === '1') return legacyTitle();
  if (params.get('dungeon') === '1') return dungeonTitle();
  router.go(new BootTitle({
    assets: GRID_ASSETS,
    lines: [['이주선 R-7 비상 전원', '가동'], ['복제 포드', '정상'], ['영혼 슬롯', '비어 있음']],
    startLabel: '깨어나기',
    hasRun: () => false,
    start: () => void new Expedition(router, root, title, gridSeed()).start(),
    resume: () => undefined,
  }));
}

/** The earlier grid dungeon game (kept reachable while the world map grows). */
function dungeonTitle(): void {
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

/** `?demo=chains`: a chain-built party fights a packed room by itself; when it is over, a new room is staged. */
async function chainsDemo(): Promise<void> {
  try {
    const [{ DelveScreen }, { chainArena, arenaOver }, lib, kit, weapons] = await Promise.all([import('../ui/delve/delveScreen'), import('../ui/delve/chainArena'), UalLibrary.load(import.meta.env.BASE_URL), DungeonKit.load(import.meta.env.BASE_URL), WeaponKit.load(import.meta.env.BASE_URL)]);
    setWeaponKit(weapons);
    let seed = urlSeed || 7;
    const stage = (): void => {
      const party = chainArena(seed++);
      router.go(new DelveScreen(lib, kit, { party, auto: true, stepped: true, restart: stage, quit: stage }));
      let overFor = 0;
      const watch = setInterval(() => { overFor = arenaOver(party) ? overFor + 1 : 0; if (overFor >= 3) { clearInterval(watch); stage(); } }, 1000);
    };
    stage();
  } catch (e) {
    showFatal(root, e);
  }
}

/** `?demo=looks`: every class side by side, for looking the figures over. */
async function looksDemo(): Promise<void> {
  try {
    const [{ mountLooksDemo }, lib, weapons] = await Promise.all([import('../ui/party/looksDemo'), UalLibrary.load(import.meta.env.BASE_URL), WeaponKit.load(import.meta.env.BASE_URL)]);
    setWeaponKit(weapons);
    mountLooksDemo(root, lib, import.meta.env.BASE_URL);
  } catch (e) {
    showFatal(root, e);
  }
}

if (params.get('demo') === 'looks') void looksDemo();
else if (params.get('demo') === 'chains') void chainsDemo();
else if (params.get('screen') === 'sandbox') sandbox();
else title();
