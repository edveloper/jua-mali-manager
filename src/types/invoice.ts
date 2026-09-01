/**
 * Everything printed on an invoice is snapshot onto it when it is raised.
 *
 * A document already in somebody's hands must not change when the shop renames
 * itself or a customer is edited. So these shapes describe frozen copies, not
 * live references, and nothing here is looked up again at render time.
 */

export interface InvoiceIssuer {
  name: string;
  branch_label?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  kra_pin?: string | null;
  logo_url?: string | null;
  vat_registered?: boolean | null;
  vat_number?: string | null;
  mpesa_paybill?: string | null;
  mpesa_account?: string | null;
  cheque_payee?: string | null;
  bank_name?: string | null;
  bank_branch?: string | null;
  bank_account?: string | null;
}

export interface InvoiceBillTo {
  name: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  kra_pin?: string | null;
}

export interface InvoiceLine {
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
}

/** Read off the credit balance and today's date, never stored. */
export type InvoiceStatus = 'sent' | 'part_paid' | 'paid' | 'overdue' | 'cancelled';

/** The shape the document renders from, inside the app and at the public link. */
export interface InvoiceDocument {
  number: string;
  issuedOn: string;
  dueOn: string;
  deliveredOn?: string | null;
  notes?: string | null;
  issuer: InvoiceIssuer;
  billTo: InvoiceBillTo;
  lines: InvoiceLine[];
  subtotal: number;
  vatAmount: number;
  total: number;
  amountPaid: number;
  status: InvoiceStatus;
}

/** A row in the owner's own list, which also knows things a customer never sees. */
export interface Invoice extends InvoiceDocument {
  id: string;
  receiptId: string;
  creditSaleId?: string | null;
  customerId?: string | null;
  token: string;
  termsDays: number;
  voidedAt?: string | null;
}

export const STATUS_LABEL: Record<InvoiceStatus, string> = {
  sent: 'Sent',
  part_paid: 'Part paid',
  paid: 'Paid',
  overdue: 'Overdue',
  cancelled: 'Cancelled',
};
