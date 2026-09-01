import type { JsonValue } from "../../../packages/spec/src/json.ts";

export interface CacheValue<T> {
  readonly value: T;
  /** Estimated retained bytes. Budgets are deliberately soft. */
  readonly bytes: number;
  readonly dispose?: (value: T) => void;
}

export interface ResourceLease<T> {
  readonly key: string;
  readonly value: T;
  /** Idempotent. The entry becomes evictable after its final lease releases. */
  release(): void;
}

interface CacheEntry<T> extends CacheValue<T> {
  leases: number;
  lastUsed: number;
}

interface PendingEntry<T> {
  promise: Promise<CacheEntry<T>>;
}

/**
 * Page-wide content cache. Entries are content-addressed by callers, retained
 * by leases while visible, and evicted least-recently-used only when unleased.
 * A budget is a soft target: visible resources are allowed to exceed it.
 */
export class RuntimeResourceCache {
  private configuredBudgetBytes: number;
  private readonly entries = new Map<string, CacheEntry<unknown>>();
  private readonly pending = new Map<string, PendingEntry<unknown>>();
  private clock = 0;
  private retainedBytes = 0;

  constructor(options: { budgetBytes: number }) {
    if (!Number.isFinite(options.budgetBytes) || options.budgetBytes < 0) {
      throw new Error("cairn-plot: cache budget must be a finite non-negative number");
    }
    this.configuredBudgetBytes = options.budgetBytes;
  }

  get budgetBytes(): number {
    return this.configuredBudgetBytes;
  }

  /** Change the soft retention target and immediately trim unleased entries. */
  setBudgetBytes(budgetBytes: number): void {
    if (!Number.isFinite(budgetBytes) || budgetBytes < 0) {
      throw new Error("cairn-plot: cache budget must be a finite non-negative number");
    }
    this.configuredBudgetBytes = budgetBytes;
    this.evictToBudget();
  }

  get bytes(): number {
    return this.retainedBytes;
  }

  get size(): number {
    return this.entries.size;
  }

  has(key: string): boolean {
    return this.entries.has(key);
  }

  /** Inspect a prepared value without pinning it. Prefer `acquire` for display. */
  peek<T>(key: string): T | undefined {
    const entry = this.entries.get(key) as CacheEntry<T> | undefined;
    if (!entry) return undefined;
    entry.lastUsed = ++this.clock;
    return entry.value;
  }

  acquire<T>(key: string): ResourceLease<T> | undefined {
    const entry = this.entries.get(key) as CacheEntry<T> | undefined;
    if (!entry) return undefined;
    return this.lease(key, entry);
  }

  /**
   * Resolve a key once. Concurrent foreground and preload callers share work;
   * each successful caller receives its own lease. Failed work is not cached,
   * so a later foreground selection retries naturally.
   */
  async getOrCreate<T>(
    key: string,
    load: () => Promise<CacheValue<T>>,
  ): Promise<ResourceLease<T>> {
    const hit = this.acquire<T>(key);
    if (hit) return hit;

    let pending = this.pending.get(key) as PendingEntry<T> | undefined;
    if (!pending) {
      const promise = load().then((loaded) => {
        const bytes = normalizedBytes(loaded.bytes);
        const entry: CacheEntry<T> = {
          ...loaded,
          bytes,
          leases: 0,
          lastUsed: ++this.clock,
        };
        this.entries.set(key, entry as CacheEntry<unknown>);
        this.retainedBytes += bytes;
        this.pending.delete(key);
        return entry;
      }, (error) => {
        this.pending.delete(key);
        throw error;
      });
      pending = { promise };
      this.pending.set(key, pending as PendingEntry<unknown>);
    }

    const entry = await pending.promise;
    const lease = this.lease(key, entry);
    this.evictToBudget();
    return lease;
  }

  /** Remove every unleased entry. Leased entries survive and may exceed budget. */
  clear(): void {
    for (const [key, entry] of this.entries) {
      if (entry.leases === 0) this.remove(key, entry);
    }
  }

  private lease<T>(key: string, entry: CacheEntry<T>): ResourceLease<T> {
    entry.leases++;
    entry.lastUsed = ++this.clock;
    let released = false;
    return {
      key,
      value: entry.value,
      release: () => {
        if (released) return;
        released = true;
        entry.leases--;
        entry.lastUsed = ++this.clock;
        this.evictToBudget();
      },
    };
  }

  private evictToBudget(): void {
    while (this.retainedBytes > this.configuredBudgetBytes) {
      let victimKey: string | undefined;
      let victim: CacheEntry<unknown> | undefined;
      for (const [key, entry] of this.entries) {
        if (entry.leases > 0) continue;
        if (!victim || entry.lastUsed < victim.lastUsed) {
          victimKey = key;
          victim = entry;
        }
      }
      if (!victim || victimKey === undefined) return;
      this.remove(victimKey, victim);
    }
  }

  private remove(key: string, entry: CacheEntry<unknown>): void {
    if (!this.entries.delete(key)) return;
    this.retainedBytes -= entry.bytes;
    entry.dispose?.(entry.value);
  }
}

function normalizedBytes(bytes: number): number {
  if (!Number.isFinite(bytes) || bytes < 0) {
    throw new Error("cairn-plot: cached resource size must be finite and non-negative");
  }
  return bytes;
}

export const DEFAULT_RUNTIME_CACHE_BYTES = 512 * 1024 * 1024;

/** The default cache shared by every plot mounted from this module graph. */
export const globalResourceCache = new RuntimeResourceCache({
  budgetBytes: DEFAULT_RUNTIME_CACHE_BYTES,
});

/** Configure the page-wide decoded/prepared resource retention target.
 * Hosts that provide long iteration sequences may opt into a larger budget.
 * The target remains soft: visible leased resources are never evicted. */
export function setRuntimeCacheBudget(budgetBytes: number): void {
  globalResourceCache.setBudgetBytes(budgetBytes);
}

export interface DerivedCacheKey {
  readonly comparison: string;
  readonly version: string;
  readonly operands: readonly string[];
  readonly settings?: Readonly<Record<string, JsonValue>>;
}

/** Stable across cells and independent of object insertion order. */
export function derivedCacheKey(key: DerivedCacheKey): string {
  return `derived:${canonicalJson({
    comparison: key.comparison,
    version: key.version,
    operands: [...key.operands],
    settings: key.settings ?? {},
  })}`;
}

function canonicalJson(value: JsonValue): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${canonicalJson(value[key]!)}`
    ).join(",")}}`;
  }
  return JSON.stringify(value);
}
