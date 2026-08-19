import { Modal } from '@/components/Modal';
import { Button } from '@/components/ui/button';
import { isIpad, isIosSafari } from '@/hooks/usePwaInstall';

interface InstallSheetProps {
  onClose: () => void;
}

/** Safari's share glyph, drawn rather than described. */
const ShareGlyph = ({ className = '' }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M12 15V3" />
    <path d="M8 7l4-4 4 4" />
    <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
  </svg>
);

const Step = ({ n, children }: { n: number; children: React.ReactNode }) => (
  <div className="flex gap-3">
    <span className="shrink-0 h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center num">
      {n}
    </span>
    <div className="text-sm leading-relaxed pt-0.5">{children}</div>
  </div>
);

/**
 * How to install on an iPhone or iPad.
 *
 * iOS has never supported beforeinstallprompt, so this is the only route there
 * and it has to be done by hand. It replaces a raw window.alert() that listed
 * the steps as text: in an app where every other surface is designed, a browser
 * alert reads as something having gone wrong.
 *
 * The Share button is drawn rather than named, because "the square with the
 * arrow" is a description somebody has to decode while looking at a toolbar.
 */
export function InstallSheet({ onClose }: InstallSheetProps) {
  const onIpad = isIpad();
  const inSafari = isIosSafari();

  return (
    <Modal
      title="Add to your home screen"
      onClose={onClose}
      footer={<Button className="flex-1" onClick={onClose}>Got it</Button>}
    >
      <p className="text-sm text-muted-foreground leading-relaxed">
        It opens like any other app, fills the whole screen, and keeps working when
        the network drops.
      </p>

      {!inSafari && (
        <div className="rounded-lg border border-warning/40 bg-warning/5 p-3">
          <p className="text-sm font-medium">Open this page in Safari first</p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Adding to the home screen is most reliable from Safari on an{' '}
            {onIpad ? 'iPad' : 'iPhone'}. Copy the address, open Safari, and come back
            to this step.
          </p>
        </div>
      )}

      <div className="space-y-3">
        <Step n={1}>
          Tap the share button{' '}
          <span className="inline-flex items-center justify-center align-middle h-6 w-6 rounded border border-border text-primary mx-0.5">
            <ShareGlyph className="h-3.5 w-3.5" />
          </span>{' '}
          {onIpad ? 'at the top of Safari.' : 'at the bottom of Safari.'}
        </Step>
        <Step n={2}>
          Scroll down the list and tap{' '}
          <span className="font-medium text-foreground">Add to Home Screen</span>.
        </Step>
        <Step n={3}>
          Tap <span className="font-medium text-foreground">Add</span>. The
          DukaKonnect icon appears with your other apps.
        </Step>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">
        Nothing is downloaded and nothing is charged. It is the same app, opened
        without the browser around it.
      </p>
    </Modal>
  );
}
