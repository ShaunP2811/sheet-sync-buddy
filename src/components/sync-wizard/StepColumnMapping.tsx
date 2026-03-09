import { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TARGET_SCHEMA } from '@/types/sync';
import type { ColumnMapping } from '@/types/sync';

interface Props {
  sourceHeaders: string[];
  mappings: ColumnMapping[];
  onMappingsSet: (mappings: ColumnMapping[]) => void;
  onBack: () => void;
}

export default function StepColumnMapping({ sourceHeaders, mappings: existingMappings, onMappingsSet, onBack }: Props) {
  const [mappings, setMappings] = useState<Record<string, string>>(() => {
    // Auto-map by name similarity
    const initial: Record<string, string> = {};
    for (const targetCol of TARGET_SCHEMA) {
      const match = sourceHeaders.find(
        (h) => h.toLowerCase().replace(/[\s_-]/g, '') === targetCol.toLowerCase().replace(/[\s_-]/g, '')
      );
      if (match) initial[targetCol] = match;
    }
    // Restore existing mappings
    for (const m of existingMappings) {
      initial[m.targetColumn] = m.sourceColumn;
    }
    return initial;
  });

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
      return; // At least one match key required
    }
    onMappingsSet(result);
  };

  const hasMatchKey = Object.entries(mappings).some(
    ([k, v]) => (k === 'Email' || k === 'Phoneno') && v && v !== '_unmapped_'
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
            <p className="text-sm text-muted-foreground">Map source columns to the target schema. Email or Phoneno is required.</p>
          </div>
        </div>

        <div className="space-y-2 max-h-[450px] overflow-y-auto">
          {TARGET_SCHEMA.map((targetCol) => {
            const isKey = targetCol === 'Email' || targetCol === 'Phoneno';
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
                    <SelectTrigger className="h-9 text-sm">
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

        <div className="flex justify-end pt-2">
          <Button onClick={handleContinue} disabled={!hasMatchKey} className="gap-2">
            Run Comparison <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
