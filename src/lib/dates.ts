import { format } from 'date-fns';

/**
 * Today, as the person holding the phone would say it.
 *
 * `new Date().toISOString().split('T')[0]` looks like the obvious way to get a
 * yyyy-MM-dd and is wrong everywhere east of Greenwich. Kenya is UTC+3, so
 * between midnight and 3am the UTC date is still yesterday: a shop recording a
 * delivery at 1am would have it filed against the previous day, and an expense
 * added then would land in the wrong day's takings.
 *
 * date-fns `format` reads the device clock, so this gives the local calendar
 * day. Everything stored is a real instant in a Postgres timestamptz, so the
 * display side has always been correct; only these date-only keys were not.
 */
export const todayKey = (): string => format(new Date(), 'yyyy-MM-dd');

/** The same, for any date. */
export const dateKey = (value: Date): string => format(value, 'yyyy-MM-dd');

/**
 * A real instant for a date the user picked.
 *
 * A date field gives back "2026-09-03" and nothing more. Sending that to a
 * timestamptz column as "2026-09-03T12:00:00", with no offset, makes Postgres
 * read it as noon UTC, which is 15:00 in Nairobi. Every restock in the activity
 * log therefore claimed to have happened at 15:00, whatever time it really was.
 *
 * So: if the chosen day is today, use the actual moment, which is both true and
 * more useful. If it is backdated, use midday local, far enough from either
 * boundary that no timezone can push it onto the wrong day.
 */
export const instantForDate = (dateKey: string): string => {
  const now = new Date();
  if (dateKey === todayKey()) return now.toISOString();

  const [y, m, d] = dateKey.split('-').map(Number);
  if (!y || !m || !d) return now.toISOString();

  return new Date(y, m - 1, d, 12, 0, 0).toISOString();
};
