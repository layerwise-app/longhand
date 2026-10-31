import { useEffect, useState, type FormEvent } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { SearchIcon } from 'lucide-react';
import { PersonRow } from '~/components/story/person-row';
import { StoryCard } from '~/components/story/story-card';
import { search as runSearch } from '~/functions/reading.functions';
import { cn } from '~/lib/utils';
import { seo } from '~/utils/seo';

type Filter = 'stories' | 'people' | 'topics';
type SearchParams = { q: string; type?: Filter };

export const Route = createFileRoute('/_site/search')({
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    q: typeof search.q === 'string' ? search.q : '',
    type:
      search.type === 'people' || search.type === 'topics'
        ? search.type
        : undefined
  }),
  loaderDeps: ({ search }) => ({ q: search.q }),
  loader: ({ deps }) => runSearch({ data: { q: deps.q } }),
  // Results pages add nothing search engines don't already have.
  head: () => seo({ title: 'Search', noindex: true }),
  component: SearchPage
});

function SearchPage() {
  const data = Route.useLoaderData();
  const { q, type } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const [value, setValue] = useState(q);
  useEffect(() => setValue(q), [q]);
  const active: Filter = type ?? 'stories';
  const counts = {
    stories: data.stories.length,
    people: data.people.length,
    topics: data.topics.length
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    navigate({ search: { q: value.trim(), type } });
  };
  const hasQuery = data.q.length >= 2;
  return (
    <div className='mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12'>
      <form role='search' onSubmit={submit} className='relative'>
        <SearchIcon className='pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground' />
        <input
          type='search'
          autoFocus={!q}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder='Search stories, people, and topics'
          aria-label='Search stories, people, and topics'
          className='h-12 w-full rounded-full bg-tint pr-4 pl-12 text-base outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/40'
        />
      </form>
      {data.rateLimited ? (
        <p className='py-10 text-center text-muted-foreground'>
          That’s a lot of searching. Give it a minute and try again.
        </p>
      ) : hasQuery ? (
        <>
          <h1 className='mt-8 font-display text-3xl font-normal'>
            Results for <span className='italic'>{data.q}</span>
          </h1>
          <div role='tablist' className='mt-4 flex gap-6 border-b'>
            {(['stories', 'people', 'topics'] as const).map((filter) => (
              <Link
                key={filter}
                to='/search'
                search={{ q, type: filter === 'stories' ? undefined : filter }}
                role='tab'
                aria-selected={active === filter}
                className={cn(
                  '-mb-px border-b py-3 text-sm capitalize',
                  active === filter
                    ? 'border-foreground font-medium'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                {filter} <span className='text-muted-foreground'>{counts[filter]}</span>
              </Link>
            ))}
          </div>
          <div className='pt-4'>
            {active === 'stories'
              ? data.stories.map((story) => <StoryCard key={story.id} story={story} />)
              : null}
            {active === 'people' ? (
              <div className='space-y-6 py-4'>
                {data.people.map((person) => (
                  <PersonRow key={person.id} person={person} showFollow={false} />
                ))}
              </div>
            ) : null}
            {active === 'topics' ? (
              <ul>
                {data.topics.map((topic) => (
                  <li key={topic.slug} className='border-b py-4'>
                    <Link
                      to='/topics/$slug'
                      params={{ slug: topic.slug }}
                      search={{ sort: undefined }}
                      className='font-display text-xl font-medium hover:underline'
                    >
                      {topic.name}
                    </Link>
                    <p className='font-serif text-muted-foreground'>{topic.description}</p>
                  </li>
                ))}
              </ul>
            ) : null}
            {counts[active] === 0 ? (
              <p className='py-14 text-center font-serif text-lg text-muted-foreground'>
                No {active} matched that. Try fewer or different words.
              </p>
            ) : null}
          </div>
        </>
      ) : (
        <p className='py-14 text-center font-serif text-lg text-muted-foreground'>
          Try a word you remember from a story, a writer’s name, or a topic.
        </p>
      )}
    </div>
  );
}
