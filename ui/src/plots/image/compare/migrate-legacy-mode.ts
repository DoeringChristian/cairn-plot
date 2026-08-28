import type { DiffMode } from "../../types";
import type { MediaCompareModeKind } from "./mode";

// ---------------------------------------------------------------------------
// Settings migration-on-read: legacy {diffMode, compareMode, referenceMode}
// combo -> the new single `mode` field.
//
// Pre-refactor ImageGalleryCard settings had two independently-settable
// axes: `diffMode` ("none" | DiffMode) and `compareMode`
// ("side-by-side" | "split" | "blend", default "side-by-side"). Under the
// unified exclusive-mode model there is exactly one axis. The mapping below
// is the single, table-driven source of truth for collapsing old combos to
// the nearest new mode — cards must call `migrateLegacyMode`, not hand-roll
// their own ifs (spec-visual-compare.md quality bar #5).
//
// Rule (in priority order):
//   1. Any active diff (`diffMode !== "none"`) wins — this is the sanctioned
//      "split+diff (or side+diff) collapses to diff" delta from the spec.
//   2. Otherwise compareMode "split" maps directly; the removed "blend" view
//      mode aliases to "split" (the surviving slide comparison).
//   3. Otherwise "side-by-side" (or unset) maps to "split" when the old
//      per-run reference scope was active (that combination visually showed
//      two panes; the removed side-by-side view now migrates to the surviving
//      "split"/slide comparison), else "normal" (single pane, reference
//      tracked but not shown/diffed).
// ---------------------------------------------------------------------------

export interface LegacyModeInputs {
  diffMode: "none" | DiffMode;
  compareMode?: "side-by-side" | "split" | "blend";
  referenceMode?: "global" | "per-run";
}

// ---------------------------------------------------------------------------
// Lenient read alias for the REMOVED "blend" compare view mode. Old baked
// descriptors / persisted settings may still carry a `mode` value of "blend";
// the runtime tolerates it by rendering as "split" (the surviving slide
// comparison) and emitting exactly ONE console.warn per session (module-level
// guard). Schema/type surfaces no longer list "blend" — this is the read-side
// safety net so legacy reports keep rendering.
// ---------------------------------------------------------------------------

let warnedBlendModeRemoved = false;

/**
 * Alias a possibly-legacy compare `mode` value: "blend" → "split" (once-warned);
 * every other value passes through unchanged. Call at the read boundary wherever
 * a compare mode string arrives from external data (a baked descriptor or a
 * persisted settings blob).
 */
export function aliasLegacyCompareMode<T extends string>(mode: T): Exclude<T, "blend"> | "split" {
  if (mode === "blend") {
    if (!warnedBlendModeRemoved) {
      warnedBlendModeRemoved = true;
      // eslint-disable-next-line no-console
      console.warn("cairn-plot: the 'blend' compare mode was removed; rendering as 'split'.");
    }
    return "split";
  }
  return mode as Exclude<T, "blend">;
}

export function migrateLegacyMode(input: LegacyModeInputs): MediaCompareModeKind {
  const { diffMode, compareMode = "side-by-side", referenceMode = "global" } = input;
  if (diffMode !== "none") return "diff";
  if (compareMode === "split") return "split";
  // The "blend" view mode was removed; legacy blend settings alias to split.
  if (compareMode === "blend") return "split";
  return referenceMode === "per-run" ? "split" : "normal";
}

// ---------------------------------------------------------------------------
// Table-driven coverage — every legacy combo a reviewer needs to check maps
// here, one row per case (co-located with the utility per spec-visual-compare
// quality bar #5). `assertLegacyModeMigrationTable` runs once at module load
// (cheap: a handful of function calls) so a broken mapping fails loudly
// without a test runner (this repo has none configured yet).
// ---------------------------------------------------------------------------

export const LEGACY_MODE_MIGRATION_TABLE: Array<{
  description: string;
  input: LegacyModeInputs;
  expected: MediaCompareModeKind;
}> = [
  {
    description: "fresh default: no diff, default compare, default (global) reference",
    input: { diffMode: "none" },
    expected: "normal",
  },
  {
    description: "no diff, explicit side-by-side, global reference",
    input: { diffMode: "none", compareMode: "side-by-side", referenceMode: "global" },
    expected: "normal",
  },
  {
    description: "no diff, side-by-side, per-run reference -> legacy side migrates to split (surviving comparison)",
    input: { diffMode: "none", compareMode: "side-by-side", referenceMode: "per-run" },
    expected: "split",
  },
  {
    description: "no diff, split compare, global reference",
    input: { diffMode: "none", compareMode: "split", referenceMode: "global" },
    expected: "split",
  },
  {
    description: "no diff, split compare, per-run reference (referenceMode irrelevant to split)",
    input: { diffMode: "none", compareMode: "split", referenceMode: "per-run" },
    expected: "split",
  },
  {
    description: "no diff, legacy blend compare, global reference -> removed blend aliases to split",
    input: { diffMode: "none", compareMode: "blend", referenceMode: "global" },
    expected: "split",
  },
  {
    description: "no diff, legacy blend compare, per-run reference -> removed blend aliases to split",
    input: { diffMode: "none", compareMode: "blend", referenceMode: "per-run" },
    expected: "split",
  },
  {
    description: "absolute diff + default compare + global reference (the common single-pane diff view)",
    input: { diffMode: "absolute", compareMode: "side-by-side", referenceMode: "global" },
    expected: "diff",
  },
  {
    description: "signed diff + side-by-side + per-run reference -> previously-combinable side+diff collapses to diff",
    input: { diffMode: "signed", compareMode: "side-by-side", referenceMode: "per-run" },
    expected: "diff",
  },
  {
    description: "squared diff + split compare -> previously-combinable split+diff collapses to diff (the spec's headline case)",
    input: { diffMode: "squared", compareMode: "split", referenceMode: "global" },
    expected: "diff",
  },
  {
    description: "relative_absolute diff + blend compare -> collapses to diff",
    input: { diffMode: "relative_absolute", compareMode: "blend", referenceMode: "per-run" },
    expected: "diff",
  },
  {
    description: "relative_signed diff, compareMode unset (legacy default), global reference",
    input: { diffMode: "relative_signed" },
    expected: "diff",
  },
  {
    description: "relative_squared diff, compareMode unset, per-run reference -> diff still wins",
    input: { diffMode: "relative_squared", referenceMode: "per-run" },
    expected: "diff",
  },
];

export function assertLegacyModeMigrationTable(): void {
  for (const testCase of LEGACY_MODE_MIGRATION_TABLE) {
    const got = migrateLegacyMode(testCase.input);
    if (got !== testCase.expected) {
      throw new Error(
        `[media-compare] migrateLegacyMode regression: "${testCase.description}" ` +
          `expected "${testCase.expected}", got "${got}" (input: ${JSON.stringify(testCase.input)})`,
      );
    }
  }
}

assertLegacyModeMigrationTable();
