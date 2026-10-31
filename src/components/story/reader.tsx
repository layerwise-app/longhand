import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useRouter } from '@tanstack/react-router';
import {
  CheckIcon,
  FlagIcon,
  LinkIcon,
  MoreHorizontalIcon,
  PencilIcon,
  ShareIcon,
  StarIcon
} from 'lucide-react';
import { toast } from 'sonner';
import { getTopic } from '~/brand.config';
import { useAuthGate } from '~/components/site/auth-gate';
import { UserAvatar } from '~/components/site/user-avatar';
import { BookmarkButton, FollowButton } from '~/components/story/actions';
import { HighlightLayer } from '~/components/story/highlights';
import { ClapIcon, ResponseIcon } from '~/components/story/icons';
import { ReadingProgress } from '~/components/story/reading-progress';
import { ReportDialog } from '~/components/story/report-dialog';
import { Responses } from '~/components/story/responses';
import { StoryBody } from '~/components/story/story-body';
import { StoryTile } from '~/components/story/story-card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '~/components/ui/dropdown-menu';
import { clapStory } from '~/functions/community.functions';
import type { StoryPageData } from '~/functions/reading.functions';
import { setStaffPick } from '~/functions/stories.functions';
import { formatCount, formatDate, formatLongDate, plural } from '~/lib/format';
import { limits } from '~/lib/limits';
import { coverSrcSet } from '~/lib/media';
import { cn } from '~/lib/utils';
import { useViewer } from '~/lib/viewer';

/** Claps are counted locally as fast as you tap and sent in small batches. */
function useClaps(data: StoryPageData) {
  const [mine, setMine] = useState(data.viewerState.claps);
  const [total, setTotal] = useState(data.story.clapCount);
  const [burst, setBurst] = useState(0);
  const pending = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const gate = useAuthGate();
  const mineRef = useRef(mine);
  mineRef.current = mine;

  const flush = useCallback(async () => {
    const add = pending.current;
    if (!add) return;
    pending.current = 0;
    try {
      const result = await clapStory({ data: { storyId: data.story.id, add } });
      setMine(result.mine);
      setTotal(result.total);
    } catch (error) {
      setMine((value) => value - add);
      setTotal((value) => value - add);
      toast.error(error instanceof Error ? error.message : 'Your claps didn’t go through.');
    }
  }, [data.story.id]);

  useEffect(
    () => () => {
      clearTimeout(timer.current);
      void flush();
    },
    [flush]
  );

  const clap = useCallback(() => {
    if (!gate('clap for this story')) return;
    if (data.viewerState.isAuthor) {
      toast('You can’t clap for your own story, but it’s a good one.');
      return;
    }
    if (mineRef.current >= limits.clapsPerReader) return;
    pending.current += 1;
    mineRef.current += 1;
    setMine((value) => value + 1);
    setTotal((value) => value + 1);
    setBurst((value) => value + 1);
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 500);
  }, [data.viewerState.isAuthor, flush, gate]);

  return { mine, total, burst, clap };
}

type Claps = ReturnType<typeof useClaps>;

function ClapButton({ claps, size = 'md' }: { claps: Claps; size?: 'md' | 'lg' }) {
  const hold = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const stop = () => clearInterval(hold.current);
  useEffect(() => stop, []);
  const atMax = claps.mine >= limits.clapsPerReader;
  return (
    <div className='relative inline-flex items-center gap-1.5'>
      <button
        type='button'
        aria-label={
          claps.mine
            ? `Clap. You have clapped ${claps.mine} of ${limits.clapsPerReader} times`
            : 'Clap for this story'
        }
        onClick={(event) => {
          // A keyboard press has no pointer events, so it arrives here alone.
          if (event.detail === 0) claps.clap();
        }}
        onPointerDown={(event) => {
          if (event.pointerType === 'mouse' && event.button !== 0) return;
          claps.clap();
          stop();
          hold.current = setInterval(claps.clap, 160);
        }}
        onPointerUp={stop}
        onPointerLeave={stop}
        onPointerCancel={stop}
        onContextMenu={(event) => event.preventDefault()}
        style={{ touchAction: 'manipulation' }}
        className={cn(
          'inline-flex touch-none items-center justify-center rounded-full transition-colors select-none',
          size === 'lg'
            ? 'size-12 border hover:border-foreground'
            : 'size-9 hover:bg-tint',
          claps.mine ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <ClapIcon
          key={claps.burst}
          filled={claps.mine > 0}
          className={cn(claps.burst ? 'clap-pop' : '', size === 'lg' ? 'size-6' : 'size-[1.3rem]')}
        />
      </button>
      {claps.burst ? (
        <span
          key={claps.burst}
          aria-hidden='true'
          className='clap-float pointer-events-none absolute -top-5 left-1 rounded-full bg-foreground px-1.5 py-0.5 text-[11px] font-medium text-background tabular-nums opacity-0'
        >
          {atMax ? 'Max' : `+${claps.mine}`}
        </span>
      ) : null}
      <span className='text-[13px] text-muted-foreground tabular-nums'>
        {claps.total ? formatCount(claps.total) : ''}
      </span>
    </div>
  );
}

function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = window.location.href.split('#')[0]!;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        // Closing the share sheet isn't an error worth showing.
      }
      return;
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
    toast.success('Link copied.');
  };
  return (
    <button
      type='button'
      onClick={share}
      aria-label='Share this story'
      className='inline-flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground'
    >
      {copied ? <CheckIcon className='size-[1.15rem]' /> : <ShareIcon className='size-[1.15rem]' />}
    </button>
  );
}

function MoreMenu({ data }: { data: StoryPageData }) {
  const viewer = useViewer();
  const router = useRouter();
  const isAdmin = viewer?.role === 'admin';
  const toggleStaffPick = async () => {
    await setStaffPick({ data: { id: data.story.id, staffPick: !data.story.staffPick } });
    await router.invalidate();
    toast.success(data.story.staffPick ? 'Removed from staff picks.' : 'Added to staff picks.');
  };
  return (
    <ReportDialog
      targetType='story'
      targetId={data.story.id}
      trigger={(openReport) => (
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label='More actions'
            className='inline-flex size-9 items-center justify-center rounded-full text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50'
          >
            <MoreHorizontalIcon className='size-[1.15rem]' />
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end' className='w-48'>
            {data.viewerState.isAuthor ? (
              <DropdownMenuItem asChild>
                <Link to='/dashboard/write/$id' params={{ id: data.story.id }}>
                  <PencilIcon /> Edit story
                </Link>
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem
              onSelect={async () => {
                await navigator.clipboard.writeText(window.location.href.split('#')[0]!);
                toast.success('Link copied.');
              }}
            >
              <LinkIcon /> Copy link
            </DropdownMenuItem>
            {isAdmin ? (
              <DropdownMenuItem onSelect={toggleStaffPick}>
                <StarIcon /> {data.story.staffPick ? 'Remove staff pick' : 'Make staff pick'}
              </DropdownMenuItem>
            ) : null}
            {data.viewerState.isAuthor ? null : (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={openReport}>
                  <FlagIcon /> Report story
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    />
  );
}

function ActionBar({
  data,
  claps,
  responseCount
}: {
  data: StoryPageData;
  claps: Claps;
  responseCount: number;
}) {
  return (
    <div className='flex items-center gap-3'>
      <ClapButton claps={claps} />
      <a
        href='#responses'
        aria-label={plural(responseCount, 'response')}
        className='inline-flex items-center gap-1 text-[13px] text-muted-foreground tabular-nums hover:text-foreground'
      >
        <span className='inline-flex size-9 items-center justify-center'>
          <ResponseIcon className='size-[1.2rem]' />
        </span>
        <span className='-ml-1.5'>{responseCount || ''}</span>
      </a>
      <div className='ml-auto flex items-center gap-1'>
        <BookmarkButton storyId={data.story.id} initial={data.viewerState.bookmarked} />
        <ShareButton title={data.story.title} />
        <MoreMenu data={data} />
      </div>
    </div>
  );
}

/** A reading phone gets its actions back when it scrolls up, and not otherwise. */
function PhoneBar({
  data,
  claps,
  responseCount,
  articleRef
}: {
  data: StoryPageData;
  claps: Claps;
  responseCount: number;
  articleRef: React.RefObject<HTMLElement | null>;
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    let frame = 0;
    const update = () => {
      frame = 0;
      const y = window.scrollY;
      const article = articleRef.current;
      const inside =
        article &&
        y > article.offsetTop + 300 &&
        y + window.innerHeight < article.offsetTop + article.offsetHeight;
      if (Math.abs(y - last) > 6) {
        setVisible(Boolean(inside) && y < last);
        last = y;
      } else if (!inside) {
        setVisible(false);
      }
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, [articleRef]);
  return (
    <div
      aria-hidden={!visible}
      {...(visible ? {} : { inert: true })}
      className={cn(
        'fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-4 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm transition-transform duration-200 md:hidden',
        visible ? 'translate-y-0' : 'translate-y-full'
      )}
    >
      <ActionBar data={data} claps={claps} responseCount={responseCount} />
    </div>
  );
}

export function StoryReader({ data }: { data: StoryPageData }) {
  const { story, author } = data;
  const articleRef = useRef<HTMLElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const claps = useClaps(data);
  const [responseCount, setResponseCount] = useState(story.responseCount);
  const [composerSeed, setComposerSeed] = useState<{ text: string; at: number } | null>(null);
  const topics = useMemo(
    () => story.topics.flatMap((slug) => getTopic(slug) ?? []),
    [story.topics]
  );

  return (
    <>
      <ReadingProgress
        targetRef={articleRef}
        storyId={story.id}
        readingMinutes={story.readingMinutes}
      />
      {/* The gutter variable lets images run edge to edge on phones. */}
      <article ref={articleRef} style={{ ['--story-gutter' as string]: '1.25rem' }}>
        <header className='mx-auto max-w-[42rem] px-5 pt-8 sm:pt-14'>
          <h1 className='font-display text-[2.15rem] leading-[1.1] font-medium tracking-[-0.018em] text-balance sm:text-[3.05rem] sm:leading-[1.07]'>
            {story.title}
          </h1>
          {story.subtitle ? (
            <p className='mt-3 font-serif text-[1.3rem] leading-[1.32] text-pretty text-muted-foreground sm:text-[1.5rem]'>
              {story.subtitle}
            </p>
          ) : null}
          <div className='mt-6 flex items-center gap-3'>
            <Link to='/@{$username}' params={{ username: author.username }} tabIndex={-1} aria-hidden='true'>
              <UserAvatar name={author.name} src={author.avatarUrl} size={44} />
            </Link>
            <div className='min-w-0 flex-1 text-sm'>
              <div className='flex flex-wrap items-center gap-x-2'>
                <Link
                  to='/@{$username}'
                  params={{ username: author.username }}
                  rel='author'
                  className='font-medium hover:underline'
                >
                  {author.name}
                </Link>
              </div>
              <div className='text-[13px] text-muted-foreground'>
                <time dateTime={story.publishedAt} title={formatLongDate(story.publishedAt)}>
                  {formatDate(story.publishedAt)}
                </time>
                <span aria-hidden='true'> · </span>
                {story.readingMinutes} min read
              </div>
            </div>
            {data.viewerState.isAuthor ? null : (
              <FollowButton
                userId={author.id}
                name={author.name}
                initial={data.viewerState.followingAuthor}
              />
            )}
          </div>
          <div className='mt-5 border-y py-1'>
            <ActionBar data={data} claps={claps} responseCount={responseCount} />
          </div>
        </header>

        {story.coverUrl ? (
          <figure className='mx-auto mt-7 max-w-[54rem] sm:mt-9 sm:px-5'>
            <img
              src={story.coverUrl}
              srcSet={coverSrcSet(story.coverUrl)}
              sizes='(max-width: 864px) 100vw, 824px'
              alt={story.coverAlt}
              width={1600}
              height={900}
              fetchPriority='high'
              decoding='async'
              className='aspect-[16/9] w-full bg-tint object-cover sm:rounded-sm'
            />
          </figure>
        ) : null}

        <div className='mx-auto max-w-[42rem] px-5 pt-8 sm:pt-10'>
          <StoryBody ref={bodyRef} html={story.html} />
          <HighlightLayer
            bodyRef={bodyRef}
            storyId={story.id}
            top={data.topHighlight}
            mine={data.viewerState.highlights}
            onRespond={(quote) => {
              setComposerSeed({ text: `> ${quote}\n\n`, at: Date.now() });
              document.getElementById('responses')?.scrollIntoView({ behavior: 'smooth' });
            }}
          />

          {topics.length ? (
            <ul className='mt-9 flex flex-wrap gap-2' aria-label='Topics'>
              {topics.map((topic) => (
                <li key={topic.slug}>
                  <Link
                    to='/topics/$slug'
                    params={{ slug: topic.slug }}
                    search={{ sort: undefined }}
                    className='inline-block rounded-full bg-tint px-3.5 py-1.5 text-[13px] transition-colors hover:bg-border'
                  >
                    {topic.name}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}

          <div className='mt-7 py-1'>
            <ActionBar data={data} claps={claps} responseCount={responseCount} />
          </div>
        </div>
      </article>

      <PhoneBar data={data} claps={claps} responseCount={responseCount} articleRef={articleRef} />

      <div className='mt-8 border-t bg-tint/50'>
        <div className='mx-auto max-w-[42rem] px-5 py-9'>
          <div className='flex items-start gap-4'>
            <Link to='/@{$username}' params={{ username: author.username }} tabIndex={-1} aria-hidden='true'>
              <UserAvatar name={author.name} src={author.avatarUrl} size={64} />
            </Link>
            <div className='min-w-0 flex-1'>
              <p className='font-display text-2xl leading-tight font-medium'>
                <Link to='/@{$username}' params={{ username: author.username }} className='hover:underline hover:decoration-1 hover:underline-offset-4'>
                  Written by {author.name}
                </Link>
              </p>
              <p className='mt-0.5 text-[13px] text-muted-foreground'>{plural(author.followerCount, 'follower')}</p>
              {author.bio ? <p className='mt-2 font-serif text-[1.08rem] leading-snug'>{author.bio}</p> : null}
            </div>
            {data.viewerState.isAuthor ? null : (
              <FollowButton
                userId={author.id}
                name={author.name}
                initial={data.viewerState.followingAuthor}
              />
            )}
          </div>
        </div>
      </div>

      <div className='mx-auto max-w-[42rem] px-5'>
        <Responses
          storyId={story.id}
          authorId={author.id}
          initial={data.responses}
          seed={composerSeed}
          onCountChange={(delta) => setResponseCount((value) => value + delta)}
        />
      </div>

      {data.moreFromAuthor.length || data.related.length ? (
        <div className='border-t bg-tint/50'>
          <div className='mx-auto max-w-5xl space-y-12 px-5 py-12'>
            {data.moreFromAuthor.length ? (
              <section aria-labelledby='more-from-author'>
                <h2 id='more-from-author' className='font-display text-2xl font-medium'>
                  More from {author.name}
                </h2>
                <div className='mt-6 grid gap-8 sm:grid-cols-3'>
                  {data.moreFromAuthor.map((item) => (
                    <StoryTile key={item.id} story={item} />
                  ))}
                </div>
              </section>
            ) : null}
            {data.related.length ? (
              <section aria-labelledby='related-stories'>
                <h2 id='related-stories' className='font-display text-2xl font-medium'>
                  You might also like
                </h2>
                <div className='mt-6 grid gap-8 sm:grid-cols-2 lg:grid-cols-4'>
                  {data.related.map((item) => (
                    <StoryTile key={item.id} story={item} />
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
