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
import { SKILLS } from '../sim/party/skills';

const root = document.getElementById('app')!;
const router = new Router(root);
const params = new URLSearchParams(location.search);
// the pixel phosphor terminal look is the default (?ui=classic shows the older teal terminal)
if (params.get('ui') !== 'classic') document.documentElement.classList.add('ui-pip');
const urlSeed = Number(params.get('seed')) || 0;
// ?skill: a build of skills in place of the level-up cards (to try beside them)
if (params.has('skill')) SKILLS.on = true;

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

/** `?demo=branch`: a menu of class branches; `&b=<branch>` stages that branch's build against a horde, turn by turn. */
async function branchDemo(): Promise<void> {
  try {
    const { branchArena, branchMenuHtml } = await import('../ui/delve/branchArena');
    const key = params.get('b');
    if (!key) { root.innerHTML = branchMenuHtml(); return; }
    const [{ DelveScreen }, { arenaOver }, lib, kit, weapons] = await Promise.all([import('../ui/delve/delveScreen'), import('../ui/delve/chainArena'), UalLibrary.load(import.meta.env.BASE_URL), DungeonKit.load(import.meta.env.BASE_URL), WeaponKit.load(import.meta.env.BASE_URL)]);
    setWeaponKit(weapons);
    let seed = urlSeed || 7;
    const stage = (): void => {
      const hand = params.has('hand'), party = branchArena(seed++, key, hand, !hand || params.has('horde'));
      router.go(new DelveScreen(lib, kit, { party, auto: !hand, stepped: !hand, restart: stage, quit: () => { location.search = `?demo=branch${['hand', 'horde', 'hd', 'dark', 'dpad'].filter((k) => params.has(k)).map((k) => `&${k}`).join('')}`; } }));
      if (hand) return;
      let overFor = 0;
      const watch = setInterval(() => { overFor = arenaOver(party) ? overFor + 1 : 0; if (overFor >= 3) { clearInterval(watch); stage(); } }, 1000);
    };
    stage();
  } catch (e) {
    showFatal(root, e);
  }
}

/** `?demo=brain` (`&c=<class>`): a lone clone goes down by itself, run after run, under switches for what it knows how to do (see brainDemo.ts). */
async function brainDemo(): Promise<void> {
  try {
    const [{ DelveScreen }, { runBrainDemo }, lib, kit, weapons] = await Promise.all([import('../ui/delve/delveScreen'), import('../ui/demo/brainDemo'), UalLibrary.load(import.meta.env.BASE_URL), DungeonKit.load(import.meta.env.BASE_URL), WeaponKit.load(import.meta.env.BASE_URL)]);
    setWeaponKit(weapons);
    const cls = (['warrior', 'archer', 'mage', 'cleric', 'rogue', 'necromancer'] as const).find((c) => c === params.get('c')) ?? 'archer';
    runBrainDemo(cls, urlSeed || 3, (party) => { const screen = new DelveScreen(lib, kit, { party, quit: title }); router.go(screen); return screen.drive; });
  } catch (e) {
    showFatal(root, e);
  }
}

/** `?demo=swarm` (`&c=<class>`): the dungeon walked by hand with blows that land by themselves, big bands and a floor that closes in (see swarmDemo.ts). */
async function swarmDemo(): Promise<void> {
  try {
    const [{ DelveScreen }, { runSwarmDemo }, lib, kit, weapons] = await Promise.all([import('../ui/delve/delveScreen'), import('../ui/demo/swarmDemo'), UalLibrary.load(import.meta.env.BASE_URL), DungeonKit.load(import.meta.env.BASE_URL), WeaponKit.load(import.meta.env.BASE_URL)]);
    setWeaponKit(weapons);
    const cls = (['warrior', 'archer', 'mage', 'cleric', 'rogue', 'necromancer'] as const).find((c) => c === params.get('c')) ?? 'warrior';
    runSwarmDemo(cls, urlSeed || 3, (party) => { const screen = new DelveScreen(lib, kit, { party, auto: true, quit: title }); router.go(screen); return screen.drive; });
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

/** `?demo=raid`: the besieged base with three clones, the siege some waves in (see raidDemo.ts). */
async function raidDemo(): Promise<void> {
  try {
    const [{ WorldScreen }, { raidArena }, { NatureKit }, lib, kit, weapons] = await Promise.all([import('../ui/overworld/worldScreen'), import('../ui/demo/raidDemo'), import('../view/overworld/natureKit'), UalLibrary.load(import.meta.env.BASE_URL), DungeonKit.load(import.meta.env.BASE_URL), WeaponKit.load(import.meta.env.BASE_URL)]);
    setWeaponKit(weapons);
    const nature = await NatureKit.load(import.meta.env.BASE_URL).catch(() => undefined);
    const stage = (): void => router.go(new WorldScreen(lib, kit, { party: raidArena(urlSeed || 42, params.has('n') ? Number(params.get('n')) : 12), nature, restart: stage }));
    stage();
  } catch (e) {
    showFatal(root, e);
  }
}

if (params.get('demo') === 'looks') void looksDemo();
else if (params.get('demo') === 'chains') void chainsDemo();
else if (params.get('demo') === 'deep') void deepDemo();
else if (params.get('demo') === 'brain') void brainDemo();
else if (params.get('demo') === 'swarm') void swarmDemo();
else if (params.get('demo') === 'branch') void branchDemo();
else if (params.get('demo') === 'tune') void Promise.all([import('../ui/demo/tuneDemo'), UalLibrary.load(import.meta.env.BASE_URL), WeaponKit.load(import.meta.env.BASE_URL)]).then(([{ mountTuneDemo }, lib, weapons]) => { setWeaponKit(weapons); mountTuneDemo(root, lib); }).catch((e) => showFatal(root, e));
else if (params.get('demo') === 'raid') void raidDemo();
else title();
