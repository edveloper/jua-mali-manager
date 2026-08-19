export type PaymentMethod = 'cash' | 'mpesa' | 'airtel' | 'other';

export const PAYMENT_METHODS: { value: PaymentMethod; label: string; short: string }[] = [
  { value: 'cash', label: 'Cash', short: 'Cash' },
  { value: 'mpesa', label: 'M-Pesa', short: 'M-Pesa' },
  { value: 'airtel', label: 'Airtel Money', short: 'Airtel' },
  { value: 'other', label: 'Other', short: 'Other' },
];

/** Cash is the only method with nothing to quote afterwards. */
export const takesReference = (method: PaymentMethod) => method !== 'cash';

export const methodLabel = (method?: string | null) =>
  PAYMENT_METHODS.find((m) => m.value === method)?.short ?? 'Not recorded';

// Deliberately still the old brand name. This key is already sitting in the
// browser of everyone using the app, and renaming it would quietly forget which
// payment method each of them last used.
const STORAGE_KEY = 'tarihi:last-payment-method';

/**
 * A shop that runs mostly on M-Pesa should not re-tap it all day, so the last
 * method used is remembered. localStorage rather than component state because a
 * PWA on a cheap phone gets killed and reopened constantly.
 */
export const rememberMethod = (method: PaymentMethod) => {
  try {
    localStorage.setItem(STORAGE_KEY, method);
  } catch {
    // Private mode or a full quota. Not worth interrupting a sale over.
  }
};

export const lastUsedMethod = (): PaymentMethod => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (PAYMENT_METHODS.some((m) => m.value === stored)) return stored as PaymentMethod;
  } catch {
    // fall through
  }
  return 'cash';
};
