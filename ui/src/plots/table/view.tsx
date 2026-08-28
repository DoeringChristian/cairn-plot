import Table from "../../lib/cairn-plot/renderers/Table.tsx";
import type { ReactPlotViewProps } from "../react-view.ts";
import type { TablePresentation, TableSettings } from "./register.ts";

export function TablePlotView({ presentation: p, settings, commands }: ReactPlotViewProps<TablePresentation, TableSettings>) {
  return <Table
    table={p.table ?? { columns: [], data: [] }}
    rowsPerPage={p.rowsPerPage ?? 20}
    hiddenColumns={[...(p.hiddenColumns ?? [])]}
    diffStatuses={p.diffStatuses?.map((row) => [...row])}
    invertDiff={p.invertDiff}
    state={{
      sort: settings["table.sort"] ?? null,
      filter: settings["table.filter"] ?? "",
      page: settings["table.page"] ?? 0,
    }}
    onStateChange={(state) => commands.patch({
      "table.sort": state.sort,
      "table.filter": state.filter,
      "table.page": state.page,
    })}
  />;
}
