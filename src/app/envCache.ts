import type { Theme } from '../sim/run/types';
import { EnvLibrary } from '../view/explore/envAssets';

const cache = new Map<Theme, Promise<EnvLibrary>>();

export function getEnv(theme: Theme): Promise<EnvLibrary> {
  let p = cache.get(theme);
  if (!p) {
    p = EnvLibrary.load(import.meta.env.BASE_URL, theme).catch((e: unknown) => { cache.delete(theme); throw e; });
    cache.set(theme, p);
  }
  return p;
}
