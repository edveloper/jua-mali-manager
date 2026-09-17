/**
 * The last known good copy of a shop's records, kept on the phone.
 *
 * Nothing here is a source of truth. Supabase is, always. This is a photograph
 * of what the server last said, so that a shopkeeper standing in a dead spot can
 * still look up a price, check who owes what, and read this morning's takings
 * instead of a blank screen.
 *
 * IndexedDB rather than localStorage: a few hundred products with their prices
 * is past what a 5MB synchronous store should be asked to hold, and writing it
 * on every fetch would block the main thread at exactly the wrong moment.
 *
 * Written by hand rather than with a library because the whole surface is three
 * functions, and a dependency that has to be installed before the app can build
 * is a poor trade for sixty lines.
 *
 * Deliberately not here: anything that writes to the server. Queuing sales made
 * offline is a much larger problem, because two phones can sell the last crate
 * and something has to give. That needs conflict rules agreed first, and it gets
 * its own piece of work.
 */

const DB_NAME = 'dukakonnect';
const STORE = 'snapshots';
/** Sales made with no signal, waiting to be sent. Added in version 2. */
export const PENDING_STORE = 'pending';
const VERSION = 2;

export interface Snapshot<T> {
  rows: T[];
  savedAt: number;
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

const open = (): Promise<IDBDatabase | null> => {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    // Private windows, ancient browsers and storage-blocking settings all take
    // IndexedDB away. Every caller treats null as "no cache", never as an error,
    // because a shop that cannot cache must still be a shop that works.
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }

    try {
      const request = indexedDB.open(DB_NAME, VERSION);
      request.onupgradeneeded = () => {
        // Runs for a fresh database and for an upgrade alike, so each store is
        // checked rather than assumed absent.
        if (!request.result.objectStoreNames.contains(STORE)) {
          request.result.createObjectStore(STORE);
        }
        if (!request.result.objectStoreNames.contains(PENDING_STORE)) {
          request.result.createObjectStore(PENDING_STORE, { keyPath: 'opId' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });

  return dbPromise;
};

// Keyed by shop, so switching between three shops does not show one another's
// stock, and signing out of one leaves the others intact.
const keyFor = (shopId: string, name: string) => `${shopId}:${name}`;

/** Shared with the pending-sale queue, which lives in the same database. */
export const openDb = open;

export const cacheWrite = async <T>(shopId: string, name: string, rows: T[]): Promise<void> => {
  const db = await open();
  if (!db || !shopId) return;

  try {
    const tx = db.transaction(STORE, 'readwrite');
    // structuredClone is what IndexedDB does anyway; doing it here means a row
    // carrying something unclonable fails loudly in one place rather than
    // aborting the transaction from inside the browser.
    tx.objectStore(STORE).put({ rows, savedAt: Date.now() }, keyFor(shopId, name));
  } catch {
    // A failed write is a cache miss later, which every caller already handles.
  }
};

export const cacheRead = async <T>(shopId: string, name: string): Promise<Snapshot<T> | null> => {
  const db = await open();
  if (!db || !shopId) return null;

  return new Promise((resolve) => {
    try {
      const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(keyFor(shopId, name));
      request.onsuccess = () => {
        const value = request.result as Snapshot<T> | undefined;
        resolve(value && Array.isArray(value.rows) ? value : null);
      };
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
};

/**
 * Forget everything. Called on sign out, because the next person to open this
 * phone may not be the person whose takings are sitting in it.
 */
export const cacheClearAll = async (): Promise<void> => {
  const db = await open();
  if (!db) return;

  try {
    // Snapshots only. A sale sitting in the queue is money that happened and
    // has not reached the server: clearing it on sign out would delete a
    // shopkeeper's takings to tidy up a cache.
    db.transaction(STORE, 'readwrite').objectStore(STORE).clear();
  } catch {
    // Nothing to be done, and nothing that depends on it having worked.
  }
};
