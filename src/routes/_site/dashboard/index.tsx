import { useState } from 'react';
import { createFileRoute, Link, useRouter } from '@tanstack/react-router';
import { EllipsisIcon, SquarePenIcon } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '~/components/ui/alert-dialog';
import { Button } from '~/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '~/components/ui/dropdown-menu';
import {
  deleteStory,
  listMyStories,
  unpublishStory
} from '~/functions/stories.functions';
import { formatDate } from '~/lib/format';
import { coverThumb } from '~/lib/media';
import { cn } from '~/lib/utils';
import { seo } from '~/utils/seo';

export const Route = createFileRoute('/_site/dashboard/')({
  loader: () => listMyStories(),
  head: () => seo({ title: 'Your stories', noindex: true }),
  component: StoriesPage
});

type Row = Awaited<ReturnType<typeof listMyStories>>[number];

function StoriesPage() {
  const rows = Route.useLoaderData();
  const router = useRouter();
  const [tab, setTab] = useState<'draft' | 'published'>(
    rows.some((row) => row.status === 'draft') || !rows.length ? 'draft' : 'published'
  );
  const [deleting, setDeleting] = useState<Row | null>(null);
  const shown = rows.filter((row) => row.status === tab);
  const counts = {
    draft: rows.filter((row) => row.status === 'draft').length,
    published: rows.filter((row) => row.status === 'published').length
  };

  const unpublish = async (row: Row) => {
    try {
      await unpublishStory({ data: { id: row.id } });
      toast.success('Unpublished. It’s back in your drafts.');
      await router.invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'That didn’t work.');
    }
  };
  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await deleteStory({ data: { id: deleting.id } });
      toast.success('Story deleted.');
      await router.invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'That didn’t work.');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <>
      <div className='flex items-center justify-between gap-4'>
        <h1 className='font-display text-4xl font-normal tracking-tight'>Your stories</h1>
        <Button asChild className='rounded-full'>
          <Link to='/dashboard/write/$id' params={{ id: 'new' }} preload={false}>
            <SquarePenIcon className='size-4' /> Write
          </Link>
        </Button>
      </div>
      <div className='mt-5 flex gap-5' role='tablist'>
        {(['draft', 'published'] as const).map((key) => (
          <button
            key={key}
            type='button'
            role='tab'
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn(
              'text-sm',
              tab === key ? 'font-medium' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {key === 'draft' ? 'Drafts' : 'Published'} <span className='text-muted-foreground'>{counts[key]}</span>
          </button>
        ))}
      </div>
      <ul className='mt-3'>
        {shown.map((row) => {
          const title = row.draftTitle || row.title || 'Untitled story';
          return (
            <li key={row.id} className='flex items-start gap-4 border-b py-5 last:border-b-0'>
              <div className='min-w-0 flex-1'>
                <Link
                  to='/dashboard/write/$id'
                  params={{ id: row.id }}
                  className='font-display text-xl leading-snug font-medium hover:underline hover:decoration-1 hover:underline-offset-4'
                >
                  {title}
                </Link>
                {row.draftSubtitle ? (
                  <p className='mt-0.5 line-clamp-1 font-serif text-muted-foreground'>{row.draftSubtitle}</p>
                ) : null}
                <p className='mt-1.5 text-[13px] text-muted-foreground'>
                  {row.status === 'published' ? (
                    <>
                      Published {formatDate(row.publishedAt!)} · {row.readingMinutes} min read · {row.clapCount} claps · {row.responseCount} responses
                      {row.hasUnpublishedChanges ? (
                        <span className='text-foreground'> · Unpublished edits</span>
                      ) : null}
                    </>
                  ) : (
                    <>
                      Saved {formatDate(row.draftUpdatedAt)}
                      {row.publishedAt ? ' · Previously published' : ''}
                    </>
                  )}
                </p>
              </div>
              {row.coverUrl ? (
                <img
                  src={coverThumb(row.coverUrl)}
                  alt=''
                  loading='lazy'
                  className='hidden aspect-[3/2] w-24 rounded-sm bg-tint object-cover sm:block'
                />
              ) : null}
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label={`Actions for ${title}`}
                  className='inline-flex size-9 items-center justify-center rounded-full text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50'
                >
                  <EllipsisIcon className='size-5' />
                </DropdownMenuTrigger>
                <DropdownMenuContent align='end'>
                  <DropdownMenuItem asChild>
                    <Link to='/dashboard/write/$id' params={{ id: row.id }}>Edit</Link>
                  </DropdownMenuItem>
                  {row.status === 'published' ? (
                    <>
                      <DropdownMenuItem asChild>
                        <Link to='/story/$slug' params={{ slug: row.slug! }}>View story</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => unpublish(row)}>Unpublish</DropdownMenuItem>
                    </>
                  ) : null}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant='destructive' onSelect={() => setDeleting(row)}>
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          );
        })}
      </ul>
      {!shown.length ? (
        <div className='py-14 text-center'>
          <p className='font-display text-2xl font-medium'>
            {tab === 'draft' ? 'No drafts' : 'Nothing published yet'}
          </p>
          <p className='mx-auto mt-1 max-w-sm font-serif text-lg text-muted-foreground'>
            {tab === 'draft'
              ? 'Start one whenever you like. It saves as you type.'
              : 'When you publish a story, it will show up here.'}
          </p>
        </div>
      ) : null}
      <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this story?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting?.status === 'published'
                ? 'It will disappear for readers, along with its claps, responses, and highlights. This can’t be undone.'
                : 'This can’t be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className='rounded-full'>Keep it</AlertDialogCancel>
            <AlertDialogAction className='rounded-full bg-destructive text-white hover:bg-destructive/90' onClick={confirmDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
