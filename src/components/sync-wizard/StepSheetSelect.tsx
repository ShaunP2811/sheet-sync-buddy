import { useState, useEffect } from 'react';
import { Search, FileSpreadsheet, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useGoogleAuth } from '@/features/auth/GoogleAuthContext';
import { listSpreadsheets } from '@/services/googleSheets';
import type { GoogleSpreadsheet } from '@/types/google';

interface Props {
  onSelect: (sheet: GoogleSpreadsheet) => void;
}

export default function StepSheetSelect({ onSelect }: Props) {
  const { accessToken } = useGoogleAuth();
  const [sheets, setSheets] = useState<GoogleSpreadsheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!accessToken) return;
    setLoading(true);
    listSpreadsheets(accessToken)
      .then(setSheets)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [accessToken]);

  const filtered = sheets.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Card className="border-border">
      <CardContent className="pt-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Select Primary Google Sheet</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Choose the Google Sheet that serves as your system of record.
          </p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search spreadsheets…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <p className="text-sm text-destructive py-4">{error}</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No spreadsheets found.</p>
        ) : (
          <div className="space-y-1 max-h-[400px] overflow-y-auto">
            {filtered.map((sheet) => (
              <button
                key={sheet.id}
                onClick={() => onSelect(sheet)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left hover:bg-accent/50 transition-colors"
              >
                <FileSpreadsheet className="h-5 w-5 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{sheet.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Modified {new Date(sheet.modifiedTime).toLocaleDateString()}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
