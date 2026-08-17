import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface CashUpProps {
  dateLabel: string;
  /** What the drawer held at the start of the day. Null when never counted. */
  openingBalance: number | null;
  cashSales: number;
  cashDeniPaid: number;
  cashSpent: number;
  nonCashIn: { label: string; amount: number }[];
  savedCount: { countedCash: number; difference: number } | null;
  onSaveCount: (countedCash: number, expectedCash: number) => Promise<boolean>;
}

const money = (n: number) => n.toLocaleString('en-KE', { maximumFractionDigits: 0 });

/**
 * What should be in the drawer, and what actually is.
 *
 * A till does not start empty each morning, so this needs an opening balance --
 * yesterday's count. Without one the sum is only the day's movement, and saying
 * "you should have" would be a guess. It went badly negative when a shop paid
 * for stock in cash on a quiet day, which is the case that proved the point.
 */
export function CashUp({
  dateLabel, openingBalance, cashSales, cashDeniPaid, cashSpent,
  nonCashIn, savedCount, onSaveCount,
}: CashUpProps) {
  const [open, setOpen] = useState(false);
  const [counted, setCounted] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const movement = cashSales + cashDeniPaid - cashSpent;
  const known = openingBalance !== null;
  const expected = known ? openingBalance + movement : movement;

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
          <span className="sheet-heading">
            {known ? 'In the till you should have' : 'Cash through the drawer'}
          </span>
          <span className={`amount ${known ? '' : movement < 0 ? 'text-destructive' : ''}`}>
            {known ? money(expected) : `${movement < 0 ? '−' : '+'} ${money(Math.abs(movement))}`}
          </span>
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
          <p className="text-xs text-muted-foreground mt-1">
            {known ? 'Tap to count it' : 'Count it once to set a starting point'}
          </p>
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

      {known ? (
        <div className="ledger-line ledger-rule">
          <span className="text-muted-foreground">Started the day with</span>
          <span className="num">{money(openingBalance)}</span>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground mt-2 leading-relaxed rounded-md bg-muted p-2">
          Nobody has counted the drawer yet, so there is no starting point. Count what is
          in there now and from tomorrow this will show a full total instead of just the
          day's movement.
        </p>
      )}

      <div className={`ledger-line ${known ? '' : 'ledger-rule'}`}>
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
        <span className="font-semibold">
          {known ? 'Should be in the till' : "Today's movement"}
        </span>
        <span className={`text-xl amount ${!known && movement < 0 ? 'text-destructive' : ''}`}>
          {known ? money(expected) : `${movement < 0 ? '−' : '+'} ${money(Math.abs(movement))}`}
        </span>
      </div>

      {known && expected < 0 && (
        <p className="text-xs text-warning mt-2 leading-relaxed">
          That is less than nothing, so some of what you paid out did not come from this
          drawer. Count what is actually there and it will correct itself.
        </p>
      )}

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

        {countedValid && known && (
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
