import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import AppLayout from '@/components/layout/AppLayout';
import WizardStepper from '@/components/sync-wizard/WizardStepper';
import StepSheetSelect from '@/components/sync-wizard/StepSheetSelect';
import StepTabSelect from '@/components/sync-wizard/StepTabSelect';
import StepSources from '@/components/sync-wizard/StepSources';
import StepPreview from '@/components/sync-wizard/StepPreview';
import StepDestination from '@/components/sync-wizard/StepDestination';
import StepConfirm from '@/components/sync-wizard/StepConfirm';
import { useGoogleAuth } from '@/features/auth/GoogleAuthContext';
import { runComparisonAsync, mapSourceRow, normalizeEmail, normalizePhone, detectKeyColumns, type ComparisonProgress } from '@/features/sync/comparisonEngine';
import { readRows, appendRows, updateCells, createTab, listTabs } from '@/services/googleSheets';
import { addSyncHistoryEntry } from '@/services/syncHistory';
import type { SourceEntry, ColumnMapping, ComparisonResult, DestinationConfig } from '@/types/sync';
import type { GoogleSpreadsheet, GoogleSheetTab, CellUpdate } from '@/types/google';

export default function NewSync() {
  const { accessToken } = useGoogleAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Wizard state
  const [primarySheet, setPrimarySheet] = useState<GoogleSpreadsheet | null>(null);
  const [primaryTabs, setPrimaryTabs] = useState<GoogleSheetTab[]>([]);
  const [primaryTab, setPrimaryTab] = useState<string>('');
  const [sources, setSources] = useState<SourceEntry[]>([]);
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);
  const [destination, setDestination] = useState<DestinationConfig>({ type: 'same_tab', tabName: '' });
  const [primaryRows, setPrimaryRows] = useState<Record<string, string>[]>([]);
  const [primaryHeaders, setPrimaryHeaders] = useState<string[]>([]);

  const next = () => setStep((s) => s + 1);
  const back = () => setStep((s) => Math.max(0, s - 1));

  // Load primary rows when tab is selected
  useEffect(() => {
    if (primarySheet && primaryTab && accessToken) {
      setIsLoading(true);
      readRows(accessToken, primarySheet.id, primaryTab)
        .then((data) => {
          setPrimaryRows(data.rows);
          setPrimaryHeaders(data.headers);
        })
        .catch((e) => toast.error('Failed to read primary sheet: ' + e.message))
        .finally(() => setIsLoading(false));
    }
  }, [primarySheet, primaryTab, accessToken]);

  // Run comparison
  const [isComparing, setIsComparing] = useState(false);
  const [comparisonProgress, setComparisonProgress] = useState<ComparisonProgress | null>(null);

  const handleRunComparison = async () => {
    if (sources.length === 0) return;

    // Merge all sources: map each source's rows using its own column mappings
    // Target columns are now the primary sheet's actual headers
    const allMappedRows: Record<string, string>[] = [];
    for (const source of sources) {
      for (const row of source.rows) {
        const mapped = mapSourceRow(row, source.columnMappings, primaryHeaders);
        allMappedRows.push(mapped);
      }
    }

    // Detect email/phone columns from primary headers
    const { emailCol, phoneCol } = detectKeyColumns(primaryHeaders);

    // Deduplicate merged rows by email (primary) then phone (fallback)
    const seen = new Set<string>();
    const deduped: Record<string, string>[] = [];
    for (const row of allMappedRows) {
      const email = emailCol ? normalizeEmail(row[emailCol]) : '';
      const phone = phoneCol ? normalizePhone(row[phoneCol]) : '';
      const key = email || phone || '';
      if (!key || !seen.has(key)) {
        if (key) seen.add(key);
        deduped.push(row);
      }
    }

    // Use identity mappings since rows are already mapped to primary headers
    const identityMappings: ColumnMapping[] = primaryHeaders.map((col) => ({
      sourceColumn: col,
      targetColumn: col,
    }));

    setIsComparing(true);
    setComparisonProgress({ processed: 0, total: deduped.length });

    const result = await runComparisonAsync(
      primaryRows,
      deduped,
      identityMappings,
      setComparisonProgress,
      ['email', 'phoneno'],
      primaryHeaders
    );

    setComparisonResult(result);
    setIsComparing(false);
    setComparisonProgress(null);
    next();
  };

  // Execute sync
  const handleExecuteSync = async () => {
    if (!accessToken || !primarySheet || !comparisonResult || !destination.tabName) return;
    setIsLoading(true);

    try {
      const destTab = destination.tabName;
      const destHeaders = [...primaryHeaders];

      // Create new tab if needed — use primary headers as the schema
      if (destination.type === 'new_tab') {
        await createTab(accessToken, primarySheet.id, destTab, destHeaders);
      }

      // Append new leads — mapped rows already keyed by primary header names
      if (comparisonResult.newLeads.length > 0) {
        const rows = comparisonResult.newLeads.map((nl) =>
          destHeaders.map((col) => nl.mappedRow[col] ?? '')
        );
        await appendRows(accessToken, primarySheet.id, destTab, rows);
      }

      // Update blank fields — column names match primary headers directly
      if (comparisonResult.updates.length > 0 && destination.type === 'same_tab') {
        const cellUpdates: CellUpdate[] = [];
        for (const update of comparisonResult.updates) {
          for (const [col, value] of Object.entries(update.fieldsToFill)) {
            const colIndex = destHeaders.indexOf(col);
            if (colIndex >= 0) {
              cellUpdates.push({
                row: update.primaryRowIndex,
                column: colIndex,
                value,
              });
            }
          }
        }
        if (cellUpdates.length > 0) {
          await updateCells(accessToken, primarySheet.id, destTab, cellUpdates, destHeaders);
        }
      }

      // Log to history
      const sourceLabels = sources.map((s) => s.label);
      const compositeSourceLabel = sourceLabels.join(', ');
      addSyncHistoryEntry({
        id: crypto.randomUUID(),
        primarySheetName: primarySheet.name,
        primaryTabName: primaryTab,
        sourceType: sources.length === 1 ? sources[0].type : 'csv',
        sourceLabel: compositeSourceLabel,
        sourceLabels,
        destinationTabName: destTab,
        newLeadsAdded: comparisonResult.summary.newLeadCount,
        rowsUpdated: comparisonResult.summary.updateCount,
        rowsSkipped: comparisonResult.summary.skippedCount,
        status: 'completed',
        completedAt: new Date().toISOString(),
        logs: {
          newLeads: comparisonResult.newLeads,
          updates: comparisonResult.updates.map((u) => ({
            matchedBy: u.matchedBy,
            matchValue: u.matchValue,
            fieldsToFill: u.fieldsToFill,
          })),
          skipped: comparisonResult.skipped,
        },
      });

      toast.success('Sync completed successfully!');
      navigate(`/`);
    } catch (e: any) {
      toast.error('Sync failed: ' + e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const compositeSourceLabel = sources.map((s) => s.label).join(', ');

  const steps = [
    <StepSheetSelect key={0} onSelect={(sheet) => { setPrimarySheet(sheet); next(); }} />,
    <StepTabSelect
      key={1}
      spreadsheetId={primarySheet?.id || ''}
      tabs={primaryTabs}
      onTabsLoaded={setPrimaryTabs}
      onSelect={(tab) => { setPrimaryTab(tab); next(); }}
      onBack={back}
    />,
    <StepSources
      key={2}
      sources={sources}
      onSourcesChange={setSources}
      isComparing={isComparing}
      comparisonProgress={comparisonProgress}
      onRunComparison={handleRunComparison}
      onBack={back}
      primaryHeaders={primaryHeaders}
    />,
    <StepPreview
      key={3}
      result={comparisonResult}
      onNext={next}
      onBack={back}
    />,
    <StepDestination
      key={4}
      primaryTab={primaryTab}
      spreadsheetId={primarySheet?.id || ''}
      tabs={primaryTabs}
      destination={destination}
      onSelect={(d) => { setDestination(d); next(); }}
      onBack={back}
    />,
    <StepConfirm
      key={5}
      primarySheet={primarySheet}
      primaryTab={primaryTab}
      sourceLabel={compositeSourceLabel}
      destination={destination}
      result={comparisonResult}
      primaryHeaders={primaryHeaders}
      primaryRowCount={primaryRows.length}
      isLoading={isLoading}
      onConfirm={handleExecuteSync}
      onBack={back}
    />,
  ];

  return (
    <AppLayout>
      <div className="space-y-6 max-w-3xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">New Sync</h1>
          <p className="text-muted-foreground mt-1">Compare and sync data step by step.</p>
        </div>
        <WizardStepper currentStep={step} />
        <div className="mt-6">{steps[step]}</div>
      </div>
    </AppLayout>
  );
}
