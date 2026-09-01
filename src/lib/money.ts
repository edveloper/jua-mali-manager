/**
 * One way to write an amount.
 *
 * There were seventeen copies of this function, pasted file by file, and two of
 * them had drifted: the sell and restock dialogs showed cents while every list,
 * report and document rounded them away. So a price typed as 15.50 was saved as
 * 15.50, shown as 15.50 while it was being entered, and displayed as 16
 * everywhere afterwards.
 *
 * The damage was never the rounding itself. It was that totals stopped adding
 * up: three lines of 15.50 each rendered as "16", visibly 48, underneath a total
 * reading 47. In an app whose whole job is arithmetic somebody can trust, a
 * column that does not sum is worse than a missing feature.
 *
 * Cents are real here even when nobody types them, because the weighted-average
 * cost price is a division. Restocking 40 units at 1,300 onto 12 already held at
 * 1,250 produces a cost with decimals, and every profit figure inherits them.
 *
 * So: shillings when the amount is whole, cents when it is not. A shop dealing
 * in round numbers never sees a trailing ".00", and a shop dealing in halves
 * never sees a figure that has quietly moved.
 */

/** Money is decimal and JavaScript is not, so nothing is formatted unrounded. */
const round2 = (value: number) => Math.round((Number(value) || 0) * 100) / 100;

export const money = (value: number): string => {
  const amount = round2(value);

  // A tolerance rather than `% 1 !== 0`: 46.5 survives the round above intact,
  // but a value arriving as 46.499999999999996 must not be called fractional
  // and then printed as 46.50 next to a total that says 46.
  const hasCents = Math.abs(amount % 1) > 0.001;

  return amount.toLocaleString('en-KE', {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  });
};

/** With the unit, for the few places that show an amount on its own. */
export const ksh = (value: number): string => `KSh ${money(value)}`;

/**
 * Always two decimals, unseparated, for spreadsheets.
 *
 * Excel parses a number column by looking at the characters. Thousands
 * separators turn a figure into text, and a varying number of decimals makes a
 * column that cannot be summed. Screens and files want opposite things here.
 */
export const moneyForCsv = (value: number): string => round2(value).toFixed(2);
