import { useEffect } from 'react';

/**
 * Keeps the tab title and description right when moving between public pages
 * inside the app. The first load already has them: public pages are rendered to
 * static HTML at build time (scripts/prerender.mjs) with their own head tags.
 */
export function usePageMeta(title: string, description?: string) {
  useEffect(() => {
    document.title = title;
    if (description) {
      document.querySelector('meta[name="description"]')?.setAttribute('content', description);
    }
  }, [title, description]);
}
