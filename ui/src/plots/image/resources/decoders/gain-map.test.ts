/**
 * Pure unit tests for the HDR gain-map parsers + reconstruction
 * (`gain-map.ts`). These cover the DOM-FREE surface — JPEG segment walking, the
 * MPF index parse, XMP extraction, hdrgm metadata parse (scalar + per-channel
 * rdf:Seq + defaults), and the linear-light reconstruction math — plus a
 * real-file parse of the committed 1000x667 Adobe gain-map fixture. The pixel
 * decode + full end-to-end float result need a browser JPEG codec and are
 * asserted in `gain-map-decode.browser.ts`.
 *
 *   node --experimental-strip-types --test \
 *     src/plots/image/resources/decoders/gain-map.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  walkJpegSegments,
  hasGainMapSignature,
  extractXmp,
  parseMpfSecondImage,
  parseGainMapMetadata,
  reconstructHdrFromGainMap,
  type RgbaImage,
} from "./gain-map.ts";

// ---------------------------------------------------------------------------
// Synthetic-buffer builders.
// ---------------------------------------------------------------------------

/** Build a JPEG-shaped buffer: SOI + the given APPn segments + SOS + EOI. */
function makeJpeg(segments: { marker: number; payload: number[] }[]): Uint8Array {
  const parts: number[] = [0xff, 0xd8]; // SOI
  for (const s of segments) {
    const len = s.payload.length + 2;
    parts.push(0xff, s.marker, (len >> 8) & 0xff, len & 0xff, ...s.payload);
  }
  parts.push(0xff, 0xda, 0x00, 0x02); // SOS (empty scan header) — walk stops here
  parts.push(0xff, 0xd9); // EOI
  return new Uint8Array(parts);
}

/** ASCII string → byte array. */
function A(s: string): number[] {
  return Array.from(s, (c) => c.charCodeAt(0));
}

/** An APP1 XMP segment payload: the xap header, NUL, then the packet body. */
function xmpPayload(body: string): number[] {
  return [...A("http://ns.adobe.com/xap/1.0/"), 0x00, ...A(body)];
}

/**
 * Build an MPF APP2 payload (big-endian TIFF) declaring 2 images whose second
 * MP entry has the given size + offset (relative to the MPF endian marker).
 */
function mpfPayload(secondSize: number, secondOffsetRel: number): number[] {
  const be = (v: number, n: number): number[] => {
    const out: number[] = [];
    for (let i = n - 1; i >= 0; i--) out.push((v >>> (8 * i)) & 0xff);
    return out;
  };
  // TIFF: "MM", 0x002A, IFD0 offset = 8. IFD0 has 3 entries; MP-entry value
  // block follows immediately after the IFD.
  const ifdStart = 8;
  const nEntries = 3;
  const entriesBlockRel = ifdStart + 2 + nEntries * 12 + 4; // after IFD + next-IFD ptr
  const tiff: number[] = [
    ...A("MM"),
    ...be(0x002a, 2),
    ...be(ifdStart, 4),
    ...be(nEntries, 2),
    // 0xB000 MPFVersion (type 7 UNDEFINED, count 4) inline "0100"
    ...be(0xb000, 2), ...be(7, 2), ...be(4, 4), ...A("0100"),
    // 0xB001 NumberOfImages (type 4 LONG, count 1) = 2
    ...be(0xb001, 2), ...be(4, 2), ...be(1, 4), ...be(2, 4),
    // 0xB002 MPEntry (type 7, count 32) value offset = entriesBlockRel
    ...be(0xb002, 2), ...be(7, 2), ...be(32, 4), ...be(entriesBlockRel, 4),
    ...be(0, 4), // next-IFD offset = 0
    // MP entry 0 (primary): attr, size, offset=0, dep1, dep2
    ...be(0x20030000, 4), ...be(1000, 4), ...be(0, 4), ...be(0, 2), ...be(0, 2),
    // MP entry 1 (gain map): attr, size, offset(rel), dep1, dep2
    ...be(0x00000000, 4), ...be(secondSize, 4), ...be(secondOffsetRel, 4), ...be(0, 2), ...be(0, 2),
  ];
  return [...A("MPF"), 0x00, ...tiff];
}

// ---------------------------------------------------------------------------
// Segment walk + signature.
// ---------------------------------------------------------------------------

test("walkJpegSegments finds APPn segments and stops at SOS", () => {
  const jpeg = makeJpeg([
    { marker: 0xe1, payload: A("hello") },
    { marker: 0xe2, payload: A("world!!") },
  ]);
  const segs = walkJpegSegments(jpeg);
  assert.equal(segs.length, 2);
  assert.equal(segs[0]!.marker, 0xe1);
  assert.equal(segs[0]!.payloadLength, 5);
  assert.equal(segs[1]!.marker, 0xe2);
  assert.equal(segs[1]!.payloadLength, 7);
});

test("walkJpegSegments rejects non-JPEG", () => {
  assert.deepEqual(walkJpegSegments(new Uint8Array([0x00, 0x01, 0x02])), []);
});

test("hasGainMapSignature detects the hdr-gain-map namespace, else false", () => {
  const withNs = makeJpeg([{ marker: 0xe1, payload: xmpPayload('xmlns:hdrgm="http://ns.adobe.com/hdr-gain-map/1.0/"') }]);
  assert.equal(hasGainMapSignature(withNs), true);
  const plain = makeJpeg([{ marker: 0xe1, payload: xmpPayload("<x:xmpmeta/>") }]);
  assert.equal(hasGainMapSignature(plain), false);
});

// ---------------------------------------------------------------------------
// MPF index.
// ---------------------------------------------------------------------------

/** Locate the "MPF\0" signature in a byte stream (start of the MPF payload). */
function findMpf(bytes: Uint8Array): number {
  for (let i = 0; i + 4 <= bytes.length; i++) {
    if (bytes[i] === 0x4d && bytes[i + 1] === 0x50 && bytes[i + 2] === 0x46 && bytes[i + 3] === 0x00) return i;
  }
  return -1;
}

test("parseMpfSecondImage returns absolute offset+size of the 2nd MP entry", () => {
  // MP-entry offsets are relative to the MPF endian marker (start of "MM"), 4
  // bytes into the "MPF\0" payload. Build the primary, then APPEND a fake
  // second image after it, and point the 2nd MP entry at that appended range.
  const secondSize = 40;
  const probe = makeJpeg([{ marker: 0xe2, payload: mpfPayload(secondSize, 0) }]);
  const tiffStart = findMpf(probe) + 4;
  const baseLen = probe.length; // the appended gain image starts here
  const rel = baseLen - tiffStart;
  const primary = makeJpeg([{ marker: 0xe2, payload: mpfPayload(secondSize, rel) }]);
  const full = new Uint8Array(primary.length + secondSize);
  full.set(primary); // secondSize zero bytes stand in for the gain sub-image
  const range = parseMpfSecondImage(full);
  assert.ok(range, "expected an MPF range");
  assert.equal(range!.size, secondSize);
  assert.equal(range!.offset, baseLen);
});

test("parseMpfSecondImage returns null when there is no MPF segment", () => {
  const jpeg = makeJpeg([{ marker: 0xe1, payload: A("no mpf here") }]);
  assert.equal(parseMpfSecondImage(jpeg), null);
});

// ---------------------------------------------------------------------------
// XMP + metadata parse.
// ---------------------------------------------------------------------------

const PER_CHANNEL_XMP = `<x:xmpmeta><rdf:RDF><rdf:Description
  xmlns:hdrgm="http://ns.adobe.com/hdr-gain-map/1.0/"
  hdrgm:Version="1.0"
  hdrgm:BaseRenditionIsHDR="False"
  hdrgm:OffsetSDR="0.015625"
  hdrgm:OffsetHDR="0.015625"
  hdrgm:HDRCapacityMin="0"
  hdrgm:HDRCapacityMax="2.6">
  <hdrgm:GainMapMin><rdf:Seq><rdf:li>-0.1</rdf:li><rdf:li>-0.2</rdf:li><rdf:li>-0.3</rdf:li></rdf:Seq></hdrgm:GainMapMin>
  <hdrgm:GainMapMax><rdf:Seq><rdf:li>1.9</rdf:li><rdf:li>2.3</rdf:li><rdf:li>1.3</rdf:li></rdf:Seq></hdrgm:GainMapMax>
  <hdrgm:Gamma><rdf:Seq><rdf:li>0.3</rdf:li><rdf:li>0.28</rdf:li><rdf:li>0.32</rdf:li></rdf:Seq></hdrgm:Gamma>
 </rdf:Description></rdf:RDF></x:xmpmeta>`;

test("extractXmp pulls the packet out of an APP1 xap segment", () => {
  const jpeg = makeJpeg([{ marker: 0xe1, payload: xmpPayload(PER_CHANNEL_XMP) }]);
  const xml = extractXmp(jpeg);
  assert.ok(xml && xml.includes("hdr-gain-map"));
});

test("parseGainMapMetadata reads per-channel rdf:Seq fields", () => {
  const meta = parseGainMapMetadata(PER_CHANNEL_XMP);
  assert.ok(meta);
  assert.deepEqual(meta!.gainMapMin, [-0.1, -0.2, -0.3]);
  assert.deepEqual(meta!.gainMapMax, [1.9, 2.3, 1.3]);
  assert.deepEqual(meta!.gamma, [0.3, 0.28, 0.32]);
  assert.equal(meta!.offsetSdr, 0.015625);
  assert.equal(meta!.offsetHdr, 0.015625);
  assert.equal(meta!.hdrCapacityMax, 2.6);
  assert.equal(meta!.baseRenditionIsHdr, false);
});

test("parseGainMapMetadata reads scalar attributes and applies defaults", () => {
  const xml = `<x xmlns:hdrgm="http://ns.adobe.com/hdr-gain-map/1.0/"
    hdrgm:GainMapMax="3.0" hdrgm:HDRCapacityMax="3.0"/>`;
  const meta = parseGainMapMetadata(xml);
  assert.ok(meta);
  assert.deepEqual(meta!.gainMapMax, [3.0]);
  // Defaults: GainMapMin 0, Gamma 1, offsets 1/64, HDRCapacityMin 0.
  assert.deepEqual(meta!.gainMapMin, [0]);
  assert.deepEqual(meta!.gamma, [1]);
  assert.equal(meta!.offsetSdr, 1 / 64);
  assert.equal(meta!.offsetHdr, 1 / 64);
  assert.equal(meta!.hdrCapacityMin, 0);
});

test("parseGainMapMetadata returns null for a non-hdrgm packet", () => {
  assert.equal(parseGainMapMetadata("<x:xmpmeta/>"), null);
});

// ---------------------------------------------------------------------------
// Reconstruction math.
// ---------------------------------------------------------------------------

/** A solid WxH RGBA image with every pixel set to (r,g,b,255). */
function solid(w: number, h: number, r: number, g: number, b: number): RgbaImage {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = 255;
  }
  return { data, width: w, height: h };
}

/** Reference sRGB inverse-OETF (encoded [0,1] → linear). */
function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

test("neutral gain (mid-gray gain sample, symmetric offsets) round-trips the linearized base", () => {
  // gamma=1, min=0, max=1 ⇒ logBoost = recovery. A gain sample of 0 gives
  // logBoost 0 ⇒ gainFactor 1 ⇒ HDR = (SDRlin+off)*1 - off = SDRlin exactly.
  const base = solid(2, 2, 128, 128, 128);
  const gain = solid(2, 2, 0, 0, 0);
  const meta = parseGainMapMetadata(
    `<x xmlns:hdrgm="http://ns.adobe.com/hdr-gain-map/1.0/" hdrgm:GainMapMin="0" hdrgm:GainMapMax="1" hdrgm:Gamma="1" hdrgm:HDRCapacityMax="1"/>`,
  )!;
  const out = reconstructHdrFromGainMap(base, gain, meta);
  const expected = srgbToLinear(128 / 255);
  for (let i = 0; i < out.length; i++) assert.ok(Math.abs(out[i]! - expected) < 1e-5, `px ${i}: ${out[i]} vs ${expected}`);
});

test("full-headroom reconstruction reaches ~2^GainMapMax over a bright base", () => {
  // White base (SDRlin ≈ 1), full gain sample (255 ⇒ recovery 1), gamma 1,
  // min 0, max 2 ⇒ gainFactor = 2^2 = 4. HDR = (1+off)*4 - off.
  const off = 0.015625;
  const base = solid(1, 1, 255, 255, 255);
  const gain = solid(1, 1, 255, 255, 255);
  const meta = parseGainMapMetadata(
    `<x xmlns:hdrgm="http://ns.adobe.com/hdr-gain-map/1.0/" hdrgm:GainMapMin="0" hdrgm:GainMapMax="2" hdrgm:Gamma="1" hdrgm:OffsetSDR="0.015625" hdrgm:OffsetHDR="0.015625" hdrgm:HDRCapacityMax="2"/>`,
  )!;
  const out = reconstructHdrFromGainMap(base, gain, meta);
  const expected = (1 + off) * 4 - off;
  assert.ok(Math.abs(out[0]! - expected) < 1e-4, `${out[0]} vs ${expected}`);
  assert.ok(out[0]! > 1, "bright region must carry >1 headroom");
});

test("reconstruction upsamples a smaller gain map to the base resolution", () => {
  // 4x4 base, 2x2 gain — must not throw and must fill every base pixel.
  const base = solid(4, 4, 200, 200, 200);
  const gain = solid(2, 2, 128, 128, 128);
  const meta = parseGainMapMetadata(
    `<x xmlns:hdrgm="http://ns.adobe.com/hdr-gain-map/1.0/" hdrgm:GainMapMax="2" hdrgm:HDRCapacityMax="2"/>`,
  )!;
  const out = reconstructHdrFromGainMap(base, gain, meta);
  assert.equal(out.length, 4 * 4 * 3);
  for (let i = 0; i < out.length; i++) assert.ok(Number.isFinite(out[i]!) && out[i]! > 0);
});

// ---------------------------------------------------------------------------
// Real-file pure-parse coverage (committed Adobe gain-map fixture).
// ---------------------------------------------------------------------------

test("real Adobe gain-map JPEG: MPF + XMP + metadata parse", () => {
  const buf = readFileSync(new URL("./fixtures/gainmap-benz-1000x667.jpg", import.meta.url));
  const u8 = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  assert.equal(hasGainMapSignature(u8), true);
  const range = parseMpfSecondImage(u8);
  assert.ok(range, "expected a gain-map MPF range");
  // The gain-map sub-image is a valid appended JPEG (starts with SOI FFD8).
  assert.equal(u8[range!.offset], 0xff);
  assert.equal(u8[range!.offset + 1], 0xd8);
  assert.equal(range!.offset + range!.size, u8.length, "2nd image ends at EOF");
  const gainU8 = u8.subarray(range!.offset, range!.offset + range!.size);
  const xml = extractXmp(gainU8);
  assert.ok(xml && xml.includes("hdr-gain-map"), "gain-map sub-image carries hdrgm XMP");
  const meta = parseGainMapMetadata(xml!);
  assert.ok(meta);
  assert.equal(meta!.baseRenditionIsHdr, false);
  assert.equal(meta!.hdrCapacityMax, 2.6);
  assert.equal(meta!.gainMapMax.length, 3, "per-channel GainMapMax");
  assert.ok(Math.abs(meta!.gainMapMax[1]! - 2.314585) < 1e-4);
});
