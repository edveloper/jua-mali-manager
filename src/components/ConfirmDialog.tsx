import { useState, ReactNode } from 'react';
import { Modal } from '@/components/Modal';
import { Button } from '@/components/ui/button';

interface ConfirmDialogProps {
  title: string;
  /** What is about to happen, in the plainest words available. */
  message: ReactNode;
  /** The figures being committed, shown back so a typo is visible. */
  details?: { label: string; value: string }[];
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red button and warning tone, for anything that removes a record. */
  destructive?: boolean;
  onConfirm: () => void | Promise<unknown>;
  onCancel: () => void;
}

/**
 * One confirmation step, used only where it earns its place.
 *
 * Confirmations are not free. A till app is used dozens of times a day with a
 * customer waiting, and a prompt on every action buys nothing except the habit
 * of tapping through prompts without reading them, which is worse than having
 * none at all.
 *
 * So the rule in this app is: confirm what is hard to undo, and make everything
 * else easy to undo. Selling has no prompt because a sale can be cancelled from
 * the day list in one tap, which also catches the mistakes noticed an hour
 * later. Restocking, deleting and anything touching staff get this, because they
 * either cannot be reversed or reach past the person doing them.
 *
 * Where numbers are involved they are repeated back. "Are you sure?" tests
 * nothing; "50 crates at 260, that is 13,000" is a question somebody can answer.
 */
export function ConfirmDialog({
  title,
  message,
  details,
  confirmLabel = 'Yes, do it',
  cancelLabel = 'Go back',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={title}
      onClose={onCancel}
      footer={
        <>
          <Button variant="outline" className="flex-1" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            className="flex-1"
            variant={destructive ? 'destructive' : 'default'}
            onClick={handleConfirm}
            disabled={busy}
          >
            {busy ? 'Working...' : confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm leading-relaxed">{message}</div>

      {details && details.length > 0 && (
        <div className="sheet">
          {details.map((d) => (
            <div key={d.label} className="ledger-line">
              <span className="text-muted-foreground">{d.label}</span>
              <span className="num font-medium text-right">{d.value}</span>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
