import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface CashUpProps {
  dateLabel: string;
  cashSales: number;
  cashDeniPaid: number;
  cashSpent: number;
  /** Money that arrived by phone or otherwise — never in the drawer. */
  nonCashIn: { label: string; amount: number }[];
  savedCount: { countedCash: number; difference: number } | null;
  onSaveCount: (countedCash: number, expectedCash: number) => Promise<boolean>;
}

const money = (n: number) => n.toLocaleString('en-KE', { maximumFractionDigits: 0 });

/**
 * What should be in the drawer, and what actually is.
 *
 * The whole feature depends on payment methods being recorded: before that, an
 * M-Pesa sale looked like cash and this number would have been confidently wrong.
 */
export function CashUp({
  dateLabel,
  cashSales,
  cashDeniPaid,
  cashSpent,
  nonCashIn,
  savedCount,
  onSaveCount,
}: CashUpProps) {
  const [open, setOpen] = useState(false);
  const [counted, setCounted] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const expected = cashSales + cashDeniPaid - cashSpent;
  const countedNum = Number(counted);
  const countedValid = counted.trim() !== '' && Number.isFinite(countedNum);
  const difference = countedValid ? countedNum - expected : 0;

  const handleSave = async () => {
    if (!countedValid) return;
    setIsSaving(true);
    const ok = await onSaveCount(countedNum, expected);
    setIsSaving(false);
    if (ok) setCounted('');
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="sheet w-full text-left pressable">
        <div className="flex items-baseline justify-between gap-4">
          <span className="sheet-heading">In the till you should have</span>
          <span className="amount">{money(expected)}</span>
        </div>
        {savedCount ? (
          <p className={`text-xs mt-1 ${savedCount.difference === 0 ? 'text-success' : 'text-warning'}`}>
            {savedCount.difference === 0
              ? 'Counted and it matched'
              : savedCount.difference > 0
                ? `Counted ${money(savedCount.countedCash)} — ${money(savedCount.difference)} more than expected`
                : `Counted ${money(savedCount.countedCash)} — ${money(Math.abs(savedCount.difference))} short`}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground mt-1">Tap to count it</p>
        )}
      </button>
    );
  }

  return (
    <div className="sheet">
      <div className="flex items-baseline justify-between">
        <p className="sheet-heading">Closing the till · {dateLabel}</p>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted-foreground">
          Close
        </button>
      </div>

      <div className="ledger-line ledger-rule">
        <span className="text-muted-foreground">Cash sales</span>
        <span className="num">{money(cashSales)}</span>
      </div>
      {cashDeniPaid > 0 && (
        <div className="ledger-line">
          <span className="text-muted-foreground">Deni paid in cash</span>
          <span className="num">{money(cashDeniPaid)}</span>
        </div>
      )}
      {cashSpent > 0 && (
        <div className="ledger-line">
          <span className="text-muted-foreground">Paid out in cash</span>
          <span className="num">− {money(cashSpent)}</span>
        </div>
      )}
      <div className="ledger-line ledger-total">
        <span className="font-semibold">Should be in the till</span>
        <span className="text-xl amount">{money(expected)}</span>
      </div>

      {nonCashIn.length > 0 && (
        <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
          {nonCashIn.map((n) => `${n.label} ${money(n.amount)}`).join(', ')} went to your
          phone, not the drawer.
        </p>
      )}

      <div className="mt-4 space-y-2 border-t border-border/70 pt-3">
        <label htmlFor="counted" className="text-sm font-medium">Count it and type the total</label>
        <Input
          id="counted"
          type="number"
          inputMode="decimal"
          placeholder="0"
          value={counted}
          onChange={(e) => setCounted(e.target.value)}
          className="text-lg h-12 num"
        />

        {countedValid && (
          <div className={`ledger-line ${difference === 0 ? 'text-success' : 'text-warning'}`}>
            <span className="font-medium">
              {difference === 0 ? 'It matches' : difference > 0 ? 'More than expected' : 'Short by'}
            </span>
            {difference !== 0 && <span className="amount">{money(Math.abs(difference))}</span>}
          </div>
        )}

        <Button className="w-full" onClick={handleSave} disabled={!countedValid || isSaving}>
          {isSaving ? 'Saving...' : savedCount ? 'Update the count' : 'Save the count'}
        </Button>
      </div>
    </div>
  );
}
