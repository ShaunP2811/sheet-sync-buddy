import { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import AppLayout from '@/components/layout/AppLayout';
import { getSyncHistoryEntry } from '@/services/syncHistory';

export default function SyncDetail() {
  const { id } = useParams<{ id: string }>();
  const entry = id ? getSyncHistoryEntry(id) : null;

  // Derive display columns: use stored primaryHeaders, or fall back to
  // extracting keys from the logged data (for entries saved before this change)
  const displayHeaders = useMemo(() => {
    if (!entry) return [];
    if (entry.primaryHeaders && entry.primaryHeaders.length > 0) return entry.primaryHeaders;
    // Fallback: derive from logged data
    if (entry.logs) {
      const keysSet = new Set<string>();
      for (const lead of entry.logs.newLeads) {
        for (const k of Object.keys(lead.mappedRow)) {
          if (lead.mappedRow[k]) keysSet.add(k);
        }
      }
      for (const update of entry.logs.updates) {
        for (const k of Object.keys(update.fieldsToFill)) {
          keysSet.add(k);
        }
      }
      if (keysSet.size > 0) return Array.from(keysSet);
    }
    return [];
  }, [entry]);

  if (!entry) {
    return (
      <AppLayout>
        <div className="text-center py-20">
          <p className="text-muted-foreground">Sync run not found.</p>
          <Link to="/" className="mt-4 inline-block">
            <Button variant="outline">Back to Dashboard</Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/history">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-foreground">Sync Run Detail</h1>
            <p className="text-sm text-muted-foreground">{new Date(entry.completedAt).toLocaleString()}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Primary Sheet</span>
                <span className="font-medium text-foreground">{entry.primarySheetName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Primary Tab</span>
                <span className="font-medium text-foreground">{entry.primaryTabName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Source(s)</span>
                <span className="font-medium text-foreground text-right">
                  {entry.sourceLabels
                    ? entry.sourceLabels.map((l, i) => <div key={i}>{l}</div>)
                    : entry.sourceLabel}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Destination</span>
                <span className="font-medium text-foreground">{entry.destinationTabName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <Badge variant={entry.status === 'completed' ? 'default' : 'destructive'}>
                  {entry.status === 'completed' ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                  {entry.status}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Results</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-success/10 border border-success/20">
                <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">{entry.newLeadsAdded} new leads added</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20">
                <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">{entry.rowsUpdated} rows updated</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-warning/10 border border-warning/20">
                <AlertTriangle className="h-5 w-5 text-warning shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">{entry.rowsSkipped} rows skipped</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {entry.logs && displayHeaders.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Detailed Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" className="w-full">
                {entry.logs.newLeads.length > 0 && (
                  <AccordionItem value="new-leads">
                    <AccordionTrigger>
                      <span className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-success" />
                        New Leads Added ({entry.logs.newLeads.length})
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="overflow-x-auto">
                        <ScrollArea className="max-h-96">
                          <Table className="min-w-[1200px]">
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-10 sticky left-0 bg-background">#</TableHead>
                                {displayHeaders.map((col) => (
                                  <TableHead key={col}>{col}</TableHead>
                                ))}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {entry.logs.newLeads.map((lead, i) => (
                                <TableRow key={i}>
                                  <TableCell className="text-muted-foreground sticky left-0 bg-background">{i + 1}</TableCell>
                                  {displayHeaders.map((col) => (
                                    <TableCell key={col} className="text-xs whitespace-nowrap">
                                      {lead.mappedRow[col] || '—'}
                                    </TableCell>
                                  ))}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </ScrollArea>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}

                {entry.logs.updates.length > 0 && (
                  <AccordionItem value="updates">
                    <AccordionTrigger>
                      <span className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                        Rows Updated ({entry.logs.updates.length})
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="overflow-x-auto">
                        <ScrollArea className="max-h-96">
                          <Table className="min-w-[1400px]">
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-10 sticky left-0 bg-background">#</TableHead>
                                <TableHead>Matched By</TableHead>
                                <TableHead>Match Value</TableHead>
                                {displayHeaders.map((col) => (
                                  <TableHead key={col}>{col}</TableHead>
                                ))}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {entry.logs.updates.map((update, i) => (
                                <TableRow key={i}>
                                  <TableCell className="text-muted-foreground sticky left-0 bg-background">{i + 1}</TableCell>
                                  <TableCell>
                                    <Badge variant="outline">{update.matchedBy}</Badge>
                                  </TableCell>
                                  <TableCell className="font-mono text-xs">{update.matchValue}</TableCell>
                                  {displayHeaders.map((col) => {
                                    const val = update.fieldsToFill[col];
                                    return (
                                      <TableCell key={col} className={`text-xs whitespace-nowrap ${val ? 'text-green-600 font-medium' : 'text-muted-foreground'}`}>
                                        {val || '—'}
                                      </TableCell>
                                    );
                                  })}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </ScrollArea>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}

                {entry.logs.skipped.length > 0 && (
                  <AccordionItem value="skipped">
                    <AccordionTrigger>
                      <span className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-warning" />
                        Rows Skipped ({entry.logs.skipped.length})
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="overflow-x-auto">
                        <ScrollArea className="max-h-96">
                          <Table className="min-w-[1000px]">
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-10 sticky left-0 bg-background">#</TableHead>
                                <TableHead>Reason</TableHead>
                                <TableHead>Details</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {entry.logs.skipped.map((skip, i) => (
                                <TableRow key={i}>
                                  <TableCell className="text-muted-foreground sticky left-0 bg-background">{i + 1}</TableCell>
                                  <TableCell className="whitespace-nowrap">{skip.reason}</TableCell>
                                  <TableCell>
                                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                                      {Object.entries(skip.sourceRow).map(([k, v]) => (
                                        <span key={k} className="text-xs">
                                          <span className="text-muted-foreground">{k}:</span> {v || '—'}
                                        </span>
                                      ))}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </ScrollArea>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}
              </Accordion>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
