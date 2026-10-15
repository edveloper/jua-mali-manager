/**
 * One rule for taking down a customer's name and number.
 *
 * This exists because there were two forms and only one of them was fixed.
 * Staff kept typing "John 0712345678" into a name box; the sale dialog was
 * taught to cope and the Add Customer form on the Deni tab was not, so the
 * behaviour carried straight on through the other door. Two copies of a rule
 * are one copy and a bug waiting to be found.
 *
 * Any new place that asks for a customer uses these, or it will drift too.
 */

/** A run of nine or more digits is a phone number, not part of a name. */
const PHONE_RUN = /(\+?\d[\d\s-]{8,})/;

export interface SplitName {
  name: string;
  phone: string;
}

/**
 * Take the number out of the name box and put it where it belongs.
 *
 * Correcting somebody silently beats telling them off, and filling the second
 * box in front of them is what teaches them it exists. An existing phone is
 * never overwritten: what they typed deliberately outranks what we inferred.
 */
export const splitNameAndPhone = (typed: string, existingPhone: string): SplitName => {
  const run = typed.match(PHONE_RUN);

  if (run && run[0].replace(/\D/g, '').length >= 9) {
    return {
      name: typed.replace(run[0], '').replace(/\s+/g, ' ').trim(),
      phone: existingPhone.trim() ? existingPhone : run[0].replace(/[^\d+]/g, ''),
    };
  }

  return { name: typed, phone: existingPhone };
};

/** Anything left over after the split is a typo, not a number. */
export const nameHasDigits = (name: string): boolean => /\d/.test(name);

/**
 * Nine digits is the shortest a Kenyan number gets: 712345678, or 0712345678
 * with the leading zero, or +254712345678 with the country code.
 */
export const phoneLooksReal = (phone: string): boolean => phone.replace(/\D/g, '').length >= 9;

/**
 * Both halves, or neither.
 *
 * A debt you cannot follow up is a debt you have written off without noticing,
 * which is the whole reason the number is not optional.
 */
export const customerReady = (name: string, phone: string): boolean =>
  Boolean(name.trim()) && !nameHasDigits(name) && phoneLooksReal(phone);
