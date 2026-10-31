import { createFileRoute } from '@tanstack/react-router';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '~/db';
import { stories, storyStatsDaily } from '~/db/schema';
import { checkRateLimit, visitorKey } from '~/server/rate-limit';
import { loadViewer } from '~/server/viewer';

const BOTS = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|headless/i;

// Counts a view or a read for writer stats. It stores daily totals only: the
// visitor key is a salted hash used to count each visitor once per half hour.
export const Route = createFileRoute('/api/track')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const done = new Response(null, { status: 204 });
        if (BOTS.test(request.headers.get('user-agent') ?? '')) return done;
        const body = (await request.json().catch(() => null)) as {
          storyId?: unknown;
          event?: unknown;
        } | null;
        const storyId = typeof body?.storyId === 'string' ? body.storyId.slice(0, 200) : '';
        const event = body?.event;
        if (!storyId || (event !== 'view' && event !== 'read')) return done;

        const [story] = await db
          .select({ authorId: stories.authorId })
          .from(stories)
          .where(and(eq(stories.id, storyId), eq(stories.status, 'published')))
          .limit(1);
        if (!story) return done;
        // Writers reading their own work don't move their numbers.
        const viewer = await loadViewer();
        if (viewer?.id === story.authorId) return done;
        const subject = `${event}:${storyId}:${viewer?.id ?? (await visitorKey(request.headers))}`;
        if (!(await checkRateLimit('track', subject))) return done;

        const day = new Date().toISOString().slice(0, 10);
        const isView = event === 'view';
        await db.batch([
          db
            .insert(storyStatsDaily)
            .values({
              storyId,
              day,
              views: isView ? 1 : 0,
              reads: isView ? 0 : 1
            })
            .onConflictDoUpdate({
              target: [storyStatsDaily.storyId, storyStatsDaily.day],
              set: isView
                ? { views: sql`${storyStatsDaily.views} + 1` }
                : { reads: sql`${storyStatsDaily.reads} + 1` }
            }),
          db
            .update(stories)
            .set(
              isView
                ? { viewCount: sql`${stories.viewCount} + 1` }
                : { readCount: sql`${stories.readCount} + 1` }
            )
            .where(eq(stories.id, storyId))
        ]);
        return done;
      }
    }
  }
});
