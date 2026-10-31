import { createFileRoute } from '@tanstack/react-router';
import { brand } from '~/brand.config';
import { siteMapEntries } from '~/functions/reading.functions';
import { sitemapPaths, siteUrl } from '~/lib/site';

// Fixed pages from `sitemapPaths`, plus every topic, published story, and writer.
// Drafts are never in here because they have no published slug to list.
export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: async () => {
        const { stories, authors } = await siteMapEntries();
        const entries = [
          ...sitemapPaths.map((path) => ({ path, lastmod: null as Date | null })),
          ...brand.topics.map((topic) => ({
            path: `/topics/${topic.slug}`,
            lastmod: null as Date | null
          })),
          ...authors.map((author) => ({
            path: `/@${author.username}`,
            lastmod: null as Date | null
          })),
          ...stories.map((story) => ({
            path: `/story/${story.slug}`,
            lastmod: story.updatedAt
          }))
        ];
        const urls = entries
          .map(
            ({ path, lastmod }) =>
              `  <url><loc>${escapeXml(siteUrl(path))}</loc>${
                lastmod ? `<lastmod>${new Date(lastmod).toISOString()}</lastmod>` : ''
              }</url>`
          )
          .join('\n');
        return new Response(
          `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
          { headers: { 'content-type': 'application/xml; charset=utf-8' } }
        );
      }
    }
  }
});

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}
