import { Mail, Link2, MessageCircle, Check } from 'lucide-react';
import { useState } from 'react';
import { Modal } from '@/components/Modal';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { openWhatsApp, openEmail, copyText, toWhatsAppNumber } from '@/lib/send';

export interface SendableInvoice {
  number: string;
  amountDue: string;
  dueOn: string;
  url: string;
  shopName: string;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
}

interface SendInvoiceDialogProps {
  invoice: SendableInvoice;
  onClose: () => void;
}

/**
 * Two named ways out, rather than one share sheet and a shrug.
 *
 * The system share sheet is not available on desktop at all, and where it is,
 * what appears in it is the operating system's decision. Naming WhatsApp and
 * email means the shopkeeper knows what will happen before they tap, which is
 * the whole point of the step.
 */
export function SendInvoiceDialog({ invoice, onClose }: SendInvoiceDialogProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const greeting = invoice.customerName ? `Hello ${invoice.customerName},\n\n` : '';
  const body =
    `${greeting}Please find invoice ${invoice.number} from ${invoice.shopName} ` +
    `for ${invoice.amountDue}, due ${invoice.dueOn}.\n\n${invoice.url}\n\n` +
    `Thank you,\n${invoice.shopName}`;

  const subject = `Invoice ${invoice.number} from ${invoice.shopName}`;
  const number = toWhatsAppNumber(invoice.customerPhone);

  const Option = ({
    icon: Icon, title, detail, onClick, tone = 'default',
  }: {
    icon: typeof Mail;
    title: string;
    detail: string;
    onClick: () => void;
    tone?: 'default' | 'quiet';
  }) => (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 rounded-lg border border-border p-3 text-left active:bg-muted transition-colors"
    >
      <div
        className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${
          tone === 'quiet' ? 'bg-muted' : 'bg-primary/10'
        }`}
      >
        <Icon className={`h-5 w-5 ${tone === 'quiet' ? 'text-muted-foreground' : 'text-primary'}`} />
      </div>
      <div className="min-w-0">
        <p className="font-medium text-sm">{title}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
    </button>
  );

  return (
    <Modal
      title={`Send ${invoice.number}`}
      onClose={onClose}
      footer={<Button variant="outline" className="flex-1" onClick={onClose}>Done</Button>}
    >
      <div className="sheet">
        <div className="ledger-line">
          <span className="text-muted-foreground">Amount due</span>
          <span className="amount">{invoice.amountDue}</span>
        </div>
        <div className="ledger-line">
          <span className="text-muted-foreground">Due</span>
          <span className="num">{invoice.dueOn}</span>
        </div>
      </div>

      <div className="space-y-2">
        <Option
          icon={MessageCircle}
          title="WhatsApp"
          detail={
            number
              ? `Opens a chat with ${invoice.customerName ?? 'them'}, message ready`
              : 'Opens WhatsApp, pick who to send it to'
          }
          onClick={() => { openWhatsApp(body, invoice.customerPhone); onClose(); }}
        />

        <Option
          icon={Mail}
          title="Email"
          detail={
            invoice.customerEmail
              ? `To ${invoice.customerEmail}, subject and message filled in`
              : 'Opens your mail app, subject and message filled in'
          }
          onClick={() => { openEmail(subject, body, invoice.customerEmail); onClose(); }}
        />

        <Option
          icon={copied ? Check : Link2}
          tone="quiet"
          title={copied ? 'Link copied' : 'Copy the link'}
          detail="Paste it wherever you like"
          onClick={async () => {
            const ok = await copyText(invoice.url);
            setCopied(ok);
            toast(
              ok
                ? { title: 'Link copied' }
                : { title: 'Copy this link', description: invoice.url }
            );
          }}
        />
      </div>

      {!number && invoice.customerPhone && (
        <p className="text-xs text-muted-foreground leading-relaxed">
          The number saved for this customer is not one WhatsApp recognises, so the chat
          will open without a recipient. Fix it on the customer to send straight to them.
        </p>
      )}
    </Modal>
  );
}
