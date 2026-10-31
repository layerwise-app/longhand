import { and, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import { db } from '~/db';
import { bookmarks, profiles, stories, storyTopics, user } from '~/db/schema';

export type StoryCard = {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  coverUrl: string | null;
  coverAlt: string;
  publishedAt: string;
  readingMinutes: number;
  clapCount: number;
  responseCount: number;
  topics: string[];
  bookmarked: boolean;
  author: {
    id: string;
    name: string;
    username: string;
    avatarUrl: string | null;
  };
};

const cardColumns = {
  id: stories.id,
  slug: stories.slug,
  title: stories.title,
  subtitle: stories.subtitle,
  description: stories.description,
  coverUrl: stories.coverUrl,
  coverAlt: stories.coverAlt,
  publishedAt: stories.publishedAt,
  readingMinutes: stories.readingMinutes,
  clapCount: stories.clapCount,
  responseCount: stories.responseCount,
  authorId: stories.authorId,
  authorName: user.name,
  authorUsername: profiles.username,
  authorAvatar: profiles.avatarUrl
};

export const isPublished = eq(stories.status, 'published');

export async function topicsFor(ids: string[]) {
  const map = new Map<string, string[]>();
  if (!ids.length) return map;
  const rows = await db
    .select({ storyId: storyTopics.storyId, topic: storyTopics.topic })
    .from(storyTopics)
    .where(inArray(storyTopics.storyId, ids));
  for (const row of rows) {
    map.set(row.storyId, [...(map.get(row.storyId) ?? []), row.topic]);
  }
  return map;
}

/** Published stories as cards, with topics and the viewer's bookmarks attached. */
export async function selectCards(options: {
  where?: SQL;
  orderBy?: SQL | SQL[];
  limit: number;
  offset?: number;
  viewerId?: string | null;
}): Promise<StoryCard[]> {
  const order = options.orderBy ?? desc(stories.publishedAt);
  const rows = await db
    .select(cardColumns)
    .from(stories)
    .innerJoin(user, eq(user.id, stories.authorId))
    .innerJoin(profiles, eq(profiles.userId, stories.authorId))
    .where(and(isPublished, options.where))
    .orderBy(...(Array.isArray(order) ? order : [order]))
    .limit(options.limit)
    .offset(options.offset ?? 0);
  return decorate(rows, options.viewerId);
}

/** Cards for known ids, in the order given. */
export async function cardsById(ids: string[], viewerId?: string | null) {
  if (!ids.length) return [];
  const cards = await selectCards({
    where: inArray(stories.id, ids),
    limit: ids.length,
    viewerId
  });
  const byId = new Map(cards.map((card) => [card.id, card]));
  return ids.flatMap((id) => byId.get(id) ?? []);
}

type CardRow = {
  [K in keyof typeof cardColumns]: unknown;
};

async function decorate(rows: CardRow[], viewerId?: string | null) {
  const typed = rows as Array<{
    id: string;
    slug: string | null;
    title: string;
    subtitle: string;
    description: string;
    coverUrl: string | null;
    coverAlt: string;
    publishedAt: Date | null;
    readingMinutes: number;
    clapCount: number;
    responseCount: number;
    authorId: string;
    authorName: string;
    authorUsername: string;
    authorAvatar: string | null;
  }>;
  const ids = typed.map((row) => row.id);
  const [topics, saved] = await Promise.all([
    topicsFor(ids),
    viewerId && ids.length
      ? db
          .select({ storyId: bookmarks.storyId })
          .from(bookmarks)
          .where(
            and(eq(bookmarks.userId, viewerId), inArray(bookmarks.storyId, ids))
          )
      : Promise.resolve([] as { storyId: string }[])
  ]);
  const savedIds = new Set(saved.map((row) => row.storyId));
  return typed.map(
    (row): StoryCard => ({
      id: row.id,
      slug: row.slug ?? row.id,
      title: row.title,
      subtitle: row.subtitle,
      description: row.description,
      coverUrl: row.coverUrl,
      coverAlt: row.coverAlt,
      publishedAt: (row.publishedAt ?? new Date(0)).toISOString(),
      readingMinutes: row.readingMinutes,
      clapCount: row.clapCount,
      responseCount: row.responseCount,
      topics: topics.get(row.id) ?? [],
      bookmarked: savedIds.has(row.id),
      author: {
        id: row.authorId,
        name: row.authorName,
        username: row.authorUsername,
        avatarUrl: row.authorAvatar
      }
    })
  );
}

export const engagementOrder = sql`(${stories.clapCount} + ${stories.responseCount} * 12 + ${stories.bookmarkCount} * 6) DESC`;

export type PersonCard = {
  id: string;
  name: string;
  username: string;
  bio: string;
  avatarUrl: string | null;
  followerCount: number;
};

export const personColumns = {
  id: profiles.userId,
  name: user.name,
  username: profiles.username,
  bio: profiles.bio,
  avatarUrl: profiles.avatarUrl,
  followerCount: profiles.followerCount
};
