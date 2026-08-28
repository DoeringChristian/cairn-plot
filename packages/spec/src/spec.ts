import type { JsonValue } from "./json.ts";

/** JSON-safe data consumed by a renderer. */
export type DataSpec =
  | { kind: "inline"; props: Record<string, JsonValue> }
  | { kind: "image"; hash: string | null; referenceHash?: string | null; metadata?: string | null; format?: string; url?: string; part?: number | string; layer?: string | string[] }
  | { kind: "npz"; hash: string | null; objectType: "pointcloud" | "mesh" | "volume" | "boxes3d"; meta: Record<string, JsonValue> }
  | { kind: "imghdr"; hash: string | null; meta: Record<string, JsonValue> }
  | { kind: "url"; src: string; referenceSrc?: string | null; metadata?: string | null };

export type PlotNode = PlotLeafNode | GridNode | CompareNode;

export interface PlotLeafNode {
  kind: "plot";
  type: string;
  props?: Record<string, JsonValue>;
  data: DataSpec;
}

export interface GridNode {
  kind: "grid";
  children: PlotNode[];
  cols?: number;
  colWidths?: Array<number | string>;
  rowHeights?: Array<number | string>;
  gap?: number | string;
  shared?: SharedProps;
  /** Authored initial layout. The runtime may store a different active layout. */
  initialLayout?: "grid" | "stack";
  /** Every multi-child grid is switchable by default; false hides the toggle. */
  switchable?: boolean;
}

export interface CompareNode {
  kind: "compare";
  /** Plot definition that owns comparison semantics. */
  type: string;
  /** Plot-defined presentation (`overlay`, `difference`, …). */
  presentation: string;
  /** Ordered comparison inputs. */
  operands: DataSpec[];
  /** How the plot definition groups the operands into visible outputs. */
  strategy: "reference" | "all";
  referenceIndex?: number;
  props?: Record<string, JsonValue>;
}

export interface SharedProps {
  colormap?: string;
  colorRange?: [number, number];
  colorbar?: boolean;
  reference?: DataSpec;
  sync?: { view?: boolean; camera?: boolean };
}

/** The one durable recursive plot specification shared by Python and JS. */
export interface PlotSpec {
  root: PlotNode;
  /** Standalone bootstrap transport metadata; PlotHost always receives DataSource explicitly. */
  mode?: "local" | "endpoint";
  endpoint?: string;
}
