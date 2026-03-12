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
import { TARGET_SCHEMA } from '@/types/sync';
import { emptyTargetRow } from '@/lib/schema';

// ─── Normalization ───────────────────────────────────────────

/** Trim and lowercase an email */
export function normalizeEmail(value: string | undefined | null): string {
  if (!value) return '';
  return value.trim().toLowerCase();
}

/** Trim and strip spaces/dashes and leading p:+ prefix from a phone number */
export function normalizePhone(value: string | undefined | null): string {
  if (!value) return '';
  return value.trim().replace(/[\s\-()]/g, '').replace(/^p?:?\+?/i, '');
}

/** Parse various date formats and return DD/MM/YYYY HH:mm:ss */
export function normalizeDate(value: string | undefined | null): string {
  if (!value || !value.trim()) return '';
  const raw = value.trim();

  // Already in DD/MM/YYYY format — return as-is (zero-padded)
  const ddmmMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2}):(\d{1,2}))?$/);
  if (ddmmMatch) {
    const dd = ddmmMatch[1].padStart(2, '0');
    const mm = ddmmMatch[2].padStart(2, '0');
    const yyyy = ddmmMatch[3];
    if (ddmmMatch[4]) {
      const hh = ddmmMatch[4].padStart(2, '0');
      const min = ddmmMatch[5].padStart(2, '0');
      const ss = ddmmMatch[6].padStart(2, '0');
      return `${dd}/${mm}/${yyyy} ${hh}:${min}:${ss}`;
    }
    return `${dd}/${mm}/${yyyy} 00:00:00`;
  }

  let date: Date | null = null;

  // Format: "2026-02-06 02:22:57(UTC+08:00)" — strip the "(UTC+HH:MM)" suffix
  const utcSuffixMatch = raw.match(/^(.+?)\(UTC([+-]\d{2}:\d{2})\)$/i);
  if (utcSuffixMatch) {
    // Parse as "datetime+offset" by appending the offset
    date = new Date(utcSuffixMatch[1].trim() + utcSuffixMatch[2]);
  }

  // Format: ISO 8601 "2026-03-02T08:06:09+08:00" or similar
  if (!date || isNaN(date.getTime())) {
    date = new Date(raw);
  }

  if (!date || isNaN(date.getTime())) return raw; // Can't parse, return as-is

  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');

  return `${dd}/${mm}/${yyyy} ${hh}:${min}:${ss}`;
}

/** Check if a string value is blank/empty after trimming */
export function isBlank(value: string | undefined | null): boolean {
  return !value || value.trim() === '';
}

// ─── Key Column Detection ────────────────────────────────────

const normCol = (s: string) => s.toLowerCase().replace(/[\s_\-()]/g, '');

interface KeyColumns {
  emailCol: string | null;
  phoneCol: string | null;
}

/** Detect which header names correspond to email and phone columns */
export function detectKeyColumns(headers: string[]): KeyColumns {
  let emailCol: string | null = null;
  let phoneCol: string | null = null;
  for (const h of headers) {
    const n = normCol(h);
    if (!emailCol && (n === 'email' || n === 'emailaddress')) emailCol = h;
    if (!phoneCol && (n === 'phoneno' || n === 'phone' || n === 'phonenumber' || n === 'phoneno.')) phoneCol = h;
  }
  return { emailCol, phoneCol };
}

// ─── Key Extraction ──────────────────────────────────────────

interface RowKey {
  email: string;
  phone: string;
}

function extractKey(row: SheetRow, keyCols: KeyColumns): RowKey {
  return {
    email: keyCols.emailCol ? normalizeEmail(row[keyCols.emailCol]) : '',
    phone: keyCols.phoneCol ? normalizePhone(row[keyCols.phoneCol]) : '',
  };
}

// ─── Map Source Row to Target Schema ─────────────────────────

export function mapSourceRow(
  sourceRow: SheetRow,
  mappings: ColumnMapping[],
  targetHeaders?: string[]
): SheetRow {
  const mapped: SheetRow = {};
  const headers = targetHeaders || [...TARGET_SCHEMA];
  for (const h of headers) {
    mapped[h] = '';
  }
  for (const m of mappings) {
    const sourceValue = sourceRow[m.sourceColumn];
    if (sourceValue !== undefined) {
      const n = normCol(m.targetColumn);
      if (n === 'phoneno' || n === 'phone' || n === 'phonenumber') {
        mapped[m.targetColumn] = normalizePhone(sourceValue);
      } else if (n === 'date') {
        mapped[m.targetColumn] = normalizeDate(sourceValue);
      } else {
        mapped[m.targetColumn] = sourceValue;
      }
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

function buildPrimaryLookup(primaryRows: SheetRow[], keyCols: KeyColumns): PrimaryLookup {
  const byEmail = new Map<string, PrimaryEntry>();
  const byPhone = new Map<string, PrimaryEntry>();

  for (let i = 0; i < primaryRows.length; i++) {
    const row = primaryRows[i];
    const key = extractKey(row, keyCols);

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
  matchFields: MatchField[] = ['email', 'phoneno'],
  targetHeaders?: string[]
): ComparisonResult {
  const newLeads: NewLead[] = [];
  const updates: UpdateLead[] = [];
  const skipped: SkippedRow[] = [];

  const headers = targetHeaders || [...TARGET_SCHEMA];
  const keyCols = detectKeyColumns(headers);
  const lookup = buildPrimaryLookup(primaryRows, keyCols);

  for (const sourceRow of sourceRows) {
    processRow(sourceRow, lookup, columnMappings, matchFields, newLeads, updates, skipped, keyCols, targetHeaders);
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
  matchFields: MatchField[] = ['email', 'phoneno'],
  targetHeaders?: string[]
): Promise<ComparisonResult> {
  return new Promise((resolve) => {
    const newLeads: NewLead[] = [];
    const updates: UpdateLead[] = [];
    const skipped: SkippedRow[] = [];
    const headers = targetHeaders || [...TARGET_SCHEMA];
    const keyCols = detectKeyColumns(headers);
    const lookup = buildPrimaryLookup(primaryRows, keyCols);
    const total = sourceRows.length;
    let index = 0;

    function processBatch() {
      const end = Math.min(index + BATCH_SIZE, total);
      while (index < end) {
        processRow(sourceRows[index], lookup, columnMappings, matchFields, newLeads, updates, skipped, keyCols, targetHeaders);
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
  skipped: SkippedRow[],
  keyCols: KeyColumns,
  targetHeaders?: string[]
) {
  const mapped = mapSourceRow(sourceRow, columnMappings, targetHeaders);
  const key: RowKey = {
    email: keyCols.emailCol ? normalizeEmail(mapped[keyCols.emailCol]) : '',
    phone: keyCols.phoneCol ? normalizePhone(mapped[keyCols.phoneCol]) : '',
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
        const n = normCol(targetCol);
        if (n === 'phoneno' || n === 'phone' || n === 'phonenumber') {
          fieldsToFill[targetCol] = normalizePhone(sourceValue);
        } else if (n === 'date') {
          fieldsToFill[targetCol] = normalizeDate(sourceValue);
        } else {
          fieldsToFill[targetCol] = sourceValue!.trim();
        }
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
