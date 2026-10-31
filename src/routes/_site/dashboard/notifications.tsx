import { useEffect } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { UserAvatar } from '~/components/site/user-avatar';
import {
  getNotifications,
  markNotificationsRead
} from '~/functions/community.functions';
import { formatDate } from '~/lib/format';
import { cn } from '~/lib/utils';
import { seo } from '~/utils/seo';

export const Route = createFileRoute('/_site/dashboard/notifications')({
  loader: () => getNotifications(),
  head: () => seo({ title: 'Notifications', noindex: true }),
  component: NotificationsPage
});

type Item = Awaited<ReturnType<typeof getNotifications>>[number];

function describe(item: Item) {
  switch (item.type) {
    case 'follow':
      return 'started following you';
    case 'clap':
      return 'clapped for';
    case 'response':
      return 'responded to';
    case 'reply':
      return 'replied to your response on';
    case 'highlight':
      return 'highlighted a passage in';
  }
}

function NotificationsPage() {
  const items = Route.useLoaderData();
  const queryClient = useQueryClient();

  // Opening the page counts as reading it.
  useEffect(() => {
    if (!items.some((item) => item.unread)) return;
    void markNotificationsRead().then(() =>
      queryClient.invalidateQueries({ queryKey: ['viewer'] })
    );
  }, [items, queryClient]);

  return (
    <>
      <h1 className='font-display text-4xl font-normal tracking-tight'>Notifications</h1>
      {items.length ? (
        <ul className='mt-4'>
          {items.map((item) => (
            <li
              key={item.id}
              className={cn(
                'flex gap-3 border-b py-4 last:border-b-0',
                item.unread && '-mx-3 rounded-sm border-transparent bg-tint/70 px-3'
              )}
            >
              <Link to='/@{$username}' params={{ username: item.actorUsername }} tabIndex={-1} aria-hidden='true'>
                <UserAvatar name={item.actorName} src={item.actorAvatar} size={36} />
              </Link>
              <div className='min-w-0 flex-1 text-[15px] leading-snug'>
                <p>
                  <Link to='/@{$username}' params={{ username: item.actorUsername }} className='font-medium hover:underline'>
                    {item.actorName}
                  </Link>{' '}
                  {describe(item)}{' '}
                  {item.storySlug ? (
                    <Link
                      to='/story/$slug'
                      params={{ slug: item.storySlug }}
                      hash={item.type === 'response' || item.type === 'reply' ? 'responses' : undefined}
                      className='font-medium hover:underline'
                    >
                      {item.storyTitle}
                    </Link>
                  ) : null}
                </p>
                {item.responseBody ? (
                  <p className='mt-1 line-clamp-2 font-serif text-muted-foreground'>{item.responseBody}</p>
                ) : null}
                <p className='mt-1 text-[12px] text-muted-foreground'>{formatDate(item.createdAt)}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className='py-14 text-center'>
          <p className='font-display text-2xl font-medium'>All quiet</p>
          <p className='mx-auto mt-1 max-w-sm font-serif text-lg text-muted-foreground'>
            When someone follows you or responds to your work, you’ll hear about it here.
          </p>
        </div>
      )}
    </>
  );
}
