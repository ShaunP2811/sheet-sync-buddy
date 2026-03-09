import { useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { DestinationConfig, DestinationType } from '@/types/sync';
import type { GoogleSheetTab } from '@/types/google';

interface Props {
  primaryTab: string;
  spreadsheetId: string;
  tabs: GoogleSheetTab[];
  destination: DestinationConfig;
  onSelect: (config: DestinationConfig) => void;
  onBack: () => void;
}

export default function StepDestination({ primaryTab, tabs, destination, onSelect, onBack }: Props) {
  const [type, setType] = useState<DestinationType>(destination.type);
  const [existingTab, setExistingTab] = useState(destination.tabName || primaryTab);
  const [newTabName, setNewTabName] = useState('');

  const handleContinue = () => {
    let tabName = '';
    if (type === 'same_tab') tabName = primaryTab;
    else if (type === 'existing_tab') tabName = existingTab;
    else tabName = newTabName.trim();

    if (!tabName) return;
    onSelect({ type, tabName });
  };

  const isValid =
    type === 'same_tab' ||
    (type === 'existing_tab' && existingTab) ||
    (type === 'new_tab' && newTabName.trim());

  return (
    <Card className="border-border">
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Select Destination</h2>
            <p className="text-sm text-muted-foreground">Where should the changes be written?</p>
          </div>
        </div>

        <RadioGroup value={type} onValueChange={(v) => setType(v as DestinationType)} className="space-y-3">
          <div className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-accent/30 transition-colors">
            <RadioGroupItem value="same_tab" id="same" />
            <Label htmlFor="same" className="cursor-pointer flex-1">
              <p className="text-sm font-medium text-foreground">Same tab ({primaryTab})</p>
              <p className="text-xs text-muted-foreground">Write changes directly to the primary tab</p>
            </Label>
          </div>

          <div className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-accent/30 transition-colors">
            <RadioGroupItem value="existing_tab" id="existing" />
            <Label htmlFor="existing" className="cursor-pointer flex-1">
              <p className="text-sm font-medium text-foreground">Another existing tab</p>
              <p className="text-xs text-muted-foreground">Select a different tab in the same spreadsheet</p>
            </Label>
          </div>

          {type === 'existing_tab' && (
            <div className="pl-8 space-y-1">
              {tabs.filter((t) => t.title !== primaryTab).map((t) => (
                <button
                  key={t.sheetId}
                  onClick={() => setExistingTab(t.title)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    existingTab === t.title ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-accent/50 text-foreground'
                  }`}
                >
                  {t.title}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-accent/30 transition-colors">
            <RadioGroupItem value="new_tab" id="new" />
            <Label htmlFor="new" className="cursor-pointer flex-1">
              <p className="text-sm font-medium text-foreground">Create a new tab</p>
              <p className="text-xs text-muted-foreground">Headers will match the target schema</p>
            </Label>
          </div>

          {type === 'new_tab' && (
            <div className="pl-8">
              <Input
                placeholder="New tab name"
                value={newTabName}
                onChange={(e) => setNewTabName(e.target.value)}
                className="max-w-xs"
              />
            </div>
          )}
        </RadioGroup>

        <div className="flex justify-end pt-2">
          <Button onClick={handleContinue} disabled={!isValid} className="gap-2">
            Continue <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
