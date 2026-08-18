/**
 * `channel-menu.ts` — the CHANNELS toolbar menu for EXR panes: the standard
 * `ToolbarButtonSpec` dropdown (same chrome as the colormap/tonemap menus)
 * listing every selectable part × channel group, plus each color group's
 * individual channels (indented) for single-channel isolation.
 *
 * IN THE TOOLBAR by design (not a tev-style always-visible strip): the usual
 * case is that the report already authored the channels to show — the menu is
 * the occasional on-the-fly override, so it lives with the other view-local
 * controls and adds NO chrome below the viewport (a footer strip changed the
 * pane's height with its wrap count, resizing the viewport on selection).
 *
 * Subsampled channels (RY/BY chroma) are filtered OUT by the tree builder
 * (`tryExrTree`) — the selector decode path can't decode them alone, so they
 * are simply not offered; the DEFAULT view (the loader's luminance-chroma →
 * RGB conversion) still shows them combined.
 *
 * Pure builder: the owner (`LeafView`) holds the selection state and performs
 * the re-resolve; deep parts are skipped (P4 territory).
 */
import type { ToolbarButtonSpec, ToolbarMenuOption } from "../controls/ToolbarConfig";
import type { ChannelGroup } from "./channel-groups";

/** True when the tree yields a USABLE menu (≥2 selectable entries). Deep-only
 *  trees don't (deep parts skip decode-time selection), and neither do
 *  luminance-chroma files whose subsampled RY/BY were filtered (a lone Y is
 *  nothing to switch) — both fall back to the SYNTHETIC RGBA tree over the
 *  DECODED pixels (the format-agnostic slice path). */
export function treeHasSelectableChannels(tree: ChannelMenuTree): boolean {
  return buildEntries(tree).length >= 2;
}

export interface ChannelMenuTree {
  parts: Array<{ name: string; index: number; deep: boolean; groups: ChannelGroup[] }>;
}

/** The decode selection the menu drives — mirrors the descriptor fields. */
export interface ChannelSelection {
  part?: number | string;
  /** Group name, full channel name, or an ARBITRARY combo of up to 3 full
   *  channel names (packed into R,G,B slots in order). */
  layer?: string | string[];
}

interface MenuEntry {
  option: ToolbarMenuOption;
  selection: ChannelSelection | null; // null = the default view (no selector)
}

function shortLabel(group: ChannelGroup): string {
  if (group.name === "") {
    return group.kind === "color" ? "RGBA".slice(0, group.channels.length) : group.channels[0]!;
  }
  return group.name;
}

/** Resolve a selection's part to its tree index (name or index; default 0). */
function partIndexOf(tree: ChannelMenuTree, part: number | string | undefined): number {
  if (part == null) return 0;
  if (typeof part === "number") return part;
  return tree.parts.find((p) => p.name === part)?.index ?? 0;
}

function buildEntries(tree: ChannelMenuTree): MenuEntry[] {
  const selectableParts = tree.parts.filter((p) => !p.deep && p.groups.length > 0);
  const multiPart = selectableParts.length > 1;
  const entries: MenuEntry[] = [];
  for (const part of selectableParts) {
    const partPrefix = multiPart ? `${part.name || `#${part.index}`} · ` : "";
    const partSel: Pick<ChannelSelection, "part"> =
      part.index !== 0 ? { part: part.name || part.index } : {};
    for (const group of part.groups) {
      const isDefaultGroup = part.index === 0 && group === tree.parts[0]?.groups[0];
      entries.push({
        option: {
          id: `p${part.index}|${group.name}`,
          label: partPrefix + shortLabel(group),
        },
        // The tree's very first group of part 0 IS the default decode — encode
        // it as "no selector" so its cache key matches the initial mount.
        selection: isDefaultGroup && group.name === "" ? null : { ...partSel, layer: group.name },
      });
      if (group.kind === "color" && group.channels.length > 1) {
        for (const full of group.channels) {
          entries.push({
            option: { id: `p${part.index}|${full}`, label: ` · ${full}` },
            selection: { ...partSel, layer: full },
          });
        }
      }
    }
  }
  return entries;
}

/**
 * Build the CHANNELS toolbar menu, or `null` when there is nothing to switch
 * (a single group with a single channel). `selection` is the CURRENT effective
 * decode selection (view override merged over the node's authored one).
 */
export function channelToolbarButton(
  tree: ChannelMenuTree,
  selection: ChannelSelection,
  onSelect: (sel: ChannelSelection | null) => void,
): ToolbarButtonSpec | null {
  const entries = buildEntries(tree);
  if (entries.length === 0) return null;
  if (entries.length === 1) return null; // nothing to switch
  const byId = new Map(entries.map((e) => [e.option.id, e]));

  // The CURRENT selection's option id (drives the face label + highlight).
  const curPartIdx = partIndexOf(tree, selection.part);
  const curLayer = selection.layer;
  let value = entries[0]!.option.id;
  // An ARBITRARY COMBO (authored `channels=[...]`) has no group entry — show it
  // verbatim on the face via a synthetic option (picking it is a no-op keep).
  if (Array.isArray(curLayer)) {
    const comboOpt: MenuEntry = {
      option: { id: "__combo", label: curLayer.join(" | ") },
      selection: { part: selection.part, layer: curLayer },
    };
    entries.unshift(comboOpt);
    byId.set("__combo", comboOpt);
    value = "__combo";
  } else if (curLayer != null) {
    const direct = byId.get(`p${curPartIdx}|${curLayer}`);
    if (direct) value = direct.option.id;
  } else {
    const part = tree.parts.find((p) => p.index === curPartIdx);
    const firstGroup = part?.groups[0];
    if (firstGroup) value = `p${curPartIdx}|${firstGroup.name}`;
  }

  return {
    id: "channels",
    title: "Channels — EXR part / channel-group / single-channel selection",
    menu: {
      options: entries.map((e) => e.option),
      value,
      onSelect: (id: string) => {
        const entry = byId.get(id);
        if (entry) onSelect(entry.selection);
      },
    },
  };
}
