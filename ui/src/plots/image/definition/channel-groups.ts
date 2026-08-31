/**
 * `channel-groups.ts` — tev-style grouping of an EXR part's flat channel list
 * into the entries the CHANNEL STRIP shows and the decode selector addresses.
 *
 * Convention (OpenEXR layer naming): a channel `diffuse.R` belongs to layer
 * (group) `diffuse` with suffix `R`; a bare `R` belongs to the DEFAULT group
 * `""`. Per layer prefix:
 *   - suffixes containing R+G+B (any case, ± A)      → ONE "color" group;
 *   - suffixes containing X+Y (± Z), e.g. normals    → ONE "color" group shown
 *     as RGB slots in X,Y,Z order (tev does the same);
 *   - anything else (Z, mask, id, lone alpha, odd sets) → one SCALAR group per
 *     channel, named by the full channel name, rendered via the colormap path.
 * Group order follows first appearance in the file's channel list (the default
 * color group always sorts first when present).
 *
 * Pure + framework-free: unit-tested in node, consumed by the strip UI, the
 * decode selector and `cp.Layers` expansion alike.
 */
interface NamedChannel {
  readonly name: string;
}

export interface ChannelGroup {
  /** Group name — the layer prefix ("" = the default/base layer), or the FULL
   *  channel name for scalar groups. This is the `layer` selector value. */
  name: string;
  /** "color" = multi-channel, rendered as RGB(A); "scalar" = one channel via
   *  the colormap path. */
  kind: "color" | "scalar";
  /** FULL channel names in output-slot order (R,G,B[,A] / X,Y,Z / [single]). */
  channels: string[];
}

const RGBA_ORDER: Record<string, number> = { R: 0, G: 1, B: 2, A: 3 };
const XYZ_ORDER: Record<string, number> = { X: 0, Y: 1, Z: 2 };

function splitName(full: string): { prefix: string; suffix: string } {
  const dot = full.lastIndexOf(".");
  return dot < 0
    ? { prefix: "", suffix: full }
    : { prefix: full.slice(0, dot), suffix: full.slice(dot + 1) };
}

/** Group a part's channels. Accepts either full descriptors or bare names. */
export function groupChannels(channels: ReadonlyArray<NamedChannel | string>): ChannelGroup[] {
  const names = channels.map((c) => (typeof c === "string" ? c : c.name));
  // Bucket by layer prefix, preserving first-appearance order.
  const buckets = new Map<string, string[]>();
  for (const full of names) {
    const { prefix } = splitName(full);
    let list = buckets.get(prefix);
    if (!list) {
      list = [];
      buckets.set(prefix, list);
    }
    list.push(full);
  }

  const groups: ChannelGroup[] = [];
  for (const [prefix, fulls] of buckets) {
    const bySuffix = new Map(fulls.map((f) => [splitName(f).suffix.toUpperCase(), f]));
    const has = (s: string) => bySuffix.has(s);
    if (has("R") && has("G") && has("B")) {
      const ordered = [...bySuffix.entries()]
        .filter(([s]) => s in RGBA_ORDER)
        .sort((a, b) => RGBA_ORDER[a[0]]! - RGBA_ORDER[b[0]]!)
        .map(([, f]) => f);
      groups.push({ name: prefix, kind: "color", channels: ordered });
      // Non-RGBA leftovers under the same prefix (rare) fall through as scalars.
      for (const f of fulls) {
        if (!(splitName(f).suffix.toUpperCase() in RGBA_ORDER)) {
          groups.push({ name: f, kind: "scalar", channels: [f] });
        }
      }
    } else if (has("X") && has("Y")) {
      const ordered = [...bySuffix.entries()]
        .filter(([s]) => s in XYZ_ORDER)
        .sort((a, b) => XYZ_ORDER[a[0]]! - XYZ_ORDER[b[0]]!)
        .map(([, f]) => f);
      groups.push({ name: prefix, kind: "color", channels: ordered });
      for (const f of fulls) {
        if (!(splitName(f).suffix.toUpperCase() in XYZ_ORDER)) {
          groups.push({ name: f, kind: "scalar", channels: [f] });
        }
      }
    } else {
      // No recognizable color triplet: every channel is its own scalar group.
      for (const f of fulls) groups.push({ name: f, kind: "scalar", channels: [f] });
    }
  }
  // The default/base color group first (what an unselected decode shows).
  groups.sort((a, b) => (a.name === "" ? -1 : 0) - (b.name === "" ? -1 : 0));
  return groups;
}

/** Resolve a `layer` selector against a part's groups. `undefined` = the first
 *  group (base color when present). Throws naming the available groups. */
export function resolveGroup(
  groups: ChannelGroup[],
  layer: string | undefined,
): ChannelGroup {
  if (groups.length === 0) throw new Error("cairn-plot: part has no channels");
  if (layer == null) return groups[0]!;
  const g = groups.find((x) => x.name === layer);
  if (g) return g;
  // Convenience: a FULL channel name (`diffuse.G`) selects that single channel
  // as a scalar view even when it lives inside a color group.
  for (const cand of groups) {
    const ch = cand.channels.find((c) => c === layer);
    if (ch) return { name: layer, kind: "scalar", channels: [ch] };
  }
  const names = groups.map((x) => (x.name === "" ? "(default)" : x.name)).join(", ");
  throw new Error(`cairn-plot: no channel group or channel named "${layer}" (available: ${names})`);
}
