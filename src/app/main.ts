import '../ui/styles/main.css';
import '../ui/styles/screens.css';
import '../ui/styles/hud.css';
import { showFatal } from './fatal';
import { Router } from './router';
import { Expedition } from './expedition';
import '../ui/styles/pipTheme.css';
import { UalLibrary } from '../view/grid/ualActor';
import { setWeaponKit, WeaponKit } from '../view/grid/weaponKit';
import { DungeonKit } from '../view/grid/dungeonKit';
import { BootTitle } from '../ui/grid/bootTitle';
import { GRID_ASSETS } from './gridAssets';

const root = document.getElementById('app')!;
const router = new Router(root);
const params = new URLSearchParams(location.search);
// the pixel phosphor terminal look is the default (?ui=classic shows the older teal terminal)
if (params.get('ui') !== 'classic') document.documentElement.classList.add('ui-pip');
const urlSeed = Number(params.get('seed')) || 0;

const gridSeed = (): number => urlSeed || Math.floor(Math.random() * 99999) + 1;

/** The game's title: the colony ship's boot log, then the expedition. */
function title(): void {
  router.go(new BootTitle({
    assets: GRID_ASSETS,
    lines: [['이주선 R-7 비상 전원', '가동'], ['복제 포드', '정상'], ['영혼 슬롯', '비어 있음']],
    startLabel: '깨어나기',
    hasRun: () => false,
    start: () => void new Expedition(router, root, title, gridSeed()).start(),
    resume: () => undefined,
  }));
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

/** `?demo=deep&floor=N`: a deep floor with a level-10 empty body fighting by itself, for checking how a horde runs on screen. */
async function deepDemo(): Promise<void> {
  try {
    const [{ DelveScreen }, { newDelve }, { gainXp, LEVEL_XP }, lib, kit, weapons] = await Promise.all([import('../ui/delve/delveScreen'), import('../sim/delve/delveSim'), import('../sim/party/partyLevel'), UalLibrary.load(import.meta.env.BASE_URL), DungeonKit.load(import.meta.env.BASE_URL), WeaponKit.load(import.meta.env.BASE_URL)]);
    setWeaponKit(weapons);
    const floor = Math.max(1, Math.min(15, Number(params.get('floor')) || 12));
    const party = newDelve(urlSeed || 3, floor), hero = party.units.find((u) => u.id === 'hero')!;
    gainXp(party, hero, LEVEL_XP[9]!, []); hero.picks = 0; hero.offer = undefined;
    router.go(new DelveScreen(lib, kit, { party, auto: true, quit: title }));
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
else if (params.get('demo') === 'deep') void deepDemo();
else title();
