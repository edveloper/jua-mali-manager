import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { CONTACT_EMAIL } from '@/seo/public-routes';

/** Links every public page carries in its footer. */
export function PublicFooter() {
  return (
    <footer className="flex flex-col items-center gap-3 py-8">
      <div className="opacity-70 flex flex-col items-center gap-2">
        <Logo size="sm" wordmark={false} />
        <p className="text-xs text-muted-foreground">biashara yako, siku kwa siku</p>
      </div>
      <nav className="flex gap-4 text-xs text-muted-foreground">
        <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
        <Link to="/terms" className="hover:text-foreground">Terms</Link>
        <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-foreground">Contact</a>
      </nav>
    </footer>
  );
}

/**
 * Shell for the public pages that are not the landing page (privacy, terms):
 * the same phone-width column and header, with plain reading text.
 */
export function PublicPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background max-w-md mx-auto">
      <header className="sticky top-0 z-30 bg-background/90 backdrop-blur border-b border-border">
        <div className="px-4 h-14 flex items-center justify-between gap-3">
          <Link to="/" aria-label="DukaKonnect home">
            <Logo size="sm" />
          </Link>
          <Link to="/auth" className="text-sm font-semibold text-primary px-3 py-1.5 rounded-full active:bg-primary/10">
            Sign In
          </Link>
        </div>
      </header>

      <main className="px-5 pt-8 pb-4">
        <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
        <p className="text-xs text-muted-foreground mt-2">Last updated {updated}</p>
        <div className="mt-6 space-y-7 text-[0.95rem] leading-relaxed">{children}</div>
      </main>

      <PublicFooter />
    </div>
  );
}

export function Section({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="space-y-2.5">
      <h2 className="text-lg font-bold">{heading}</h2>
      {children}
    </section>
  );
}
