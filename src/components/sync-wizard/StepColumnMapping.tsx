import { useState, useMemo } from 'react';
import { ArrowLeft, ArrowRight, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TARGET_SCHEMA } from '@/types/sync';
import type { ColumnMapping } from '@/types/sync';
import type { ComparisonProgress } from '@/features/sync/comparisonEngine';

interface Props {
  sourceHeaders: string[];
  mappings: ColumnMapping[];
  isComparing?: boolean;
  comparisonProgress?: ComparisonProgress | null;
  onMappingsSet: (mappings: ColumnMapping[]) => void;
  onBack: () => void;
}

/** Normalize a column name for comparison */
function norm(s: string): string {
  return s.toLowerCase().replace(/[\s_\-()]/g, '');
}

/** Count how many target columns were auto-matched */
function computeAutoMapStats(sourceHeaders: string[]) {
  const sourceNormed = new Set(sourceHeaders.map(norm));
  let matched = 0;
  const unmatched: string[] = [];
  for (const col of TARGET_SCHEMA) {
    if (sourceNormed.has(norm(col))) {
      matched++;
    } else {
      unmatched.push(col);
    }
  }
  // Source headers that didn't match any target column
  const targetNormed = new Set(TARGET_SCHEMA.map(norm));
  const unmappedSource = sourceHeaders.filter((h) => !targetNormed.has(norm(h)));

  return { matched, unmatched, unmappedSource, total: TARGET_SCHEMA.length };
}

export default function StepColumnMapping({ sourceHeaders, mappings: existingMappings, isComparing, comparisonProgress, onMappingsSet, onBack }: Props) {
  const [mappings, setMappings] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const targetCol of TARGET_SCHEMA) {
      const match = sourceHeaders.find((h) => norm(h) === norm(targetCol));
      if (match) initial[targetCol] = match;
    }
    for (const m of existingMappings) {
      initial[m.targetColumn] = m.sourceColumn;
    }
    return initial;
  });

  const autoStats = useMemo(() => computeAutoMapStats(sourceHeaders), [sourceHeaders]);

  const mappedCount = Object.values(mappings).filter((v) => v && v !== '_unmapped_').length;

  const setMapping = (targetCol: string, sourceCol: string) => {
    setMappings((prev) => ({ ...prev, [targetCol]: sourceCol }));
  };

  const handleContinue = () => {
    const result: ColumnMapping[] = [];
    for (const [target, source] of Object.entries(mappings)) {
      if (source && source !== '_unmapped_') {
        result.push({ sourceColumn: source, targetColumn: target as any });
      }
    }
    if (!result.some((m) => m.targetColumn === 'Email') && !result.some((m) => m.targetColumn === 'Phoneno')) {
      return;
    }
    onMappingsSet(result);
  };

  const hasMatchKey = Object.entries(mappings).some(
    ([k, v]) => (k === 'Email' || k === 'Phoneno') && v && v !== '_unmapped_'
  );

  const lowMatchRate = autoStats.matched < Math.ceil(autoStats.total * 0.3);

  return (
    <Card className="border-border">
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Map Columns</h2>
            <p className="text-sm text-muted-foreground">Map source columns to the target schema. Email or Phoneno is required.</p>
          </div>
        </div>

        {/* Auto-map feedback banner */}
        {lowMatchRate ? (
          <div className="flex items-start gap-3 bg-warning/10 border border-warning/20 rounded-lg p-3">
            <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-foreground">
                Low auto-match: only {autoStats.matched} of {autoStats.total} columns matched
              </p>
              <p className="text-muted-foreground mt-0.5">
                Your source headers don't closely match the target schema. Please map columns manually below.
              </p>
              {autoStats.unmappedSource.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Unrecognized source columns: {autoStats.unmappedSource.slice(0, 6).join(', ')}
                  {autoStats.unmappedSource.length > 6 && ` (+${autoStats.unmappedSource.length - 6} more)`}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 bg-success/10 border border-success/20 rounded-lg px-3 py-2">
            <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
            <p className="text-sm text-foreground">
              Auto-mapped {autoStats.matched} of {autoStats.total} columns. {mappedCount} total mapped.
            </p>
          </div>
        )}

        <div className="space-y-2 max-h-[450px] overflow-y-auto">
          {TARGET_SCHEMA.map((targetCol) => {
            const isKey = targetCol === 'Email' || targetCol === 'Phoneno';
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
                  <Select
                    value={mappings[targetCol] || '_unmapped_'}
                    onValueChange={(v) => setMapping(targetCol, v)}
                  >
                    <SelectTrigger className={`h-9 text-sm ${!isMapped && isKey ? 'border-destructive/50' : ''}`}>
                      <SelectValue placeholder="Select source column" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_unmapped_">— Not mapped —</SelectItem>
                      {sourceHeaders.map((h) => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            );
          })}
        </div>

        {!hasMatchKey && (
          <p className="text-sm text-destructive">At least Email or Phoneno must be mapped.</p>
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
          <div className="flex justify-end pt-2">
            <Button onClick={handleContinue} disabled={!hasMatchKey} className="gap-2">
              Run Comparison <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
