export interface ParsedMpesaEntry {
  /** Index signature so the array can be passed straight through as JSONB. */
  [key: string]: string | number | null;
  code: string;
  amount: number;
  paid_at: string | null;
  counterparty: string | null;
  direction: 'in' | 'out';
  raw_text: string;
}

export interface ParseResult {
  entries: ParsedMpesaEntry[];
  skipped: number;
}

/**
 * M-Pesa confirmation messages are rigidly formatted, which is what makes this
 * possible without any Safaricom integration. A message looks like:
 *
 *   SFG7H2K9LM Confirmed. You have received Ksh330.00 from JANE WANJIKU
 *   0712345678 on 16/8/26 at 10:42 AM New M-PESA balance is Ksh1,234.00.
 *
 * Anything that cannot be read is counted and reported rather than guessed at --
 * a wrong amount here would be worse than a missing one.
 */

/** Codes are ten alphanumerics, and every message begins with one. */
const MESSAGE_START = /\b([A-Z0-9]{10})\s+Confirmed/gi;

const AMOUNT = /Ksh\s?([\d,]+(?:\.\d{1,2})?)/i;
const WHEN = /on\s+(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s+at\s+(\d{1,2}):(\d{2})\s*(AM|PM)?/i;
const RECEIVED_FROM = /received\s+Ksh[\d,.]+\s+from\s+([A-Za-z .'-]+?)(?:\s+\d{7,}|\s+on\s)/i;
const SENT_TO = /(?:sent to|paid to)\s+([A-Za-z0-9 .'&-]+?)(?:\s+\d{7,}|\s+on\s|\.)/i;

const toIso = (chunk: string): string | null => {
  const m = chunk.match(WHEN);
  if (!m) return null;

  const [, d, mo, y, hRaw, min, meridiem] = m;
  let hour = Number(hRaw);
  if (meridiem) {
    const upper = meridiem.toUpperCase();
    if (upper === 'PM' && hour < 12) hour += 12;
    if (upper === 'AM' && hour === 12) hour = 0;
  }

  // Two-digit years in these messages are always this century.
  const year = Number(y) < 100 ? 2000 + Number(y) : Number(y);
  const date = new Date(year, Number(mo) - 1, Number(d), hour, Number(min));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

export const parseMpesaText = (text: string): ParseResult => {
  const trimmed = text.trim();
  if (!trimmed) return { entries: [], skipped: 0 };

  // Split on where each message starts rather than on newlines: a single
  // message often wraps across several lines when pasted.
  const starts: { index: number; code: string }[] = [];
  let match: RegExpExecArray | null;
  MESSAGE_START.lastIndex = 0;
  while ((match = MESSAGE_START.exec(trimmed)) !== null) {
    starts.push({ index: match.index, code: match[1].toUpperCase() });
  }

  if (starts.length === 0) return { entries: [], skipped: trimmed.split('\n').filter(Boolean).length };

  const seen = new Set<string>();
  const entries: ParsedMpesaEntry[] = [];
  let skipped = 0;

  starts.forEach((start, i) => {
    const end = i + 1 < starts.length ? starts[i + 1].index : trimmed.length;
    const chunk = trimmed.slice(start.index, end).trim();

    const amountMatch = chunk.match(AMOUNT);
    if (!amountMatch) {
      skipped += 1;
      return;
    }

    const amount = Number(amountMatch[1].replace(/,/g, ''));
    if (!Number.isFinite(amount) || amount <= 0) {
      skipped += 1;
      return;
    }

    // Duplicates inside one paste are the same transaction twice, not two.
    if (seen.has(start.code)) return;
    seen.add(start.code);

    const isIncoming = /you have received|received Ksh/i.test(chunk);
    const party = isIncoming ? chunk.match(RECEIVED_FROM) : chunk.match(SENT_TO);

    entries.push({
      code: start.code,
      amount,
      paid_at: toIso(chunk),
      counterparty: party ? party[1].trim().replace(/\s+/g, ' ') : null,
      direction: isIncoming ? 'in' : 'out',
      raw_text: chunk.slice(0, 400),
    });
  });

  return { entries, skipped };
};
