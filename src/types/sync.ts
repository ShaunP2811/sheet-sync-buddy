/**
 * SheetSync — Sync & Comparison Types
 */

/** Target Google Sheet schema columns in exact order */
export const TARGET_SCHEMA = [
  'Date',
  'FullName',
  'Race',
  'Phoneno',
  'Email',
  'Nationality',
  'Location',
  'Age',
  'Platform Content Type',
  'Code',
  'CampaignName',
  'AdSetName',
  'AdName',
  'FormName',
] as const;

export type TargetColumn = (typeof TARGET_SCHEMA)[number];

/** A row as a record of column name → string value */
export type SheetRow = Record<string, string>;

/** Source type for the sync */
export type SourceType = 'csv' | 'google_sheet';

/** Match field strategy */
export type MatchField = 'email' | 'phoneno';

/** Column mapping: source column → target column */
export interface ColumnMapping {
  sourceColumn: string;
  targetColumn: string;
}

/** A saved column mapping preset */
export interface MappingPreset {
  id: string;
  name: string;
  mappings: ColumnMapping[];
  createdAt: string;
}

/** Status of a sync run */
export type SyncRunStatus = 'pending' | 'running' | 'completed' | 'failed';

/** A row marked as a new lead to be added */
export interface NewLead {
  mappedRow: SheetRow;
}

/** A row matched in primary with blank fields to fill */
export interface UpdateLead {
  primaryRowIndex: number;
  matchedBy: MatchField;
  matchValue: string;
  fieldsToFill: Record<string, string>;
}

/** A skipped row with reason */
export interface SkippedRow {
  sourceRow: SheetRow;
  reason: string;
}

/** Full comparison result */
export interface ComparisonResult {
  newLeads: NewLead[];
  updates: UpdateLead[];
  skipped: SkippedRow[];
  summary: {
    newLeadCount: number;
    updateCount: number;
    skippedCount: number;
  };
}

/** Destination tab options */
export type DestinationType = 'same_tab' | 'existing_tab' | 'new_tab';

export interface DestinationConfig {
  type: DestinationType;
  tabName: string;
}

/** A single source entry for multi-source sync */
export interface SourceEntry {
  id: string;
  type: SourceType;
  label: string;
  headers: string[];
  rows: SheetRow[];
  columnMappings: ColumnMapping[];
}

/** Sync wizard state */
export interface SyncWizardState {
  primarySheetId: string;
  primarySheetName: string;
  primaryTabName: string;
  sourceType: SourceType;
  sourceSheetId?: string;
  sourceTabName?: string;
  sourceFileName?: string;
  sourceRows: SheetRow[];
  sourceHeaders: string[];
  columnMappings: ColumnMapping[];
  matchFields: MatchField[];
  comparisonResult?: ComparisonResult;
  destination?: DestinationConfig;
}

/** Sync job record (mirrors DB) */
export interface SyncJob {
  id: string;
  userId: string;
  primarySheetId: string;
  primarySheetName: string | null;
  primaryTabName: string;
  sourceType: SourceType;
  sourceSheetId: string | null;
  sourceTabName: string | null;
  sourceFileName: string | null;
  columnMapping: Record<string, string>;
  createdAt: string;
}

/** Sync run record (mirrors DB) */
export interface SyncRun {
  id: string;
  jobId: string;
  userId: string;
  destinationTabName: string;
  newLeadsAdded: number;
  rowsUpdated: number;
  rowsSkipped: number;
  status: SyncRunStatus;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
}
