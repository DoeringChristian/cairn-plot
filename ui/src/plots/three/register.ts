import type { DataSpec } from "../../../../packages/spec/src/spec.ts";
import type { DataSource } from "../../resources/data/data-source.ts";
import { definePlot, type SettingsRecord } from "../contracts.ts";
import { getPlotType } from "../registry.ts";
import { registerReactPlotType } from "../react-registry.ts";
import {
  fetchBoxesArrays,
  fetchMeshArrays,
  fetchPointCloudArrays,
  fetchVolumeArray,
} from "../artifact-resolvers.ts";

export type ThreePlotKind = "pointcloud" | "mesh" | "volume" | "boxes3d";
type NpzSpec = Extract<DataSpec, { kind: "npz" }>;

export interface ThreePresentation extends Record<string, unknown> {
  readonly item: unknown;
}

function validateThreeData(kind: ThreePlotKind, value: DataSpec): NpzSpec {
  if (value.kind !== "npz" || value.objectType !== kind) {
    throw new Error(`cairn-plot: ${kind} requires npz data with objectType ${kind}`);
  }
  return value;
}

function threePresentation(value: Record<string, unknown>): ThreePresentation {
  if (value.item === null || typeof value.item !== "object" || Array.isArray(value.item)) {
    throw new Error("cairn-plot: 3D presentation requires a resolved item");
  }
  return value as ThreePresentation;
}

async function resolveThreeArrays(spec: NpzSpec, source: DataSource) {
  if (!spec.hash) throw new Error("npz DataSpec has no hash to resolve");
  switch (spec.objectType) {
    case "pointcloud": return fetchPointCloudArrays(spec.hash, source);
    case "mesh": return fetchMeshArrays(spec.hash, source);
    case "volume": return { data: await fetchVolumeArray(spec.hash, source) };
    case "boxes3d": return fetchBoxesArrays(spec.hash, source);
  }
}

/** Core-owned semantic definitions; the optional addon installs their backends. */
export function ensureThreePlotTypes(): void {
  for (const kind of ["pointcloud", "mesh", "volume", "boxes3d"] as const) {
    if (getPlotType(kind)) continue;
    registerReactPlotType({
      definition: definePlot<NpzSpec, Record<string, unknown>, SettingsRecord, ThreePresentation>({
        kind,
        data: { validate: (value) => validateThreeData(kind, value) },
        settings: {
          defaults: () => ({}),
          project: (settings) => {
            const camera = settings["scene3d.camera"];
            const projected: SettingsRecord = {};
            if (camera !== undefined) projected["scene3d.camera"] = camera;
            return projected;
          },
        },
        resolve: async (spec, context) => {
          const arrays = await resolveThreeArrays(spec, context.source);
          return { item: { arrays, meta: spec.meta } };
        },
        present: threePresentation,
      }),
      backends: [],
    });
  }
}
