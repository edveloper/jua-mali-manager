/**
 * Server entry used only at build time by scripts/prerender.mjs.
 *
 * The app itself is a client-side single-page app, which leaves search engines
 * (and anyone on a slow connection) an empty page until the JavaScript arrives.
 * The public pages are rendered here to plain HTML so each one is served with
 * its own content and head tags. The signed-in app is never rendered here.
 */
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import Landing from './pages/Landing';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import NotFound from './pages/NotFound';
import { PUBLIC_ROUTES, SITE_URL, type PublicRoute } from './seo/public-routes';

const PAGES = { home: Landing, privacy: Privacy, terms: Terms, notFound: NotFound } as const;

export type PageKey = keyof typeof PAGES;

export function render(key: PageKey): string {
  const Page = PAGES[key];
  return renderToString(
    <StaticRouter location={PUBLIC_ROUTES[key].path}>
      <Page />
    </StaticRouter>
  );
}

export { PUBLIC_ROUTES, SITE_URL };
export type { PublicRoute };
