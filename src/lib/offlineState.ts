import { useSyncExternalStore } from 'react';

/**
 * Whether anything on screen is a saved copy rather than the real thing.
 *
 * The rule this exists to enforce: never show cached figures without saying so.
 * A shopkeeper deciding whether to reorder, or whether somebody has paid, is
 * making that decision on numbers. Numbers from an hour ago that look exactly
 * like numbers from now are worse than no numbers at all, because there is
 * nothing to tell them to go and check.
 *
 * A tiny store rather than context, because the fetching happens inside hooks
 * that would otherwise all need a provider threaded through them, and because
 * what the banner needs to know is one question with one answer.
 */

const servedFromCache = new Map<string, number>();
const listeners = new Set<() => void>();

const emit = () => {
  for (const listener of listeners) listener();
};

/** A fetch failed and we fell back to what was saved at `savedAt`. */
export const markServedFromCache = (key: string, savedAt: number) => {
  if (servedFromCache.get(key) === savedAt) return;
  servedFromCache.set(key, savedAt);
  emit();
};

/** A fetch succeeded, so this part of the screen is live again. */
export const markFresh = (key: string) => {
  if (servedFromCache.delete(key)) emit();
};

export const clearCacheFlags = () => {
  if (servedFromCache.size === 0) return;
  servedFromCache.clear();
  emit();
};

// The oldest of them, because a banner that admits to one stale list while
// another is staler still is only half honest.
const snapshot = () => {
  if (servedFromCache.size === 0) return 0;
  return Math.min(...servedFromCache.values());
};

let cached = snapshot();

const subscribe = (listener: () => void) => {
  const wrapped = () => {
    cached = snapshot();
    listener();
  };
  listeners.add(wrapped);
  return () => {
    listeners.delete(wrapped);
  };
};

// useSyncExternalStore compares by identity, so this must return the same
// number until something actually changes, never a fresh object.
const getSnapshot = () => cached;

/** 0 when everything on screen is live, otherwise when the oldest copy was taken. */
export const useServedFromCache = (): number => useSyncExternalStore(subscribe, getSnapshot, () => 0);
