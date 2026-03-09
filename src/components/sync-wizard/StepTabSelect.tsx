import { useState, useEffect } from 'react';
import { Loader2, Table2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useGoogleAuth } from '@/features/auth/GoogleAuthContext';
import { listTabs } from '@/services/googleSheets';
import type { GoogleSheetTab } from '@/types/google';

interface Props {
  spreadsheetId: string;
  tabs: GoogleSheetTab[];
  onTabsLoaded: (tabs: GoogleSheetTab[]) => void;
  onSelect: (tabName: string) => void;
  onBack: () => void;
}

export default function StepTabSelect({ spreadsheetId, tabs, onTabsLoaded, onSelect, onBack }: Props) {
  const { accessToken } = useGoogleAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!accessToken || !spreadsheetId || tabs.length > 0) return;
    setLoading(true);
    listTabs(accessToken, spreadsheetId)
      .then(onTabsLoaded)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [accessToken, spreadsheetId]);

  return (
    <Card className="border-border">
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Select Primary Tab</h2>
            <p className="text-sm text-muted-foreground">Choose the tab containing your lead data.</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <p className="text-sm text-destructive py-4">{error}</p>
        ) : (
          <div className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.sheetId}
                onClick={() => onSelect(tab.title)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left hover:bg-accent/50 transition-colors"
              >
                <Table2 className="h-4 w-4 text-primary shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">{tab.title}</p>
                  <p className="text-xs text-muted-foreground">{tab.rowCount} rows · {tab.columnCount} columns</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
