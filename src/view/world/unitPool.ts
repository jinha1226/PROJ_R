/** How the pool builds, keys, shows and hides actors (injected so the pool stays testable without three.js). */
export interface PoolOps<S, A> {
  keyOf(setup: S): string;
  create(setup: S): A;
  show(a: A, setup: S): void;
  hide(a: A): void;
}

/** Actors only for units near the hero; released actors are kept per kind and reused. */
export class UnitPool<S extends { id: string }, A> {
  private readonly inUse = new Map<string, { a: A; key: string }>();
  private readonly spare = new Map<string, A[]>();

  constructor(private readonly ops: PoolOps<S, A>) {}

  get(id: string): A | undefined {
    return this.inUse.get(id)?.a;
  }

  live(): Map<string, A> {
    return new Map([...this.inUse].map(([id, v]) => [id, v.a]));
  }

  /** Makes the live set match `visible`: acquire for newcomers, release for leavers. */
  sync(visible: S[]): { added: string[]; removed: string[] } {
    const want = new Set(visible.map((s) => s.id));
    const removed: string[] = [];
    for (const [id, v] of this.inUse) {
      if (want.has(id)) continue;
      this.ops.hide(v.a);
      const list = this.spare.get(v.key) ?? [];
      list.push(v.a);
      this.spare.set(v.key, list);
      this.inUse.delete(id);
      removed.push(id);
    }
    const added: string[] = [];
    for (const s of visible) {
      if (this.inUse.has(s.id)) continue;
      const key = this.ops.keyOf(s);
      const a = this.spare.get(key)?.pop() ?? this.ops.create(s);
      this.ops.show(a, s);
      this.inUse.set(s.id, { a, key });
      added.push(s.id);
    }
    return { added, removed };
  }

  /** Every actor ever built (live or spare), for disposal. */
  all(): A[] {
    return [...[...this.inUse.values()].map((v) => v.a), ...[...this.spare.values()].flat()];
  }
}
