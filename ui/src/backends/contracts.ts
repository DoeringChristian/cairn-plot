/** Framework-independent lifecycle shared by every concrete plot backend. */

export type BackendTechnology = "dom" | "canvas2d" | "webgpu" | "three";

export interface RenderEnvironment {
  readonly webgpu: boolean;
  readonly webgl2: boolean;
  readonly pixelRatio: number;
}

export interface BackendSupport {
  readonly supported: boolean;
  readonly priority?: number;
  readonly reason?: string;
}

export type SemanticInvalidation =
  | "none"
  | "presentation"
  | "content"
  | "layout"
  | "remount";

/** The only way a backend may change its owning cell's settings. */
export interface SettingsCommandPort<TSettings> {
  patch(patch: Partial<TSettings>): void;
  reset(): void;
}

export interface BackendInput<TPresentation, TSettings> {
  readonly presentation: TPresentation;
  readonly settings: Readonly<TSettings>;
  readonly commands: SettingsCommandPort<TSettings>;
  readonly invalidation: SemanticInvalidation;
}
