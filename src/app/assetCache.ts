import { loadAssets, type AssetLibrary } from '../view/actors/assets';

let pending: Promise<AssetLibrary> | null = null;

/** Loads the shared asset library once; a failed load can be retried. */
export function getAssets(onProgress?: (p: number) => void): Promise<AssetLibrary> {
  if (!pending) {
    pending = loadAssets(import.meta.env.BASE_URL, onProgress).catch((e: unknown) => {
      pending = null;
      throw e;
    });
  }
  return pending;
}
