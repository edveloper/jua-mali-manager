import { ReactNode, FormEvent, useEffect, useRef, useState } from 'react';
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
  /** For bodies that bring their own padding, like a rendered invoice. */
  bodyClassName?: string;
}

/**
 * How much of the window the on-screen keyboard is covering.
 *
 * `dvh` does not solve this, though it is widely believed to. On iOS Safari the
 * keyboard does not resize the layout viewport at all, and Chrome defaults to
 * `interactive-widget=resizes-visual`, which also leaves it alone. In both cases
 * `100dvh` stays the height of the whole screen, a `fixed inset-0` overlay keeps
 * covering the area behind the keyboard, and a bottom-anchored dialog puts its
 * footer underneath it. That is the Confirm button you cannot scroll to.
 *
 * The visual viewport is the part actually in view, so we measure that instead
 * and hand the dialog a real height.
 *
 * The threshold matters. Address bars collapse and expand by 50-100px during
 * ordinary scrolling, and reacting to that would make every dialog twitch. A
 * keyboard is never smaller than about 250px, so 120px separates the two.
 */
function useVisibleViewport() {
  const [box, setBox] = useState<{ top: number; height: number } | null>(null);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      const covered = window.innerHeight - vv.height;
      setBox(covered > 120 ? { top: vv.offsetTop, height: vv.height } : null);
    };

    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  return box;
}

/**
 * The one dialog shell in the app.
 *
 * Every dialog used to build its own box, and each one drifted: some scrolled,
 * some did not, and on a phone with the keyboard up the Confirm button ended up
 * below the fold with no way to reach it. The fix has to live in one place or it
 * comes back with the next dialog somebody adds.
 *
 * The shell is a column with a bounded height, so it can never grow past what is
 * visible; only the middle scrolls; and when the keyboard is up that bound comes
 * from the visual viewport rather than from CSS. Focusing a field also scrolls it
 * into the middle of the body, because a field at the bottom of a long form is
 * otherwise hidden by the keyboard the moment tapping it summons one.
 */
export function Modal({ title, onClose, children, footer, onSubmit, size = 'md', bodyClassName }: ModalProps) {
  const Shell = onSubmit ? 'form' : 'div';
  const box = useVisibleViewport();
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;

    const onFocusIn = (e: FocusEvent) => {
      const field = e.target as HTMLElement | null;
      if (!field || !field.closest('input, textarea, select')) return;
      // The keyboard animates in and the resize above lands after it, so
      // scrolling immediately would aim at a height that is about to change.
      window.setTimeout(() => {
        field.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, 300);
    };

    body.addEventListener('focusin', onFocusIn);
    return () => body.removeEventListener('focusin', onFocusIn);
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm flex items-end sm:items-center justify-center"
      style={box ? { top: box.top, height: box.height, bottom: 'auto' } : undefined}
    >
      <Shell
        onSubmit={onSubmit}
        style={box ? { maxHeight: '100%' } : undefined}
        className={`bg-card w-full ${size === 'lg' ? 'max-w-lg' : 'max-w-md'} rounded-t-2xl sm:rounded-lg animate-slide-up flex flex-col max-h-[90dvh]`}
      >
        <div className="p-4 border-b border-border flex items-center justify-between shrink-0 no-print">
          <h2 className="text-lg font-semibold">{title}</h2>
          <Button type="button" variant="ghost" size="icon-sm" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* overscroll-contain so flicking past the end of a long form does not
            start scrolling the page underneath it. */}
        <div
          ref={bodyRef}
          className={bodyClassName ?? 'p-4 space-y-4 overflow-y-auto overscroll-contain flex-1'}
        >
          {children}
        </div>

        {footer && (
          <div className="p-4 border-t border-border shrink-0 flex gap-3 no-print">{footer}</div>
        )}
      </Shell>
    </div>
  );
}
