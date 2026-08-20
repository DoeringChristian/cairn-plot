/**
 * GPU-side ASSEMBLY of the content-op registry into WGSL — the content twin of
 * `image/encodings/wgsl.ts`. Pure string building (CORE-SAFE, no device); the
 * image shader (`engine/shaders/image.wgsl.ts`) interpolates the result and
 * calls `cairnContent(sampledA, sampledB, contentOpId)` so the CONTENT stage is
 * consumed THROUGH the registry.
 */
import { getContentOp, listDirectContentOps } from "./registry.ts";

/**
 * The GPU dispatch id of each `direct` content op — the value the engine packs
 * into the `contentOpId` uniform and the shader's `cairnContent` dispatch keys
 * on. Assigned by registration order of the `direct` ops (identity FIRST → 0), so
 * the zero-filled uniform default is IDENTITY (the passthrough) and a pane that
 * sets no op renders bit-for-bit as before. Mirrors `image/encodings`' generated
 * `OPERATOR_ID`. Cached ops are NOT in this map (they render into a result
 * texture the display samples, not an inline dispatch).
 *
 * Computed LAZILY + memoized (like {@link buildContentOpWGSL}) rather than as an
 * eager module-level constant: `export *` from the registry barrel evaluates this
 * module during the ESM dependency phase — BEFORE the barrel's body runs
 * `registerContentOps()` — so eagerly reading the registry here would see it
 * empty. First access (always after the barrel finished registering) is safe.
 */
let ID_MAP: Record<string, number> | undefined;
function contentOpDispatchIds(): Record<string, number> {
  if (ID_MAP) return ID_MAP;
  const map: Record<string, number> = {};
  listDirectContentOps().forEach((op, i) => {
    map[op.id] = i;
  });
  if (map["identity"] !== 0) {
    throw new Error(`content-ops: identity must dispatch to id 0 (the zero-filled default), got ${map["identity"]}`);
  }
  ID_MAP = map;
  return map;
}

/** The dispatch-id map (a fresh snapshot per call is unnecessary — it is memoized;
 *  callers must not mutate it). Named as a getter-style export so downstream code
 *  + tests read the SAME assignment the shader dispatch uses. */
export const CONTENT_OP_ID: Record<string, number> = new Proxy(
  {},
  {
    get: (_t, prop: string) => contentOpDispatchIds()[prop],
    has: (_t, prop: string) => prop in contentOpDispatchIds(),
    ownKeys: () => Reflect.ownKeys(contentOpDispatchIds()),
    getOwnPropertyDescriptor: (_t, prop: string) => {
      const v = contentOpDispatchIds()[prop];
      if (v === undefined) return undefined;
      return { value: v, enumerable: true, configurable: true };
    },
  },
) as Record<string, number>;

/** The dispatch id for a content-op id (0 = identity for an unknown/undefined id,
 *  matching the shader's fallthrough). */
export function contentOpId(id: string | undefined | null): number {
  if (!id) return 0;
  return contentOpDispatchIds()[id] ?? 0;
}

/**
 * Assemble `fn cairnContent(a: vec4<f32>, b: vec4<f32>, opId: i32) -> vec4<f32>`
 * from the registry: an opId dispatch over the `direct` ops (mirroring
 * `buildApplyOperatorWGSL`), with IDENTITY as the fallthrough (`return a;`). Each
 * non-identity direct op emits `if (opId == N) { return <expr>; }` where `<expr>`
 * is the op's `wgsl` over the two sampled slots `a`,`b`. Cached ops assemble no
 * WGSL here — their result texture is bound as slot `a` + displayed via identity.
 *
 * The `a`/`b` slot convention: `a` is the primary/foreground source (single-image
 * = the only source); `b` is the second/reference source (arity-2 diffs). An
 * arity-1 op (identity) ignores `b`, so the single-image path is unaffected by the
 * (placeholder) second slot.
 */
export function buildContentOpWGSL(): string {
  const direct = listDirectContentOps();
  const identity = getContentOp("identity");
  if (!identity || identity.renderClass !== "direct") {
    throw new Error("buildContentOpWGSL: the 'identity' content op is not registered as a direct op");
  }
  const branches = direct
    .filter((op) => op.id !== "identity")
    .map((op) => `  if (opId == ${CONTENT_OP_ID[op.id]}) { return ${op.wgsl}; }`)
    .join("\n");
  return `fn cairnContent(a: vec4<f32>, b: vec4<f32>, opId: i32) -> vec4<f32> {
${branches}
  return ${identity.wgsl};
}`;
}
