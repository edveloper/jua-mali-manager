// Runs after `vite build` and the SSR build of src/entry-server.tsx (see the
// "build" script). For each public page it takes the built dist/index.html,
// gives it that page's head tags and rendered content, and writes it to dist/.
//
//   dist/index.html    landing page (also the app's shell for signed-in users)
//   dist/privacy.html  served at /privacy   (vercel.json: cleanUrls)
//   dist/terms.html    served at /terms
//   dist/404.html      served with a 404 status for unknown paths
//   dist/app.html      bare shell, noindex: /auth and /i/:token rewrite to it
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const dist = path.resolve('dist');
const ssrEntry = path.resolve('dist-ssr/entry-server.js');
const { render, PUBLIC_ROUTES, SITE_URL } = await import(pathToFileURL(ssrEntry).href);

const template = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');

const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

function setMeta(html, attr, key, value) {
  const re = new RegExp(`<meta\\s+${attr}="${key}"\\s+content="[^"]*"\\s*/?>`);
  const tag = `<meta ${attr}="${key}" content="${esc(value)}" />`;
  if (!re.test(html)) throw new Error(`template is missing <meta ${attr}="${key}">`);
  return html.replace(re, tag);
}

function withHead(html, route) {
  const url = SITE_URL + (route.path === '/' ? '/' : route.path);
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(route.title)}</title>`);
  html = setMeta(html, 'name', 'description', route.description);
  html = setMeta(html, 'property', 'og:title', route.title);
  html = setMeta(html, 'property', 'og:description', route.description);
  html = setMeta(html, 'property', 'og:url', url);
  html = setMeta(html, 'name', 'twitter:title', route.title);
  html = setMeta(html, 'name', 'twitter:description', route.description);
  html = html.replace(/<link rel="canonical" href="[^"]*"\s*\/?>/, route.noindex ? '' : `<link rel="canonical" href="${url}" />`);
  if (route.noindex) html = html.replace('</head>', '    <meta name="robots" content="noindex" />\n  </head>');
  return html;
}

// Structured data for the landing page: what DukaKonnect is and who makes it.
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'DukaKonnect',
  url: SITE_URL + '/',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web, Android, iOS',
  description: PUBLIC_ROUTES.home.description,
  inLanguage: 'en-KE',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'KES' },
  author: { '@type': 'Person', name: 'Eddie Ezekiel Ochieng', url: 'https://eddie-ezekiel.com' },
};

function withContent(html, body) {
  // The boot splash stays inside #root for signed-in users (see index.html);
  // the rendered page sits beside it. main.tsx clears #root before mounting.
  const marker = '<!-- prerender -->';
  if (!html.includes(marker)) throw new Error('template is missing the <!-- prerender --> marker');
  return html
    .replace('<html lang="en">', '<html lang="en" class="prerendered">')
    .replace(marker, `<div id="prerender">${body}</div>`);
}

const pages = [
  ['home', true],
  ['privacy', false],
  ['terms', false],
  ['notFound', false],
];

for (const [key, isHome] of pages) {
  const route = PUBLIC_ROUTES[key];
  let html = withContent(withHead(template, route), render(key));
  if (isHome) {
    html = html.replace('</head>', `    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>\n  </head>`);
  }
  fs.writeFileSync(path.join(dist, route.file), html);
  console.log(`prerendered ${route.path} -> dist/${route.file}`);
}

// Bare shell for the routes that must stay out of search results.
const shell = withHead(template, {
  path: '/auth',
  title: 'Sign in · DukaKonnect',
  description: 'Sign in to DukaKonnect.',
  noindex: true,
});
fs.writeFileSync(path.join(dist, 'app.html'), shell);
console.log('wrote dist/app.html (noindex shell for /auth and /i/:token)');

fs.rmSync(path.resolve('dist-ssr'), { recursive: true, force: true });
