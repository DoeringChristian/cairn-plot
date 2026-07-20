/**
 * In-page **capability notice** — one small, dismissible warning banner shown
 * when a rendered cairn-plot page hits a FUNDAMENTAL browser capability limit
 * (not a cairn-plot bug). Two kinds:
 *
 *   - `"no-webgpu"` — the page contains GPU-preferring content (the gpu-image
 *     addon tried to register) but WebGPU is unavailable. Reported from the
 *     addon's `tryRegister()` failure path (`plot-gpu-image-addon.tsx`), so a
 *     chart-only page (which never loads the addon) NEVER warns.
 *   - `"no-hdr"` — WebGPU works, but the HDR canvas path (`rgba16float` +
 *     `toneMapping:"extended"`) is unavailable while the page actually shows
 *     true-float HDR content. Reported from `GpuImagePane`'s acquire logic
 *     (it knows when it wanted HDR and got an SDR surface).
 *
 * DESIGN: vanilla DOM injection (no React), same spirit as the page bootstrap,
 * so it works in EVERY baked page (report + gallery), `file://` included, with
 * no dependency on a React root being mounted. The banner is theme-aware — it
 * styles itself with the `--color-*` CSS variables the emitters put on
 * `:root.cairn-plot-doc`, so it reads correctly in light AND dark.
 *
 * IDEMPOTENT / at-most-one: each kind reports at most once; at most ONE banner
 * is mounted per page. If both fire, `no-webgpu` wins (in practice they are
 * mutually exclusive — `no-hdr` requires WebGPU to be working).
 *
 * DISMISSAL persists per page under a `localStorage` key namespaced by
 * `location.pathname`, falling back to `sessionStorage` then in-memory when
 * storage is denied (`file://`, private mode) so it still dismisses for the
 * session.
 */

export type CapabilityLimit = "no-webgpu" | "no-hdr";

/** Full browser-support guide the "Learn more" link points at. */
export const BROWSER_SUPPORT_GUIDE_URL =
  "https://github.com/doeringchristian/cairn-plot/blob/main/docs/browser-support.md";

/** Environment inputs for the (pure) hint picker — passed explicitly so it is
 *  unit-testable without a DOM. `isBrave` comes from `navigator.brave` at the
 *  call site (Brave's UA is indistinguishable from Chrome). */
export interface HintEnv {
  userAgent: string;
  isBrave?: boolean;
}

type Browser = "brave" | "firefox" | "safari" | "chromium-linux" | "chromium";

/** Classify the browser from its UA string (+ the Brave flag). Order matters:
 *  Brave first (UA looks like Chrome), then Firefox, then real Safari (has
 *  "Safari" but none of the Chromium/Android markers), then Chromium-on-Linux,
 *  else generic Chromium. Exported for the unit test. */
export function detectBrowser(userAgent: string, isBrave = false): Browser {
  const ua = userAgent || "";
  if (isBrave) return "brave";
  if (/firefox/i.test(ua)) return "firefox";
  if (/safari/i.test(ua) && !/chrome|chromium|crios|android/i.test(ua)) return "safari";
  if (/linux/i.test(ua) && /chrome|chromium/i.test(ua)) return "chromium-linux";
  return "chromium";
}

/**
 * One short, browser-specific sentence on how to enable the missing capability
 * in the CURRENT browser. Pure — depends only on `kind` + `env`. The Firefox
 * hint deliberately states the HDR limitation inline (Firefox has no extended
 * tone-mapping path at all), so it is correct for both kinds.
 */
export function pickEnableHint(kind: CapabilityLimit, env: HintEnv): string {
  switch (detectBrowser(env.userAgent, env.isBrave)) {
    case "firefox":
      return "Firefox: about:config → dom.webgpu.enabled (HDR output is not available in Firefox at all — browser limitation).";
    case "safari":
      return "Safari: Develop → Feature Flags → WebGPU (Safari 26+ has it by default).";
    case "brave":
      return "Brave: check Shields fingerprint blocking + brave://flags.";
    case "chromium-linux":
      return "Chromium on Linux: enable chrome://flags/#enable-unsafe-webgpu.";
    case "chromium":
    default:
      return kind === "no-hdr"
        ? "Chrome/Edge: requires an HDR display with OS HDR enabled."
        : "Chrome/Edge: enable chrome://flags/#enable-unsafe-webgpu and hardware acceleration.";
  }
}

/** The one-line limitation message per kind. */
function limitMessage(kind: CapabilityLimit): string {
  return kind === "no-webgpu"
    ? "GPU renderer unavailable → CPU fallback active; FLIP kernels + HDR compare disabled."
    : "true HDR output unsupported by this browser → HDR images tone-mapped to SDR.";
}

/** Per-page dismissal key, namespaced by kind + `location.pathname`. Pure. */
export function capabilityNoticeStorageKey(kind: CapabilityLimit, pathname: string): string {
  return `cairn-plot:capnotice:${kind}:${pathname}`;
}

// --- dismissal storage (localStorage → sessionStorage → in-memory) ----------

const memoryDismissed = new Set<string>();

function readDismissed(key: string): boolean {
  try {
    if (window.localStorage.getItem(key) === "1") return true;
  } catch {
    /* storage denied — fall through */
  }
  try {
    if (window.sessionStorage.getItem(key) === "1") return true;
  } catch {
    /* storage denied — fall through */
  }
  return memoryDismissed.has(key);
}

function writeDismissed(key: string): void {
  try {
    window.localStorage.setItem(key, "1");
    return;
  } catch {
    /* storage denied — try sessionStorage */
  }
  try {
    window.sessionStorage.setItem(key, "1");
    return;
  } catch {
    /* storage denied — fall back to in-memory */
  }
  memoryDismissed.add(key);
}

// --- singleton banner state -------------------------------------------------

const reported = new Set<CapabilityLimit>();
let shownKind: CapabilityLimit | null = null;
let bannerEl: HTMLElement | null = null;

function removeBanner(): void {
  if (bannerEl && bannerEl.parentNode) bannerEl.parentNode.removeChild(bannerEl);
  bannerEl = null;
  shownKind = null;
}

function mountBanner(kind: CapabilityLimit): void {
  const key = capabilityNoticeStorageKey(kind, window.location.pathname);
  const hint = pickEnableHint(kind, {
    userAgent: navigator.userAgent,
    isBrave: !!(navigator as unknown as { brave?: unknown }).brave,
  });

  const root = document.createElement("div");
  root.setAttribute("role", "status");
  root.setAttribute("data-cairn-plot-capnotice", kind);
  Object.assign(root.style, {
    position: "fixed",
    bottom: "12px",
    right: "12px",
    zIndex: "2147483000",
    maxWidth: "340px",
    boxSizing: "border-box",
    padding: "10px 30px 10px 12px",
    borderRadius: "6px",
    border: "1px solid var(--color-border, #d0d7de)",
    background: "rgb(var(--color-bg-elevated-rgb, 246 248 250) / 0.9)",
    color: "var(--color-fg-muted, #656d76)",
    backdropFilter: "blur(4px)",
    WebkitBackdropFilter: "blur(4px)",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.18)",
    font: "12px/1.4 system-ui, sans-serif",
  } as Partial<CSSStyleDeclaration>);

  const msg = document.createElement("div");
  msg.textContent = limitMessage(kind);
  Object.assign(msg.style, {
    fontWeight: "600",
    color: "var(--color-fg, #1f2328)",
    marginBottom: "4px",
  } as Partial<CSSStyleDeclaration>);

  const hintEl = document.createElement("div");
  hintEl.textContent = hint;
  hintEl.style.marginBottom = "4px";

  const link = document.createElement("a");
  link.href = BROWSER_SUPPORT_GUIDE_URL;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "Learn more";
  Object.assign(link.style, {
    color: "var(--color-accent, #0969da)",
    textDecoration: "none",
  } as Partial<CSSStyleDeclaration>);

  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "×";
  close.setAttribute("aria-label", "Dismiss browser capability notice");
  close.title = "Dismiss";
  Object.assign(close.style, {
    position: "absolute",
    top: "4px",
    right: "6px",
    padding: "0 4px",
    border: "0",
    background: "transparent",
    color: "var(--color-fg-subtle, #8b949e)",
    cursor: "pointer",
    fontSize: "16px",
    lineHeight: "1",
  } as Partial<CSSStyleDeclaration>);
  close.addEventListener("click", () => {
    writeDismissed(key);
    removeBanner();
  });

  root.appendChild(msg);
  root.appendChild(hintEl);
  root.appendChild(link);
  root.appendChild(close);

  document.body.appendChild(root);
  bannerEl = root;
  shownKind = kind;
}

/**
 * Report that the page hit a browser capability limit. Idempotent per kind;
 * mounts at most ONE banner per page. Safe to call before `<body>` exists
 * (defers to `DOMContentLoaded`) and in non-DOM environments (no-op).
 */
export function reportCapabilityLimit(kind: CapabilityLimit): void {
  if (typeof document === "undefined" || typeof window === "undefined") return;
  if (reported.has(kind)) return;
  reported.add(kind);

  const key = capabilityNoticeStorageKey(kind, window.location.pathname);
  if (readDismissed(key)) return;

  const show = (): void => {
    // Re-check dismissal in case the deferred callback ran after a dismiss.
    if (readDismissed(key)) return;
    if (shownKind !== null) {
      // A banner is already up. Prefer no-webgpu; otherwise keep the first.
      if (kind === "no-webgpu" && shownKind === "no-hdr") {
        removeBanner();
      } else {
        return;
      }
    }
    mountBanner(kind);
  };

  if (document.body) {
    show();
  } else {
    window.addEventListener("DOMContentLoaded", show, { once: true });
  }
}

/** Test-only: reset the module singleton state between cases. */
export function __resetCapabilityNoticeForTests(): void {
  reported.clear();
  memoryDismissed.clear();
  removeBanner();
}
