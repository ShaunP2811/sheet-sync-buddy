/**
 * SheetSync — Target Schema & Constants
 */

import { TARGET_SCHEMA, type TargetColumn } from '@/types/sync';

export { TARGET_SCHEMA };

/** Set of valid target columns for fast lookup */
export const TARGET_COLUMN_SET = new Set<string>(TARGET_SCHEMA);

/** Check if a string is a valid target column */
export function isTargetColumn(col: string): col is TargetColumn {
  return TARGET_COLUMN_SET.has(col);
}

/** Get the column index in the target schema (0-based) */
export function getColumnIndex(col: TargetColumn): number {
  return TARGET_SCHEMA.indexOf(col);
}

/** Build an empty row with all target columns set to empty string */
export function emptyTargetRow(): Record<TargetColumn, string> {
  const row = {} as Record<TargetColumn, string>;
  for (const col of TARGET_SCHEMA) {
    row[col] = '';
  }
  return row;
}

/** Convert a mapped row to an ordered array matching target schema */
export function rowToArray(row: Record<string, string>): string[] {
  return TARGET_SCHEMA.map((col) => row[col] ?? '');
}

/** Convert a mapped row to an ordered array matching given headers */
export function rowToArrayByHeaders(row: Record<string, string>, headers: string[]): string[] {
  return headers.map((col) => row[col] ?? '');
}
