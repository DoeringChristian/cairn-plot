import type { ComponentType } from "react";

import type { JsonValue } from "../../../../packages/spec/src/json.ts";
import type { DataSource } from "../../resources/data/data-sources.ts";
import type { ColumnType, TableData } from "./renderer/Table.tsx";
import type { CellComparison } from "./diff.ts";
import type { SettingsRecord } from "../contracts.ts";
import { ensureInlinePlotType, type InlineSpec } from "../inline-register.ts";
import type { ReactPlotViewProps } from "../react-view.ts";

export interface TablePresentation {
  readonly table: TableData;
  readonly rowsPerPage?: number;
  readonly hiddenColumns?: readonly string[];
  readonly invertDiff?: boolean;
  readonly diffStatuses?: readonly (readonly CellComparison[])[];
  readonly height?: number;
}

export type TableSettings = SettingsRecord & {
  "table.sort"?: { column: string; direction: "asc" | "desc" } | null;
  "table.filter"?: string;
  "table.page"?: number;
};

export function projectTableSettings(settings: Readonly<SettingsRecord>): TableSettings {
  const projected: TableSettings = {};
  const sort = settings["table.sort"];
  const filter = settings["table.filter"];
  const page = settings["table.page"];
  if (sort === null || isSort(sort)) projected["table.sort"] = sort;
  if (typeof filter === "string") projected["table.filter"] = filter;
  if (typeof page === "number" && Number.isInteger(page) && page >= 0) {
    projected["table.page"] = page;
  }
  return projected;
}

function tablePresentation(value: Record<string, unknown>): TablePresentation {
  const table = value.table;
  if (table === null || typeof table !== "object" || Array.isArray(table)) {
    throw new Error("cairn-plot: table presentation requires typed table data");
  }
  const record = table as Record<string, unknown>;
  if (!Array.isArray(record.columns) || !record.columns.every(isColumn) ||
      !Array.isArray(record.data) || !record.data.every((row) => Array.isArray(row))) {
    throw new Error("cairn-plot: table presentation requires typed columns and rows");
  }
  const width = record.columns.length;
  if (record.data.some((row) => row.length !== width)) {
    throw new Error("cairn-plot: table rows must match the column count");
  }
  return value as unknown as TablePresentation;
}

function isColumn(value: unknown): value is { name: string; type: ColumnType } {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const column = value as Record<string, unknown>;
  return typeof column.name === "string" &&
    (column.type === "number" || column.type === "string" ||
      column.type === "bool" || column.type === "other");
}

function isSort(value: JsonValue | undefined): value is { column: string; direction: "asc" | "desc" } {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  return typeof value.column === "string" &&
    (value.direction === "asc" || value.direction === "desc");
}

export function ensureTablePlotType(
  View: ComponentType<ReactPlotViewProps<TablePresentation, TableSettings>>,
  resolve: (spec: InlineSpec, source: DataSource) => Promise<Record<string, unknown>>,
): void {
  ensureInlinePlotType<TablePresentation, TableSettings>({
    kind: "table",
    View,
    resolve,
    parse: tablePresentation,
    settings: { defaults: () => ({}), project: projectTableSettings },
  });
}
