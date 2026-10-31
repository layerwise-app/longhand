import { useEffect, useState } from 'react';
import { createFileRoute, redirect, useRouter } from '@tanstack/react-router';
import { Loader2Icon } from 'lucide-react';
import { ClientOnlyEditor, LazyDraftEditor } from '~/components/editor/editor-loader';
import { getDraft } from '~/functions/stories.functions';
import { useViewer } from '~/lib/viewer';
import { seo } from '~/utils/seo';

type WriteSearch = { import?: 'try' };

export const Route = createFileRoute('/dashboard_/write/$id')({
  validateSearch: (search: Record<string, unknown>): WriteSearch => ({
    import: search.import === 'try' ? 'try' : undefined
  }),
  beforeLoad: ({ context, location }) => {
    if (!context.viewer) {
      throw redirect({ to: '/sign-in', search: { redirect: location.href } });
    }
    if (!context.viewer.username) {
      throw redirect({ to: '/welcome', search: { redirect: location.href } });
    }
  },
  loader: ({ params }) =>
    params.id === 'new' ? null : getDraft({ data: { id: params.id } }),
  head: () => seo({ title: 'Write', noindex: true }),
  component: WritePage
});

function ImportTryDraft() {
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { importTryDraft } = await import('~/components/editor/try-draft');
        const id = await importTryDraft();
        if (cancelled) return;
        router.navigate({
          to: '/dashboard/write/$id',
          params: { id: id ?? 'new' },
          search: {},
          replace: true
        });
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);
  return (
    <div className='flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center'>
      {failed ? (
        <p className='max-w-sm font-serif text-lg'>
          We couldn’t move your draft over. It’s still safe in this browser. Reload the page to try again.
        </p>
      ) : (
        <>
          <Loader2Icon className='size-6 animate-spin text-primary' />
          <p className='font-serif text-lg'>Bringing your draft over…</p>
        </>
      )}
    </div>
  );
}

function WritePage() {
  const draft = Route.useLoaderData();
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const viewer = useViewer()!;
  if (id === 'new' && search.import === 'try') {
    return <ClientOnlyEditor><ImportTryDraft /></ClientOnlyEditor>;
  }
  return (
    <ClientOnlyEditor>
      <LazyDraftEditor key={id} draft={draft} viewer={viewer} />
    </ClientOnlyEditor>
  );
}
