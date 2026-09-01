import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Undo2 } from 'lucide-react';
import { Sale } from '@/types/inventory';
import { Button } from '@/components/ui/button';
import { money } from '@/lib/money';

interface DaySalesProps {
  sales: Sale[];
  /** Maps a user id to a display name, for the "who sold it" column. */
  nameFor: (userId?: string | null) => string;
  onVoid: (saleId: string) => Promise<boolean>;
  /** Hide the seller column when there is only ever one person selling. */
  showSeller?: boolean;
}


/**
 * The list the app never had. Without it there is no way to check whether a sale
 * was recorded, and no way to undo one -- which is why voiding lives here rather
 * than on its own screen.
 */
export function DaySales({ sales, nameFor, onVoid, showSeller = true }: DaySalesProps) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const ordered = [...sales].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Lines are still listed one by one -- that is what somebody checking the day
  // wants to see. But a line bought as part of a basket is marked, because
  // cancelling it takes the whole basket with it.
  const receiptSize = useMemo(() => {
    const counts = new Map<string, number>();
    for (const sale of sales) {
      counts.set(sale.receiptId, (counts.get(sale.receiptId) || 0) + 1);
    }
    return counts;
  }, [sales]);

  const handleVoid = async (saleId: string) => {
    setBusyId(saleId);
    const ok = await onVoid(saleId);
    setBusyId(null);
    if (ok) setConfirmingId(null);
  };

  if (ordered.length === 0) {
    return (
      <div className="sheet">
        <p className="sheet-heading">Sales</p>
        <p className="text-sm text-muted-foreground mt-2">Nothing recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="sheet">
      <p className="sheet-heading">Sales</p>

      <div className="mt-2 divide-y divide-border/70">
        {ordered.map((sale) => {
          const voided = Boolean(sale.voidedAt);
          const inBasket = (receiptSize.get(sale.receiptId) || 1) > 1;
          const above =
            sale.priceSource === 'override' && sale.listPriceAtSale
              ? (sale.unitPrice ?? 0) - sale.listPriceAtSale
              : 0;

          return (
            <div key={sale.id} className={voided ? 'py-2 opacity-50' : 'py-2'}>
              <div className="flex items-baseline gap-3">
                <span className="text-xs text-muted-foreground num shrink-0 w-11">
                  {format(new Date(sale.createdAt), 'HH:mm')}
                </span>
                <span className={`flex-1 min-w-0 truncate text-sm ${voided ? 'line-through' : ''}`}>
                  {sale.productName}
                  {sale.quantity > 1 && (
                    <span className="text-muted-foreground"> ×{sale.quantity}</span>
                  )}
                </span>
                <span className={`amount text-sm shrink-0 ${voided ? 'line-through' : ''}`}>
                  {money(sale.totalAmount)}
                </span>
              </div>

              <div className="flex items-center gap-3 pl-14 mt-0.5">
                {above !== 0 && !voided && (
                  <span className={`text-xs num ${above > 0 ? 'text-success' : 'text-warning'}`}>
                    {above > 0 ? '↑' : '↓'} {money(Math.abs(above))} a unit
                  </span>
                )}
                {showSeller && !voided && (
                  <span className="text-xs text-muted-foreground truncate">
                    {nameFor(sale.soldBy)}
                  </span>
                )}
                {inBasket && !voided && (
                  <span className="text-xs text-muted-foreground">
                    1 of {receiptSize.get(sale.receiptId)} in one sale
                  </span>
                )}
                {voided && <span className="text-xs text-muted-foreground">cancelled</span>}

                {!voided && (
                  <div className="ml-auto">
                    {confirmingId === sale.id ? (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => setConfirmingId(null)}
                        >
                          Keep
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          disabled={busyId === sale.id}
                          onClick={() => handleVoid(sale.id)}
                        >
                          {busyId === sale.id
                            ? 'Cancelling...'
                            : inBasket ? `Cancel all ${receiptSize.get(sale.receiptId)}` : 'Yes, cancel'}
                        </Button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmingId(sale.id)}
                        className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1"
                      >
                        <Undo2 className="h-3 w-3" />
                        Cancel
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
