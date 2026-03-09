import { ArrowLeft, ArrowRight, Plus, RefreshCw, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { ComparisonResult } from '@/types/sync';

interface Props {
  result: ComparisonResult | null;
  onNext: () => void;
  onBack: () => void;
}

export default function StepPreview({ result, onNext, onBack }: Props) {
  if (!result) return null;

  return (
    <Card className="border-border">
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Preview Changes</h2>
            <p className="text-sm text-muted-foreground">Review what will happen before syncing.</p>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded-lg bg-success/10 border border-success/20 text-center">
            <Plus className="h-4 w-4 text-success mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground">{result.summary.newLeadCount}</p>
            <p className="text-xs text-muted-foreground">New Leads</p>
          </div>
          <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-center">
            <RefreshCw className="h-4 w-4 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground">{result.summary.updateCount}</p>
            <p className="text-xs text-muted-foreground">Updates</p>
          </div>
          <div className="p-3 rounded-lg bg-warning/10 border border-warning/20 text-center">
            <AlertTriangle className="h-4 w-4 text-warning mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground">{result.summary.skippedCount}</p>
            <p className="text-xs text-muted-foreground">Skipped</p>
          </div>
        </div>

        {/* Detailed tabs */}
        <Tabs defaultValue="new" className="w-full">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="new">New Leads ({result.newLeads.length})</TabsTrigger>
            <TabsTrigger value="updates">Updates ({result.updates.length})</TabsTrigger>
            <TabsTrigger value="skipped">Skipped ({result.skipped.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="new">
            <ScrollArea className="h-[280px]">
              {result.newLeads.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No new leads to add.</p>
              ) : (
                <div className="space-y-2">
                  {result.newLeads.slice(0, 50).map((lead, i) => (
                    <div key={i} className="text-xs bg-muted/50 rounded-lg px-3 py-2 flex flex-wrap gap-2">
                      {Object.entries(lead.mappedRow)
                        .filter(([, v]) => v)
                        .slice(0, 6)
                        .map(([k, v]) => (
                          <span key={k}>
                            <span className="text-muted-foreground">{k}:</span>{' '}
                            <span className="font-medium text-foreground">{v}</span>
                          </span>
                        ))}
                    </div>
                  ))}
                  {result.newLeads.length > 50 && (
                    <p className="text-xs text-muted-foreground text-center">
                      …and {result.newLeads.length - 50} more
                    </p>
                  )}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="updates">
            <ScrollArea className="h-[280px]">
              {result.updates.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No updates needed.</p>
              ) : (
                <div className="space-y-2">
                  {result.updates.slice(0, 50).map((update, i) => (
                    <div key={i} className="text-xs bg-muted/50 rounded-lg px-3 py-2">
                      <span className="text-muted-foreground">
                        Row {update.primaryRowIndex + 1} (matched by {update.matchedBy}: {update.matchValue})
                      </span>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {Object.entries(update.fieldsToFill).map(([k, v]) => (
                          <Badge key={k} variant="secondary" className="text-xs font-normal">
                            {k} ← <span className="font-medium">{v}</span>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="skipped">
            <ScrollArea className="h-[280px]">
              {result.skipped.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No rows skipped.</p>
              ) : (
                <div className="space-y-2">
                  {result.skipped.slice(0, 50).map((skip, i) => (
                    <div key={i} className="text-xs bg-muted/50 rounded-lg px-3 py-2">
                      <span className="text-warning font-medium">{skip.reason}</span>
                      <div className="flex flex-wrap gap-2 mt-1 text-muted-foreground">
                        {Object.entries(skip.sourceRow)
                          .filter(([, v]) => v)
                          .slice(0, 4)
                          .map(([k, v]) => (
                            <span key={k}>{k}: {v}</span>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end pt-2">
          <Button onClick={onNext} className="gap-2">
            Choose Destination <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
