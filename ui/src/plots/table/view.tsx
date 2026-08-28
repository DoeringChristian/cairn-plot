import Table from "../../lib/cairn-plot/renderers/Table.tsx";
import type { PlotViewProps } from "../view-props.ts";
import type { TableSettings } from "./register.ts";

export function TablePlotView(p: PlotViewProps) {
  const settings = (p.syncedSettings ?? {}) as TableSettings;
  const patch = p.setSyncedSettings as ((patch: TableSettings) => void) | undefined;
  return <Table
    table={p.table ?? { columns: [], data: [] }}
    rowsPerPage={p.rowsPerPage ?? 20}
    hiddenColumns={p.hiddenColumns ?? []}
    diffStatuses={p.diffStatuses}
    invertDiff={p.invertDiff}
    state={{
      sort: settings["table.sort"] ?? null,
      filter: settings["table.filter"] ?? "",
      page: settings["table.page"] ?? 0,
    }}
    onStateChange={(state) => patch?.({
      "table.sort": state.sort,
      "table.filter": state.filter,
      "table.page": state.page,
    })}
  />;
}
