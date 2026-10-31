import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { brand, getTopic } from '~/brand.config';
import { FooterLinks } from '~/components/site/footer';
import { LOGO_STROKE } from '~/components/site/logo';
import { TopicFollowButton } from '~/components/story/actions';
import { PersonRow } from '~/components/story/person-row';
import { StoryCard, StoryMini } from '~/components/story/story-card';
import { Button } from '~/components/ui/button';
import { getHome, type HomeData } from '~/functions/reading.functions';
import { site, siteUrl } from '~/lib/site';
import { cn } from '~/lib/utils';
import { useViewer } from '~/lib/viewer';
import { seo } from '~/utils/seo';

type HomeSearch = { tab?: 'following'; topic?: string; page?: number };

export const Route = createFileRoute('/_site/')({
  validateSearch: (search: Record<string, unknown>): HomeSearch => ({
    tab: search.tab === 'following' ? 'following' : undefined,
    topic: typeof search.topic === 'string' ? search.topic : undefined,
    page: Number(search.page) > 1 ? Number(search.page) : undefined
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => getHome({ data: deps }),
  head: ({ match }) => {
    const topic = match.search.topic ? getTopic(match.search.topic) : undefined;
    return seo({
      title: `${brand.name}: ${brand.tagline}`,
      description: brand.description,
      // Filtered views of the feed point search engines at the main feed.
      path: '/',
      noindex: Boolean(topic || match.search.tab || match.search.page),
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: site.name,
        url: siteUrl('/'),
        potentialAction: {
          '@type': 'SearchAction',
          target: `${siteUrl('/search')}?q={query}`,
          'query-input': 'required name=query'
        }
      }
    });
  },
  component: Home
});

function Hero() {
  return (
    <section className='relative overflow-hidden border-b'>
      <svg
        viewBox='0 0 100 100'
        aria-hidden='true'
        preserveAspectRatio='xMidYMid meet'
        className='pointer-events-none absolute top-1/2 -right-16 h-[135%] -translate-y-1/2 text-primary opacity-[0.12] sm:right-[-2%] sm:opacity-100 sm:h-[118%]'
      >
        <path
          d={LOGO_STROKE}
          pathLength={1}
          className='hero-stroke'
          fill='none'
          stroke='currentColor'
          strokeWidth='3.2'
          strokeLinecap='round'
          strokeLinejoin='round'
        />
      </svg>
      <div className='relative mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-24'>
        <h1 className='max-w-[12ch] font-display text-[3.2rem] leading-[1.02] font-normal tracking-[-0.025em] text-balance sm:text-[5.2rem]'>
          {brand.hero.title}
        </h1>
        <p className='mt-5 max-w-[32rem] font-serif text-xl leading-snug text-muted-foreground sm:text-[1.45rem]'>
          {brand.hero.body}
        </p>
        <div className='mt-8 flex flex-wrap items-center gap-3'>
          <Button asChild size='lg' className='rounded-full px-6 text-[15px]'>
            <a href='#feed'>Start reading</a>
          </Button>
          <Button asChild size='lg' variant='outline' className='rounded-full bg-transparent px-6 text-[15px]'>
            <Link to='/try'>Try the editor</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function FeedTabs({ tab, topic }: { tab: HomeData['tab']; topic: string | null }) {
  const tabs = [
    { key: 'for-you', label: 'For you', search: { topic: topic ?? undefined } },
    { key: 'following', label: 'Following', search: { tab: 'following' as const, topic: topic ?? undefined } }
  ];
  return (
    <div role='tablist' aria-label='Feed' className='flex gap-6 border-b'>
      {tabs.map((item) => (
        <Link
          key={item.key}
          to='/'
          search={item.search}
          role='tab'
          aria-selected={tab === item.key}
          className={cn(
            '-mb-px border-b py-3 text-sm transition-colors',
            tab === item.key
              ? 'border-foreground font-medium text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}

function TopicChips({ active, tab }: { active: string | null; tab: HomeData['tab'] }) {
  const tabSearch = tab === 'following' ? ({ tab: 'following' } as const) : {};
  const chip = (selected: boolean) =>
    cn(
      'shrink-0 rounded-full px-3.5 py-1.5 text-[13px] whitespace-nowrap transition-colors',
      selected
        ? 'bg-foreground text-background'
        : 'bg-tint text-foreground hover:bg-border'
    );
  return (
    <nav
      aria-label='Filter by topic'
      className='scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 py-4 sm:mx-0 sm:flex-wrap sm:px-0'
    >
      <Link to='/' search={tabSearch} className={chip(!active)} aria-current={!active ? 'true' : undefined}>
        All
      </Link>
      {brand.topics.map((topic) => (
        <Link
          key={topic.slug}
          to='/'
          search={{ ...tabSearch, topic: topic.slug }}
          className={chip(active === topic.slug)}
          aria-current={active === topic.slug ? 'true' : undefined}
        >
          {topic.name}
        </Link>
      ))}
    </nav>
  );
}

function EmptyFollowing({ hasFollows }: { hasFollows: boolean }) {
  return (
    <div className='py-14 text-center'>
      <h2 className='font-display text-2xl font-medium'>
        {hasFollows ? 'Nothing new here yet' : 'Your own front page'}
      </h2>
      <p className='mx-auto mt-2 max-w-sm font-serif text-lg text-muted-foreground'>
        {hasFollows
          ? 'When the writers and topics you follow publish something, it will land here.'
          : 'Follow a few writers and topics, and their new stories will show up here.'}
      </p>
      <Button asChild variant='outline' className='mt-5 rounded-full'>
        <Link to='/topics'>Browse topics</Link>
      </Button>
    </div>
  );
}

function Sidebar({ data }: { data: HomeData }) {
  return (
    <aside className='space-y-9'>
      {data.staffPicks.length ? (
        <section aria-labelledby='staff-picks'>
          <h2 id='staff-picks' className='mb-4 text-sm font-semibold'>Staff picks</h2>
          <div className='space-y-5'>
            {data.staffPicks.map((story) => (
              <StoryMini key={story.id} story={story} />
            ))}
          </div>
        </section>
      ) : null}
      <section aria-labelledby='recommended-topics'>
        <h2 id='recommended-topics' className='mb-3 text-sm font-semibold'>Recommended topics</h2>
        <div className='flex flex-wrap gap-2'>
          {data.recommendedTopics.slice(0, 7).map((topic) => (
            <Link
              key={topic.slug}
              to='/topics/$slug'
              params={{ slug: topic.slug }}
              search={{ sort: undefined }}
              className='rounded-full bg-tint px-3 py-1.5 text-[13px] transition-colors hover:bg-border'
            >
              {topic.name}
            </Link>
          ))}
        </div>
      </section>
      {data.writers.length ? (
        <section aria-labelledby='who-to-follow'>
          <h2 id='who-to-follow' className='mb-4 text-sm font-semibold'>Writers to follow</h2>
          <div className='space-y-4'>
            {data.writers.map((writer) => (
              <PersonRow key={writer.id} person={writer} following={writer.following} compact />
            ))}
          </div>
        </section>
      ) : null}
      <FooterLinks />
    </aside>
  );
}

function Home() {
  const data = Route.useLoaderData();
  const search = Route.useSearch();
  const viewer = useViewer();
  const navigate = useNavigate({ from: Route.fullPath });
  const topic = data.topic ? getTopic(data.topic) : undefined;
  return (
    <>
      {viewer ? null : <Hero />}
      <div id='feed' className='mx-auto grid max-w-6xl scroll-mt-14 grid-cols-1 gap-x-14 px-4 pt-4 pb-12 sm:px-6 sm:pt-6 lg:grid-cols-[minmax(0,1fr)_19rem]'>
        <div className='min-w-0'>
          {viewer ? <FeedTabs tab={data.tab} topic={data.topic} /> : null}
          <TopicChips active={data.topic} tab={data.tab} />
          {topic ? (
            <div className='flex items-center justify-between gap-4 pb-2'>
              <p className='font-serif text-[1.05rem] text-muted-foreground'>{topic.description}</p>
              <TopicFollowButton
                key={topic.slug}
                topic={topic.slug}
                name={topic.name}
                initial={!data.recommendedTopics.every((t) => t.slug !== topic.slug || !t.following)}
              />
            </div>
          ) : null}
          {data.feed.length ? (
            <>
              <div>
                {data.feed.map((story) => (
                  <StoryCard key={story.id} story={story} />
                ))}
              </div>
              {data.hasMore ? (
                <div className='pt-6 text-center'>
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
            </>
          ) : data.tab === 'following' ? (
            <EmptyFollowing hasFollows={data.followingAnything} />
          ) : (
            <p className='py-14 text-center font-serif text-lg text-muted-foreground'>
              No stories here yet. Yours could be the first.
            </p>
          )}
        </div>
        <div className='hidden lg:block lg:pt-4'>
          <div className='sticky top-20'>
            <Sidebar data={data} />
          </div>
        </div>
        <div className='mt-10 border-t pt-8 lg:hidden'>
          <Sidebar data={data} />
        </div>
      </div>
    </>
  );
}
