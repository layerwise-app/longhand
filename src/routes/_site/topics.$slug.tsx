import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { brand } from '~/brand.config';
import { TopicFollowButton } from '~/components/story/actions';
import { StoryCard } from '~/components/story/story-card';
import { Button } from '~/components/ui/button';
import { getTopicPage } from '~/functions/reading.functions';
import { plural } from '~/lib/format';
import { cn } from '~/lib/utils';
import { seo } from '~/utils/seo';

type TopicSearch = { sort?: 'latest'; page?: number };

export const Route = createFileRoute('/_site/topics/$slug')({
  validateSearch: (search: Record<string, unknown>): TopicSearch => ({
    sort: search.sort === 'latest' ? 'latest' : undefined,
    page: Number(search.page) > 1 ? Number(search.page) : undefined
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ params, deps }) =>
    getTopicPage({ data: { slug: params.slug, sort: deps.sort, page: deps.page } }),
  head: ({ loaderData, params }) =>
    seo({
      title: `${loaderData?.topic.name ?? 'Topic'} stories on ${brand.name}`,
      description: loaderData?.topic.description,
      path: `/topics/${params.slug}`,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: loaderData?.topic.name,
        description: loaderData?.topic.description
      }
    }),
  component: TopicPage
});

function TopicPage() {
  const data = Route.useLoaderData();
  const search = Route.useSearch();
  const params = Route.useParams();
  const navigate = useNavigate({ from: Route.fullPath });
  const tab = (active: boolean) =>
    cn(
      '-mb-px border-b py-3 text-sm',
      active
        ? 'border-foreground font-medium'
        : 'border-transparent text-muted-foreground hover:text-foreground'
    );
  return (
    <div className='mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14'>
      <p className='text-[13px] text-muted-foreground'>
        <Link to='/topics' className='hover:text-foreground'>Topics</Link>
      </p>
      <h1 className='mt-1 font-display text-5xl font-normal tracking-tight sm:text-6xl'>{data.topic.name}</h1>
      <p className='mt-3 max-w-xl font-serif text-xl leading-snug text-muted-foreground'>{data.topic.description}</p>
      <div className='mt-5 flex items-center gap-4'>
        <TopicFollowButton
          key={data.topic.slug}
          topic={data.topic.slug}
          name={data.topic.name}
          initial={data.following}
          size='default'
        />
        <span className='text-[13px] text-muted-foreground'>
          {plural(data.storyCount, 'story', 'stories')} · {plural(data.followerCount, 'follower')}
        </span>
      </div>
      <div className='mt-8 flex gap-6 border-b' role='tablist'>
        <Link
          to='/topics/$slug'
          params={params}
          search={{}}
          role='tab'
          aria-selected={data.sort === 'popular'}
          className={tab(data.sort === 'popular')}
        >
          Popular
        </Link>
        <Link
          to='/topics/$slug'
          params={params}
          search={{ sort: 'latest' }}
          role='tab'
          aria-selected={data.sort === 'latest'}
          className={tab(data.sort === 'latest')}
        >
          Latest
        </Link>
      </div>
      <div className='pt-4'>
        {data.stories.map((story) => (
          <StoryCard key={story.id} story={story} />
        ))}
        {!data.stories.length ? (
          <p className='py-14 text-center font-serif text-lg text-muted-foreground'>
            Nothing here yet. Be the first to write about {data.topic.name.toLowerCase()}.
          </p>
        ) : null}
      </div>
      {data.hasMore ? (
        <div className='pt-4 text-center'>
          <Button
            variant='outline'
            className='rounded-full'
            onClick={() =>
              navigate({
                search: { ...search, page: (search.page ?? 1) + 1 },
                resetScroll: false
              })
            }
          >
            Show more stories
          </Button>
        </div>
      ) : null}
    </div>
  );
}
