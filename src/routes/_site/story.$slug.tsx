import { createFileRoute } from '@tanstack/react-router';
import { brand } from '~/brand.config';
import { StoryReader } from '~/components/story/reader';
import { getStoryPage } from '~/functions/reading.functions';
import { siteUrl } from '~/lib/site';
import { seo } from '~/utils/seo';

export const Route = createFileRoute('/_site/story/$slug')({
  loader: ({ params }) => getStoryPage({ data: { slug: params.slug } }),
  head: ({ loaderData, params }) => {
    if (!loaderData) return seo({ title: brand.name, noindex: true });
    const { story, author } = loaderData;
    const path = `/story/${params.slug}`;
    return seo({
      title: `${story.title} | ${brand.name}`,
      description: story.description,
      path,
      image: story.coverUrl ?? undefined,
      imageAlt: story.coverAlt,
      type: 'article',
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: story.title,
        description: story.description,
        ...(story.coverUrl ? { image: [siteUrl(story.coverUrl)] } : {}),
        datePublished: story.publishedAt,
        dateModified: story.updatedAt,
        wordCount: story.wordCount,
        mainEntityOfPage: siteUrl(path),
        keywords: story.topics.join(', '),
        author: {
          '@type': 'Person',
          name: author.name,
          url: siteUrl(`/@${author.username}`)
        },
        publisher: {
          '@type': 'Organization',
          name: brand.name,
          logo: {
            '@type': 'ImageObject',
            url: siteUrl('/android-chrome-512x512.png')
          }
        }
      }
    });
  },
  component: StoryPage
});

function StoryPage() {
  const data = Route.useLoaderData();
  return <StoryReader key={data.story.id} data={data} />;
}
