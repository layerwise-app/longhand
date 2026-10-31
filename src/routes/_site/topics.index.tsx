import { createFileRoute, Link } from '@tanstack/react-router';
import { brand } from '~/brand.config';
import { TopicFollowButton } from '~/components/story/actions';
import { getAllTopics } from '~/functions/reading.functions';
import { plural } from '~/lib/format';
import { seo } from '~/utils/seo';

export const Route = createFileRoute('/_site/topics/')({
  loader: () => getAllTopics(),
  head: () =>
    seo({
      title: `Topics on ${brand.name}`,
      description: 'Every topic people write about here, from food and fiction to transit and type.',
      path: '/topics'
    }),
  component: TopicsPage
});

function TopicsPage() {
  const topics = Route.useLoaderData();
  return (
    <div className='mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14'>
      <h1 className='font-display text-4xl font-normal tracking-tight sm:text-5xl'>Topics</h1>
      <p className='mt-3 max-w-xl font-serif text-xl text-muted-foreground'>
        Follow what interests you, and your feed will lean that way.
      </p>
      <ul className='mt-8 grid gap-x-10 sm:grid-cols-2'>
        {topics.map((topic) => (
          <li key={topic.slug} className='flex items-start justify-between gap-4 border-t py-5'>
            <div className='min-w-0'>
              <Link
                to='/topics/$slug'
                params={{ slug: topic.slug }}
                search={{ sort: undefined }}
                className='font-display text-[1.45rem] leading-tight font-medium hover:underline hover:decoration-1 hover:underline-offset-4'
              >
                {topic.name}
              </Link>
              <p className='mt-1 font-serif text-[1.02rem] leading-snug text-muted-foreground'>{topic.description}</p>
              <p className='mt-1.5 text-[13px] text-muted-foreground'>{plural(topic.storyCount, 'story', 'stories')}</p>
            </div>
            <TopicFollowButton topic={topic.slug} name={topic.name} initial={topic.following} />
          </li>
        ))}
      </ul>
    </div>
  );
}
