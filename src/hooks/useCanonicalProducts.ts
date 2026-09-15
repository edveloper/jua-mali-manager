import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CanonicalProduct } from '@/lib/catalog';

/**
 * The shared catalogue, fetched once and kept.
 *
 * It is reference data: the same few hundred rows for every shop, changing only
 * when we ship a migration. So it is fetched once per session rather than per
 * screen, and cached in module scope so opening the product form four times
 * does not mean four round trips.
 *
 * It is deliberately not blocking. If this never arrives, the form still works
 * exactly as it did before and you simply type the name yourself, which is
 * worth more than a spinner in front of somebody trying to add a product.
 */
/*
 * Described here rather than taken from the generated Supabase types, which are
 * produced from the live schema and so will not know this table until the
 * migration has been applied. Regenerating them afterwards is tidy but not
 * required: this shape is the contract either way.
 */
interface CanonicalRow {
  id: string;
  name: string;
  product_type: string | null;
  brand: string | null;
  size_value: number | string | null;
  size_unit: string | null;
  sold_by: string | null;
  category: string;
  pack_size: string | null;
  kind: string | null;
  business_types: string[] | null;
  aliases: string[] | null;
}

const SOLD_BY = ['unit', 'weight', 'volume', 'length', 'area', 'service'] as const;

let cache: CanonicalProduct[] | null = null;
let inFlight: Promise<CanonicalProduct[]> | null = null;

const load = async (): Promise<CanonicalProduct[]> => {
  if (cache) return cache;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const { data, error } = await supabase
      .from('canonical_products' as never)
      .select('id, name, product_type, brand, size_value, size_unit, sold_by, category, pack_size, kind, business_types, aliases')
      .order('name')
      .returns<CanonicalRow[]>();

    if (error || !data) {
      // Not a toast. Suggestions are a convenience, and a shopkeeper adding
      // stock does not need to be told about a table they have never heard of.
      inFlight = null;
      return [];
    }

    cache = data.map((row) => ({
      id: row.id,
      name: row.name,
      productType: row.product_type ?? row.name,
      brand: row.brand,
      // numeric comes back as a string from PostgREST often enough that
      // trusting the type here would put "500" into arithmetic as text.
      sizeValue: row.size_value === null || row.size_value === undefined ? null : Number(row.size_value),
      sizeUnit: row.size_unit,
      soldBy: (SOLD_BY as readonly string[]).includes(row.sold_by ?? '')
        ? (row.sold_by as CanonicalProduct['soldBy'])
        : 'unit',
      category: row.category,
      packSize: row.pack_size,
      kind: (row.kind === 'service' ? 'service' : 'goods') as CanonicalProduct['kind'],
      businessTypes: row.business_types ?? [],
      aliases: row.aliases ?? [],
    }));

    return cache;
  })();

  return inFlight;
};

export function useCanonicalProducts() {
  const [catalog, setCatalog] = useState<CanonicalProduct[]>(cache ?? []);

  useEffect(() => {
    let alive = true;
    load().then((rows) => {
      if (alive) setCatalog(rows);
    });
    return () => {
      alive = false;
    };
  }, []);

  return catalog;
}
