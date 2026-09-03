import { ShoppingCart, Receipt, HandCoins, LucideIcon } from 'lucide-react';
import { Modal } from '@/components/Modal';

interface QuickActionsProps {
  onClose: () => void;
  onRecordSale: () => void;
  onRecordSpending?: () => void;
  onRecordRepayment?: () => void;
}

interface Action {
  label: string;
  hint: string;
  icon: LucideIcon;
  onClick: () => void;
}

/**
 * What the button in the middle opens.
 *
 * The same three every time, in the same order, whatever screen you came from.
 * A sheet that changes with context reads as clever once and as unreliable
 * afterwards, and this is the control somebody presses two hundred times a day:
 * the thumb should learn where the first row is and stop reading.
 */
export function QuickActions({ onClose, onRecordSale, onRecordSpending, onRecordRepayment }: QuickActionsProps) {
  const actions: Action[] = [
    {
      label: 'Record a sale',
      hint: 'One item or a whole basket',
      icon: ShoppingCart,
      onClick: onRecordSale,
    },
    ...(onRecordSpending
      ? [{
          label: 'Record spending',
          hint: 'Rent, transport, stock, anything paid out',
          icon: Receipt,
          onClick: onRecordSpending,
        }]
      : []),
    ...(onRecordRepayment
      ? [{
          label: 'Record a repayment',
          hint: 'Somebody paying down their deni',
          icon: HandCoins,
          onClick: onRecordRepayment,
        }]
      : []),
  ];

  return (
    <Modal title="Record something" onClose={onClose}>
      <div className="sheet p-0 overflow-hidden divide-y divide-border/70">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.label}
              type="button"
              onClick={() => { onClose(); action.onClick(); }}
              className="w-full flex items-center gap-3 px-3 py-3.5 text-left active:bg-muted transition-colors"
            >
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium">{action.label}</p>
                <p className="text-xs text-muted-foreground truncate">{action.hint}</p>
              </div>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
