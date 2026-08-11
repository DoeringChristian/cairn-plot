/**
 * `image/decoders/gain-map.ts` — HDR gain-map JPEG reconstruction (Adobe /
 * ISO 21496-1 "hdr-gain-map").
 *
 * An HDR gain-map JPEG is an ordinary SDR JPEG (the "base rendition") that
 * ALSO carries, appended after it via **MPF (Multi-Picture Format)**, a second
 * JPEG — the *gain map* — plus **XMP** metadata in the `hdr-gain-map/1.0/`
 * namespace. Reconstructing the HDR image is a per-pixel, per-channel operation
 * that multiplies the (linearized) base by a spatially-varying gain read out of
 * the gain-map image and remapped through the XMP metadata.
 *
 * This module is PURE and DOM-free (no `createImageBitmap`, no canvas): it only
 * walks bytes and does float math, so it is fully unit-testable under Node's
 * type-stripping test runner. The DOM-bound half — decoding the two sub-JPEGs
 * to RGBA pixels via the browser codec — lives in `decoders.ts`, which calls
 * the parsers here to locate the gain-map sub-image and the metadata, then calls
 * {@link reconstructHdrFromGainMap} with the decoded pixels.
 *
 * ## Reconstruction formula (the spec rule we follow)
 * Per the Android Ultra HDR / ISO 21496-1 "Display" pseudocode, the gain is
 * applied to the **LINEARIZED (linear-light) SDR pixel**, NOT the gamma-encoded
 * value, and the output is linear-light HDR:
 *
 *   recovery   = gainSample / 255                          (normalize to [0,1])
 *   logRecov   = pow(recovery, 1 / gamma)                  (de-gamma, per ch.)
 *   logBoost   = gainMapMin·(1 − logRecov) + gainMapMax·logRecov   (log2, per ch.)
 *   weight     = clamp((log2(maxDisplayBoost) − HDRCapMin) /
 *                       (HDRCapMax − HDRCapMin), 0, 1)
 *   HDR        = (SDRlinear + OffsetSDR) · 2^(logBoost·weight) − OffsetHDR
 *
 * We reconstruct at FULL headroom (display-independent maximum): the target
 * `maxDisplayBoost = 2^HDRCapMax`, so `weight = 1`. Because `OffsetSDR ==
 * OffsetHDR` for this class of file, a NEUTRAL gain (logBoost = 0) round-trips
 * exactly to the linearized base: `HDR = SDRlinear`. The output is linear-light
 * float RGB — the same convention EXR/PFM feed cairn-plot's HDR surface
 * (1.0 = display white, headroom preserved above 1.0).
 *
 * Ref: https://developer.android.com/media/platform/hdr-image-format (Display).
 */

// ---------------------------------------------------------------------------
// JPEG segment walking.
// ---------------------------------------------------------------------------

/** One APPn (or other) marker segment located inside a JPEG byte stream. */
export interface JpegSegment {
  /** The marker's second byte (e.g. 0xe1 for APP1, 0xe2 for APP2). */
  marker: number;
  /** Absolute offset of the segment's payload (just past the 2-byte length). */
  payloadStart: number;
  /** Payload length in bytes (segment length field minus the 2 length bytes). */
  payloadLength: number;
}

/**
 * Walk the marker segments of a JPEG stream in `[start, end)`, stopping at the
 * Start-Of-Scan (0xda) or End-Of-Image (0xd9). Returns every APPn/other length-
 * prefixed segment (standalone markers RSTn/SOI are skipped). Tolerant: returns
 * whatever it parsed if the stream is malformed rather than throwing.
 */
export function walkJpegSegments(bytes: Uint8Array, start = 0, end = bytes.length): JpegSegment[] {
  const segs: JpegSegment[] = [];
  // Must begin at SOI (FFD8) to be a JPEG.
  if (end - start < 2 || bytes[start] !== 0xff || bytes[start + 1] !== 0xd8) return segs;
  let p = start + 2;
  while (p + 4 <= end) {
    // Skip any fill bytes between segments.
    if (bytes[p] !== 0xff) {
      p++;
      continue;
    }
    const marker = bytes[p + 1]!;
    // SOS (start of entropy-coded scan) / EOI — stop the header walk.
    if (marker === 0xda || marker === 0xd9) break;
    // Standalone markers with no length payload: SOI, RSTn (0xd0..0xd7), TEM.
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01 || marker === 0xff) {
      p += 2;
      continue;
    }
    const len = (bytes[p + 2]! << 8) | bytes[p + 3]!;
    if (len < 2 || p + 2 + len > end) break;
    segs.push({ marker, payloadStart: p + 4, payloadLength: len - 2 });
    p += 2 + len;
  }
  return segs;
}

// ---------------------------------------------------------------------------
// ASCII helpers (avoid allocating giant latin1 strings for whole files).
// ---------------------------------------------------------------------------

/** True when `bytes` at `offset` equals the ASCII of `sig`. */
function asciiAt(bytes: Uint8Array, offset: number, sig: string): boolean {
  if (offset + sig.length > bytes.length) return false;
  for (let i = 0; i < sig.length; i++) {
    if (bytes[offset + i] !== sig.charCodeAt(i)) return false;
  }
  return true;
}

/** Decode a byte range as latin1 (1:1 byte→codepoint) — safe for ASCII XML. */
function latin1(bytes: Uint8Array, start: number, end: number): string {
  let s = "";
  // Chunk to avoid String.fromCharCode arg-count limits on large XMP packets.
  for (let i = start; i < end; i += 8192) {
    const stop = Math.min(end, i + 8192);
    s += String.fromCharCode(...bytes.subarray(i, stop));
  }
  return s;
}

/** The hdr-gain-map XMP namespace URI (Adobe / ISO 21496-1). */
export const HDR_GAIN_MAP_NS = "http://ns.adobe.com/hdr-gain-map/1.0/";
const XMP_HEADER = "http://ns.adobe.com/xap/1.0/\0";

/**
 * CHEAP detector: does the JPEG carry the hdr-gain-map namespace anywhere? A
 * plain-byte substring scan (no allocation of the whole file as a string). This
 * is the generic hdrgm signal — it fires for Adobe gain-map JPEGs AND Google
 * Ultra HDR (both declare the same namespace on the gain-map image's XMP), so
 * the decoder can branch before doing any heavier parsing.
 */
export function hasGainMapSignature(bytes: Uint8Array): boolean {
  const sig = HDR_GAIN_MAP_NS;
  const first = sig.charCodeAt(0);
  const limit = bytes.length - sig.length;
  for (let i = 0; i <= limit; i++) {
    if (bytes[i] !== first) continue;
    let ok = true;
    for (let j = 1; j < sig.length; j++) {
      if (bytes[i + j] !== sig.charCodeAt(j)) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// XMP extraction (main packet + Extended-XMP reassembly).
// ---------------------------------------------------------------------------

/**
 * Extract the XMP packet from a JPEG's APP1 segments. The main packet is the
 * APP1 whose payload starts with `http://ns.adobe.com/xap/1.0/\0`. If an
 * Extended-XMP chain is present (APP1 payloads headed by
 * `http://ns.adobe.com/xmp/extension/\0`), its chunks are reassembled by their
 * 32-bit big-endian offsets and appended so fields that spilled into the
 * extension are still visible. Returns `null` if no main XMP packet is found.
 */
export function extractXmp(bytes: Uint8Array, start = 0, end = bytes.length): string | null {
  const segs = walkJpegSegments(bytes, start, end);
  let main: string | null = null;
  const extChunks: { offset: number; text: string }[] = [];
  const EXT_HEADER = "http://ns.adobe.com/xmp/extension/\0";
  for (const seg of segs) {
    if (seg.marker !== 0xe1) continue;
    const p = seg.payloadStart;
    if (asciiAt(bytes, p, XMP_HEADER)) {
      const bodyStart = p + XMP_HEADER.length;
      main = latin1(bytes, bodyStart, seg.payloadStart + seg.payloadLength);
    } else if (asciiAt(bytes, p, EXT_HEADER)) {
      // Extended-XMP chunk layout after the header: 32-byte GUID, 4-byte total
      // length (BE), 4-byte chunk offset (BE), then the chunk bytes.
      const h = p + EXT_HEADER.length;
      if (h + 40 <= seg.payloadStart + seg.payloadLength) {
        const offset = (bytes[h + 36]! << 24) | (bytes[h + 37]! << 16) | (bytes[h + 38]! << 8) | bytes[h + 39]!;
        extChunks.push({ offset, text: latin1(bytes, h + 40, seg.payloadStart + seg.payloadLength) });
      }
    }
  }
  if (main === null) return null;
  if (extChunks.length > 0) {
    extChunks.sort((a, b) => a.offset - b.offset);
    main += extChunks.map((c) => c.text).join("");
  }
  return main;
}

// ---------------------------------------------------------------------------
// MPF (Multi-Picture Format) index → the gain-map sub-image byte range.
// ---------------------------------------------------------------------------

/** Absolute byte range of an embedded sub-image located via the MPF index. */
export interface MpfImageRange {
  offset: number;
  size: number;
}

/**
 * Parse the MPF (Multi-Picture Format) index in the APP2 `MPF\0` segment and
 * return the byte range of the SECOND MP entry (the gain map) as ABSOLUTE
 * offsets into `bytes`. Per the MPF spec, MP-entry offsets are relative to the
 * start of the MPF endian marker (the TIFF header inside the segment); the first
 * (primary) image has offset 0 by convention. Returns `null` if there is no MPF
 * segment, fewer than 2 images, or the structure is malformed.
 */
export function parseMpfSecondImage(bytes: Uint8Array, start = 0, end = bytes.length): MpfImageRange | null {
  const segs = walkJpegSegments(bytes, start, end);
  const mpf = segs.find((s) => s.marker === 0xe2 && asciiAt(bytes, s.payloadStart, "MPF\0"));
  if (!mpf) return null;
  // TIFF structure begins right after "MPF\0"; all MP offsets are relative here.
  const tiff = mpf.payloadStart + 4;
  const segEnd = mpf.payloadStart + mpf.payloadLength;
  if (tiff + 8 > segEnd) return null;
  const le = bytes[tiff] === 0x49 && bytes[tiff + 1] === 0x49; // "II" = little-endian
  const be = bytes[tiff] === 0x4d && bytes[tiff + 1] === 0x4d; // "MM" = big-endian
  if (!le && !be) return null;
  const u16 = (o: number): number => (le ? bytes[o]! | (bytes[o + 1]! << 8) : (bytes[o]! << 8) | bytes[o + 1]!);
  const u32 = (o: number): number =>
    le
      ? (bytes[o]! | (bytes[o + 1]! << 8) | (bytes[o + 2]! << 16) | (bytes[o + 3]! << 24)) >>> 0
      : ((bytes[o]! << 24) | (bytes[o + 1]! << 16) | (bytes[o + 2]! << 8) | bytes[o + 3]!) >>> 0;
  if (u16(tiff + 2) !== 42) return null; // TIFF magic
  const ifd0 = tiff + u32(tiff + 4);
  if (ifd0 + 2 > segEnd) return null;
  const nEntries = u16(ifd0);
  let numImages = 0;
  let entriesOff = 0; // MP-Entry values offset, relative to `tiff`
  for (let i = 0; i < nEntries; i++) {
    const e = ifd0 + 2 + i * 12;
    if (e + 12 > segEnd) break;
    const tag = u16(e);
    if (tag === 0xb001) numImages = u32(e + 8); // NumberOfImages
    else if (tag === 0xb002) entriesOff = u32(e + 8); // MPEntry (offset to value block)
  }
  if (numImages < 2 || entriesOff === 0) return null;
  // MP entries are 16 bytes each: 4 attr, 4 size, 4 offset, 2 dep1, 2 dep2.
  const e1 = tiff + entriesOff + 16; // second entry
  if (e1 + 16 > segEnd) return null;
  const size = u32(e1 + 4);
  const relOffset = u32(e1 + 8);
  if (size === 0 || relOffset === 0) return null;
  const absOffset = tiff + relOffset;
  if (absOffset + size > end) return null;
  return { offset: absOffset, size };
}

// ---------------------------------------------------------------------------
// hdrgm metadata parse (scalar OR per-channel rdf:Seq).
// ---------------------------------------------------------------------------

/** Parsed hdr-gain-map metadata. Per-channel fields are length-1 (scalar,
 *  broadcast to all channels) or length-3 (explicit R,G,B). */
export interface GainMapMetadata {
  gainMapMin: number[]; // log2 gain at gain-map value 0
  gainMapMax: number[]; // log2 gain at gain-map value 1
  gamma: number[]; // encoding gamma
  offsetSdr: number;
  offsetHdr: number;
  hdrCapacityMin: number; // log2 headroom min
  hdrCapacityMax: number; // log2 headroom max (== full-reconstruction target)
  baseRenditionIsHdr: boolean;
}

/** Read an hdrgm field as an array of floats: either the attribute form
 *  `hdrgm:Name="v"` or the element form `<hdrgm:Name>…<rdf:li>v</rdf:li>…`. */
function readFloatField(xml: string, name: string): number[] | null {
  // Attribute form first.
  const attr = new RegExp(`hdrgm:${name}\\s*=\\s*"([^"]*)"`).exec(xml);
  if (attr) {
    const v = Number.parseFloat(attr[1]!);
    return Number.isFinite(v) ? [v] : null;
  }
  // Element form: <hdrgm:Name> … </hdrgm:Name> — collect rdf:li values, else
  // a bare scalar text node.
  const el = new RegExp(`<hdrgm:${name}[^>]*>([\\s\\S]*?)</hdrgm:${name}>`).exec(xml);
  if (el) {
    const inner = el[1]!;
    const lis: number[] = [];
    const liRe = /<rdf:li[^>]*>\s*([^<]*?)\s*<\/rdf:li>/g;
    let m: RegExpExecArray | null;
    while ((m = liRe.exec(inner))) {
      const v = Number.parseFloat(m[1]!);
      if (Number.isFinite(v)) lis.push(v);
    }
    if (lis.length > 0) return lis;
    const scalar = Number.parseFloat(inner.trim());
    if (Number.isFinite(scalar)) return [scalar];
  }
  return null;
}

/** Read a boolean hdrgm attribute/element ("True"/"False"), else `dflt`. */
function readBoolField(xml: string, name: string, dflt: boolean): boolean {
  const attr = new RegExp(`hdrgm:${name}\\s*=\\s*"([^"]*)"`).exec(xml);
  const el = attr ? null : new RegExp(`<hdrgm:${name}[^>]*>\\s*([^<]*?)\\s*</hdrgm:${name}>`).exec(xml);
  const raw = (attr?.[1] ?? el?.[1])?.trim().toLowerCase();
  if (raw === undefined) return dflt;
  return raw === "true";
}

/**
 * Parse hdr-gain-map metadata from an XMP packet. Applies the spec DEFAULTS
 * for any absent field (Gamma=1, OffsetSDR=OffsetHDR=1/64, GainMapMin=0,
 * GainMapMax=1, HDRCapacityMin=0). Returns `null` only if the XMP lacks the
 * hdrgm namespace entirely (not a gain-map packet) — a gain-map packet with
 * only defaults still reconstructs.
 */
export function parseGainMapMetadata(xml: string): GainMapMetadata | null {
  if (!xml.includes("hdr-gain-map/")) return null;
  const scalar = (name: string, dflt: number): number => {
    const v = readFloatField(xml, name);
    return v && v.length > 0 ? v[0]! : dflt;
  };
  const vec = (name: string, dflt: number): number[] => readFloatField(xml, name) ?? [dflt];
  return {
    gainMapMin: vec("GainMapMin", 0),
    gainMapMax: vec("GainMapMax", 1),
    gamma: vec("Gamma", 1),
    offsetSdr: scalar("OffsetSDR", 1 / 64),
    offsetHdr: scalar("OffsetHDR", 1 / 64),
    hdrCapacityMin: scalar("HDRCapacityMin", 0),
    hdrCapacityMax: scalar("HDRCapacityMax", 1),
    baseRenditionIsHdr: readBoolField(xml, "BaseRenditionIsHDR", false),
  };
}

// ---------------------------------------------------------------------------
// Reconstruction.
// ---------------------------------------------------------------------------

/** sRGB inverse-OETF: gamma-encoded [0,1] → linear-light [0,1]. The spec
 *  applies the gain to the LINEARIZED base; SDR JPEGs (sRGB / Display-P3 both
 *  use the sRGB transfer) linearize with this curve. */
function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** Pick per-channel metadata value `c`, broadcasting a length-1 (scalar) array. */
function pick(arr: number[], c: number): number {
  return arr.length === 1 ? arr[0]! : (arr[c] ?? arr[arr.length - 1]!);
}

/** Bilinearly sample channel `ch` of an RGBA `Uint8ClampedArray` at (fx,fy) in
 *  gain-map pixel space; returns the sample in [0,255]. */
function bilinearU8(data: Uint8ClampedArray, w: number, h: number, fx: number, fy: number, ch: number): number {
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(x0 + 1, w - 1);
  const y1 = Math.min(y0 + 1, h - 1);
  const cx0 = Math.max(0, Math.min(x0, w - 1));
  const cy0 = Math.max(0, Math.min(y0, h - 1));
  const dx = fx - x0;
  const dy = fy - y0;
  const at = (x: number, y: number): number => data[(y * w + x) * 4 + ch]!;
  const top = at(cx0, cy0) * (1 - dx) + at(x1, cy0) * dx;
  const bot = at(cx0, y1) * (1 - dx) + at(x1, y1) * dx;
  return top * (1 - dy) + bot * dy;
}

/** RGBA `Uint8ClampedArray` decoded from a sub-JPEG, with its own dimensions. */
export interface RgbaImage {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/**
 * Reconstruct a FULL-headroom linear-light HDR float image (3-channel RGB) from
 * a decoded SDR base and gain map plus parsed metadata. The gain map is
 * bilinearly upsampled to the base resolution when smaller. Reconstruction uses
 * weight = 1 (target headroom = 2^HDRCapacityMax), per the spec formula
 * documented at the top of this module. Output is a `Float32Array` of length
 * `baseW*baseH*3`, row-major, top-row-first (matching every other DecodedImage).
 */
export function reconstructHdrFromGainMap(
  base: RgbaImage,
  gain: RgbaImage,
  meta: GainMapMetadata,
): Float32Array {
  const { width, height } = base;
  const out = new Float32Array(width * height * 3);
  // Full reconstruction: target maxDisplayBoost = 2^HDRCapacityMax ⇒ weight = 1.
  const weight = 1;
  const sx = gain.width / width;
  const sy = gain.height / height;
  const invGamma = [1 / Math.max(pick(meta.gamma, 0), 1e-6), 1 / Math.max(pick(meta.gamma, 1), 1e-6), 1 / Math.max(pick(meta.gamma, 2), 1e-6)];
  const gmin = [pick(meta.gainMapMin, 0), pick(meta.gainMapMin, 1), pick(meta.gainMapMin, 2)];
  const gmax = [pick(meta.gainMapMax, 0), pick(meta.gainMapMax, 1), pick(meta.gainMapMax, 2)];
  for (let y = 0; y < height; y++) {
    // Map base pixel centre to gain-map space (pixel-centre convention).
    const gy = (y + 0.5) * sy - 0.5;
    for (let x = 0; x < width; x++) {
      const gx = (x + 0.5) * sx - 0.5;
      const bi = (y * width + x) * 4;
      const oi = (y * width + x) * 3;
      for (let c = 0; c < 3; c++) {
        const sdrLin = srgbToLinear(base.data[bi + c]! / 255);
        // Grayscale gain maps store R=G=B, so reading channel c is correct for
        // both single-channel and per-channel (RGB) gain maps.
        const recovery = bilinearU8(gain.data, gain.width, gain.height, gx, gy, c) / 255;
        const logRecovery = Math.pow(recovery, invGamma[c]!);
        const logBoost = gmin[c]! * (1 - logRecovery) + gmax[c]! * logRecovery;
        const hdr = (sdrLin + meta.offsetSdr) * Math.pow(2, logBoost * weight) - meta.offsetHdr;
        out[oi + c] = hdr;
      }
    }
  }
  return out;
}
