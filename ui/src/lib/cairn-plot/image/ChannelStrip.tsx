/**
 * `ChannelStrip` — the tev-style channel selector: a horizontally wrapping row
 * of chips BELOW an EXR pane's viewport (header = stack tabs, footer = channel
 * strip). One chip per selectable GROUP (parts × channel groups from the
 * `exrTree` describe); the ACTIVE group chip expands inline with its channel
 * LETTERS (R G B A / X Y Z / …) so a single channel can be isolated (decoded as
 * a scalar via the selector path — cached, so revisits are instant). Scalar
 * groups (`Z`, masks) are plain chips.
 *
 * Multi-part files prefix chips with the part name (`beauty · diffuse`); deep
 * parts are skipped (selection on deep parts is not supported yet). The strip
 * renders nothing when there is only one selectable view (a plain single-group
 * single-channel image) — chrome only when it has a job.
 *
 * Presentation-only: the OWNER (`LeafView`) holds the active selection and
 * performs the re-resolve on `onSelect`. Same visual family as `StackTabStrip`.
 */
import type { ChannelGroup } from "./channel-groups";

export interface ChannelStripTree {
  parts: Array<{ name: string; index: number; deep: boolean; groups: ChannelGroup[] }>;
}

/** The decode selection the strip drives — mirrors the descriptor fields. */
export interface ChannelSelection {
  part?: number | string;
  layer?: string;
}

/** A flat strip entry: one selectable group of one part. */
interface StripEntry {
  partIndex: number;
  partName: string;
  group: ChannelGroup;
  label: string;
}

function entriesOf(tree: ChannelStripTree): StripEntry[] {
  const multiPart = tree.parts.filter((p) => !p.deep).length > 1;
  const out: StripEntry[] = [];
  for (const part of tree.parts) {
    if (part.deep) continue; // deep parts: selection unsupported (P4 territory)
    for (const group of part.groups) {
      const groupLabel = group.name === "" ? (group.kind === "color" ? "RGBA".slice(0, group.channels.length) : group.channels[0]!) : group.name;
      const label = multiPart ? `${part.name || `#${part.index}`} · ${groupLabel}` : groupLabel;
      out.push({ partIndex: part.index, partName: part.name, group, label });
    }
  }
  return out;
}

/** The channel-letter badge for a full channel name (`diffuse.G` → `G`). */
function letterOf(fullName: string): string {
  const dot = fullName.lastIndexOf(".");
  return dot < 0 ? fullName : fullName.slice(dot + 1);
}

/** Whether `sel` addresses this entry (group selected) — `layer` may also be a
 *  FULL channel name inside the entry's group (letter isolation). */
function matches(entry: StripEntry, sel: ChannelSelection, defaultEntry: StripEntry): {
  active: boolean;
  activeChannel: string | null;
} {
  const partIdx =
    sel.part == null
      ? 0
      : typeof sel.part === "number"
        ? sel.part
        : null; // name matched below
  const partOk =
    sel.part == null
      ? entry.partIndex === 0
      : typeof sel.part === "string"
        ? entry.partName === sel.part
        : entry.partIndex === partIdx;
  if (!partOk) return { active: false, activeChannel: null };
  if (sel.layer == null) {
    return { active: entry === defaultEntry, activeChannel: null };
  }
  if (sel.layer === entry.group.name) return { active: true, activeChannel: null };
  if (entry.group.channels.includes(sel.layer)) return { active: true, activeChannel: sel.layer };
  return { active: false, activeChannel: null };
}

export default function ChannelStrip({
  tree,
  selection,
  onSelect,
}: {
  tree: ChannelStripTree;
  /** The CURRENT effective selection (view override merged over the node's). */
  selection: ChannelSelection;
  onSelect: (sel: ChannelSelection) => void;
}) {
  const entries = entriesOf(tree);
  if (entries.length === 0) return null;
  const defaultEntry = entries.find((e) => e.partIndex === 0) ?? entries[0]!;
  // No job → no chrome: a lone single-channel view has nothing to switch.
  if (entries.length === 1 && entries[0]!.group.channels.length === 1) return null;

  return (
    <div
      data-cairn-channel-strip=""
      className="mt-1 flex flex-wrap items-center gap-1"
      style={{ minWidth: 0 }}
    >
      {entries.map((entry, i) => {
        const m = matches(entry, selection, defaultEntry);
        const selForEntry: ChannelSelection = {
          // Emit the part by NAME when it has one (stable), else by index; omit
          // for part 0 (keeps the default-part descriptor shape).
          ...(entry.partIndex !== 0 ? { part: entry.partName || entry.partIndex } : {}),
        };
        const groupSel: ChannelSelection = {
          ...selForEntry,
          // The default color group of part 0 with no isolation = no selector at
          // all (the legacy decode) — keeps cache keys aligned with first mount.
          ...(entry === defaultEntry && entry.group.name === "" ? {} : { layer: entry.group.name }),
        };
        const showLetters = m.active && entry.group.channels.length > 1;
        return (
          <span
            key={`${entry.partIndex}:${entry.group.name}:${i}`}
            data-cairn-channel-chip={m.active ? "active" : ""}
            className={
              "flex shrink-0 items-center overflow-hidden rounded text-[11px] " +
              (m.active
                ? "bg-accent/15 text-fg ring-1 ring-accent"
                : "text-fg-muted hover:bg-bg-hover hover:text-fg")
            }
          >
            <button
              type="button"
              data-cairn-channel-group={entry.group.name || "(default)"}
              title={
                entry.group.kind === "color"
                  ? `Show ${entry.label} (${entry.group.channels.length} channels)`
                  : `Show ${entry.label} (scalar)`
              }
              onClick={() => onSelect(groupSel)}
              className={"px-2 py-0.5 " + (m.active && !m.activeChannel ? "font-semibold" : "")}
            >
              {entry.label}
            </button>
            {showLetters && (
              <span className="flex items-center gap-0.5 border-l border-accent/40 px-1">
                {entry.group.channels.map((full) => (
                  <button
                    key={full}
                    type="button"
                    data-cairn-channel-letter={full}
                    title={`Isolate ${full}`}
                    onClick={() => onSelect({ ...selForEntry, layer: full })}
                    className={
                      "min-w-4 rounded px-0.5 text-center text-[10px] font-semibold " +
                      (m.activeChannel === full
                        ? "bg-accent text-white"
                        : "text-fg-muted hover:bg-bg-hover hover:text-fg")
                    }
                  >
                    {letterOf(full)}
                  </button>
                ))}
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}
