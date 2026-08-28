/**
 * ONE horizontal-alignment contract shared by a Table column's header cell and
 * its body cells. Before this, header cells were ALWAYS left-aligned while
 * numeric body cells were right-aligned (`mono text-right`), so a numeric
 * column's header text sat far from the column of numbers under it. Deriving
 * both the `<th>` and the `<td>` alignment from this single function keeps a
 * header directly above its cells.
 *
 * Convention: numeric columns right-align (both header and cells), everything
 * else left-aligns.
 */
import type { ColumnType } from "./Table";

export type ColumnAlign = "left" | "right";

export function columnAlign(type: ColumnType | undefined): ColumnAlign {
  return type === "number" ? "right" : "left";
}

export interface ColumnAlignClasses {
  align: ColumnAlign;
  /** Flex-row classes for the header's inner name+arrow group. */
  header: string;
  /** Text classes for a body `<td>` (mono tabular figures when numeric). */
  cell: string;
  /** True when the sort arrow should sit LEFT of the name (right-aligned cols),
   *  so the header NAME's right edge lines up with the right-aligned numbers. */
  arrowFirst: boolean;
}

export function columnAlignClasses(
  type: ColumnType | undefined,
): ColumnAlignClasses {
  const align = columnAlign(type);
  if (align === "right") {
    return {
      align,
      header: "flex items-center justify-end",
      cell: "mono text-right",
      arrowFirst: true,
    };
  }
  return {
    align,
    header: "flex items-center",
    cell: "",
    arrowFirst: false,
  };
}
