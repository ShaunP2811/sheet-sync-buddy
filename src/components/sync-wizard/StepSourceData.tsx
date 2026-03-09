import { useState, useCallback, useEffect } from 'react';
import { Upload, FileSpreadsheet, ArrowLeft, Loader2, Search, Table2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useGoogleAuth } from '@/features/auth/GoogleAuthContext';
import { listSpreadsheets, listTabs, readRows } from '@/services/googleSheets';
import { parseCSVFile } from '@/services/csvParser';
import { MAX_CSV_SIZE } from '@/lib/constants';
import type { SourceType, SheetRow } from '@/types/sync';
import type { GoogleSpreadsheet, GoogleSheetTab } from '@/types/google';

interface Props {
  sourceType: SourceType;
  onData: (headers: string[], rows: SheetRow[], label: string) => void;
  onBack: () => void;
}

export default function StepSourceData({ sourceType, onData, onBack }: Props) {
  if (sourceType === 'csv') return <CSVUpload onData={onData} onBack={onBack} />;
  return <GoogleSheetSource onData={onData} onBack={onBack} />;
}

function CSVUpload({ onData, onBack }: Omit<Props, 'sourceType'>) {
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
          onClick={() => document.getElementById('csv-input')?.click()}
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
            id="csv-input"
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

function GoogleSheetSource({ onData, onBack }: Omit<Props, 'sourceType'>) {
  const { accessToken } = useGoogleAuth();
  const [phase, setPhase] = useState<'sheet' | 'tab'>('sheet');
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
      setPhase('tab');
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
            onClick={phase === 'tab' ? () => setPhase('sheet') : onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {phase === 'sheet' ? 'Select Source Spreadsheet' : `Select Tab from "${selectedSheet?.name}"`}
            </h2>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : phase === 'sheet' ? (
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
