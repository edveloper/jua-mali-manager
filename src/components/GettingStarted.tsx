import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TabType } from '@/components/Navigation';

interface GettingStartedProps {
  hasProducts: boolean;
  hasSales: boolean;
  onNavigate: (tab: TabType) => void;
}

/**
 * Shown only until the shop has recorded its first sale, then it disappears on
 * its own -- no dismiss button to remember, and nothing to clutter the daybook
 * afterwards. A new owner otherwise lands on a screen of zeros with no
 * indication that products come first.
 */
export function GettingStarted({ hasProducts, hasSales, onNavigate }: GettingStartedProps) {
  if (hasSales) return null;

  const steps = [
    {
      done: hasProducts,
      title: 'Add what you sell',
      body: 'Just two or three to begin with. Put in what each one costs you and what you sell it for.',
      action: hasProducts ? null : { label: 'Add a product', tab: 'products' as TabType },
    },
    {
      done: false,
      title: 'Record one sale',
      body: 'Tap an item on the Sell screen. Your stock goes down on its own and the day starts adding up.',
      action: hasProducts ? { label: 'Go to Sell', tab: 'products' as TabType } : null,
    },
  ];

  return (
    <div className="sheet space-y-4">
      <div>
        <p className="font-semibold">Karibu</p>
        <p className="text-sm text-muted-foreground mt-0.5">
          Two things and your shop is running.
        </p>
      </div>

      <div className="space-y-4">
        {steps.map((step, i) => (
          <div key={step.title} className="flex gap-3">
            <div
              className={`h-6 w-6 rounded-full shrink-0 flex items-center justify-center text-xs font-semibold num ${
                step.done
                  ? 'bg-success text-success-foreground'
                  : 'border border-border text-muted-foreground'
              }`}
            >
              {step.done ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${step.done ? 'text-muted-foreground line-through' : ''}`}>
                {step.title}
              </p>
              {!step.done && (
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{step.body}</p>
              )}
              {step.action && (
                <Button size="sm" className="mt-2" onClick={() => onNavigate(step.action!.tab)}>
                  {step.action.label}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground border-t border-border/70 pt-3">
        Selling on deni, staff logins and expenses are all there when you need them.
        Nothing has to be set up first.
      </p>
    </div>
  );
}
