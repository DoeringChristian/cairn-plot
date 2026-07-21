/* tslint:disable */
/* eslint-disable */

/**
 * A decoded EXR image handed to JS. `precision` is `"f16-bits"` or `"f32"`;
 * read `halfBits` when it is `"f16-bits"`, else `floats`.
 */
export class DecodedImage {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    readonly channels: number;
    /**
     * Interleaved f32 samples when `precision === "f32"`, else null.
     */
    readonly floats: Float32Array | undefined;
    /**
     * Interleaved half bit patterns when `precision === "f16-bits"`, else null.
     */
    readonly halfBits: Uint16Array | undefined;
    readonly height: number;
    /**
     * `"f16-bits"` | `"f32"`.
     */
    readonly precision: string;
    readonly width: number;
}

/**
 * Decode an OpenEXR file. Throws a JS `Error` on failure; unsupported inputs
 * (HTJ2K compression, luminance-chroma layout) throw an error whose `.code` is
 * `"unsupported-compression"` / `"unsupported-channel-layout"` so the caller
 * can fall back to the TS decoder. NOTE: the full classic compression set
 * including DWAA/DWAB IS supported and decodes normally.
 */
export function decode_exr(bytes: Uint8Array): DecodedImage;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_decodedimage_free: (a: number, b: number) => void;
    readonly decode_exr: (a: number, b: number, c: number) => void;
    readonly decodedimage_channels: (a: number) => number;
    readonly decodedimage_floats: (a: number) => number;
    readonly decodedimage_halfBits: (a: number) => number;
    readonly decodedimage_height: (a: number) => number;
    readonly decodedimage_precision: (a: number, b: number) => void;
    readonly decodedimage_width: (a: number) => number;
    readonly __wbindgen_export: (a: number) => void;
    readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
    readonly __wbindgen_export2: (a: number, b: number) => number;
    readonly __wbindgen_export3: (a: number, b: number, c: number) => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
