import type { ComponentType } from "react";

import type { ColormapName, ParallelColumn, ParallelRow } from "../types.ts";
import { ensureInlinePlotType, } from "../inline-register.ts";
import type { ReactPlotViewProps } from "../react-view.ts";

interface ParallelDomain {
  readonly min: number;
  readonly max: number;
  readonly isNumeric: boolean;
}

export interface ParallelPresentation {
  readonly columns: readonly ParallelColumn[];
  readonly rows: readonly ParallelRow[];
  readonly columnDomains: readonly ParallelDomain[];
  readonly colormap?: ColormapName;
  readonly className?: string;
  readonly height?: number;
}

type ParallelSettings = Record<string, never>;

function parallelPresentation(value: Record<string, unknown>): ParallelPresentation {
  if (!Array.isArray(value.columns) || !value.columns.every(isParallelColumn) ||
      !Array.isArray(value.rows) || !value.rows.every(isParallelRow) ||
      !Array.isArray(value.columnDomains) || !value.columnDomains.every(isParallelDomain)) {
    throw new Error("cairn-plot: parallel presentation requires typed columns, rows, and domains");
  }
  const width = value.columns.length;
  if (value.columnDomains.length !== width ||
      value.rows.some((row) => row.values.length !== width || row.raw.length !== width)) {
    throw new Error("cairn-plot: parallel rows and domains must match the column count");
  }
  return value as unknown as ParallelPresentation;
}

function isParallelColumn(value: unknown): value is ParallelColumn {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const column = value as Record<string, unknown>;
  return typeof column.key === "string" &&
    (column.source === "param" || column.source === "metric") &&
    (column.log === undefined || typeof column.log === "boolean") &&
    (column.invert === undefined || typeof column.invert === "boolean");
}

function isParallelRow(value: unknown): value is ParallelRow {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === "string" && Array.isArray(row.values) &&
    row.values.every((item) => item === null ||
      (typeof item === "number" && Number.isFinite(item))) &&
    Array.isArray(row.raw) && row.raw.every((item) => item === null || typeof item === "string");
}

function isParallelDomain(value: unknown): value is ParallelDomain {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const domain = value as Record<string, unknown>;
  return typeof domain.min === "number" && Number.isFinite(domain.min) &&
    typeof domain.max === "number" && Number.isFinite(domain.max) &&
    typeof domain.isNumeric === "boolean";
}

export function ensureParallelPlotType(
  View: ComponentType<ReactPlotViewProps<ParallelPresentation, ParallelSettings>>,
): void {
  ensureInlinePlotType<ParallelPresentation, ParallelSettings>({
    kind: "parallel",
    View,
    parse: parallelPresentation,
    settings: { defaults: () => ({}), project: () => ({}) },
  });
}
