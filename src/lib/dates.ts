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
