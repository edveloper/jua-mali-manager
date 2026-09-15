import { CloudOff } from 'lucide-react';
import { format } from 'date-fns';
import { useServedFromCache } from '@/lib/offlineState';

/**
 * Says so when the figures on screen are a saved copy.
 *
 * The whole point of caching is that a dead spot does not mean a blank screen.
 * The whole risk of caching is that an hour-old stock level looks exactly like
 * a live one, and somebody reorders against it. This is the line that separates
 * the two, and it is why the cache was not worth shipping without it.
 *
 * It names the time rather than saying "offline", because "saved at 09:41" tells
 * a shopkeeper whether it matters. Before the morning delivery it does. After a
 * quiet hour it does not.
 */
export function OfflineNotice() {
  const savedAt = useServedFromCache();
  if (!savedAt) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-warning/15 border-b border-warning/30">
      <CloudOff className="h-4 w-4 text-warning shrink-0" />
      <p className="text-xs leading-snug">
        <span className="font-semibold">Showing saved figures</span>
        <span className="text-muted-foreground">
          {' '}from {format(new Date(savedAt), 'HH:mm')}. Anything recorded since then is not here.
        </span>
      </p>
    </div>
  );
}
