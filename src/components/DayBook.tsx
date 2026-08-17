import { TabType } from '@/components/Navigation';

interface DayBookProps {
  dateLabel: string;
  sales: number;
  paidNow: number;
  onDeni: number;
  deniPaidBack: number;
  spent: number;
  takeHome: number;
  /** Money actually received today, keyed by method. Excludes deni. */
  byMethod: { method: string; label: string; amount: number }[];
  stockValue: number;
  stockRetailValue: number;
  owedToYou: number;
  lowStockCount: number;
  onNavigate: (tab: TabType) => void;
}

const money = (n: number) => n.toLocaleString('en-KE', { maximumFractionDigits: 0 });

/**
 * The day on one sheet, read top to bottom like a shopkeeper's book: what came
 * in, what went out, what is left. Deliberately not six equal cards -- take-home
 * is the number that matters and it should look like it.
 */
export function DayBook({
  dateLabel,
  sales,
  paidNow,
  onDeni,
  deniPaidBack,
  byMethod,
  spent,
  takeHome,
  stockValue,
  stockRetailValue,
  owedToYou,
  lowStockCount,
  onNavigate,
}: DayBookProps) {
  const moneyIn = paidNow + deniPaidBack;
  const isLoss = takeHome < 0;

  return (
    <div className="space-y-3">
      <div className="sheet">
        <div className="ledger-line">
          <span className="font-medium">Sales</span>
          <span className="amount">{money(sales)}</span>
        </div>
        {sales > 0 && (
          <>
            <div className="ledger-sub">
              <span>paid now</span>
              <span className="num">{money(paidNow)}</span>
            </div>
            {onDeni > 0 && (
              <div className="ledger-sub">
                <span>on deni</span>
                <span className="num">{money(onDeni)}</span>
              </div>
            )}
          </>
        )}

        {deniPaidBack > 0 && (
          <div className="ledger-line">
            <span className="font-medium">Deni paid back</span>
            <span className="amount text-success">{money(deniPaidBack)}</span>
          </div>
        )}

        <div className="ledger-line ledger-rule">
          <span className="text-muted-foreground">Money in</span>
          <span className="amount">{money(moneyIn)}</span>
        </div>
        {/* Only worth breaking out when more than one kind of money came in --
            a purely cash day does not need telling that it was cash. */}
        {byMethod.length > 1 && byMethod.map((row) => (
          <div key={row.method} className="ledger-sub">
            <span>{row.label}</span>
            <span className="num">{money(row.amount)}</span>
          </div>
        ))}

        <button
          type="button"
          onClick={() => onNavigate('money')}
          className="ledger-line w-full text-left pressable"
        >
          <span className="text-muted-foreground">Spent</span>
          <span className="amount text-destructive">− {money(spent)}</span>
        </button>

        <div className="ledger-line ledger-total">
          <span className="font-semibold">{dateLabel === "Today's" ? 'Take-home' : `Take-home, ${dateLabel}`}</span>
          <span className={`text-2xl amount ${isLoss ? 'text-destructive' : 'text-success'}`}>
            {money(takeHome)}
          </span>
        </div>
      </div>

      {(owedToYou > 0 || lowStockCount > 0) && (
        <div className="grid grid-cols-2 gap-3">
          {owedToYou > 0 && (
            <button
              type="button"
              onClick={() => onNavigate('credit')}
              className="sheet text-left pressable"
            >
              <p className="sheet-heading">Owed to you</p>
              <p className="text-lg amount text-warning mt-1">{money(owedToYou)}</p>
            </button>
          )}
          {lowStockCount > 0 && (
            <button
              type="button"
              onClick={() => onNavigate('alerts')}
              className="sheet text-left pressable"
            >
              <p className="sheet-heading">Running low</p>
              <p className="text-lg amount text-warning mt-1">
                {lowStockCount} {lowStockCount === 1 ? 'item' : 'items'}
              </p>
            </button>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => onNavigate('stock')}
        className="sheet w-full text-left pressable"
      >
        <div className="flex items-baseline justify-between gap-4">
          <span className="sheet-heading">Stock you are holding</span>
          <span className="amount">{money(stockValue)}</span>
        </div>
        {stockRetailValue > 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            {money(stockRetailValue)} if it all sells
          </p>
        )}
      </button>
    </div>
  );
}
