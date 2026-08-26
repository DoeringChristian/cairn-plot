/**
 * Shared scaffolding for the `*.browser.ts` harness pages (the WebGPU parity
 * proofs and interaction harnesses that `scripts/test-harness.mjs` discovers
 * via their sibling `*.browser.html` pages).
 *
 * Every harness page carries the same three-part contract the runner (and a
 * human, or claude-in-chrome) reads back:
 *   - `#result`  — one colored PASS/FAIL line per assertion (`report`);
 *   - `#status`  — the overall verdict, exactly "PASS" or "FAIL"
 *                  (`setOverallStatus`; the runner polls this element);
 *   - `document.title` — `"<title> PASS"` / `"<title> FAIL"`, plus an optional
 *     well-known `window` flag, so a script-based (non-visual) check can poll
 *     the outcome without reading the DOM.
 *
 * These helpers used to be copy-pasted verbatim into every harness; this module
 * is the single copy. Harness-specific side effects (extra window flags such as
 * `__gpuImagePaneMainDone`, console.error capture, …) stay in the harness
 * files at their call sites — this module owns only the shared contract.
 */

/** Resolve after `ms` milliseconds. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Poll `predicate` every `stepMs` until it returns true or `timeoutMs`
 * elapses; one final check runs after the deadline. Accepts sync or async
 * predicates. Harnesses that relied on different local defaults pass their
 * timeout/step explicitly at the call site.
 */
export async function waitFor(
  predicate: () => boolean | Promise<boolean>,
  timeoutMs = 8000,
  stepMs = 20,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return true;
    await sleep(stepMs);
  }
  return await predicate();
}

export interface HarnessOptions {
  /** Title stem: `document.title` becomes `"<title> PASS"` / `"<title> FAIL"`. */
  title: string;
  /**
   * Optional well-known global: `window[resultFlag]` is set to `"pass"` /
   * `"fail"` alongside `#status`, for script-based (non-visual) polling.
   */
  resultFlag?: string;
  /**
   * Text colors for `#result` lines and `#status`. Defaults to plain
   * green/red; harness pages with a dark background pass brighter hues
   * (e.g. `{ pass: "#6f6", fail: "#f66" }`).
   */
  colors?: { pass: string; fail: string };
}

export interface Harness {
  /** Append one colored `PASS:`/`FAIL:` line to `#result` and the console. */
  report(pass: boolean, message: string): void;
  /** Write the overall verdict to `#status`, `document.title`, and (if configured) the window flag. */
  setOverallStatus(pass: boolean): void;
}

/** Create the standard `report`/`setOverallStatus` pair for one harness page. */
export function createHarness(opts: HarnessOptions): Harness {
  const passColor = opts.colors?.pass ?? "green";
  const failColor = opts.colors?.fail ?? "red";

  function report(pass: boolean, message: string): void {
    const line = `${pass ? "PASS" : "FAIL"}: ${message}`;
    // eslint-disable-next-line no-console
    console[pass ? "log" : "error"](line);
    const el = document.getElementById("result");
    if (el) {
      const p = document.createElement("div");
      p.textContent = line;
      p.style.color = pass ? passColor : failColor;
      el.appendChild(p);
    }
  }

  function setOverallStatus(pass: boolean): void {
    const el = document.getElementById("status");
    if (el) {
      el.textContent = pass ? "PASS" : "FAIL";
      el.style.color = pass ? passColor : failColor;
    }
    if (opts.resultFlag) {
      (window as unknown as Record<string, unknown>)[opts.resultFlag] = pass ? "pass" : "fail";
    }
    document.title = pass ? `${opts.title} PASS` : `${opts.title} FAIL`;
  }

  return { report, setOverallStatus };
}
