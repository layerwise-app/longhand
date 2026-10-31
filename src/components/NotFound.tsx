import { Link } from '@tanstack/react-router';
import { Button } from '~/components/ui/button';

export function NotFound({ children }: { children?: React.ReactNode }) {
  return (
    <div className='mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-6 py-16 text-center'>
      <h1 className='font-display text-4xl font-medium'>This page isn’t here</h1>
      <div className='mt-3 font-serif text-lg text-muted-foreground'>
        {children || (
          <p>It may have been unpublished, or the link may have a typo in it.</p>
        )}
      </div>
      <Button asChild className='mt-6 rounded-full'>
        <Link to='/'>Back to reading</Link>
      </Button>
    </div>
  );
}
