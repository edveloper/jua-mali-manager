export type PaymentMethod = 'cash' | 'mpesa' | 'airtel' | 'other';

/**
 * Cheque is a payment method the books know about, but never an option at the
 * till. A cheque handed over is a promise, not money, so it is settled through
 * the deni flow where it can be held until it clears. It appears here only so
 * that a cleared cheque reads as "Cheque" wherever payments are listed.
 */
export type RecordedMethod = PaymentMethod | 'cheque';

export const PAYMENT_METHODS: { value: PaymentMethod; label: string; short: string }[] = [
  { value: 'cash', label: 'Cash', short: 'Cash' },
  { value: 'mpesa', label: 'M-Pesa', short: 'M-Pesa' },
  { value: 'airtel', label: 'Airtel Money', short: 'Airtel' },
  { value: 'other', label: 'Other', short: 'Other' },
];

/** Cash is the only method with nothing to quote afterwards. */
export const takesReference = (method: PaymentMethod) => method !== 'cash';

export const methodLabel = (method?: string | null) => {
  if (method === 'cheque') return 'Cheque';
  return PAYMENT_METHODS.find((m) => m.value === method)?.short ?? 'Not recorded';
};

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
