interface LogoProps {
  /** Mark only, or mark plus wordmark. */
  wordmark?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const MARK_SIZES = { sm: 'h-7 w-7', md: 'h-10 w-10', lg: 'h-14 w-14' };
const TEXT_SIZES = { sm: 'text-lg', md: 'text-2xl', lg: 'text-3xl' };

/**
 * The mark is a K drawn as a connection.
 *
 * The stem is the ruled edge of a daybook page, which is the line the whole app
 * is built on. The arms open off it, and the sage node sits where the upper arm
 * lands: one side of a trade meeting the other. Sage is the shop's own colour
 * everywhere else in the app, so the node reads as the counterparty rather than
 * as decoration.
 *
 * Kept as inline SVG so it inherits nothing and renders identically everywhere,
 * including before any CSS or font has loaded. The colours are literals for the
 * same reason: this has to be right on the very first paint.
 *
 * The wordmark splits the name the way the family does, with the shared half in
 * terracotta. Sibling apps carry the same suffix, so it is the half that says
 * which family this belongs to.
 */
export function Logo({ wordmark = true, size = 'md', className = '' }: LogoProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <svg
        viewBox="0 0 64 64"
        className={`${MARK_SIZES[size]} shrink-0`}
        role="img"
        aria-label="DukaKonnect"
      >
        <rect width="64" height="64" rx="14" fill="#c85a2e" />
        <g fill="none" stroke="#f8f7f5" strokeWidth="6.5" strokeLinecap="round">
          <path d="M18.5 19 V48" />
          <path d="M21.5 34.5 L36.5 22" />
          <path d="M21.5 34.5 L38 48" />
        </g>
        <circle cx="43.5" cy="17.5" r="5" fill="#4f9469" />
      </svg>
      {wordmark && (
        <span className={`${TEXT_SIZES[size]} font-bold tracking-tight`}>
          Duka<span className="text-primary">Konnect</span>
        </span>
      )}
    </div>
  );
}
