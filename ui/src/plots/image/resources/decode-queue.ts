/**
 * `resources/decode-queue.ts` — bounded, prioritised image-decode admission.
 *
 * Opening a run mounts a page of image cards at once. Before this queue every
 * one of them started its decode immediately, so the decodes for panes the
 * user is looking at competed with the decodes for panes 600 px off screen,
 * and the browser's decode workers were oversubscribed. Three rules fix that:
 *
 *   1. At most `DECODE_CONCURRENCY` decodes run at a time.
 *   2. Entries that are QUEUED (not yet running) are served MOST-RECENT-FIRST.
 *      The newest request is the one the user just scrolled to; the stale mount
 *      requests ahead of it wait. A LIFO is deliberate — a FIFO would make a
 *      freshly visible pane wait behind everything that ever mounted.
 *   3. A queued entry is CANCELLED when its refcount falls to zero
 *      (`retainDecode` at mount, `releaseDecode` at unmount): an unmounted
 *      pane's decode must never occupy a slot a visible pane needs. A RUNNING
 *      entry is never cancelled — it is already paid for, and its result is
 *      cached by URL for whoever asks next.
 *
 * Only the decode itself is queued (see `decoded-image.ts`). The lazy
 * `imageData()` readback deliberately does NOT enter the queue: a queued task
 * that waited on another queued task could deadlock the three slots.
 */

/** Concurrent decodes. Three keeps the browser's decoder busy without letting
 *  an off-screen page of cards monopolise it. */
export const DECODE_CONCURRENCY = 3;

/** Rejection of a queued decode that lost its last requester before it ran. */
export class DecodeCancelled extends Error {
  constructor(key: string) {
    super(`decode cancelled: ${key}`);
    this.name = "DecodeCancelled";
  }
}

interface QueueEntry {
  key: string;
  run: () => Promise<unknown>;
  resolve: (value: never) => void;
  reject: (error: unknown) => void;
}

let runningCount = 0;
/** Waiting entries, oldest first — `pump` pops from the TAIL (most recent). */
const waiting: QueueEntry[] = [];
/** Live requesters per key. Absent means "nobody ever retained this key", which
 *  is NOT the same as zero: an unretained entry is never cancelled. */
const refCounts = new Map<string, number>();

export function decodeQueueStats(): { running: number; queued: number } {
  return { running: runningCount, queued: waiting.length };
}

/** Run `fn` under the concurrency bound, keyed by `key` for cancellation. */
export function enqueueDecode<T>(key: string, fn: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const entry: QueueEntry = {
      key,
      run: fn as () => Promise<unknown>,
      resolve: resolve as unknown as (value: never) => void,
      reject,
    };
    if (runningCount < DECODE_CONCURRENCY) start(entry);
    else waiting.push(entry);
  });
}

/** Register a live requester for `key` (a mounting pane). */
export function retainDecode(key: string): void {
  refCounts.set(key, (refCounts.get(key) ?? 0) + 1);
}

/** Drop a requester. On the LAST one, any entry for `key` still WAITING is
 *  dropped and its promise rejects with `DecodeCancelled`. */
export function releaseDecode(key: string): void {
  const count = refCounts.get(key);
  if (count === undefined) return;
  if (count > 1) {
    refCounts.set(key, count - 1);
    return;
  }
  refCounts.delete(key);
  for (let i = waiting.length - 1; i >= 0; i--) {
    if (waiting[i].key !== key) continue;
    const [dropped] = waiting.splice(i, 1);
    dropped.reject(new DecodeCancelled(key));
  }
}

function start(entry: QueueEntry): void {
  runningCount++;
  let promise: Promise<unknown>;
  try {
    promise = entry.run();
  } catch (error) {
    settle(entry, undefined, error, true);
    return;
  }
  Promise.resolve(promise).then(
    (value) => settle(entry, value, undefined, false),
    (error) => settle(entry, undefined, error, true),
  );
}

function settle(entry: QueueEntry, value: unknown, error: unknown, failed: boolean): void {
  runningCount--;
  if (failed) entry.reject(error);
  else entry.resolve(value as never);
  pump();
}

function pump(): void {
  while (runningCount < DECODE_CONCURRENCY && waiting.length > 0) {
    start(waiting.pop()!);
  }
}
