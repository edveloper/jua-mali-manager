import { format } from 'date-fns';
import { InvoiceDocument as Doc, STATUS_LABEL } from '@/types/invoice';

const money = (n: number) => n.toLocaleString('en-KE', { maximumFractionDigits: 0 });

const asDate = (value?: string | null) => (value ? new Date(`${value}T12:00:00`) : null);

interface InvoiceDocumentProps {
  doc: Doc;
  /** Renders on paper rather than in the app's own colours. */
  print?: boolean;
}

/**
 * The invoice, as the customer receives it.
 *
 * Shared by the owner's preview and the public link, so what is checked before
 * sending is byte for byte what arrives. Two copies of this layout would drift.
 *
 * Colour appears exactly once, as a hairline at the top edge. Colour spread
 * across an invoice reads as a template rather than as a business, and this
 * document is often the first thing a distributor's accounts office sees of a
 * shop it has only met over the phone.
 */
export function InvoiceDocument({ doc }: InvoiceDocumentProps) {
  const { issuer, billTo, lines } = doc;
  const outstanding = Math.max(0, doc.total - doc.amountPaid);
  const settled = doc.status === 'paid';
  const stamp = doc.status === 'paid' || doc.status === 'overdue' || doc.status === 'cancelled';

  // VAT is only ever shown when the shop is registered and has typed its number
  // in. Kenyan shelf prices include it, so this is the portion already inside
  // the total rather than something added to it.
  const showVat = Boolean(issuer.vat_registered && issuer.vat_number) && doc.vatAmount > 0;

  return (
    <div className="invoice-doc print-document">
      <div className="invoice-rule" />

      <div className="invoice-top">
        <div className="invoice-issuer">
          {issuer.logo_url && (
            <img src={issuer.logo_url} alt="" className="invoice-logo" />
          )}
          <div>
            <p className="invoice-issuer-name">
              {issuer.name}
              {issuer.branch_label ? ` · ${issuer.branch_label}` : ''}
            </p>
            <p className="invoice-quiet">
              {issuer.address && <>{issuer.address}<br /></>}
              {[issuer.phone, issuer.email].filter(Boolean).join(' · ')}
              {issuer.kra_pin && <><br />KRA PIN {issuer.kra_pin}</>}
              {showVat && <><br />VAT {issuer.vat_number}</>}
            </p>
          </div>
        </div>

        <div className="invoice-meta">
          <p className="invoice-word">Invoice</p>
          <p className="invoice-number">{doc.number}</p>
          <dl>
            <dt>Issued</dt>
            <dd>{format(asDate(doc.issuedOn) ?? new Date(), 'd MMM yyyy')}</dd>
            <dt>Due</dt>
            <dd>{format(asDate(doc.dueOn) ?? new Date(), 'd MMM yyyy')}</dd>
          </dl>
        </div>
      </div>

      <div className="invoice-billto">
        <p className="invoice-label">Bill to</p>
        <p className="invoice-who">{billTo.name}</p>
        <p className="invoice-quiet">
          {billTo.address && <>{billTo.address}<br /></>}
          {billTo.phone}
          {billTo.kra_pin && <><br />KRA PIN {billTo.kra_pin}</>}
        </p>
      </div>

      <div className="invoice-items-scroll">
        <table className="invoice-items">
          <thead>
            <tr>
              <th scope="col">Item</th>
              <th scope="col">Qty</th>
              <th scope="col">Unit price</th>
              <th scope="col">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, i) => (
              <tr key={`${line.description}-${i}`}>
                <td>{line.description}</td>
                <td className="invoice-qty num">{line.quantity}</td>
                <td className="num">{money(line.unit_price)}</td>
                <td className="num">{money(line.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="invoice-totals">
        <div className="invoice-row">
          <span>Subtotal</span>
          <span className="num">{money(doc.subtotal)}</span>
        </div>
        {showVat && (
          <div className="invoice-row">
            <span>VAT included at 16%</span>
            <span className="num">{money(doc.vatAmount)}</span>
          </div>
        )}
        {doc.amountPaid > 0 && (
          <div className="invoice-row">
            <span>Paid to date</span>
            <span className="num">({money(doc.amountPaid)})</span>
          </div>
        )}

        <div className={`invoice-due${settled ? ' settled' : ''}`}>
          <div>
            <span className="invoice-label">Amount due</span>
            <p className="invoice-quiet invoice-when">
              by {format(asDate(doc.dueOn) ?? new Date(), 'd MMMM yyyy')}
            </p>
          </div>
          <p className="invoice-amount num">KSh {money(outstanding)}</p>
        </div>
      </div>

      {(issuer.mpesa_paybill || issuer.cheque_payee || issuer.bank_name) && (
        <div className="invoice-pay">
          {issuer.mpesa_paybill && (
            <div>
              <span className="invoice-label">M-Pesa</span>
              <p>
                Paybill {issuer.mpesa_paybill}
                {issuer.mpesa_account && <><br /><span className="invoice-quiet">Account {issuer.mpesa_account}</span></>}
              </p>
            </div>
          )}
          {issuer.cheque_payee && (
            <div>
              <span className="invoice-label">Cheque payable to</span>
              <p>{issuer.cheque_payee}</p>
            </div>
          )}
          {issuer.bank_name && (
            <div>
              <span className="invoice-label">Bank</span>
              <p>
                {[issuer.bank_name, issuer.bank_branch].filter(Boolean).join(', ')}
                {issuer.bank_account && <><br /><span className="invoice-quiet">{issuer.bank_account}</span></>}
              </p>
            </div>
          )}
        </div>
      )}

      <p className="invoice-foot">
        {doc.deliveredOn && <>Goods delivered {format(asDate(doc.deliveredOn)!, 'd MMMM yyyy')}. </>}
        Please quote {doc.number} with your payment.
        {doc.notes && <><br />{doc.notes}</>}
        <br />
        This is a commercial invoice. It is not a tax invoice issued through eTIMS.
      </p>

      {stamp && (
        <span className={`invoice-stamp ${doc.status}`}>
          {STATUS_LABEL[doc.status].toUpperCase()}
        </span>
      )}
    </div>
  );
}
