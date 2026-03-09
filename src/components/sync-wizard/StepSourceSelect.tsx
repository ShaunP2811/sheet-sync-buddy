import { Upload, FileSpreadsheet, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { SourceType } from '@/types/sync';

interface Props {
  onSelect: (type: SourceType) => void;
  onBack: () => void;
}

export default function StepSourceSelect({ onSelect, onBack }: Props) {
  return (
    <Card className="border-border">
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Select Source Type</h2>
            <p className="text-sm text-muted-foreground">Where is the data you want to compare coming from?</p>
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
