interface LogoProps {
  /** Mark only, or mark plus wordmark. */
  wordmark?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const MARK_SIZES = { sm: 'h-7 w-7', md: 'h-10 w-10', lg: 'h-14 w-14' };
const TEXT_SIZES = { sm: 'text-lg', md: 'text-2xl', lg: 'text-3xl' };

/**
 * The mark is a T made from a ledger rule: the crossbar is the ruled line, the
 * stem hangs off it, and the sage bar is an entry written at the end of that
 * line. Kept as inline SVG so it inherits nothing and renders identically
 * everywhere, including before any CSS or font has loaded.
 */
export function Logo({ wordmark = true, size = 'md', className = '' }: LogoProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <svg
        viewBox="0 0 64 64"
        className={`${MARK_SIZES[size]} shrink-0`}
        role="img"
        aria-label="Tarihi"
      >
        <rect width="64" height="64" rx="14" fill="#c85a2e" />
        <rect x="13" y="20" width="38" height="5.5" rx="2.75" fill="#f8f7f5" />
        <rect x="29.25" y="20" width="5.5" height="25" rx="2.75" fill="#f8f7f5" />
        <rect x="39" y="32.5" width="12" height="5" rx="2.5" fill="#4f9469" />
      </svg>
      {wordmark && (
        <span className={`${TEXT_SIZES[size]} font-bold tracking-tight lowercase`}>tarihi</span>
      )}
    </div>
  );
}
