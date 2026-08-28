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
  renderer: string;
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
  /**
   * `normal` creates one internal viewport per child. `stacked` creates one
   * internal viewport whose children are content slots. Switching slots never
   * replaces that viewport's settings.
   */
  mode?: "normal" | "stacked";
  /** Every multi-child grid is switchable by default; false hides the toggle. */
  switchable?: boolean;
}

export interface CompareNode {
  kind: "compare";
  /** Plot definition that owns comparison semantics. Omission means `image`. */
  renderer?: string;
  /** Plot-defined presentation (`overlay`, `difference`, …). */
  presentation?: string;
  /** Legacy image spelling. New descriptors should use `presentation`. */
  mode?: "split" | "diff";
  /** Ordered comparison inputs. New descriptors should use this form. */
  operands?: DataSpec[];
  /** How the plot definition groups the operands into visible outputs. */
  strategy?: "reference" | "all";
  referenceIndex?: number;
  /** Legacy two-operand inputs, normalized immediately by the runtime. */
  a?: DataSpec;
  b?: DataSpec;
  baselineIndex?: 0 | 1;
  diffSubmode?: string;
  align?: "top-left" | "center" | "top-right" | "bottom-left" | "bottom-right";
  fit?: "crop" | "fill";
  props?: Record<string, JsonValue>;
}

export interface SharedProps {
  colormap?: string;
  colorRange?: [number, number];
  colorbar?: boolean;
  reference?: DataSpec;
  sync?: { viewport?: boolean; camera?: boolean };
}

/** The one durable recursive plot specification shared by Python and JS. */
export interface PlotDescriptor {
  root: PlotNode;
  /** Standalone bootstrap transport metadata; PlotHost always receives DataSource explicitly. */
  mode?: "local" | "endpoint";
  endpoint?: string;
}

/** Public spelling. Kept aliased to avoid a second wire format. */
export type PlotSpec = PlotDescriptor;
