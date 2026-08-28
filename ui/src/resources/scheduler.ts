export type PreparationPriority = "foreground" | "preload";

interface QueuedTask<T> {
  readonly key: string;
  priority: PreparationPriority;
  readonly order: number;
  readonly run: () => Promise<T>;
  readonly promise: Promise<T>;
  resolve(value: T): void;
  reject(error: unknown): void;
}

/**
 * Bounded, content-keyed preparation queue. Foreground work always starts
 * before queued preload work. Re-requesting a queued preload in the foreground
 * promotes the existing task instead of starting duplicate resolution.
 */
export class PreparationScheduler {
  readonly concurrency: number;
  private readonly queued = new Map<string, QueuedTask<unknown>>();
  private readonly running = new Map<string, Promise<unknown>>();
  private active = 0;
  private clock = 0;

  constructor(options: { concurrency: number }) {
    if (!Number.isInteger(options.concurrency) || options.concurrency < 1) {
      throw new Error("cairn-plot: preparation concurrency must be a positive integer");
    }
    this.concurrency = options.concurrency;
  }

  schedule<T>(
    key: string,
    priority: PreparationPriority,
    run: () => Promise<T>,
  ): Promise<T> {
    const inFlight = this.running.get(key);
    if (inFlight) return inFlight as Promise<T>;

    const existing = this.queued.get(key) as QueuedTask<T> | undefined;
    if (existing) {
      if (priority === "foreground") existing.priority = "foreground";
      this.drain();
      return existing.promise;
    }

    let resolve!: (value: T) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    this.queued.set(key, {
      key,
      priority,
      order: this.clock++,
      run,
      promise,
      resolve,
      reject,
    } as QueuedTask<unknown>);
    this.drain();
    return promise;
  }

  private drain(): void {
    while (this.active < this.concurrency && this.queued.size > 0) {
      const task = this.next();
      if (!task) return;
      this.queued.delete(task.key);
      this.active++;
      const running = Promise.resolve().then(task.run);
      this.running.set(task.key, running);
      void running.then(task.resolve, task.reject).finally(() => {
        this.running.delete(task.key);
        this.active--;
        this.drain();
      });
    }
  }

  private next(): QueuedTask<unknown> | undefined {
    let selected: QueuedTask<unknown> | undefined;
    for (const task of this.queued.values()) {
      if (!selected || rank(task.priority) > rank(selected.priority) ||
          (task.priority === selected.priority && task.order < selected.order)) {
        selected = task;
      }
    }
    return selected;
  }
}

function rank(priority: PreparationPriority): number {
  return priority === "foreground" ? 1 : 0;
}

export const globalPreparationScheduler = new PreparationScheduler({ concurrency: 4 });
