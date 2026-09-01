import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Copy, FileText, Printer, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/Modal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { InvoiceDocument } from '@/components/InvoiceDocument';
import { useInvoices } from '@/hooks/useInvoices';
import { useToast } from '@/hooks/use-toast';
import { Invoice, STATUS_LABEL } from '@/types/invoice';
import { Sale, CreditSale } from '@/types/inventory';
import { todayKey } from '@/lib/dates';
import { money } from '@/lib/money';

interface InvoicesPanelProps {
  sales: Sale[];
  creditSales: CreditSale[];
  customerName: (id: string) => string;
  /** Sends the owner to fill in what the document is missing. */
  onGoToBusinessDetails: () => void;
  hasPaymentDetails: boolean;
}


const TERMS = [0, 7, 14, 30];

const STATUS_TONE: Record<string, string> = {
  sent: 'text-muted-foreground',
  part_paid: 'text-warning',
  overdue: 'text-destructive',
  paid: 'text-success',
  cancelled: 'text-muted-foreground line-through',
};

/**
 * Invoices, raised from sales that already happened.
 *
 * Only deni sales are offered. An invoice here documents goods that have gone
 * out and money that has not come in, so a sale settled at the till has nothing
 * to invoice for and is deliberately absent from the list.
 */
export function InvoicesPanel({
  sales, creditSales, customerName, onGoToBusinessDetails, hasPaymentDetails,
}: InvoicesPanelProps) {
  const { invoices, raiseInvoice, voidInvoice, linkFor, shareInvoice, invoiceForReceipt } = useInvoices();
  const { toast } = useToast();

  const [raising, setRaising] = useState<CreditSale | null>(null);
  const [terms, setTerms] = useState(30);
  const [deliveredOn, setDeliveredOn] = useState(todayKey());
  const [notes, setNotes] = useState('');
  const [viewing, setViewing] = useState<Invoice | null>(null);
  const [cancelling, setCancelling] = useState<Invoice | null>(null);

  // Unpaid deni with no live invoice against it. Those are the only sales a
  // document can honestly be raised for.
  const invoiceable = useMemo(() => {
    const receiptOf = (c: CreditSale) => c.receiptId || c.saleId;
    return creditSales
      .filter((c) => c.status !== 'paid')
      .filter((c) => {
        const receipt = receiptOf(c);
        return receipt && !invoiceForReceipt(receipt);
      })
      .slice(0, 25);
  }, [creditSales, invoices]);

  const receiptFor = (credit: CreditSale) => credit.receiptId || credit.saleId;

  const itemsFor = (credit: CreditSale) => {
    const receipt = receiptFor(credit);
    const lines = sales.filter((s) => s.receiptId === receipt && !s.voidedAt);
    if (lines.length === 0) return credit.productName;
    return lines.length > 1
      ? `${lines[0].productName} and ${lines.length - 1} more`
      : lines[0].productName;
  };

  const copyLink = async (invoice: Invoice) => {
    const url = linkFor(invoice);
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: 'Link copied', description: 'Paste it into WhatsApp or an email.' });
    } catch {
      toast({ title: 'Copy it by hand', description: url });
    }
  };

  return (
    <div className="space-y-3">
      {!hasPaymentDetails && (
        <button
          type="button"
          onClick={onGoToBusinessDetails}
          className="sheet w-full text-left border-warning/40 bg-warning/5"
        >
          <p className="text-sm font-medium">Add how customers should pay you</p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Without a paybill, cheque name or bank account, the invoice tells them what
            they owe but not how to settle it. Tap to fill it in.
          </p>
        </button>
      )}

      {invoiceable.length > 0 && (
        <div className="sheet space-y-2">
          <div>
            <p className="sheet-heading">Ready to invoice</p>
            <p className="text-xs text-muted-foreground mt-1">
              Sales on deni with no invoice yet.
            </p>
          </div>
          <div className="divide-y divide-border/70">
            {invoiceable.map((credit) => (
              <div key={credit.id} className="flex items-center gap-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{customerName(credit.customerId)}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {itemsFor(credit)} · {format(new Date(credit.createdAt), 'd MMM')}
                  </p>
                </div>
                <span className="amount text-sm shrink-0">{money(credit.balance)}</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setRaising(credit);
                    setTerms(30);
                    setDeliveredOn(todayKey());
                    setNotes('');
                  }}
                >
                  Invoice
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="sheet">
        <p className="sheet-heading">Invoices</p>
        {invoices.length === 0 ? (
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            Nothing raised yet. When a customer takes goods and wants to be billed, put the
            sale on deni first, then invoice it from the list above.
          </p>
        ) : (
          <div className="mt-1 divide-y divide-border/70">
            {invoices.map((invoice) => (
              <div key={invoice.id} className="flex items-center gap-3 py-2.5">
                <button
                  type="button"
                  onClick={() => setViewing(invoice)}
                  className="flex-1 min-w-0 text-left"
                >
                  <p className="text-sm font-medium truncate">
                    {invoice.number} · {invoice.billTo?.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <span className={STATUS_TONE[invoice.status]}>
                      {STATUS_LABEL[invoice.status]}
                    </span>
                    {' · due '}{format(new Date(`${invoice.dueOn}T12:00:00`), 'd MMM')}
                  </p>
                </button>
                <span className="amount text-sm shrink-0">
                  {money(Math.max(0, invoice.total - invoice.amountPaid))}
                </span>
                {!invoice.voidedAt && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    onClick={() => shareInvoice(invoice)}
                  >
                    <Send className="h-3.5 w-3.5 mr-1.5" /> Send
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Raise */}
      {raising && (
        <Modal
          title="Raise an invoice"
          onClose={() => setRaising(null)}
          footer={
            <>
              <Button variant="outline" className="flex-1" onClick={() => setRaising(null)}>
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={async () => {
                  const receipt = receiptFor(raising);
                  if (!receipt) return;
                  const result = await raiseInvoice(receipt, {
                    termsDays: terms,
                    deliveredOn,
                    notes: notes.trim() || undefined,
                  });
                  if (result) setRaising(null);
                }}
              >
                <FileText className="h-4 w-4 mr-2" /> Raise it
              </Button>
            </>
          }
        >
          <div className="bg-muted rounded-lg p-4">
            <p className="font-semibold">{customerName(raising.customerId)}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {itemsFor(raising)} · KSh {money(raising.balance)} outstanding
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>When is it due?</Label>
            <div className="grid grid-cols-4 gap-1.5">
              {TERMS.map((d) => (
                <Button
                  key={d}
                  variant={terms === d ? 'default' : 'outline'}
                  size="sm"
                  className="px-1 text-xs"
                  onClick={() => setTerms(d)}
                >
                  {d === 0 ? 'On delivery' : `${d} days`}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="inv-delivered">When did the goods go out?</Label>
            <Input
              id="inv-delivered"
              type="date"
              value={deliveredOn}
              onChange={(e) => setDeliveredOn(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="inv-notes">Anything to add?</Label>
            <Input
              id="inv-notes"
              placeholder="e.g. Your order 4417. Optional."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            The number is allocated when you raise it and cannot be changed afterwards.
            Your shop details are copied onto the document as they are now.
          </p>
        </Modal>
      )}

      {/* Preview. The same component the customer sees, so nothing is a surprise. */}
      {viewing && (
        <div className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm flex items-end sm:items-center justify-center">
          <div className="bg-card w-full max-w-lg rounded-t-2xl sm:rounded-lg animate-slide-up flex flex-col max-h-[90dvh]">
            <div className="p-4 border-b border-border flex items-center justify-between shrink-0 no-print">
              <p className="font-semibold">{viewing.number}</p>
              <Button variant="ghost" size="icon-sm" onClick={() => setViewing(null)}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="overflow-y-auto overscroll-contain flex-1">
              <InvoiceDocument doc={viewing} />
            </div>

            <div className="p-4 border-t border-border shrink-0 flex gap-2 no-print">
              <Button variant="outline" className="flex-1" onClick={() => copyLink(viewing)}>
                <Copy className="h-4 w-4 mr-2" /> Copy link
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => window.print()}>
                <Printer className="h-4 w-4 mr-2" /> Print
              </Button>
              {!viewing.voidedAt && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Cancel this invoice"
                  onClick={() => { setCancelling(viewing); setViewing(null); }}
                >
                  <X className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {cancelling && (
        <ConfirmDialog
          title="Cancel this invoice?"
          message="The link stops working straight away. The sale and the deni stay exactly as they are, this only cancels the document."
          details={[
            { label: 'Invoice', value: cancelling.number },
            { label: 'Customer', value: cancelling.billTo?.name ?? '' },
            { label: 'Amount', value: `KSh ${money(cancelling.total)}` },
          ]}
          destructive
          confirmLabel="Cancel it"
          cancelLabel="Keep it"
          onConfirm={async () => {
            await voidInvoice(cancelling.id);
            setCancelling(null);
          }}
          onCancel={() => setCancelling(null)}
        />
      )}
    </div>
  );
}
