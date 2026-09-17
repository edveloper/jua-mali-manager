import { openDb, PENDING_STORE } from '@/lib/localCache';

/**
 * Sales made with no signal, held until there is some.
 *
 * Reading offline was the easy half. This is the half that decides whether the
 * app survives a market with patchy coverage, because a shopkeeper who cannot
 * record a sale stops reaching for their phone and goes back to the exercise
 * book, and they do not come back.
 *
 * The rule agreed before any of this was written: if two phones are offline and
 * both sell the last crate, both sales go through and the stock goes negative.
 * The goods left the shop twice. A negative figure is an honest record that
 * surfaces at the next count as shrinkage. Refusing the second sale would mean
 * the app deleting something its owner watched happen, and nothing recovers
 * from that.
 */

export interface QueuedSale {
  /** Named on the phone before the first attempt, reused for every retry. */
  opId: string;
  shopId: string;
  lines: { product_id: string; quantity: number; unit_price: number | null }[];
  payments: { method: string; amount: number; reference: string | null }[];
  customerId: string | null;
  creditAmount: number;
  queuedAt: number;
  attempts: number;
}

/**
 * Is this worth retrying, or is it a refusal that will never change?
 *
 * "Not enough stock" or "you are not allowed to do that" will fail identically
 * forever, and queueing one would mean a sale sitting on the phone pretending
 * to be pending while it silently retries into the same wall. Only a transport
 * failure earns a place in the queue.
 *
 * PostgREST hands back a `code` for anything Postgres refused. A dropped
 * connection has no code and usually arrives as a TypeError from fetch.
 */
export const looksLikeNoSignal = (error: unknown): boolean => {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  if (error instanceof TypeError) return true;

  const candidate = error as { code?: string; message?: string } | null;
  if (candidate?.code) return false;

  const message = (candidate?.message ?? '').toLowerCase();
  return message.includes('fetch') || message.includes('network') || message.includes('timeout');
};

export const enqueueSale = async (sale: QueuedSale): Promise<void> => {
  const db = await openDb();
  if (!db) return;
  try {
    db.transaction(PENDING_STORE, 'readwrite').objectStore(PENDING_STORE).put(sale);
  } catch {
    // Nothing useful to do. The caller has already been told it did not send.
  }
};

export const pendingSales = async (shopId: string): Promise<QueuedSale[]> => {
  const db = await openDb();
  if (!db || !shopId) return [];

  return new Promise((resolve) => {
    try {
      const request = db.transaction(PENDING_STORE, 'readonly').objectStore(PENDING_STORE).getAll();
      request.onsuccess = () => {
        const all = (request.result ?? []) as QueuedSale[];
        // Oldest first, so a queue drains in the order things actually happened.
        resolve(all.filter((s) => s.shopId === shopId).sort((a, b) => a.queuedAt - b.queuedAt));
      };
      request.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
};

export const removeSale = async (opId: string): Promise<void> => {
  const db = await openDb();
  if (!db) return;
  try {
    db.transaction(PENDING_STORE, 'readwrite').objectStore(PENDING_STORE).delete(opId);
  } catch {
    // Leaving it queued is safe: the server refuses a second recording of the
    // same named sale, so a stuck row costs a wasted request and nothing more.
  }
};
