import { useState } from 'react';
import { ChevronDown, ChevronRight, FileSpreadsheet, Pencil, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { ComparisonResult, DestinationConfig } from '@/types/sync';

interface Props {
  result: ComparisonResult;
  destination: DestinationConfig;
  primaryHeaders: string[];
  primaryRowCount: number;
}

function columnToLetter(col: number): string {
  let letter = '';
  let c = col;
  while (c >= 0) {
    letter = String.fromCharCode((c % 26) + 65) + letter;
    c = Math.floor(c / 26) - 1;
  }
  return letter;
}

export default function DryRunPreview({ result, destination, primaryHeaders, primaryRowCount }: Props) {
  const [newLeadsOpen, setNewLeadsOpen] = useState(false);
  const [updatesOpen, setUpdatesOpen] = useState(false);

  const destHeaders = [...primaryHeaders];

  // Compute new lead cell writes — mappedRow is keyed by primary headers
  const newLeadCells: { row: number; cells: { ref: string; column: string; value: string }[] }[] = [];
  const startRow = primaryRowCount + 2; // +1 for header, +1 for 1-indexed
  result.newLeads.slice(0, 20).forEach((lead, i) => {
    const rowNum = startRow + i;
    const cells: { ref: string; column: string; value: string }[] = [];
    destHeaders.forEach((col, colIdx) => {
      const value = lead.mappedRow[col] ?? '';
      if (value) {
        cells.push({
          ref: `${columnToLetter(colIdx)}${rowNum}`,
          column: col,
          value,
        });
      }
    });
    if (cells.length > 0) {
      newLeadCells.push({ row: rowNum, cells });
    }
  });

  // Compute update cell writes — fieldsToFill is keyed by primary headers
  const updateCells: { row: number; matchInfo: string; cells: { ref: string; column: string; value: string }[] }[] = [];
  result.updates.slice(0, 20).forEach((update) => {
    const rowNum = update.primaryRowIndex + 2; // +1 header, +1 for 1-indexed
    const cells: { ref: string; column: string; value: string }[] = [];
    for (const [col, value] of Object.entries(update.fieldsToFill)) {
      const colIdx = destHeaders.indexOf(col);
      if (colIdx >= 0) {
        cells.push({
          ref: `${columnToLetter(colIdx)}${rowNum}`,
          column: col,
          value,
        });
      }
    }
    if (cells.length > 0) {
      updateCells.push({
        row: rowNum,
        matchInfo: `${update.matchedBy}: ${update.matchValue}`,
        cells,
      });
    }
  });

  const totalCellWrites =
    result.newLeads.reduce((sum, lead) => {
      return sum + Object.values(lead.mappedRow).filter((v) => v).length;
    }, 0) +
    result.updates.reduce((sum, update) => {
      return sum + Object.keys(update.fieldsToFill).length;
    }, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <FileSpreadsheet className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">
          Dry Run — {totalCellWrites.toLocaleString()} cell writes to "{destination.tabName}"
        </h3>
      </div>

      {/* New Leads Section */}
      {result.newLeads.length > 0 && (
        <Collapsible open={newLeadsOpen} onOpenChange={setNewLeadsOpen}>
          <CollapsibleTrigger className="flex items-center gap-2 w-full text-left py-2 px-3 rounded-lg bg-success/10 border border-success/20 hover:bg-success/15 transition-colors">
            {newLeadsOpen ? <ChevronDown className="h-4 w-4 text-success" /> : <ChevronRight className="h-4 w-4 text-success" />}
            <Plus className="h-3.5 w-3.5 text-success" />
            <span className="text-sm font-medium text-foreground">
              {result.newLeads.length} new rows to append
            </span>
            <span className="text-xs text-muted-foreground ml-auto">
              Starting at row {startRow}
            </span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ScrollArea className="h-[200px] mt-2">
              <div className="space-y-2">
                {newLeadCells.map((entry) => (
                  <div key={entry.row} className="text-xs bg-muted/50 rounded-lg px-3 py-2 space-y-1">
                    <p className="text-muted-foreground font-medium">Row {entry.row}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {entry.cells.map((cell) => (
                        <Badge key={cell.ref} variant="outline" className="text-xs font-mono gap-1 bg-success/5 border-success/20">
                          <span className="text-success">{cell.ref}</span>
                          <span className="text-muted-foreground">({cell.column})</span>
                          <span className="text-foreground">← {cell.value.length > 25 ? cell.value.slice(0, 25) + '…' : cell.value}</span>
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
                {result.newLeads.length > 20 && (
                  <p className="text-xs text-muted-foreground text-center py-1">
                    …and {result.newLeads.length - 20} more rows
                  </p>
                )}
              </div>
            </ScrollArea>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Updates Section */}
      {result.updates.length > 0 && destination.type === 'same_tab' && (
        <Collapsible open={updatesOpen} onOpenChange={setUpdatesOpen}>
          <CollapsibleTrigger className="flex items-center gap-2 w-full text-left py-2 px-3 rounded-lg bg-primary/10 border border-primary/20 hover:bg-primary/15 transition-colors">
            {updatesOpen ? <ChevronDown className="h-4 w-4 text-primary" /> : <ChevronRight className="h-4 w-4 text-primary" />}
            <Pencil className="h-3.5 w-3.5 text-primary" />
            <span className="text-sm font-medium text-foreground">
              {result.updates.length} rows to update (fill blanks)
            </span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ScrollArea className="h-[200px] mt-2">
              <div className="space-y-2">
                {updateCells.map((entry, i) => (
                  <div key={i} className="text-xs bg-muted/50 rounded-lg px-3 py-2 space-y-1">
                    <p className="text-muted-foreground">
                      <span className="font-medium">Row {entry.row}</span>
                      <span className="ml-2 text-muted-foreground/70">matched by {entry.matchInfo}</span>
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {entry.cells.map((cell) => (
                        <Badge key={cell.ref} variant="outline" className="text-xs font-mono gap-1 bg-primary/5 border-primary/20">
                          <span className="text-primary">{cell.ref}</span>
                          <span className="text-muted-foreground">({cell.column})</span>
                          <span className="text-foreground">← {cell.value.length > 25 ? cell.value.slice(0, 25) + '…' : cell.value}</span>
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
                {result.updates.length > 20 && (
                  <p className="text-xs text-muted-foreground text-center py-1">
                    …and {result.updates.length - 20} more rows
                  </p>
                )}
              </div>
            </ScrollArea>
          </CollapsibleContent>
        </Collapsible>
      )}

      {result.newLeads.length === 0 && result.updates.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-2">No changes to write.</p>
      )}
    </div>
  );
}
