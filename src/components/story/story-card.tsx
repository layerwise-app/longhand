import { Link } from '@tanstack/react-router';
import { getTopic } from '~/brand.config';
import { UserAvatar } from '~/components/site/user-avatar';
import { BookmarkButton } from '~/components/story/actions';
import { ClapIcon, ResponseIcon } from '~/components/story/icons';
import { formatCount, formatDate } from '~/lib/format';
import { coverThumb } from '~/lib/media';
import type { StoryCard as StoryCardData } from '~/server/cards';

export function AuthorLine({ author }: { author: StoryCardData['author'] }) {
  return (
    <Link
      to='/@{$username}'
      params={{ username: author.username }}
      className='inline-flex min-w-0 items-center gap-2 text-[13px] font-medium hover:underline'
    >
      <UserAvatar name={author.name} src={author.avatarUrl} size={22} />
      <span className='truncate'>{author.name}</span>
    </Link>
  );
}

export function StoryCard({
  story,
  showAuthor = true
}: {
  story: StoryCardData;
  showAuthor?: boolean;
}) {
  const topic = story.topics[0] ? getTopic(story.topics[0]) : undefined;
  return (
    <article className='border-b py-6 first:pt-2 last:border-b-0'>
      {showAuthor ? (
        <div className='mb-2.5 flex items-center gap-1.5'>
          <AuthorLine author={story.author} />
          {topic ? (
            <span className='truncate text-[13px] text-muted-foreground'>
              <span aria-hidden='true'> in </span>
              <Link
                to='/topics/$slug'
                params={{ slug: topic.slug }}
                search={{ sort: undefined }}
                className='hover:text-foreground'
              >
                {topic.name}
              </Link>
            </span>
          ) : null}
        </div>
      ) : null}
      <div className='flex items-start gap-4 sm:gap-8'>
        <div className='min-w-0 flex-1'>
          <Link to='/story/$slug' params={{ slug: story.slug }} className='group block'>
            <h2 className='font-display text-[1.3rem] leading-[1.22] font-medium text-balance group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4 sm:text-[1.55rem]'>
              {story.title}
            </h2>
            <p className='mt-1.5 line-clamp-2 font-serif text-[0.98rem] leading-snug text-muted-foreground sm:text-[1.05rem]'>
              {story.subtitle || story.description}
            </p>
          </Link>
          <div className='mt-3 flex items-center gap-3 text-[13px] text-muted-foreground'>
            <span className='whitespace-nowrap'>
              {formatDate(story.publishedAt)}
              <span aria-hidden='true'> · </span>
              {story.readingMinutes} min read
            </span>
            {story.clapCount ? (
              <span
                className='inline-flex items-center gap-1'
                aria-label={`${story.clapCount} claps`}
              >
                <ClapIcon className='size-4' />
                {formatCount(story.clapCount)}
              </span>
            ) : null}
            {story.responseCount ? (
              <span
                className='inline-flex items-center gap-1'
                aria-label={`${story.responseCount} responses`}
              >
                <ResponseIcon className='size-4' />
                {story.responseCount}
              </span>
            ) : null}
            <BookmarkButton
              storyId={story.id}
              initial={story.bookmarked}
              className='-my-2 ml-auto'
            />
          </div>
        </div>
        {story.coverUrl ? (
          <Link
            to='/story/$slug'
            params={{ slug: story.slug }}
            tabIndex={-1}
            aria-hidden='true'
            className='block shrink-0'
          >
            <img
              src={coverThumb(story.coverUrl)}
              alt=''
              width={640}
              height={360}
              loading='lazy'
              decoding='async'
              className='aspect-square w-20 rounded-sm bg-tint object-cover sm:aspect-[3/2] sm:w-44'
            />
          </Link>
        ) : null}
      </div>
    </article>
  );
}

/** A small title-only link for sidebars. */
export function StoryMini({ story }: { story: StoryCardData }) {
  return (
    <div>
      <AuthorLine author={story.author} />
      <Link
        to='/story/$slug'
        params={{ slug: story.slug }}
        className='mt-1.5 block font-display text-[1.05rem] leading-snug font-medium hover:underline hover:decoration-1 hover:underline-offset-2'
      >
        {story.title}
      </Link>
      <p className='mt-1 text-[13px] text-muted-foreground'>
        {formatDate(story.publishedAt)}
      </p>
    </div>
  );
}

/** A compact card with the cover on top, used under a story. */
export function StoryTile({ story }: { story: StoryCardData }) {
  return (
    <article className='flex flex-col'>
      {story.coverUrl ? (
        <Link
          to='/story/$slug'
          params={{ slug: story.slug }}
          tabIndex={-1}
          aria-hidden='true'
          className='mb-3 block'
        >
          <img
            src={coverThumb(story.coverUrl)}
            alt=''
            width={640}
            height={360}
            loading='lazy'
            decoding='async'
            className='aspect-[16/9] w-full rounded-sm bg-tint object-cover'
          />
        </Link>
      ) : null}
      <AuthorLine author={story.author} />
      <Link
        to='/story/$slug'
        params={{ slug: story.slug }}
        className='mt-1.5 font-display text-[1.2rem] leading-snug font-medium text-balance hover:underline hover:decoration-1 hover:underline-offset-4'
      >
        {story.title}
      </Link>
      <p className='mt-1 line-clamp-2 font-serif text-[0.98rem] leading-snug text-muted-foreground'>
        {story.subtitle || story.description}
      </p>
      <div className='mt-2 flex items-center gap-3 text-[13px] text-muted-foreground'>
        <span>
          {story.readingMinutes} min read
        </span>
        {story.clapCount ? (
          <span className='inline-flex items-center gap-1'>
            <ClapIcon className='size-4' />
            {formatCount(story.clapCount)}
          </span>
        ) : null}
        <BookmarkButton storyId={story.id} initial={story.bookmarked} className='-my-2 ml-auto' />
      </div>
    </article>
  );
}
