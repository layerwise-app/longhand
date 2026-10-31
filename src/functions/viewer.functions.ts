import { createServerFn } from '@tanstack/react-start';
import { and, count, eq, isNull } from 'drizzle-orm';
import { db } from '~/db';
import { notifications } from '~/db/schema';
import { loadViewer } from '~/server/viewer';

/** The signed-in person and their unread count, for the header. */
export const getViewer = createServerFn({ method: 'GET' }).handler(async () => {
  const viewer = await loadViewer();
  if (!viewer) return null;
  const [unread] = await db
    .select({ value: count() })
    .from(notifications)
    .where(
      and(eq(notifications.userId, viewer.id), isNull(notifications.readAt))
    );
  return { ...viewer, unread: unread?.value ?? 0 };
});

export type ViewerWithUnread = NonNullable<
  Awaited<ReturnType<typeof getViewer>>
>;
