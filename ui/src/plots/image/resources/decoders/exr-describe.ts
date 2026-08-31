/**
 * `exr-describe.ts` — HEADER-ONLY EXR metadata: the parts × channels tree,
 * WITHOUT decoding any pixels. This is the metadata-first seam for
 * multi-part / multi-channel EXR support: the UI channel strip and decode
 * selector consume this description; the pixel decode then happens per
 * `{part, layer}` selection through the full decoder.
 *
 * Standalone by design (no dependency on the vendored three.js loader or the
 * pure reader): EXR headers are a simple attribute list per part — walking
 * them needs no decompression, so this stays tiny, synchronous and safe to run
 * on the main thread even for huge files.
 *
 * Layout walked (OpenEXR 2.x):
 *   magic i32 (20000630) · version i32 (bit 0x0200 tiled, 0x0800 deep/non-image,
 *   0x1000 multi-part) · one header per part (attributes `name\0 type\0 size:i32
 *   payload`, empty name terminates the header; multi-part: headers back-to-back,
 *   a lone empty header terminates the list). We read `channels` (chlist),
 *   `dataWindow` (box2i), `name` (string), `type` (string) and SKIP everything
 *   else by its declared size.
 */

const EXR_MAGIC = 20000630;
const NON_IMAGE_FLAG = 0x0800; // deep data (single-part files)
const MULTI_PART_FLAG = 0x1000;

/** One channel as stored in a part's chlist. */
export interface ExrChannelDesc {
  name: string;
  /** 0 = UINT, 1 = HALF, 2 = FLOAT. */
  pixelType: number;
  xSampling: number;
  ySampling: number;
}

/** One part of the file (a single-part file has exactly one). */
export interface ExrPartDesc {
  /** The part's `name` attribute; single-part files usually have none → "". */
  name: string;
  /** Part index in file order — the `part` selector when unnamed. */
  index: number;
  width: number;
  height: number;
  /** True for deepscanline / deeptile parts (per-pixel sample lists). */
  deep: boolean;
  /** True for tiledimage / deeptile parts. */
  tiled: boolean;
  channels: ExrChannelDesc[];
}

export interface ExrDescription {
  parts: ExrPartDesc[];
  multiPart: boolean;
}

class HeaderReader {
  private view: DataView;
  private bytes: Uint8Array;
  offset = 0;
  constructor(buffer: ArrayBuffer) {
    this.view = new DataView(buffer);
    this.bytes = new Uint8Array(buffer);
  }
  get length(): number {
    return this.bytes.length;
  }
  u8(): number {
    return this.bytes[this.offset++]!;
  }
  i32(): number {
    const v = this.view.getInt32(this.offset, true);
    this.offset += 4;
    return v;
  }
  /** NUL-terminated string (bounded — a header string never nears this). */
  cstr(max = 512): string {
    const start = this.offset;
    let end = start;
    while (end < this.bytes.length && this.bytes[end] !== 0) {
      if (end - start > max) throw new Error("cairn-plot describeExr: unterminated string in header");
      end++;
    }
    const s = new TextDecoder().decode(this.bytes.subarray(start, end));
    this.offset = end + 1; // past the NUL
    return s;
  }
  skip(n: number): void {
    this.offset += n;
  }
  /** Exactly `n` bytes as a string (string ATTRS are size-delimited, not
   *  NUL-terminated — unlike the inline names). */
  sized(n: number): string {
    const s = new TextDecoder().decode(this.bytes.subarray(this.offset, this.offset + n));
    this.offset += n;
    return s;
  }
}

function parseChlist(r: HeaderReader, endOffset: number): ExrChannelDesc[] {
  const out: ExrChannelDesc[] = [];
  for (;;) {
    if (r.offset >= endOffset) break;
    const name = r.cstr();
    if (name === "") break; // empty name terminates the channel list
    const pixelType = r.i32();
    r.skip(4); // pLinear u8 + 3 reserved
    const xSampling = r.i32();
    const ySampling = r.i32();
    out.push({ name, pixelType, xSampling, ySampling });
  }
  return out;
}

/** Parse ONE part header starting at `r.offset` (first attribute name).
 *  Returns null when the "header" is empty (the multi-part list terminator). */
function parsePartHeader(r: HeaderReader, index: number): ExrPartDesc | null {
  let channels: ExrChannelDesc[] = [];
  let name = "";
  let type = "";
  let width = 0;
  let height = 0;
  let sawAny = false;
  for (;;) {
    const attrName = r.cstr();
    if (attrName === "") break; // end of this header
    sawAny = true;
    const attrType = r.cstr();
    const size = r.i32();
    const valueEnd = r.offset + size;
    if (attrName === "channels" && attrType === "chlist") {
      channels = parseChlist(r, valueEnd);
    } else if (attrName === "dataWindow" && attrType === "box2i") {
      const xMin = r.i32();
      const yMin = r.i32();
      const xMax = r.i32();
      const yMax = r.i32();
      width = xMax - xMin + 1;
      height = yMax - yMin + 1;
    } else if (attrName === "name" && attrType === "string") {
      name = r.sized(size);
    } else if (attrName === "type" && attrType === "string") {
      type = r.sized(size);
    }
    r.offset = valueEnd; // skip whatever remains of the payload
  }
  if (!sawAny) return null;
  const deep = type === "deepscanline" || type === "deeptile";
  const tiled = type === "tiledimage" || type === "deeptile";
  return { name, index, width, height, deep, tiled, channels };
}

/**
 * Describe an EXR file from its raw bytes: every part with its dims, deep flag
 * and channel list. Throws on a non-EXR buffer; never decodes pixel data.
 */
export function describeExr(buffer: ArrayBuffer): ExrDescription {
  const r = new HeaderReader(buffer);
  if (r.length < 8 || r.i32() !== EXR_MAGIC) {
    throw new Error("cairn-plot describeExr: not an EXR file (bad magic)");
  }
  const version = r.i32();
  const multiPart = (version & MULTI_PART_FLAG) !== 0;
  const singleDeep = (version & NON_IMAGE_FLAG) !== 0;

  const parts: ExrPartDesc[] = [];
  if (!multiPart) {
    const part = parsePartHeader(r, 0);
    if (!part) throw new Error("cairn-plot describeExr: empty header");
    // Single-part files rarely carry a `type` attr — the version deep flag rules.
    if (singleDeep) part.deep = true;
    parts.push(part);
  } else {
    for (let i = 0; ; i++) {
      const part = parsePartHeader(r, i);
      if (!part) break; // lone empty header terminates the part list
      parts.push(part);
      if (i > 256) throw new Error("cairn-plot describeExr: implausible part count");
    }
    if (parts.length === 0) throw new Error("cairn-plot describeExr: multi-part file with no parts");
  }
  return { parts, multiPart };
}

/** Resolve a `part` selector (index or name) against a description. Throws with
 *  the available names on a miss — surfaced verbatim in the pane error state. */
export function resolvePartIndex(desc: ExrDescription, part: number | string | undefined): number {
  if (part == null) return 0;
  if (typeof part === "number") {
    if (part < 0 || part >= desc.parts.length) {
      throw new Error(
        `cairn-plot: part index ${part} out of range (file has ${desc.parts.length} part(s))`,
      );
    }
    return part;
  }
  const idx = desc.parts.findIndex((p) => p.name === part);
  if (idx < 0) {
    const names = desc.parts.map((p) => p.name || `#${p.index}`).join(", ");
    throw new Error(`cairn-plot: no part named "${part}" (parts: ${names})`);
  }
  return idx;
}
