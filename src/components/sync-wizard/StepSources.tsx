import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Plus,
  Trash2,
  Edit3,
  Upload,
  FileSpreadsheet,
  Loader2,
  Search,
  Table2,
  CheckCircle2,
  AlertTriangle,
  Save,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useGoogleAuth } from '@/features/auth/GoogleAuthContext';
import { listSpreadsheets, listTabs, readRows } from '@/services/googleSheets';
import { parseCSVFile } from '@/services/csvParser';
import { getMappingPresets, saveMappingPreset, deleteMappingPreset } from '@/services/mappingPresets';
import { MAX_CSV_SIZE } from '@/lib/constants';
import { TARGET_SCHEMA } from '@/types/sync';
import type { SourceEntry, SourceType, ColumnMapping, SheetRow, MappingPreset } from '@/types/sync';
import type { ComparisonProgress } from '@/features/sync/comparisonEngine';
import type { GoogleSpreadsheet, GoogleSheetTab } from '@/types/google';
import ColumnCombobox from './ColumnCombobox';

type Phase = 'list' | 'select-type' | 'load-csv' | 'load-sheet' | 'map-columns';

interface Props {
  sources: SourceEntry[];
  onSourcesChange: (sources: SourceEntry[]) => void;
  isComparing: boolean;
  comparisonProgress: ComparisonProgress | null;
  onRunComparison: () => void;
  onBack: () => void;
  primaryHeaders: string[];
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[\s_\-()]/g, '');
}

export default function StepSources({
  sources,
  onSourcesChange,
  isComparing,
  comparisonProgress,
  onRunComparison,
  onBack,
  primaryHeaders,
}: Props) {
  const [phase, setPhase] = useState<Phase>('list');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Pending source state
  const [pendingType, setPendingType] = useState<SourceType>('csv');
  const [pendingHeaders, setPendingHeaders] = useState<string[]>([]);
  const [pendingRows, setPendingRows] = useState<SheetRow[]>([]);
  const [pendingLabel, setPendingLabel] = useState('');
  const [pendingMappings, setPendingMappings] = useState<ColumnMapping[]>([]);

  const handleAddSource = () => {
    setEditingIndex(null);
    setPhase('select-type');
  };

  const handleEditMappings = (index: number) => {
    const source = sources[index];
    setEditingIndex(index);
    setPendingHeaders(source.headers);
    setPendingRows(source.rows);
    setPendingLabel(source.label);
    setPendingType(source.type);
    setPendingMappings(source.columnMappings);
    setPhase('map-columns');
  };

  const handleRemoveSource = (index: number) => {
    onSourcesChange(sources.filter((_, i) => i !== index));
  };

  const handleSourceTypeSelect = (type: SourceType) => {
    setPendingType(type);
    setPendingHeaders([]);
    setPendingRows([]);
    setPendingLabel('');
    setPendingMappings([]);
    setPhase(type === 'csv' ? 'load-csv' : 'load-sheet');
  };

  const targetSchema = primaryHeaders.length > 0 ? primaryHeaders : [...TARGET_SCHEMA];

  const handleDataLoaded = (headers: string[], rows: SheetRow[], label: string) => {
    setPendingHeaders(headers);
    setPendingRows(rows);
    setPendingLabel(label);
    // Auto-generate initial mappings against primary tab headers
    const initial: ColumnMapping[] = [];
    for (const targetCol of targetSchema) {
      const match = headers.find((h) => norm(h) === norm(targetCol));
      if (match) {
        initial.push({ sourceColumn: match, targetColumn: targetCol });
      }
    }
    setPendingMappings(initial);
    setPhase('map-columns');
  };

  const handleMappingsSaved = (mappings: ColumnMapping[]) => {
    const entry: SourceEntry = {
      id: editingIndex !== null ? sources[editingIndex].id : crypto.randomUUID(),
      type: pendingType,
      label: pendingLabel,
      headers: pendingHeaders,
      rows: pendingRows,
      columnMappings: mappings,
    };

    if (editingIndex !== null) {
      const updated = [...sources];
      updated[editingIndex] = entry;
      onSourcesChange(updated);
    } else {
      onSourcesChange([...sources, entry]);
    }
    setPhase('list');
  };

  const handlePhaseBack = () => {
    switch (phase) {
      case 'select-type':
        setPhase('list');
        break;
      case 'load-csv':
      case 'load-sheet':
        setPhase('select-type');
        break;
      case 'map-columns':
        if (editingIndex !== null) {
          setPhase('list');
        } else {
          setPhase(pendingType === 'csv' ? 'load-csv' : 'load-sheet');
        }
        break;
    }
  };

  if (phase === 'select-type') {
    return (
      <SourceTypeSelector
        onSelect={handleSourceTypeSelect}
        onBack={handlePhaseBack}
      />
    );
  }

  if (phase === 'load-csv') {
    return <CSVLoader onData={handleDataLoaded} onBack={handlePhaseBack} />;
  }

  if (phase === 'load-sheet') {
    return <SheetLoader onData={handleDataLoaded} onBack={handlePhaseBack} />;
  }

  if (phase === 'map-columns') {
    return (
      <ColumnMapper
        sourceHeaders={pendingHeaders}
        existingMappings={pendingMappings}
        sourceLabel={pendingLabel}
        targetSchema={targetSchema}
        onSave={handleMappingsSaved}
        onBack={handlePhaseBack}
      />
    );
  }

  // Default: list phase
  return (
    <Card className="border-border">
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Source Data</h2>
            <p className="text-sm text-muted-foreground">
              Add one or more sources to compare against your primary sheet.
            </p>
          </div>
        </div>

        {sources.length === 0 ? (
          <div className="border-2 border-dashed border-border rounded-xl p-8 text-center">
            <p className="text-sm text-muted-foreground mb-3">No sources added yet.</p>
            <Button onClick={handleAddSource} className="gap-2">
              <Plus className="h-4 w-4" /> Add Source
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {sources.map((source, i) => (
              <div
                key={source.id}
                className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-card"
              >
                {source.type === 'csv' ? (
                  <Upload className="h-4 w-4 text-primary shrink-0" />
                ) : (
                  <FileSpreadsheet className="h-4 w-4 text-primary shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{source.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {source.rows.length} rows · {source.columnMappings.length} columns mapped
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => handleEditMappings(i)}
                >
                  <Edit3 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                  onClick={() => handleRemoveSource(i)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}

            <Button variant="outline" onClick={handleAddSource} className="w-full gap-2">
              <Plus className="h-4 w-4" /> Add Another Source
            </Button>
          </div>
        )}

        {isComparing ? (
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-3 justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <p className="text-sm font-medium text-foreground">Running comparison…</p>
            </div>
            {comparisonProgress && comparisonProgress.total > 0 && (
              <div className="space-y-2">
                <Progress
                  value={(comparisonProgress.processed / comparisonProgress.total) * 100}
                  className="h-2"
                />
                <p className="text-xs text-muted-foreground text-center">
                  {comparisonProgress.processed.toLocaleString()} / {comparisonProgress.total.toLocaleString()} rows processed
                </p>
              </div>
            )}
          </div>
        ) : (
          sources.length > 0 && (
            <div className="flex justify-end pt-2">
              <Button onClick={onRunComparison} className="gap-2">
                Run Comparison <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )
        )}
      </CardContent>
    </Card>
  );
}

// ─── Sub-components ─────────────────────────────────────────

function SourceTypeSelector({ onSelect, onBack }: { onSelect: (type: SourceType) => void; onBack: () => void }) {
  return (
    <Card className="border-border">
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Select Source Type</h2>
            <p className="text-sm text-muted-foreground">Where is the data coming from?</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => onSelect('csv')}
            className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-border hover:border-primary/50 hover:bg-accent/30 transition-all text-center"
          >
            <Upload className="h-8 w-8 text-primary" />
            <div>
              <p className="font-medium text-foreground">CSV Upload</p>
              <p className="text-xs text-muted-foreground mt-1">Upload a CSV file from your computer</p>
            </div>
          </button>

          <button
            onClick={() => onSelect('google_sheet')}
            className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-border hover:border-primary/50 hover:bg-accent/30 transition-all text-center"
          >
            <FileSpreadsheet className="h-8 w-8 text-primary" />
            <div>
              <p className="font-medium text-foreground">Google Sheet</p>
              <p className="text-xs text-muted-foreground mt-1">Select another Google Sheet as source</p>
            </div>
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

function CSVLoader({ onData, onBack }: { onData: (headers: string[], rows: SheetRow[], label: string) => void; onBack: () => void }) {
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState('');

  const handleFile = useCallback(async (file: File) => {
    if (file.size > MAX_CSV_SIZE) {
      toast.error('File is too large. Max 10MB.');
      return;
    }
    setLoading(true);
    setFileName(file.name);
    try {
      const result = await parseCSVFile(file);
      if (result.errors.length > 0) {
        toast.warning(`Parsed with ${result.errors.length} warnings`);
      }
      if (result.rows.length === 0) {
        toast.error('No data rows found in CSV');
        return;
      }
      onData(result.headers, result.rows, file.name);
    } catch (e: any) {
      toast.error('Failed to parse CSV: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [onData]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <Card className="border-border">
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Upload CSV</h2>
            <p className="text-sm text-muted-foreground">Upload a CSV file with your source data.</p>
          </div>
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer ${
            isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
          }`}
          onClick={() => document.getElementById('csv-input-sources')?.click()}
        >
          {loading ? (
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
          ) : (
            <>
              <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground">
                {fileName || 'Drop CSV file here or click to browse'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Max 10MB</p>
            </>
          )}
          <input
            id="csv-input-sources"
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function SheetLoader({ onData, onBack }: { onData: (headers: string[], rows: SheetRow[], label: string) => void; onBack: () => void }) {
  const { accessToken } = useGoogleAuth();
  const [sheetPhase, setSheetPhase] = useState<'sheet' | 'tab'>('sheet');
  const [sheets, setSheets] = useState<GoogleSpreadsheet[]>([]);
  const [tabs, setTabs] = useState<GoogleSheetTab[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<GoogleSpreadsheet | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!accessToken) return;
    listSpreadsheets(accessToken)
      .then(setSheets)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [accessToken]);

  const selectSheet = async (sheet: GoogleSpreadsheet) => {
    setSelectedSheet(sheet);
    setLoading(true);
    try {
      const t = await listTabs(accessToken!, sheet.id);
      setTabs(t);
      setSheetPhase('tab');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const selectTab = async (tabName: string) => {
    if (!accessToken || !selectedSheet) return;
    setLoading(true);
    try {
      const data = await readRows(accessToken, selectedSheet.id, tabName);
      if (data.rows.length === 0) {
        toast.error('No data rows found in this tab');
        return;
      }
      onData(data.headers, data.rows, `${selectedSheet.name} / ${tabName}`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const filtered = sheets.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <Card className="border-border">
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"
            onClick={sheetPhase === 'tab' ? () => setSheetPhase('sheet') : onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {sheetPhase === 'sheet' ? 'Select Source Spreadsheet' : `Select Tab from "${selectedSheet?.name}"`}
            </h2>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : sheetPhase === 'sheet' ? (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <div className="space-y-1 max-h-[400px] overflow-y-auto">
              {filtered.map((s) => (
                <button key={s.id} onClick={() => selectSheet(s)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left hover:bg-accent/50 transition-colors">
                  <FileSpreadsheet className="h-5 w-5 text-primary shrink-0" />
                  <p className="text-sm font-medium text-foreground truncate">{s.name}</p>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="space-y-1">
            {tabs.map((t) => (
              <button key={t.sheetId} onClick={() => selectTab(t.title)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left hover:bg-accent/50 transition-colors">
                <Table2 className="h-4 w-4 text-primary shrink-0" />
                <p className="text-sm font-medium text-foreground">{t.title}</p>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ColumnMapper({
  sourceHeaders,
  existingMappings,
  sourceLabel,
  targetSchema,
  onSave,
  onBack,
}: {
  sourceHeaders: string[];
  existingMappings: ColumnMapping[];
  sourceLabel: string;
  targetSchema: string[];
  onSave: (mappings: ColumnMapping[]) => void;
  onBack: () => void;
}) {
  // Detect which target columns serve as match keys (email / phone)
  const matchKeySet = useMemo(() => {
    const keys = new Set<string>();
    for (const col of targetSchema) {
      const n = norm(col);
      if (n === 'email' || n === 'emailaddress') keys.add(col);
      if (n === 'phoneno' || n === 'phone' || n === 'phonenumber') keys.add(col);
    }
    return keys;
  }, [targetSchema]);

  const [mappings, setMappings] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const targetCol of targetSchema) {
      const match = sourceHeaders.find((h) => norm(h) === norm(targetCol));
      if (match) initial[targetCol] = match;
    }
    for (const m of existingMappings) {
      initial[m.targetColumn] = m.sourceColumn;
    }
    return initial;
  });

  const [presets, setPresets] = useState<MappingPreset[]>(() => getMappingPresets());
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [loadPresetOpen, setLoadPresetOpen] = useState(false);

  const autoStats = useMemo(() => {
    const sourceNormed = new Set(sourceHeaders.map(norm));
    let matched = 0;
    for (const col of targetSchema) {
      if (sourceNormed.has(norm(col))) matched++;
    }
    return { matched, total: targetSchema.length };
  }, [sourceHeaders, targetSchema]);

  const mappedCount = Object.values(mappings).filter((v) => v && v !== '_unmapped_').length;

  const setMapping = (targetCol: string, sourceCol: string) => {
    setMappings((prev) => ({ ...prev, [targetCol]: sourceCol }));
  };

  const currentMappingsAsArray = (): ColumnMapping[] => {
    const result: ColumnMapping[] = [];
    for (const [target, source] of Object.entries(mappings)) {
      if (source && source !== '_unmapped_') {
        result.push({ sourceColumn: source, targetColumn: target as any });
      }
    }
    return result;
  };

  const handleSave = () => {
    const result = currentMappingsAsArray();
    if (!result.some((m) => matchKeySet.has(m.targetColumn))) {
      return;
    }
    onSave(result);
  };

  const handleSavePreset = () => {
    const name = presetName.trim();
    if (!name) return;
    const arr = currentMappingsAsArray();
    if (arr.length === 0) {
      toast.error('Map at least one column before saving a preset.');
      return;
    }
    saveMappingPreset(name, arr);
    setPresets(getMappingPresets());
    setSaveDialogOpen(false);
    setPresetName('');
    toast.success(`Preset "${name}" saved.`);
  };

  const applyPreset = (preset: MappingPreset) => {
    const headerSet = new Set(sourceHeaders);
    const newMappings: Record<string, string> = {};
    for (const col of targetSchema) {
      newMappings[col] = '_unmapped_';
    }
    let applied = 0;
    let skipped = 0;
    for (const m of preset.mappings) {
      if (headerSet.has(m.sourceColumn)) {
        newMappings[m.targetColumn] = m.sourceColumn;
        applied++;
      } else {
        skipped++;
      }
    }
    setMappings(newMappings);
    setLoadPresetOpen(false);
    if (skipped > 0) {
      toast.info(`Applied ${applied} mappings, skipped ${skipped} (columns not found in source).`);
    } else {
      toast.success(`Applied ${applied} mappings from "${preset.name}".`);
    }
  };

  const handleDeletePreset = (id: string) => {
    deleteMappingPreset(id);
    setPresets(getMappingPresets());
    toast.success('Preset deleted.');
  };

  const hasMatchKey = Object.entries(mappings).some(
    ([k, v]) => matchKeySet.has(k) && v && v !== '_unmapped_'
  );

  return (
    <Card className="border-border">
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Map Columns</h2>
            <p className="text-sm text-muted-foreground">
              Map columns for <span className="font-medium">{sourceLabel}</span>. At least one match key (email or phone) is required.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-success/10 border border-success/20 rounded-lg px-3 py-2">
          <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
          <p className="text-sm text-foreground">
            Auto-mapped {autoStats.matched} of {autoStats.total} columns. {mappedCount} total mapped.
          </p>
        </div>

        {/* Preset toolbar */}
        <div className="flex items-center gap-2">
          <Popover open={loadPresetOpen} onOpenChange={setLoadPresetOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                Load Preset <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2" align="start">
              {presets.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-3">No saved presets</p>
              ) : (
                <div className="space-y-1">
                  {presets.map((preset) => (
                    <div
                      key={preset.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent"
                    >
                      <button
                        onClick={() => applyPreset(preset)}
                        className="flex-1 text-left text-sm truncate"
                      >
                        {preset.name}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePreset(preset.id);
                        }}
                        className="shrink-0 p-1 rounded hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </PopoverContent>
          </Popover>

          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setSaveDialogOpen(true)}>
            <Save className="h-3.5 w-3.5" /> Save as Preset
          </Button>
        </div>

        <div className="space-y-2 max-h-[450px] overflow-y-auto">
          {targetSchema.map((targetCol) => {
            const isKey = matchKeySet.has(targetCol);
            const isMapped = mappings[targetCol] && mappings[targetCol] !== '_unmapped_';
            return (
              <div key={targetCol} className="flex items-center gap-3 py-2">
                <div className="w-1/2">
                  <span className={`text-sm font-medium ${isKey ? 'text-primary' : 'text-foreground'}`}>
                    {targetCol}
                    {isKey && <span className="text-xs text-primary ml-1">(match key)</span>}
                  </span>
                </div>
                <div className="w-1/2">
                  <ColumnCombobox
                    value={mappings[targetCol] || '_unmapped_'}
                    options={sourceHeaders}
                    onSelect={(v) => setMapping(targetCol, v)}
                    placeholder="Select source column"
                    triggerClassName={!isMapped && isKey ? 'border-destructive/50' : ''}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {!hasMatchKey && (
          <p className="text-sm text-destructive">At least one match key (email or phone column) must be mapped.</p>
        )}

        <div className="flex justify-end pt-2">
          <Button onClick={handleSave} disabled={!hasMatchKey} className="gap-2">
            Save Mapping <CheckCircle2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Save Preset Dialog */}
        <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Save Mapping Preset</DialogTitle>
              <DialogDescription>
                Give this mapping configuration a name for later reuse.
              </DialogDescription>
            </DialogHeader>
            <Input
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="e.g. Facebook Leads CSV"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSavePreset();
              }}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSavePreset} disabled={!presetName.trim()}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
