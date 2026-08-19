import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Sale, SalePayment } from '@/types/inventory';
import { MpesaEntry } from '@/hooks/useMpesa';
import { parseMpesaText, ParsedMpesaEntry } from '@/lib/mpesa';

interface MpesaReconcileProps {
  sales: Sale[];
  salePayments: SalePayment[];
  entries: MpesaEntry[];
  isImporting: boolean;
  onImport: (parsed: ParsedMpesaEntry[]) => Promise<{ entries_seen: number; entries_new: number; matched: number } | null>;
  onForget: (entryId: string) => Promise<void>;
}

const money = (n: number) => n.toLocaleString('en-KE', { maximumFractionDigits: 0 });

/**
 * The matches are not the point. The two mismatched lists are: money that
 * reached the phone with no sale behind it, and sales claiming an M-Pesa payment
 * that never arrived.
 */
export function MpesaReconcile({ sales, salePayments, entries, isImporting, onImport, onForget }: MpesaReconcileProps) {
  const [text, setText] = useState('');
  const [result, setResult] = useState<{ entries_seen: number; entries_new: number; matched: number } | null>(null);
  const [skipped, setSkipped] = useState(0);

  const preview = useMemo(() => parseMpesaText(text), [text]);

  const { unmatchedIn, missingPayment, noCode, matchedTotal } = useMemo(() => {
    const codes = new Set(entries.map((e) => e.code.toUpperCase()));

    const unmatchedIn = entries.filter(
      (e) => e.direction === 'in' && !e.matchedSaleId && !e.matchedCreditPaymentId
    );

    const liveReceipts = new Set(sales.filter((s) => !s.voidedAt).map((s) => s.receiptId));

    // Payments, not sales: a receipt paid by two M-Pesa transfers has two codes,
    // and each one has to be checked on its own.
    const mpesaPayments = salePayments.filter(
      (p) => p.method === 'mpesa' && liveReceipts.has(p.receiptId)
    );

    // Claims M-Pesa and gives a code, but that code is nowhere in the statement.
    const missingPayment = mpesaPayments.filter(
      (p) => p.reference && !codes.has(p.reference.toUpperCase())
    );

    // Nothing to check against. This is the nudge to start capturing codes.
    const noCode = mpesaPayments.filter((p) => !p.reference);

    const matchedTotal = entries
      .filter((e) => e.matchedSaleId || e.matchedCreditPaymentId)
      .reduce((sum, e) => sum + e.amount, 0);

    return { unmatchedIn, missingPayment, noCode, matchedTotal };
  }, [sales, salePayments, entries]);

  // A receipt is one customer's purchase, however many lines it has, so it is
  // described by what they bought rather than by a single product name.
  const describeReceipt = useMemo(() => {
    const receipts = new Map<string, { label: string; lines: number; at: string }>();
    for (const sale of sales) {
      if (sale.voidedAt) continue;
      const seen = receipts.get(sale.receiptId);
      if (seen) seen.lines += 1;
      else receipts.set(sale.receiptId, { label: sale.productName, lines: 1, at: String(sale.createdAt) });
    }
    return (receiptId: string) => {
      const r = receipts.get(receiptId);
      if (!r) return { label: 'Sale', at: null as string | null };
      return { label: r.lines > 1 ? `${r.label} and ${r.lines - 1} more` : r.label, at: r.at };
    };
  }, [sales]);

  const handleCheck = async () => {
    if (preview.entries.length === 0) return;
    const outcome = await onImport(preview.entries);
    if (!outcome) return;
    setResult(outcome);
    setSkipped(preview.skipped);
    setText('');
  };

  const unmatchedTotal = unmatchedIn.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-3">
      <div className="sheet space-y-2">
        <p className="font-medium">Paste your M-Pesa messages</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Open M-Pesa in your messages, copy them, and paste here. Copy as many as you
          like at once. Nothing is sent to Safaricom. This only reads the text.
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          placeholder="SFG7H2K9LM Confirmed. You have received Ksh330.00 from..."
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        {text.trim() !== '' && (
          <p className="text-xs text-muted-foreground">
            {preview.entries.length} found
            {preview.skipped > 0 && `, ${preview.skipped} could not be read`}
          </p>
        )}
        <Button
          className="w-full"
          onClick={handleCheck}
          disabled={isImporting || preview.entries.length === 0}
        >
          {isImporting ? 'Checking...' : `Check ${preview.entries.length || ''}`}
        </Button>
      </div>

      {result && (
        <div className="sheet">
          <p className="sheet-heading">Last check</p>
          <div className="ledger-line ledger-rule">
            <span className="text-muted-foreground">Messages read</span>
            <span className="num">{result.entries_seen}</span>
          </div>
          <div className="ledger-line">
            <span className="text-muted-foreground">New to DukaKonnect</span>
            <span className="num">{result.entries_new}</span>
          </div>
          <div className="ledger-line">
            <span className="text-muted-foreground">Matched to a sale</span>
            <span className="num text-success">{result.matched}</span>
          </div>
          {skipped > 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              {skipped} could not be read and were left out.
            </p>
          )}
        </div>
      )}

      {entries.length > 0 && (
        <div className="sheet">
          <div className="flex items-baseline justify-between gap-4">
            <span className="sheet-heading">Matched so far</span>
            <span className="amount text-success">{money(matchedTotal)}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {entries.length} messages held, of which {entries.filter((e) => e.matchedSaleId || e.matchedCreditPaymentId).length} line up with a sale.
          </p>
        </div>
      )}

      {unmatchedIn.length > 0 && (
        <div className="sheet">
          <div className="flex items-baseline justify-between gap-4">
            <span className="sheet-heading text-warning">Money in, no sale recorded</span>
            <span className="amount text-warning">{money(unmatchedTotal)}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1 mb-2 leading-relaxed">
            You received this but nothing was rung up against it. Either the sale was
            missed, or someone let a customer pay you directly.
          </p>
          <div className="divide-y divide-border/70">
            {unmatchedIn.slice(0, 20).map((entry) => (
              <div key={entry.id} className="flex items-baseline gap-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{entry.counterparty || 'Unknown sender'}</p>
                  <p className="text-xs text-muted-foreground num">
                    {entry.code}
                    {entry.paidAt && ` · ${format(new Date(entry.paidAt), 'd MMM HH:mm')}`}
                  </p>
                </div>
                <span className="amount text-sm shrink-0">{money(entry.amount)}</span>
                <button
                  type="button"
                  onClick={() => onForget(entry.id)}
                  className="text-xs text-muted-foreground active:text-destructive shrink-0"
                  title="Not shop money"
                >
                  Not a sale
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {missingPayment.length > 0 && (
        <div className="sheet">
          <span className="sheet-heading text-destructive">Recorded, but no money came</span>
          <p className="text-xs text-muted-foreground mt-1 mb-2 leading-relaxed">
            These sales say M-Pesa and give a code, but that code is not in anything you
            have pasted. Either the code was typed wrong, or the payment never arrived.
          </p>
          <div className="divide-y divide-border/70">
            {missingPayment.slice(0, 20).map((payment) => {
              const receipt = describeReceipt(payment.receiptId);
              return (
                <div key={payment.id} className="flex items-baseline gap-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{receipt.label}</p>
                    <p className="text-xs text-muted-foreground num">
                      {payment.reference}
                      {receipt.at && ` · ${format(new Date(receipt.at), 'd MMM HH:mm')}`}
                    </p>
                  </div>
                  <span className="amount text-sm shrink-0">{money(payment.amount)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {noCode.length > 0 && (
        <div className="sheet">
          <span className="sheet-heading">Cannot be checked</span>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            {noCode.length} {noCode.length === 1 ? 'payment was' : 'payments were'} marked M-Pesa
            with no transaction code, worth{' '}
            {money(noCode.reduce((sum, p) => sum + p.amount, 0))}. There is
            nothing to match them against. Typing the code at the till is what makes this
            screen worth opening.
          </p>
        </div>
      )}

      {entries.length === 0 && !result && (
        <div className="sheet">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Nothing checked yet. Paste a few messages above and DukaKonnect will tell you which
            ones match a sale you recorded, and more usefully, which do not.
          </p>
        </div>
      )}
    </div>
  );
}
