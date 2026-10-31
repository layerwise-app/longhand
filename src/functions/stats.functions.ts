import { createServerFn } from '@tanstack/react-start';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { db } from '~/db';
import { stories, storyStatsDaily } from '~/db/schema';
import { requireProfile } from '~/server/middleware';

export const STATS_DAYS = 30;

export const getStats = createServerFn({ method: 'GET' })
  .middleware([requireProfile])
  .handler(async ({ context }) => {
    const days = Array.from({ length: STATS_DAYS }, (_, index) =>
      new Date(Date.now() - (STATS_DAYS - 1 - index) * 86_400_000)
        .toISOString()
        .slice(0, 10)
    );
    const [rows, perStory] = await Promise.all([
      db
        .select({
          storyId: storyStatsDaily.storyId,
          day: storyStatsDaily.day,
          views: storyStatsDaily.views,
          reads: storyStatsDaily.reads,
          claps: storyStatsDaily.claps
        })
        .from(storyStatsDaily)
        .innerJoin(stories, eq(stories.id, storyStatsDaily.storyId))
        .where(
          and(
            eq(stories.authorId, context.viewer.id),
            gte(storyStatsDaily.day, days[0]!)
          )
        ),
      db
        .select({
          id: stories.id,
          title: stories.title,
          draftTitle: stories.draftTitle,
          slug: stories.slug,
          status: stories.status,
          publishedAt: stories.publishedAt,
          views: sql<number>`COALESCE(SUM(${storyStatsDaily.views}), 0)`,
          reads: sql<number>`COALESCE(SUM(${storyStatsDaily.reads}), 0)`,
          claps: sql<number>`COALESCE(SUM(${storyStatsDaily.claps}), 0)`
        })
        .from(stories)
        .leftJoin(
          storyStatsDaily,
          and(
            eq(storyStatsDaily.storyId, stories.id),
            gte(storyStatsDaily.day, days[0]!)
          )
        )
        .where(
          and(
            eq(stories.authorId, context.viewer.id),
            sql`${stories.publishedAt} IS NOT NULL`
          )
        )
        .groupBy(stories.id)
        .orderBy(desc(stories.publishedAt))
        .limit(200)
    ]);
    return {
      days,
      rows,
      stories: perStory.map((story) => ({
        id: story.id,
        title: story.title || story.draftTitle || 'Untitled',
        slug: story.slug,
        live: story.status === 'published',
        publishedAt: story.publishedAt?.toISOString() ?? null,
        views: Number(story.views),
        reads: Number(story.reads),
        claps: Number(story.claps)
      }))
    };
  });
