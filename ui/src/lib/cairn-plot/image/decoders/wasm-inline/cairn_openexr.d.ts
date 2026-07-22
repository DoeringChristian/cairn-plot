/* Hand-written type for the Emscripten OpenEXR glue (cairn_openexr.mjs). */
export interface CairnOpenExrModule {
  _malloc(n: number): number;
  _free(p: number): void;
  _cairn_exr_decode(ptr: number, len: number): number;
  _cairn_exr_free(r: number): void;
  HEAPU8: Uint8Array;
  HEAPU16: Uint16Array;
  HEAP32: Int32Array;
  HEAPF32: Float32Array;
  UTF8ToString(ptr: number): string;
}
export interface CairnOpenExrInit {
  instantiateWasm?(
    imports: WebAssembly.Imports,
    done: (instance: WebAssembly.Instance) => void,
  ): unknown;
}
export default function CairnOpenExr(init?: CairnOpenExrInit): Promise<CairnOpenExrModule>;
