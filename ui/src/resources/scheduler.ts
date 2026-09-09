export type PreparationPriority = "foreground" | "preload";

/** Per-request hints. `visible` is the caller's live viewport answer (the lazy
 *  gate's intersection state); it breaks ties WITHIN a priority band so an
 *  on-screen pane is prepared before an equally-urgent off-screen one. */
export interface ScheduleOptions {
  readonly visible?: boolean;
}

interface QueuedTask<T> {
  readonly key: string;
  priority: PreparationPriority;
  visible: boolean;
  readonly order: number;
  readonly run: () => Promise<T>;
  readonly promise: Promise<T>;
  resolve(value: T): void;
  reject(error: unknown): void;
}

/**
 * How long a started task may hold its concurrency slot before the scheduler
 * assumes it will never settle (H1). A decode worker that dies without
 * replying, or an await on a promise nobody will resolve, used to pin one of
 * only four slots FOREVER — four such tasks froze every later resolve on the
 * page. On expiry the slot is reclaimed AND the task's promise is rejected, so
 * the caller sees a real failure: the resolution cache records it as an error
 * and its backoff retries the key instead of leaving the pane on "Loading…"
 * forever. The underlying `run()` promise cannot be cancelled and is simply
 * abandoned — if it settles later, that settle is ignored.
 */
export const TASK_WATCHDOG_MS = 60_000;

/** The queue order, as a pure comparator: priority band first, then visible
 *  work, then FIFO by arrival. Negative ⇒ `a` runs before `b`. */
export function comparePreparationTasks(
  a: { priority: PreparationPriority; visible?: boolean; order: number },
  b: { priority: PreparationPriority; visible?: boolean; order: number },
): number {
  const byPriority = rank(b.priority) - rank(a.priority);
  if (byPriority !== 0) return byPriority;
  const byVisible = (b.visible === true ? 1 : 0) - (a.visible === true ? 1 : 0);
  if (byVisible !== 0) return byVisible;
  return a.order - b.order;
}

/**
 * Bounded, content-keyed preparation queue. Foreground work always starts
 * before queued preload work. Re-requesting a queued preload in the foreground
 * promotes the existing task instead of starting duplicate resolution.
 */
export class PreparationScheduler {
  readonly concurrency: number;
  readonly watchdogMs: number;
  private readonly queued = new Map<string, QueuedTask<unknown>>();
  private readonly running = new Map<string, Promise<unknown>>();
  private active = 0;
  private clock = 0;

  constructor(options: { concurrency: number; watchdogMs?: number }) {
    if (!Number.isInteger(options.concurrency) || options.concurrency < 1) {
      throw new Error("cairn-plot: preparation concurrency must be a positive integer");
    }
    this.concurrency = options.concurrency;
    this.watchdogMs = options.watchdogMs ?? TASK_WATCHDOG_MS;
  }

  schedule<T>(
    key: string,
    priority: PreparationPriority,
    run: () => Promise<T>,
    options?: ScheduleOptions,
  ): Promise<T> {
    const inFlight = this.running.get(key);
    if (inFlight) return inFlight as Promise<T>;

    const existing = this.queued.get(key) as QueuedTask<T> | undefined;
    if (existing) {
      if (priority === "foreground") existing.priority = "foreground";
      if (options?.visible === true) existing.visible = true;
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
      visible: options?.visible === true,
      order: this.clock++,
      run,
      promise,
      resolve,
      reject,
    } as QueuedTask<unknown>);
    this.drain();
    return promise;
  }

  /**
   * Raise a still-QUEUED task's priority/visibility without ever starting new
   * work. Callers that already hold the in-flight promise for `key` (the
   * resolution cache does) must use this rather than `schedule`: after the
   * watchdog releases a stuck task's slot the key→promise mapping is gone, so
   * `schedule` would launch a SECOND run of work that is still in flight.
   * A no-op once the task has started, or if the key is unknown.
   */
  promote(key: string, priority: PreparationPriority, options?: ScheduleOptions): void {
    const queued = this.queued.get(key);
    if (!queued) return;
    if (priority === "foreground") queued.priority = "foreground";
    if (options?.visible === true) queued.visible = true;
    this.drain();
  }

  private drain(): void {
    while (this.active < this.concurrency && this.queued.size > 0) {
      const task = this.next();
      if (!task) return;
      this.queued.delete(task.key);
      this.active++;
      const running = Promise.resolve().then(task.run);
      this.running.set(task.key, running);

      // The slot is released EXACTLY once — by the task settling, or by the
      // watchdog when it never does.
      let releasedSlot = false;
      const releaseSlot = (): void => {
        if (releasedSlot) return;
        releasedSlot = true;
        // Only drop the key→promise mapping if it is still ours: a watchdog
        // release lets a later `schedule(key)` start fresh work.
        if (this.running.get(task.key) === running) this.running.delete(task.key);
        this.active--;
        this.drain();
      };
      const watchdog = setTimeout(() => {
        if (releasedSlot) return;
        // eslint-disable-next-line no-console
        console.warn(
          `cairn-plot: preparation task ${JSON.stringify(task.key)} did not settle within ` +
            `${this.watchdogMs}ms — releasing its scheduler slot and failing the request ` +
            `(the abandoned run may still settle; that settle is ignored)`,
        );
        // Fail the CALLER so the failure is cached and retried, rather than
        // leaving a promise that never settles behind a pane's loading state.
        task.reject(new Error(`cairn-plot scheduler: task watchdog expired: ${task.key}`));
        releaseSlot();
      }, this.watchdogMs);
      // Never keep a Node process alive just to watch a task.
      (watchdog as unknown as { unref?: () => void }).unref?.();

      void running.then(task.resolve, task.reject).finally(() => {
        clearTimeout(watchdog);
        releaseSlot();
      });
    }
  }

  private next(): QueuedTask<unknown> | undefined {
    let selected: QueuedTask<unknown> | undefined;
    for (const task of this.queued.values()) {
      if (!selected || comparePreparationTasks(task, selected) < 0) selected = task;
    }
    return selected;
  }
}

function rank(priority: PreparationPriority): number {
  return priority === "foreground" ? 1 : 0;
}

export const globalPreparationScheduler = new PreparationScheduler({ concurrency: 4 });
