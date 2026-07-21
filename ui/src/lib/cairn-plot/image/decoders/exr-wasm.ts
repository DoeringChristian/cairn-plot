/**
 * `image/decoders/exr-wasm.ts` — the WASM-first EXR decode core (P4 Phase B).
 *
 * Wraps the Rust/WASM OpenEXR decoder (the `exr` crate, compiled to WASM and
 * embedded as inline base64 in `wasm-inline/`) and layers the TS full decoder
 * (`exr-full.ts`) as the fallback. This is the *testable core* the Web Worker
 * (`exr-worker.ts`) runs and the main-thread path (`exr-decode.ts`) reuses when
 * no `Worker` is available — it needs no DOM/Worker, so `node:test` exercises it
 * directly.
 *
 * Decode strategy (WASM-first):
 *   1. instantiate the inline WASM decoder ONCE per process (memoized promise)
 *      and decode. All-HALF sources come back as raw f16 BIT PATTERNS
 *      (`precision:"f16-bits"`, zero-widening GPU path); everything else as f32.
 *   2. fall back to the proven TS decoder (`decodeExrBuffer`) when WASM cannot
 *      handle the input — a typed `unsupported-compression` (HTJ2K) /
 *      `unsupported-channel-layout` (luminance-chroma) error, a WASM
 *      instantiation failure, OR any other WASM decode error. Falling back on
 *      ANY WASM failure is strictly a superset of the two typed cases and can
 *      never regress: the TS decoder is the previously-shipped path, so any file
 *      it handled before still routes through it.
 *
 * The WASM getters (`halfBits`/`floats`) return JS-OWNED copies out of WASM
 * linear memory (the wasm-bindgen glue does `new Uint16Array(view)` /
 * `new Float32Array(view)`), so the returned typed array survives `.free()` and
 * its `.buffer` is a transferable — no extra copy needed here.
 */
import type { DecodedImage } from "../decoders.ts";
import { decodeExrBuffer } from "./exr-full.ts";
import { loadExrDecoder } from "./wasm-inline/wasm-exr-inline.ts";

type F32Image = Extract<DecodedImage, { kind: "f32" }>;

/** The subset of the inline WASM module this core depends on (for injection). */
export type ExrWasmLoader = typeof loadExrDecoder;

/**
 * The typed error codes the WASM decoder raises for inputs only the TS decoder
 * can (attempt to) handle. Any other WASM error also falls back — see the module
 * doc — but these are the *expected*, non-exceptional fallbacks.
 */
const WASM_FALLBACK_CODES = new Set([
  "unsupported-compression",
  "unsupported-channel-layout",
]);

/** True for a WASM error whose `.code` is an expected unsupported-input signal. */
export function isWasmUnsupportedError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    typeof (err as { code?: unknown }).code === "string" &&
    WASM_FALLBACK_CODES.has((err as { code: string }).code)
  );
}

/**
 * Decode EXR bytes, WASM-first with a TS fallback. Returns the canonical f32
 * variant of {@link DecodedImage}: `precision:"f16-bits"` (a `Uint16Array` of
 * raw f16 bit patterns) for all-HALF WASM output, else `precision:"f32"`.
 *
 * `loadDecoder` is injectable purely for tests (force an unsupported error or an
 * instantiation failure); production always uses the inline module's loader.
 */
export async function decodeExrPreferWasm(
  buffer: ArrayBuffer,
  loadDecoder: ExrWasmLoader = loadExrDecoder,
): Promise<F32Image> {
  try {
    const { decode_exr } = await loadDecoder();
    const img = decode_exr(new Uint8Array(buffer));
    try {
      const width = img.width;
      const height = img.height;
      const channels = img.channels;
      if (img.precision === "f16-bits") {
        const half = img.halfBits;
        if (!half) throw new Error("cairn-plot EXR/WASM: missing f16 payload");
        return { kind: "f32", data: half, width, height, channels, precision: "f16-bits" };
      }
      const floats = img.floats;
      if (!floats) throw new Error("cairn-plot EXR/WASM: missing f32 payload");
      return { kind: "f32", data: floats, width, height, channels, precision: "f32" };
    } finally {
      // Release WASM-side memory; the payload above is a JS-owned copy that
      // outlives this call.
      img.free();
    }
  } catch {
    // WASM-first, TS-fallback: typed unsupported input (see
    // isWasmUnsupportedError), instantiation failure, or any other WASM error →
    // let the proven TS decoder handle it. (A genuine bad-file error will
    // resurface from the TS path, and the registry-level fallback in
    // exr-decode.ts still tries the pure reader after that.)
    return decodeExrBuffer(buffer);
  }
}
