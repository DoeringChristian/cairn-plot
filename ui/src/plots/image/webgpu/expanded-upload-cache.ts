import { getExpandedUploadCacheByteLimit } from "../../../resources/runtime-config.ts";
import type { SourceUpload } from "./pool.ts";

interface Entry {
  upload: SourceUpload;
  bytes: number;
  refs: number;
}

export interface ExpandedUploadLease {
  readonly upload: SourceUpload;
  release(): void;
}

/** Synchronous content-keyed LRU for upload-ready expanded pixel arrays. JS runs
 * builders atomically, so simultaneous pane commits cannot build the same key
 * twice; every caller receives an independent ref-counted lease. */
export class ExpandedUploadCache {
  private readonly entries = new Map<string, Entry>();
  private totalBytes = 0;
  private budget: number;

  constructor(budgetBytes = getExpandedUploadCacheByteLimit()) {
    validateBudget(budgetBytes);
    this.budget = budgetBytes;
  }

  setBudgetBytes(bytes: number): void {
    validateBudget(bytes);
    this.budget = bytes;
    this.evict();
  }

  acquire(key: string, build: () => SourceUpload): ExpandedUploadLease {
    let entry = this.entries.get(key);
    if (entry) {
      this.entries.delete(key);
      this.entries.set(key, entry);
    } else {
      const upload = build();
      entry = { upload, bytes: upload.data.byteLength, refs: 0 };
      this.entries.set(key, entry);
      this.totalBytes += entry.bytes;
    }
    entry.refs++;
    let released = false;
    return {
      upload: entry.upload,
      release: () => {
        if (released) return;
        released = true;
        entry!.refs--;
        this.evict();
      },
    };
  }

  private evict(): void {
    while (this.totalBytes > this.budget) {
      let victim: [string, Entry] | undefined;
      for (const candidate of this.entries) {
        if (candidate[1].refs === 0) {
          victim = candidate;
          break;
        }
      }
      if (!victim) return;
      this.entries.delete(victim[0]);
      this.totalBytes -= victim[1].bytes;
    }
  }

  snapshot(): { bytes: number; entries: number; refs: number; overBudget: boolean } {
    let refs = 0;
    for (const entry of this.entries.values()) refs += entry.refs;
    return {
      bytes: this.totalBytes,
      entries: this.entries.size,
      refs,
      overBudget: this.totalBytes > this.budget,
    };
  }
}

function validateBudget(bytes: number): void {
  if (!Number.isSafeInteger(bytes) || bytes < 0) {
    throw new Error("cairn-plot: expanded CPU upload cache byte limit must be a non-negative safe integer");
  }
}

export const expandedUploadCache = new ExpandedUploadCache();

export function setExpandedUploadCacheBudget(bytes: number): void {
  expandedUploadCache.setBudgetBytes(bytes);
}
