import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';

// The editor runs only in the browser. These imports are stripped from the server
// build, which keeps the published Worker small and the reading pages fast.
export const LazyDraftEditor = import.meta.env.SSR
  ? () => null
  : lazy(() => import('~/components/editor/draft-editor'));

export const LazyTryEditor = import.meta.env.SSR
  ? () => null
  : lazy(() => import('~/components/editor/try-editor'));

function EditorSkeleton() {
  return (
    <div className='mx-auto max-w-[42rem] px-5 pt-22 sm:pt-28' aria-busy='true' aria-label='Loading the editor'>
      <div className='h-12 w-2/3 rounded-md bg-tint' />
      <div className='mt-4 h-6 w-1/2 rounded-md bg-tint' />
      <div className='mt-10 h-5 w-full rounded-md bg-tint/70' />
      <div className='mt-3 h-5 w-5/6 rounded-md bg-tint/70' />
    </div>
  );
}

/** Waits until after hydration, so the server and first client render agree. */
export function ClientOnlyEditor({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <EditorSkeleton />;
  return <Suspense fallback={<EditorSkeleton />}>{children}</Suspense>;
}
