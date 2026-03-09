/**
 * SheetSync — Comparison Engine
 *
 * Pure function: no side effects, fully testable.
 * Compares source rows against primary sheet rows
 * and produces a structured diff result.
 */

import type {
  SheetRow,
  ColumnMapping,
  ComparisonResult,
  NewLead,
  UpdateLead,
  SkippedRow,
  MatchField,
} from '@/types/sync';
import { emptyTargetRow } from '@/lib/schema';

// ─── Normalization ───────────────────────────────────────────

/** Trim and lowercase an email */
export function normalizeEmail(value: string | undefined | null): string {
  if (!value) return '';
  return value.trim().toLowerCase();
}

/** Trim and strip spaces/dashes from a phone number */
export function normalizePhone(value: string | undefined | null): string {
  if (!value) return '';
  return value.trim().replace(/[\s\-()]/g, '');
}

/** Check if a string value is blank/empty after trimming */
export function isBlank(value: string | undefined | null): boolean {
  return !value || value.trim() === '';
}

// ─── Key Extraction ──────────────────────────────────────────

interface RowKey {
  email: string;
  phone: string;
}

function extractKey(row: SheetRow): RowKey {
  return {
    email: normalizeEmail(row['Email']),
    phone: normalizePhone(row['Phoneno']),
  };
}

// ─── Map Source Row to Target Schema ─────────────────────────

function mapSourceRow(
  sourceRow: SheetRow,
  mappings: ColumnMapping[]
): SheetRow {
  const mapped = emptyTargetRow();
  for (const m of mappings) {
    const sourceValue = sourceRow[m.sourceColumn];
    if (sourceValue !== undefined) {
      mapped[m.targetColumn] = sourceValue;
    }
  }
  return mapped;
}

// ─── Primary Lookup Map ──────────────────────────────────────

interface PrimaryEntry {
  row: SheetRow;
  index: number;
}

interface PrimaryLookup {
  byEmail: Map<string, PrimaryEntry>;
  byPhone: Map<string, PrimaryEntry>;
}

function buildPrimaryLookup(primaryRows: SheetRow[]): PrimaryLookup {
  const byEmail = new Map<string, PrimaryEntry>();
  const byPhone = new Map<string, PrimaryEntry>();

  for (let i = 0; i < primaryRows.length; i++) {
    const row = primaryRows[i];
    const key = extractKey(row);

    if (key.email) {
      byEmail.set(key.email, { row, index: i });
    }
    if (key.phone) {
      byPhone.set(key.phone, { row, index: i });
    }
  }

  return { byEmail, byPhone };
}

function findMatch(
  key: RowKey,
  lookup: PrimaryLookup,
  matchFields: MatchField[]
): { entry: PrimaryEntry; matchedBy: MatchField; matchValue: string } | null {
  for (const field of matchFields) {
    if (field === 'email' && key.email) {
      const entry = lookup.byEmail.get(key.email);
      if (entry) return { entry, matchedBy: 'email', matchValue: key.email };
    }
    if (field === 'phoneno' && key.phone) {
      const entry = lookup.byPhone.get(key.phone);
      if (entry) return { entry, matchedBy: 'phoneno', matchValue: key.phone };
    }
  }
  return null;
}

// ─── Main Comparison ─────────────────────────────────────────

const BATCH_SIZE = 200;

export interface ComparisonProgress {
  processed: number;
  total: number;
}

/** Synchronous version — kept for tests */
export function runComparison(
  primaryRows: SheetRow[],
  sourceRows: SheetRow[],
  columnMappings: ColumnMapping[],
  matchFields: MatchField[] = ['email', 'phoneno']
): ComparisonResult {
  const newLeads: NewLead[] = [];
  const updates: UpdateLead[] = [];
  const skipped: SkippedRow[] = [];

  const lookup = buildPrimaryLookup(primaryRows);

  for (const sourceRow of sourceRows) {
    processRow(sourceRow, lookup, columnMappings, matchFields, newLeads, updates, skipped);
  }

  return {
    newLeads,
    updates,
    skipped,
    summary: {
      newLeadCount: newLeads.length,
      updateCount: updates.length,
      skippedCount: skipped.length,
    },
  };
}

/** Async batched version — reports progress via callback */
export function runComparisonAsync(
  primaryRows: SheetRow[],
  sourceRows: SheetRow[],
  columnMappings: ColumnMapping[],
  onProgress: (p: ComparisonProgress) => void,
  matchFields: MatchField[] = ['email', 'phoneno']
): Promise<ComparisonResult> {
  return new Promise((resolve) => {
    const newLeads: NewLead[] = [];
    const updates: UpdateLead[] = [];
    const skipped: SkippedRow[] = [];
    const lookup = buildPrimaryLookup(primaryRows);
    const total = sourceRows.length;
    let index = 0;

    function processBatch() {
      const end = Math.min(index + BATCH_SIZE, total);
      while (index < end) {
        processRow(sourceRows[index], lookup, columnMappings, matchFields, newLeads, updates, skipped);
        index++;
      }
      onProgress({ processed: index, total });

      if (index < total) {
        setTimeout(processBatch, 0);
      } else {
        resolve({
          newLeads,
          updates,
          skipped,
          summary: {
            newLeadCount: newLeads.length,
            updateCount: updates.length,
            skippedCount: skipped.length,
          },
        });
      }
    }

    onProgress({ processed: 0, total });
    setTimeout(processBatch, 0);
  });
}

// ─── Shared row processor ─────────────────────────────────────

function processRow(
  sourceRow: SheetRow,
  lookup: PrimaryLookup,
  columnMappings: ColumnMapping[],
  matchFields: MatchField[],
  newLeads: NewLead[],
  updates: UpdateLead[],
  skipped: SkippedRow[]
) {
  const mapped = mapSourceRow(sourceRow, columnMappings);
  const key: RowKey = {
    email: normalizeEmail(mapped['Email']),
    phone: normalizePhone(mapped['Phoneno']),
  };

  if (!key.email && !key.phone) {
    skipped.push({ sourceRow, reason: 'No usable Email or Phoneno' });
    return;
  }

  const match = findMatch(key, lookup, matchFields);

  if (!match) {
    newLeads.push({ mappedRow: mapped });
  } else {
    const fieldsToFill: Record<string, string> = {};
    for (const m of columnMappings) {
      const targetCol = m.targetColumn;
      const primaryValue = match.entry.row[targetCol];
      const sourceValue = mapped[targetCol];
      if (isBlank(primaryValue) && !isBlank(sourceValue)) {
        fieldsToFill[targetCol] = sourceValue!.trim();
      }
    }
    if (Object.keys(fieldsToFill).length > 0) {
      updates.push({
        primaryRowIndex: match.entry.index,
        matchedBy: match.matchedBy,
        matchValue: match.matchValue,
        fieldsToFill,
      });
    } else {
      skipped.push({ sourceRow, reason: 'Matched but no blank fields to fill' });
    }
  }
}
