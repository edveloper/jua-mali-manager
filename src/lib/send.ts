/**
 * Handing a document to somebody, without relying on a share sheet.
 *
 * `navigator.share` sounded right and is not: it does not exist on desktop
 * browsers, and where it does exist the operating system decides what appears in
 * it. The first real test of it produced "a link has been copied", which is not
 * sending anything to anyone.
 *
 * So the app names the two ways this actually travels. WhatsApp opens a chat
 * with the customer, message already typed. Email opens whatever mail app they
 * use, subject and body filled in. Both are plain links, so both work on a
 * phone and on a laptop with no permissions to ask for.
 */

/**
 * Kenyan numbers, as wa.me wants them: country code, digits only, no plus.
 *
 * 0712 345 678, +254 712 345 678 and 712345678 are all the same number and all
 * three get typed. Anything that does not resolve returns null, and the caller
 * offers a chat with no recipient rather than opening a broken one.
 */
export const toWhatsAppNumber = (phone?: string | null): string | null => {
  if (!phone) return null;

  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('254')) {
    // already international
  } else if (digits.startsWith('0')) {
    digits = `254${digits.slice(1)}`;
  } else if (digits.length === 9) {
    digits = `254${digits}`;
  } else {
    return null;
  }

  // 254 plus nine digits. Anything else is a typo, not a phone number.
  return /^254\d{9}$/.test(digits) ? digits : null;
};

/**
 * Opens WhatsApp on the customer's chat with the message ready to send.
 *
 * wa.me hands off to the installed app on a phone and to WhatsApp Web on a
 * laptop. Without a usable number it still opens, with the message ready and the
 * recipient left to choose, which beats refusing to do anything.
 */
export const openWhatsApp = (message: string, phone?: string | null) => {
  const number = toWhatsAppNumber(phone);
  const url = number
    ? `https://wa.me/${number}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
};

/**
 * Opens the mail app with everything filled in except, usually, the recipient.
 *
 * `mailto:` rather than a Gmail compose URL on purpose: it respects whatever the
 * person actually uses instead of assuming Google. The address is prefilled only
 * when we hold one, since a business customer's email is often not recorded.
 */
export const openEmail = (subject: string, body: string, to?: string | null) => {
  const params = new URLSearchParams({ subject, body });
  window.location.href = `mailto:${to ?? ''}?${params.toString().replace(/\+/g, '%20')}`;
};

/** Last resort, and still worth having when neither app is available. */
export const copyText = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};
