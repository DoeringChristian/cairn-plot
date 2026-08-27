import type { Invalidation } from "../../spec/src/settings.ts";

export function planSceneUpdate(invalidation: Invalidation): "none" | "render" | "layout" | "remount" {
  if (invalidation === "none") return "none";
  if (invalidation === "layout") return "layout";
  if (invalidation === "remount") return "remount";
  return "render";
}
