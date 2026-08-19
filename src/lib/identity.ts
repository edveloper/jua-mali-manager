// DukaKonnect lets people sign in with a phone number instead of an email.
// Supabase only understands emails, so phone numbers are mapped to a synthetic
// address. Login and employee creation MUST use the same mapping or the account
// that gets created is not the account the employee can log into, so this lives
// in one place and both call sites use it.

const PHONE_DOMAIN = 'duka.local';

/** Normalises a phone number or email into the address Supabase Auth stores. */
export const toAuthEmail = (input: string): string => {
  const value = input.trim();
  if (value.includes('@')) return value.toLowerCase();

  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('0')) digits = `254${digits.slice(1)}`;
  else if (digits.length === 9) digits = `254${digits}`;

  return `${digits}@${PHONE_DOMAIN}`;
};

/** True if the identifier can actually receive email -- phone logins cannot. */
export const canReceiveEmail = (identifier: string): boolean => {
  const value = identifier.trim();
  return value.includes('@') && !value.toLowerCase().endsWith(`@${PHONE_DOMAIN}`);
};

/** True if this address came from a phone number rather than a real email. */
export const isPhoneAccount = (email?: string | null): boolean =>
  Boolean(email && email.toLowerCase().endsWith(`@${PHONE_DOMAIN}`));

/** Turns a stored address back into something worth showing a human. */
export const toDisplayIdentity = (email?: string | null): string => {
  if (!email) return '';
  if (!isPhoneAccount(email)) return email;

  const digits = email.split('@')[0];
  // 254712345678 -> 0712 345 678
  if (digits.startsWith('254') && digits.length === 12) {
    const local = `0${digits.slice(3)}`;
    return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
  }
  return digits;
};

/**
 * What the person appears to be typing.
 *
 * The sign-in form asks one question rather than making somebody choose between
 * a phone tab and an email tab before they have typed anything. `toAuthEmail`
 * already accepts either, so this exists only to show the right icon and to
 * warn before submitting rather than after.
 *
 * 'unknown' is a real answer, not a failure: an empty box, or three characters
 * in, is not yet either one.
 */
export type IdentifierKind = 'phone' | 'email' | 'unknown';

export const identifierKind = (input: string): IdentifierKind => {
  const value = input.trim();
  if (value === '') return 'unknown';
  if (value.includes('@')) return 'email';

  // Kenyan numbers land at 9 digits local, 10 with the leading zero, 12 with the
  // country code. Anything shorter is somebody mid-way through typing.
  const digits = value.replace(/\D/g, '');
  const looksNumeric = /^[+\d][\d\s()-]*$/.test(value);
  if (looksNumeric && digits.length >= 9) return 'phone';

  return 'unknown';
};

/** How the typed number will actually be stored, shown back for confirmation. */
export const prettyPhone = (input: string): string =>
  toDisplayIdentity(toAuthEmail(input));
