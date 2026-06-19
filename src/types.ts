export interface VarMeta {
  type: string;            // "DataFrame", "list", "dict", "int", ...
  size: number | number[]; // scalar length, or [rows, cols] for DataFrame
  view: string;            // short preview string
  python_type: string;
  numpy_type: string;
}

export type NamespaceView = Record<string, VarMeta>;

export type Detail =
  | { name: string; type: string; kind: "dataframe"; columns: string[]; index: string[]; data: any[][]; shape: number[]; truncated: boolean; row_offset?: number; row_limit?: number; col_offset?: number; col_limit?: number }
  | { name: string; type: string; kind: "json"; data: any }
  | { name: string; type: string; kind: "scalar"; data: string }
  | { error: string };
