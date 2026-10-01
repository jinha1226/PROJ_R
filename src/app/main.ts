import '../ui/styles/main.css';
import '../ui/styles/screens.css';
import '../ui/styles/hud.css';
import { setupFromPresets } from '../sim/battle/setup';
import { BattleScreen } from '../ui/screens/battleScreen';
import { SandboxScreen, type SandboxChoice } from '../ui/screens/sandboxScreen';
import { getAssets } from './assetCache';
import { showFatal } from './fatal';
import { Router } from './router';
import { CompanyFlow } from './companyFlow';

const root = document.getElementById('app')!;
const router = new Router(root);
const params = new URLSearchParams(location.search);
let choice: SandboxChoice = { ally: 'solo', enemy: 'tutorial', seed: Number(params.get('seed')) || 1 };

function sandbox(): void {
  router.go(new SandboxScreen(choice, (c) => { choice = c; void battle(); }, (seed) => new CompanyFlow(router, root, sandbox, seed).hub()));
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

sandbox();
