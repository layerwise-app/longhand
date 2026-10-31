import { useState } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { brand } from '~/brand.config';
import { UserAvatar } from '~/components/site/user-avatar';
import { FollowButton } from '~/components/story/actions';
import { PersonRow } from '~/components/story/person-row';
import { ReportDialog } from '~/components/story/report-dialog';
import { StoryCard } from '~/components/story/story-card';
import { Button } from '~/components/ui/button';
import { getAuthorPage } from '~/functions/reading.functions';
import { formatCount, formatLongDate, plural } from '~/lib/format';
import { siteUrl } from '~/lib/site';
import { cn } from '~/lib/utils';
import { seo } from '~/utils/seo';

type ProfileSearch = { page?: number };

export const Route = createFileRoute('/_site/@{$username}')({
  validateSearch: (search: Record<string, unknown>): ProfileSearch => ({
    page: Number(search.page) > 1 ? Number(search.page) : undefined
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ params, deps }) =>
    getAuthorPage({ data: { username: params.username, page: deps.page } }),
  head: ({ loaderData, params }) => {
    const person = loaderData?.person;
    return seo({
      title: person ? `${person.name} (@${person.username}) on ${brand.name}` : brand.name,
      description: person?.bio || undefined,
      path: `/@${params.username}`,
      image: person?.avatarUrl ?? undefined,
      noindex: !loaderData?.storyCount,
      jsonLd: person
        ? {
            '@context': 'https://schema.org',
            '@type': 'ProfilePage',
            mainEntity: {
              '@type': 'Person',
              name: person.name,
              alternateName: person.username,
              description: person.bio,
              url: siteUrl(`/@${person.username}`)
            }
          }
        : undefined
    });
  },
  component: AuthorPage
});

type Tab = 'stories' | 'followers' | 'following';

function AuthorPage() {
  const data = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const [tab, setTab] = useState<Tab>('stories');
  const { person } = data;
  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'stories', label: 'Stories', count: data.storyCount },
    { key: 'followers', label: 'Followers', count: person.followerCount },
    { key: 'following', label: 'Following', count: person.followingCount }
  ];
  return (
    <div className='mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14'>
      <div className='flex items-start gap-4 sm:gap-6'>
        <UserAvatar name={person.name} src={person.avatarUrl} size={88} className='sm:size-28' />
        <div className='min-w-0 flex-1'>
          <h1 className='font-display text-3xl leading-tight font-normal tracking-tight sm:text-[2.6rem]'>
            {person.name}
          </h1>
          <p className='mt-0.5 text-sm text-muted-foreground'>@{person.username}</p>
          <div className='mt-3 flex flex-wrap items-center gap-2'>
            {data.isSelf ? (
              <Button asChild variant='outline' size='sm' className='rounded-full'>
                <Link to='/dashboard/settings'>Edit profile</Link>
              </Button>
            ) : (
              <FollowButton key={person.id} userId={person.id} name={person.name} initial={data.following} size='default' />
            )}
            {data.isSelf ? null : (
              <ReportDialog targetType='user' targetId={person.id} label='Report this writer' />
            )}
          </div>
        </div>
      </div>
      {person.bio ? (
        <p className='mt-5 max-w-2xl font-serif text-[1.2rem] leading-snug'>{person.bio}</p>
      ) : null}
      <p className='mt-3 text-[13px] text-muted-foreground'>
        {formatCount(person.followerCount)} followers · {plural(data.storyCount, 'story', 'stories')} · Joined {formatLongDate(person.joinedAt)}
      </p>
      <div role='tablist' className='mt-8 flex gap-6 border-b'>
        {tabs.map((item) => (
          <button
            key={item.key}
            type='button'
            role='tab'
            aria-selected={tab === item.key}
            onClick={() => setTab(item.key)}
            className={cn(
              '-mb-px border-b py-3 text-sm',
              tab === item.key
                ? 'border-foreground font-medium'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {item.label} <span className='text-muted-foreground'>{item.count}</span>
          </button>
        ))}
      </div>
      {tab === 'stories' ? (
        <div className='pt-4'>
          {data.stories.map((story) => (
            <StoryCard key={story.id} story={story} showAuthor={false} />
          ))}
          {!data.stories.length ? (
            <p className='py-12 text-center font-serif text-lg text-muted-foreground'>
              {data.isSelf ? 'Your published stories will show up here.' : `${person.name} hasn’t published anything yet.`}
            </p>
          ) : null}
          {data.hasMore ? (
            <div className='pt-4 text-center'>
              <Button
                variant='outline'
                className='rounded-full'
                onClick={() =>
                  navigate({
                    search: { page: (search.page ?? 1) + 1 },
                    resetScroll: false
                  })
                }
              >
                Show more stories
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className='space-y-5 py-6'>
          {(tab === 'followers' ? data.followers : data.followingList).map((other) => (
            <PersonRow key={other.id} person={other} showFollow={false} />
          ))}
          {!(tab === 'followers' ? data.followers : data.followingList).length ? (
            <p className='py-8 text-center font-serif text-lg text-muted-foreground'>
              {tab === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
