/**
 * Matching what somebody typed against the shared catalogue.
 *
 * This runs on the phone, not in Postgres, for two reasons. It fires on every
 * keystroke, and a round trip per keystroke on a Kenyan mobile connection is a
 * suggestion list that arrives after you have finished typing. And it has to
 * keep working with no network at all, which is the whole point of the offline
 * work. `pg_trgm` is indexed on the table for the other job: matching names
 * already in the database, in bulk, where latency does not matter.
 *
 * The hard part is not spelling, it is that the same thing is said four ways.
 * "Milk 1L", "Maziwa", "maziwa lita moja" and "MILK 1 LITRE" are one product,
 * and none of them is a typo of any other. Aliases carry the vocabulary and
 * normalisation carries the arithmetic of units.
 */

export interface CanonicalProduct {
  id: string;
  name: string;
  /** What kind of thing it is, with no brand and no size. "Beer", "Sugar". */
  productType: string;
  /** Who made it, where that is how people ask for it. Null is ordinary. */
  brand: string | null;
  sizeValue: number | null;
  sizeUnit: string | null;
  /** How it is priced, which is a different question from how big it is. */
  soldBy: 'unit' | 'weight' | 'volume' | 'length' | 'area' | 'service';
  category: string;
  packSize: string | null;
  kind: 'goods' | 'service';
  businessTypes: string[];
  aliases: string[];
}

export interface CatalogMatch {
  entry: CanonicalProduct;
  score: number;
}

/**
 * Swahili numbers, because "lita moja" and "kilo mbili" are how sizes are
 * spoken, and a shopkeeper typing quickly types what they would say.
 */
const NUMBER_WORDS: Record<string, string> = {
  moja: '1',
  mbili: '2',
  tatu: '3',
  nne: '4',
  tano: '5',
  sita: '6',
  saba: '7',
  nane: '8',
  tisa: '9',
  kumi: '10',
  nusu: '0.5',
  half: '0.5',
  one: '1',
  two: '2',
  three: '3',
};

/** Every way a unit gets written, pointed at one spelling. */
const UNIT_WORDS: Record<string, string> = {
  litre: 'l',
  litres: 'l',
  liter: 'l',
  liters: 'l',
  lita: 'l',
  ltr: 'l',
  ltrs: 'l',
  l: 'l',
  kilo: 'kg',
  kilos: 'kg',
  kilogram: 'kg',
  kilograms: 'kg',
  kgs: 'kg',
  kg: 'kg',
  gram: 'g',
  grams: 'g',
  gm: 'g',
  g: 'g',
  millilitre: 'ml',
  millilitres: 'ml',
  ml: 'ml',
  piece: 'pc',
  pieces: 'pc',
  pcs: 'pc',
  pc: 'pc',
};

/**
 * Reduce a name to the form both sides can be compared in.
 *
 * Lower case, punctuation gone, size words turned into digits and units into one
 * spelling, and "1 l" glued back into "1l" so that a number and its unit read as
 * a single token rather than two weak ones.
 */
export const normalise = (input: string): string => {
  const cleaned = input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9.\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Split a run like "500ml" so the unit can be normalised, then glue it back.
  const spaced = cleaned.replace(/(\d)([a-z])/g, '$1 $2');

  const words = spaced.split(' ').map((word) => {
    if (NUMBER_WORDS[word]) return NUMBER_WORDS[word];
    if (UNIT_WORDS[word]) return UNIT_WORDS[word];
    return word;
  });

  return words
    .join(' ')
    // Swahili puts the number after the unit: "lita moja" is litre-one, not
    // one-litre. Flip it before gluing, or the two halves stay separate tokens
    // and the whole thing only matches by luck of having an exact alias.
    .replace(/\b(l|kg|g|ml|pc) (\d(?:\.\d+)?)\b/g, '$2$1')
    .replace(/(\d(?:\.\d+)?) (l|kg|g|ml|pc)\b/g, '$1$2')
    .replace(/\s+/g, ' ')
    .trim();
};

const tokens = (value: string): string[] => normalise(value).split(' ').filter(Boolean);

/**
 * How well one candidate string answers what was typed.
 *
 * Deliberately ordered from certain to merely plausible. An exact hit beats a
 * prefix, a prefix beats a substring, and only then do we fall back to counting
 * how many of the typed words appear at all, which is what rescues "maziwa 1
 * litre" against "Fresh Milk 1L" once the alias has done its half of the work.
 */
const scoreAgainst = (queryNorm: string, queryTokens: string[], candidate: string): number => {
  const candidateNorm = normalise(candidate);
  if (!candidateNorm) return 0;

  if (candidateNorm === queryNorm) return 1;
  if (candidateNorm.startsWith(queryNorm)) return 0.9;
  if (candidateNorm.includes(queryNorm)) return 0.78;

  const candidateTokens = candidateNorm.split(' ').filter(Boolean);
  if (candidateTokens.length === 0 || queryTokens.length === 0) return 0;

  let hits = 0;
  for (const token of queryTokens) {
    // A short token has to match a whole word. Letting "1" count as a hit
    // inside "100g" makes every size look like every other size.
    const matched = token.length <= 2
      ? candidateTokens.includes(token)
      : candidateTokens.some((c) =>
          // Typing a prefix of a word is ordinary: "brook" should find
          // Brookside.
          c.startsWith(token)
          // The reverse needs a floor. Without one, "panadol" matched the "Pan"
          // in "Frying Pan" at full strength, because one was a prefix of the
          // other and nothing said how much of it had to agree.
          || (token.startsWith(c) && c.length >= Math.max(4, token.length * 0.6)));
    if (matched) hits += 1;
  }

  if (hits === 0) return 0;
  return 0.7 * (hits / queryTokens.length);
};

export interface MatchOptions {
  /** The shop's trade, so its own vocabulary is offered before anyone else's. */
  businessType?: string | null;
  limit?: number;
  /** Below this, a suggestion is noise and is better not shown. */
  threshold?: number;
}

/**
 * The suggestions to show under the name field.
 *
 * A match is scored against the entry's own name and every alias, and the best
 * of those wins. Entries belonging to this shop's trade are then lifted above
 * the rest, which is what stops a hardware being offered sukuma wiki when both
 * happen to contain the same letters.
 */
export const matchCatalog = (
  query: string,
  catalog: CanonicalProduct[],
  options: MatchOptions = {}
): CatalogMatch[] => {
  const { businessType, limit = 6, threshold = 0.34 } = options;

  const queryNorm = normalise(query);
  // One letter matches most of the catalogue, which is not a suggestion.
  if (queryNorm.length < 2) return [];

  const queryTokens = tokens(query);
  const matches: CatalogMatch[] = [];

  for (const entry of catalog) {
    let best = scoreAgainst(queryNorm, queryTokens, entry.name);

    // The brand on its own, because "tusker" should find Tusker Lager 500ml
    // without anybody typing the size they did not think of.
    if (entry.brand && best < 1) {
      const branded = scoreAgainst(queryNorm, queryTokens, entry.brand);
      if (branded > best) best = branded;
    }

    for (const alias of entry.aliases) {
      if (best === 1) break;
      const score = scoreAgainst(queryNorm, queryTokens, alias);
      if (score > best) best = score;
    }

    if (best < threshold) continue;

    // A nudge, not an override: a strong match from another trade still beats a
    // weak one from your own.
    const ownTrade = businessType && entry.businessTypes.includes(businessType);
    matches.push({ entry, score: ownTrade ? best + 0.12 : best });
  }

  return matches
    .sort((a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name))
    .slice(0, limit);
};

/** The single best guess, or nothing. Used for bulk matching, not suggestions. */
export const bestMatch = (
  query: string,
  catalog: CanonicalProduct[],
  options: MatchOptions = {}
): CatalogMatch | null => {
  const [top] = matchCatalog(query, catalog, { ...options, limit: 1, threshold: options.threshold ?? 0.72 });
  return top ?? null;
};
