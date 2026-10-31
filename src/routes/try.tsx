import { createFileRoute, redirect } from '@tanstack/react-router';
import { ClientOnlyEditor, LazyTryEditor } from '~/components/editor/editor-loader';
import { seo } from '~/utils/seo';

export const Route = createFileRoute('/try')({
  beforeLoad: ({ context }) => {
    if (context.viewer?.username) {
      throw redirect({ to: '/dashboard/write/$id', params: { id: 'new' } });
    }
  },
  head: () => seo({ title: 'Try the editor', noindex: true }),
  component: TryPage
});

function TryPage() {
  return (
    <ClientOnlyEditor>
      <LazyTryEditor />
    </ClientOnlyEditor>
  );
}
