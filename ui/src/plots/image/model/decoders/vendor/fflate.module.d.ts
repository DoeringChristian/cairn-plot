/**
 * Minimal ambient types for the vendored `fflate.module.js` — only the synchronous
 * inflate entry points cairn-plot's TS actually imports. fflate exports far more;
 * declare just what we use (the JS-side vendored decoder consumes the rest, and
 * JS→JS imports are not typechecked). See `PROVENANCE.md`.
 */

/** Decompress a raw DEFLATE stream (no zlib/gzip header) — the inverse of `deflateRaw`. */
export declare function inflateSync(data: Uint8Array, opts?: unknown): Uint8Array;

/** Decompress a zlib (RFC 1950) stream. */
export declare function unzlibSync(data: Uint8Array, opts?: unknown): Uint8Array;
