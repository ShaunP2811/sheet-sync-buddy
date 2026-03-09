import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import AppLayout from '@/components/layout/AppLayout';
import WizardStepper from '@/components/sync-wizard/WizardStepper';
import StepSheetSelect from '@/components/sync-wizard/StepSheetSelect';
import StepTabSelect from '@/components/sync-wizard/StepTabSelect';
import StepSourceSelect from '@/components/sync-wizard/StepSourceSelect';
import StepSourceData from '@/components/sync-wizard/StepSourceData';
import StepColumnMapping from '@/components/sync-wizard/StepColumnMapping';
import StepPreview from '@/components/sync-wizard/StepPreview';
import StepDestination from '@/components/sync-wizard/StepDestination';
import StepConfirm from '@/components/sync-wizard/StepConfirm';
import { useGoogleAuth } from '@/features/auth/GoogleAuthContext';
import { runComparison } from '@/features/sync/comparisonEngine';
import { readRows, appendRows, updateCells, createTab, listTabs } from '@/services/googleSheets';
import { addSyncHistoryEntry } from '@/services/syncHistory';
import { TARGET_SCHEMA } from '@/types/sync';
import { rowToArray } from '@/lib/schema';
import type { SyncWizardState, ColumnMapping, SourceType, ComparisonResult, DestinationConfig } from '@/types/sync';
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
  const [sourceType, setSourceType] = useState<SourceType>('csv');
  const [sourceHeaders, setSourceHeaders] = useState<string[]>([]);
  const [sourceRows, setSourceRows] = useState<Record<string, string>[]>([]);
  const [sourceLabel, setSourceLabel] = useState('');
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
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
  const handleRunComparison = () => {
    if (!sourceRows.length || !columnMappings.length) return;
    const result = runComparison(primaryRows, sourceRows, columnMappings);
    setComparisonResult(result);
    next();
  };

  // Execute sync
  const handleExecuteSync = async () => {
    if (!accessToken || !primarySheet || !comparisonResult || !destination.tabName) return;
    setIsLoading(true);

    try {
      const destTab = destination.tabName;

      // Create new tab if needed
      if (destination.type === 'new_tab') {
        await createTab(accessToken, primarySheet.id, destTab, [...TARGET_SCHEMA]);
      }

      // Append new leads
      if (comparisonResult.newLeads.length > 0) {
        const rows = comparisonResult.newLeads.map((nl) => rowToArray(nl.mappedRow));
        await appendRows(accessToken, primarySheet.id, destTab, rows);
      }

      // Update blank fields
      if (comparisonResult.updates.length > 0 && destination.type === 'same_tab') {
        const cellUpdates: CellUpdate[] = [];
        for (const update of comparisonResult.updates) {
          for (const [col, value] of Object.entries(update.fieldsToFill)) {
            const colIndex = TARGET_SCHEMA.indexOf(col as any);
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
          await updateCells(accessToken, primarySheet.id, destTab, cellUpdates, primaryHeaders);
        }
      }

      // Log to history
      addSyncHistoryEntry({
        id: crypto.randomUUID(),
        primarySheetName: primarySheet.name,
        primaryTabName: primaryTab,
        sourceType,
        sourceLabel,
        destinationTabName: destTab,
        newLeadsAdded: comparisonResult.summary.newLeadCount,
        rowsUpdated: comparisonResult.summary.updateCount,
        rowsSkipped: comparisonResult.summary.skippedCount,
        status: 'completed',
        completedAt: new Date().toISOString(),
      });

      toast.success('Sync completed successfully!');
      navigate(`/`);
    } catch (e: any) {
      toast.error('Sync failed: ' + e.message);
    } finally {
      setIsLoading(false);
    }
  };

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
    <StepSourceSelect
      key={2}
      onSelect={(type) => { setSourceType(type); next(); }}
      onBack={back}
    />,
    <StepSourceData
      key={3}
      sourceType={sourceType}
      onData={(headers, rows, label) => {
        setSourceHeaders(headers);
        setSourceRows(rows);
        setSourceLabel(label);
        next();
      }}
      onBack={back}
    />,
    <StepColumnMapping
      key={4}
      sourceHeaders={sourceHeaders}
      onMappingsSet={(m) => { setColumnMappings(m); handleRunComparison(); }}
      onBack={back}
      mappings={columnMappings}
    />,
    <StepPreview
      key={5}
      result={comparisonResult}
      onNext={next}
      onBack={back}
    />,
    <StepDestination
      key={6}
      primaryTab={primaryTab}
      spreadsheetId={primarySheet?.id || ''}
      tabs={primaryTabs}
      destination={destination}
      onSelect={(d) => { setDestination(d); next(); }}
      onBack={back}
    />,
    <StepConfirm
      key={7}
      primarySheet={primarySheet}
      primaryTab={primaryTab}
      sourceLabel={sourceLabel}
      destination={destination}
      result={comparisonResult}
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
