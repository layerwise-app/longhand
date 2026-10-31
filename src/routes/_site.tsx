import { createFileRoute, Outlet, useMatches } from '@tanstack/react-router';
import { SiteFooter } from '~/components/site/footer';
import { SiteHeader } from '~/components/site/header';

export const Route = createFileRoute('/_site')({
  component: SiteLayout
});

function SiteLayout() {
  const onStory = useMatches({
    select: (matches) =>
      matches.some((match) => match.routeId === '/_site/story/$slug')
  });
  return (
    <div className='flex min-h-dvh flex-col'>
      <SiteHeader autoHide={onStory} />
      <main className='flex-1'>
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  );
}
