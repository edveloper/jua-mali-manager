import { useSyncExternalStore } from 'react';

/**
 * Whether the browser thinks it has a network.
 *
 * Worth being clear about what it does and does not mean. `navigator.onLine`
 * is true whenever there is a connection to something, which includes a phone
 * attached to a wifi router that has itself lost its uplink. So it is reliable
 * for "definitely offline" and only hopeful for "definitely online".
 *
 * That asymmetry is fine for what it is used for: choosing what to say on the
 * waiting-sales banner. Being wrongly told to tap costs a tap. Being wrongly
 * told nothing will send costs trust.
 */
const subscribe = (listener: () => void) => {
  window.addEventListener('online', listener);
  window.addEventListener('offline', listener);
  return () => {
    window.removeEventListener('online', listener);
    window.removeEventListener('offline', listener);
  };
};

export const useOnline = (): boolean =>
  useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    // Rendered on a server or in a test, assume a network rather than
    // announcing a problem that may not exist.
    () => true,
  );
