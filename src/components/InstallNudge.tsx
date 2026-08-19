import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface InstallNudgeProps {
  /** Hidden entirely when there is no way to install on this device. */
  canInstall: boolean;
  /** Sales recorded in this shop. The nudge waits until the app has earned it. */
  salesCount: number;
  onInstall: () => void;
}

const DISMISSED_KEY = 'dukakonnect:install-dismissed';

/**
 * Asked once, at the point it makes sense.
 *
 * A shop that has recorded a few sales has decided this thing is useful. Before
 * that, an install prompt is a stranger asking for space on your home screen.
 * So it waits, and when it is turned down it stays down: nothing is more
 * corrosive than a banner that reappears every morning.
 */
const SALES_BEFORE_ASKING = 3;

export function InstallNudge({ canInstall, salesCount, onInstall }: InstallNudgeProps) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISSED_KEY) === '1');
    } catch {
      // Private mode, or storage disabled. Say dismissed and never nag.
      setDismissed(true);
    }
  }, []);

  const hide = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // Nothing to do. It will simply ask again next time, which is the least
      // bad outcome when there is nowhere to remember the answer.
    }
  };

  if (dismissed || !canInstall || salesCount < SALES_BEFORE_ASKING) return null;

  return (
    // Sits above the bottom navigation, not over it: the nav is how people move
    // around, and covering it to advertise something would be a poor trade.
    <div className="fixed bottom-0 left-0 right-0 z-30 px-3 pb-[calc(env(safe-area-inset-bottom)+4.75rem)] pointer-events-none">
      <div className="max-w-md mx-auto pointer-events-auto sheet flex items-center gap-3 border-primary/40 bg-card">
        <Download className="h-5 w-5 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Keep DukaKonnect on your phone</p>
          <p className="text-xs text-muted-foreground">Opens like an app, works offline</p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            hide();
            onInstall();
          }}
        >
          Install
        </Button>
        <button
          type="button"
          onClick={hide}
          aria-label="Not now"
          className="text-muted-foreground shrink-0 p-1"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
