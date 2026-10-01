/** Runs one frame; on an exception reports it and returns false so the caller stops looping. */
export function guardFrame(frame: () => void, onError: (e: unknown) => void): boolean {
  try {
    frame();
    return true;
  } catch (e) {
    onError(e);
    return false;
  }
}
