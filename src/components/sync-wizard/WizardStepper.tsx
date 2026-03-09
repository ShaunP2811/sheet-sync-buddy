import { WIZARD_STEPS } from '@/lib/constants';
import { Check } from 'lucide-react';

interface Props {
  currentStep: number;
}

export default function WizardStepper({ currentStep }: Props) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-2">
      {WIZARD_STEPS.map((label, i) => {
        const isComplete = i < currentStep;
        const isCurrent = i === currentStep;
        return (
          <div key={label} className="flex items-center gap-1 shrink-0">
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
                isComplete
                  ? 'bg-primary/15 text-primary'
                  : isCurrent
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {isComplete ? (
                <Check className="h-3 w-3" />
              ) : (
                <span className="w-4 text-center">{i + 1}</span>
              )}
              <span className="hidden sm:inline">{label}</span>
            </div>
            {i < WIZARD_STEPS.length - 1 && (
              <div className={`w-4 h-px ${i < currentStep ? 'bg-primary/40' : 'bg-border'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
