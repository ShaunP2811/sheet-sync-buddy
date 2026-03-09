import { ArrowLeft, CheckCircle2, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import DryRunPreview from './DryRunPreview';
import type { ComparisonResult, DestinationConfig } from '@/types/sync';
import type { GoogleSpreadsheet } from '@/types/google';

interface Props {
  primarySheet: GoogleSpreadsheet | null;
  primaryTab: string;
  sourceLabel: string;
  destination: DestinationConfig;
  result: ComparisonResult | null;
  primaryHeaders: string[];
  primaryRowCount: number;
  isLoading: boolean;
  onConfirm: () => void;
  onBack: () => void;
}

export default function StepConfirm({
  primarySheet, primaryTab, sourceLabel, destination, result, primaryHeaders, primaryRowCount, isLoading, onConfirm, onBack,
}: Props) {
  if (!result) return null;

  return (
    <Card className="border-border">
      <CardContent className="pt-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onBack} disabled={isLoading}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Confirm Sync</h2>
            <p className="text-sm text-muted-foreground">Review and confirm the changes below.</p>
          </div>
        </div>

        <div className="bg-muted/50 rounded-lg p-4 space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Primary Sheet</span>
            <span className="font-medium text-foreground">{primarySheet?.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Primary Tab</span>
            <span className="font-medium text-foreground">{primaryTab}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Source</span>
            <span className="font-medium text-foreground">{sourceLabel}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Destination</span>
            <span className="font-medium text-foreground">{destination.tabName}</span>
          </div>
          <hr className="border-border" />
          <div className="flex justify-between">
            <span className="text-muted-foreground">New leads to add</span>
            <span className="font-bold text-success">{result.summary.newLeadCount}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Rows to update</span>
            <span className="font-bold text-primary">{result.summary.updateCount}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Rows skipped</span>
            <span className="font-bold text-warning">{result.summary.skippedCount}</span>
          </div>
        </div>

        {/* Dry-run cell preview */}
        <DryRunPreview
          result={result}
          destination={destination}
          primaryHeaders={primaryHeaders}
          primaryRowCount={primaryRowCount}
        />

        <div className="flex items-start gap-3 bg-warning/10 border border-warning/20 rounded-lg p-3">
          <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
          <p className="text-sm text-foreground">
            This will modify your Google Sheet. Only blank fields will be filled — existing values are never overwritten.
          </p>
        </div>

        <div className="flex justify-end">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="lg" className="gap-2" disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                {isLoading ? 'Syncing…' : 'Execute Sync'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will add {result.summary.newLeadCount} new rows and update {result.summary.updateCount} existing rows
                  in "{destination.tabName}". This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onConfirm}>Yes, execute sync</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}
