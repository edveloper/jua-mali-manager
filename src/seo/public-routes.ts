// The public pages, and the head tags each one is served with. Read by the
// pages (for in-app navigation) and by scripts/prerender.mjs (for the static
// HTML that search engines and first-time visitors receive).

export const SITE_URL = 'https://dukakonnect.co.ke';

export interface PublicRoute {
  path: string;
  /** File written into dist/, served by Vercel for this path. */
  file: string;
  title: string;
  description: string;
  /** Kept out of search results (still prerendered, still reachable). */
  noindex?: boolean;
}

export const PUBLIC_ROUTES: Record<'home' | 'privacy' | 'terms' | 'notFound', PublicRoute> = {
  home: {
    path: '/',
    file: 'index.html',
    title: 'DukaKonnect · biashara yako, siku kwa siku',
    description:
      'DukaKonnect keeps the books for small shops in Kenya. Record sales, track stock, follow up deni, and see what you actually took home today. Free to start.',
  },
  privacy: {
    path: '/privacy',
    file: 'privacy.html',
    title: 'Privacy Policy · DukaKonnect',
    description:
      'What DukaKonnect stores about your shop and your customers, who can see it, and how to get it out or have it deleted.',
  },
  terms: {
    path: '/terms',
    file: 'terms.html',
    title: 'Terms of Use · DukaKonnect',
    description: 'The terms for using DukaKonnect to keep the books for your shop.',
  },
  notFound: {
    path: '/404',
    file: '404.html',
    title: 'Page not found · DukaKonnect',
    description: 'This page does not exist on DukaKonnect.',
    noindex: true,
  },
};

export const LEGAL_UPDATED = '10 October 2026';
export const CONTACT_EMAIL = 'eddie.ochieng@usalama-voice.com';
