import { ReactNode, FormEvent } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Pinned below the scrolling body, so actions never scroll out of reach. */
  footer?: ReactNode;
  /** When given, the shell renders as a form and submit buttons work normally. */
  onSubmit?: (e: FormEvent) => void;
  size?: 'md' | 'lg';
}

/**
 * The one dialog shell in the app.
 *
 * Every dialog used to build its own box, and each one drifted: some scrolled,
 * some did not, and on a phone with the keyboard up the Confirm button ended up
 * below the fold with no way to reach it. The fix has to live in one place or it
 * comes back with the next dialog somebody adds.
 *
 * Three rules do the work. The shell is a column with a fixed maximum height, so
 * it can never grow past the screen. Only the middle scrolls. And the height is
 * measured in `dvh`, not `vh` -- `vh` is the height of the window as though the
 * keyboard were not there, which is precisely the case where things go missing.
 */
export function Modal({ title, onClose, children, footer, onSubmit, size = 'md' }: ModalProps) {
  const Shell = onSubmit ? 'form' : 'div';

  return (
    <div className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm flex items-end sm:items-center justify-center">
      <Shell
        onSubmit={onSubmit}
        className={`bg-card w-full ${size === 'lg' ? 'max-w-lg' : 'max-w-md'} rounded-t-2xl sm:rounded-lg animate-slide-up flex flex-col max-h-[90dvh]`}
      >
        <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
          <h2 className="text-lg font-semibold">{title}</h2>
          <Button type="button" variant="ghost" size="icon-sm" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* overscroll-contain so flicking past the end of a long form does not
            start scrolling the page underneath it. */}
        <div className="p-4 space-y-4 overflow-y-auto overscroll-contain flex-1">{children}</div>

        {footer && (
          <div className="p-4 border-t border-border shrink-0 flex gap-3">{footer}</div>
        )}
      </Shell>
    </div>
  );
}
