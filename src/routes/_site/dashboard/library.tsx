import { createFileRoute, Link } from '@tanstack/react-router';
import { StoryCard } from '~/components/story/story-card';
import { Button } from '~/components/ui/button';
import { getLibrary } from '~/functions/reading.functions';
import { seo } from '~/utils/seo';

export const Route = createFileRoute('/_site/dashboard/library')({
  loader: () => getLibrary(),
  head: () => seo({ title: 'Your reading list', noindex: true }),
  component: LibraryPage
});

function LibraryPage() {
  const stories = Route.useLoaderData();
  return (
    <>
      <h1 className='font-display text-4xl font-normal tracking-tight'>Reading list</h1>
      {stories.length ? (
        <div className='mt-4'>
          {stories.map((story) => (
            <StoryCard key={story.id} story={story} />
          ))}
        </div>
      ) : (
        <div className='py-14 text-center'>
          <p className='font-display text-2xl font-medium'>Nothing saved yet</p>
          <p className='mx-auto mt-1 max-w-sm font-serif text-lg text-muted-foreground'>
            Tap the bookmark on any story to keep it here for later.
          </p>
          <Button asChild variant='outline' className='mt-5 rounded-full'>
            <Link to='/'>Find something to read</Link>
          </Button>
        </div>
      )}
    </>
  );
}
