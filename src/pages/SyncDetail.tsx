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
                <span className="text-muted-foreground">Source</span>
                <span className="font-medium text-foreground">{entry.sourceLabel}</span>
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

        {entry.logs && (
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
                      <ScrollArea className="max-h-80">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-10">#</TableHead>
                              <TableHead>FullName</TableHead>
                              <TableHead>Email</TableHead>
                              <TableHead>Phoneno</TableHead>
                              <TableHead>Location</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {entry.logs.newLeads.map((lead, i) => (
                              <TableRow key={i}>
                                <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                                <TableCell>{lead.mappedRow['FullName'] || '—'}</TableCell>
                                <TableCell>{lead.mappedRow['Email'] || '—'}</TableCell>
                                <TableCell>{lead.mappedRow['Phoneno'] || '—'}</TableCell>
                                <TableCell>{lead.mappedRow['Location'] || '—'}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollArea>
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
                      <ScrollArea className="max-h-80">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-10">#</TableHead>
                              <TableHead>Matched By</TableHead>
                              <TableHead>Match Value</TableHead>
                              <TableHead>Fields Filled</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {entry.logs.updates.map((update, i) => (
                              <TableRow key={i}>
                                <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                                <TableCell>
                                  <Badge variant="outline">{update.matchedBy}</Badge>
                                </TableCell>
                                <TableCell className="font-mono text-xs">{update.matchValue}</TableCell>
                                <TableCell>
                                  {Object.entries(update.fieldsToFill).map(([col, val]) => (
                                    <span key={col} className="inline-block mr-2 text-xs">
                                      <span className="text-muted-foreground">{col}:</span> {val}
                                    </span>
                                  ))}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollArea>
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
                      <ScrollArea className="max-h-80">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-10">#</TableHead>
                              <TableHead>Reason</TableHead>
                              <TableHead>Email</TableHead>
                              <TableHead>Phone</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {entry.logs.skipped.map((skip, i) => (
                              <TableRow key={i}>
                                <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                                <TableCell>{skip.reason}</TableCell>
                                <TableCell className="font-mono text-xs">{skip.sourceRow['Email'] || skip.sourceRow['email'] || '—'}</TableCell>
                                <TableCell className="font-mono text-xs">{skip.sourceRow['Phoneno'] || skip.sourceRow['phone'] || '—'}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollArea>
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
