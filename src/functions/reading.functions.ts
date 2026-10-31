import { createServerFn } from '@tanstack/react-start';
import { notFound } from '@tanstack/react-router';
import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  like,
  lt,
  ne,
  or,
  sql
} from 'drizzle-orm';
import { brand, getTopic, isTopicSlug } from '~/brand.config';
import { db } from '~/db';
import {
  bookmarks,
  claps,
  follows,
  highlights,
  profiles,
  responses,
  stories,
  storyTopics,
  topicFollows,
  user
} from '~/db/schema';
import { mostHighlighted, popularityScore, rankFeed } from '~/lib/feed-rank';
import { limits } from '~/lib/limits';
import {
  cardsById,
  engagementOrder,
  isPublished,
  personColumns,
  selectCards,
  topicsFor,
  type PersonCard,
  type StoryCard
} from '~/server/cards';
import { withViewer } from '~/server/middleware';
import { checkRateLimit, visitorKey } from '~/server/rate-limit';

const PAGE_SIZE = 10;
const CANDIDATES = 200;

const rankColumns = {
  id: stories.id,
  authorId: stories.authorId,
  published: stories.publishedAt,
  clapCount: stories.clapCount,
  responseCount: stories.responseCount,
  bookmarkCount: stories.bookmarkCount,
  highlightCount: stories.highlightCount,
  viewCount: stories.viewCount,
  readCount: stories.readCount
};

async function viewerAffinity(viewerId: string) {
  const [authors, topics, clapped, saved] = await Promise.all([
    db
      .select({ id: follows.followeeId })
      .from(follows)
      .where(eq(follows.followerId, viewerId)),
    db
      .select({ topic: topicFollows.topic })
      .from(topicFollows)
      .where(eq(topicFollows.userId, viewerId)),
    db
      .select({ id: claps.storyId })
      .from(claps)
      .where(eq(claps.userId, viewerId))
      .limit(100),
    db
      .select({ id: bookmarks.storyId })
      .from(bookmarks)
      .where(eq(bookmarks.userId, viewerId))
      .limit(100)
  ]);
  return {
    authors: new Set(authors.map((row) => row.id)),
    topics: new Set(topics.map((row) => row.topic)),
    seen: new Set([...clapped, ...saved].map((row) => row.id)),
    viewerId
  };
}

const staffPickCutoff = () =>
  new Date(Date.now() - limits.staffPickMinAccountAgeDays * 86_400_000);

/** Staff picks never include stories from new accounts. */
const staffPickWhere = () =>
  and(eq(stories.staffPick, true), lt(user.createdAt, staffPickCutoff()));

async function topicCounts() {
  return db
    .select({ topic: storyTopics.topic, value: count() })
    .from(storyTopics)
    .innerJoin(stories, eq(stories.id, storyTopics.storyId))
    .where(isPublished)
    .groupBy(storyTopics.topic);
}

export type HomeData = {
  tab: 'for-you' | 'following';
  topic: string | null;
  feed: StoryCard[];
  hasMore: boolean;
  staffPicks: StoryCard[];
  recommendedTopics: { slug: string; name: string; following: boolean }[];
  writers: (PersonCard & { following: boolean })[];
  followingAnything: boolean;
};

export const getHome = createServerFn({ method: 'GET' })
  .middleware([withViewer])
  .validator(
    (input: { tab?: string; topic?: string; page?: number }) => ({
      tab: input.tab === 'following' ? ('following' as const) : ('for-you' as const),
      topic: input.topic && isTopicSlug(input.topic) ? input.topic : null,
      page: Math.max(1, Math.min(Number(input.page) || 1, 50))
    })
  )
  .handler(async ({ data, context }): Promise<HomeData> => {
    const viewerId = context.viewer?.id ?? null;
    const affinity = viewerId
      ? await viewerAffinity(viewerId)
      : { authors: new Set<string>(), topics: new Set<string>() };
    const shown = data.page * PAGE_SIZE;
    const topicWhere = data.topic
      ? inArray(
          stories.id,
          db
            .select({ id: storyTopics.storyId })
            .from(storyTopics)
            .where(eq(storyTopics.topic, data.topic))
        )
      : undefined;

    let feed: StoryCard[];
    let hasMore: boolean;
    if (data.tab === 'following' && viewerId) {
      const where = and(
        topicWhere,
        or(
          inArray(
            stories.authorId,
            db
              .select({ id: follows.followeeId })
              .from(follows)
              .where(eq(follows.followerId, viewerId))
          ),
          inArray(
            stories.id,
            db
              .select({ id: storyTopics.storyId })
              .from(storyTopics)
              .innerJoin(
                topicFollows,
                eq(topicFollows.topic, storyTopics.topic)
              )
              .where(eq(topicFollows.userId, viewerId))
          )
        ),
        ne(stories.authorId, viewerId)
      );
      const rows = await selectCards({
        where,
        limit: shown + 1,
        viewerId
      });
      hasMore = rows.length > shown;
      feed = rows.slice(0, shown);
    } else {
      // Rank the most recent stories here and now: there is no feed table to
      // keep up to date, because the platform has no scheduled jobs.
      const rows = await db
        .select(rankColumns)
        .from(stories)
        .where(and(isPublished, topicWhere))
        .orderBy(desc(stories.publishedAt))
        .limit(CANDIDATES);
      const topics = await db
        .select({ storyId: storyTopics.storyId, topic: storyTopics.topic })
        .from(storyTopics)
        .innerJoin(stories, eq(stories.id, storyTopics.storyId))
        .where(isPublished);
      const topicsByStory = new Map<string, string[]>();
      for (const row of topics) {
        topicsByStory.set(row.storyId, [
          ...(topicsByStory.get(row.storyId) ?? []),
          row.topic
        ]);
      }
      const ranked = rankFeed(
        rows.map((row) => ({
          ...row,
          publishedAt: Math.floor((row.published?.getTime() ?? 0) / 1000),
          topics: topicsByStory.get(row.id) ?? []
        })),
        affinity,
        Math.floor(Date.now() / 1000)
      );
      hasMore = ranked.length > shown;
      feed = await cardsById(
        ranked.slice(0, shown).map((story) => story.id),
        viewerId
      );
    }

    const [staffPicks, counts, writers] = await Promise.all([
      selectCards({
        where: staffPickWhere(),
        limit: 4,
        viewerId
      }),
      topicCounts(),
      db
        .select(personColumns)
        .from(profiles)
        .innerJoin(user, eq(user.id, profiles.userId))
        .where(
          and(
            inArray(
              profiles.userId,
              db
                .select({ id: stories.authorId })
                .from(stories)
                .where(isPublished)
            ),
            viewerId ? ne(profiles.userId, viewerId) : undefined
          )
        )
        .orderBy(desc(profiles.followerCount))
        .limit(12)
    ]);
    const countBySlug = new Map(counts.map((row) => [row.topic, row.value]));
    return {
      tab: data.tab,
      topic: data.topic,
      feed,
      hasMore,
      staffPicks,
      recommendedTopics: brand.topics
        .map((topic) => ({
          slug: topic.slug,
          name: topic.name,
          following: affinity.topics.has(topic.slug),
          stories: countBySlug.get(topic.slug) ?? 0
        }))
        .sort((a, b) => Number(a.following) - Number(b.following) || b.stories - a.stories)
        .map(({ stories: _stories, ...topic }) => topic),
      writers: writers
        .map((writer) => ({
          ...writer,
          following: affinity.authors.has(writer.id)
        }))
        .filter((writer) => !writer.following)
        .slice(0, 3),
      followingAnything: affinity.authors.size + affinity.topics.size > 0
    };
  });

export type ResponseItem = {
  id: string;
  parentId: string | null;
  body: string;
  createdAt: string;
  edited: boolean;
  deleted: boolean;
  author: {
    id: string;
    name: string;
    username: string;
    avatarUrl: string | null;
  };
};

export const getStoryPage = createServerFn({ method: 'GET' })
  .middleware([withViewer])
  .validator((input: { slug: string }) => ({
    slug: String(input.slug).slice(0, 200)
  }))
  .handler(async ({ data, context }) => {
    const viewerId = context.viewer?.id ?? null;
    const [story] = await db
      .select({
        id: stories.id,
        authorId: stories.authorId,
        slug: stories.slug,
        title: stories.title,
        subtitle: stories.subtitle,
        description: stories.description,
        coverUrl: stories.coverUrl,
        coverAlt: stories.coverAlt,
        html: stories.html,
        wordCount: stories.wordCount,
        readingMinutes: stories.readingMinutes,
        publishedAt: stories.publishedAt,
        liveUpdatedAt: stories.liveUpdatedAt,
        staffPick: stories.staffPick,
        clapCount: stories.clapCount,
        responseCount: stories.responseCount,
        highlightCount: stories.highlightCount,
        authorName: user.name,
        authorUsername: profiles.username,
        authorBio: profiles.bio,
        authorAvatar: profiles.avatarUrl,
        authorFollowers: profiles.followerCount
      })
      .from(stories)
      .innerJoin(user, eq(user.id, stories.authorId))
      .innerJoin(profiles, eq(profiles.userId, stories.authorId))
      .where(and(eq(stories.slug, data.slug), isPublished))
      .limit(1);
    if (!story) throw notFound();

    const [topics, moreFromAuthor, responseRows, highlightRows, viewerState] =
      await Promise.all([
        topicsFor([story.id]).then((map) => map.get(story.id) ?? []),
        selectCards({
          where: and(eq(stories.authorId, story.authorId), ne(stories.id, story.id)),
          orderBy: engagementOrder,
          limit: 3,
          viewerId
        }),
        db
          .select({
            id: responses.id,
            parentId: responses.parentId,
            body: responses.body,
            createdAt: responses.createdAt,
            editedAt: responses.editedAt,
            deletedAt: responses.deletedAt,
            authorId: responses.authorId,
            authorName: user.name,
            authorUsername: profiles.username,
            authorAvatar: profiles.avatarUrl
          })
          .from(responses)
          .innerJoin(user, eq(user.id, responses.authorId))
          .innerJoin(profiles, eq(profiles.userId, responses.authorId))
          .where(eq(responses.storyId, story.id))
          .orderBy(asc(responses.createdAt))
          .limit(300),
        db
          .select({
            id: highlights.id,
            userId: highlights.userId,
            quote: highlights.quote,
            start: highlights.start,
            end: highlights.end
          })
          .from(highlights)
          .where(eq(highlights.storyId, story.id))
          .limit(500),
        viewerId
          ? Promise.all([
              db
                .select({ count: claps.count })
                .from(claps)
                .where(and(eq(claps.storyId, story.id), eq(claps.userId, viewerId)))
                .limit(1),
              db
                .select({ storyId: bookmarks.storyId })
                .from(bookmarks)
                .where(and(eq(bookmarks.storyId, story.id), eq(bookmarks.userId, viewerId)))
                .limit(1),
              db
                .select({ id: follows.followeeId })
                .from(follows)
                .where(and(eq(follows.followerId, viewerId), eq(follows.followeeId, story.authorId)))
                .limit(1)
            ])
          : Promise.resolve(null)
      ]);

    const related = topics.length
      ? await selectCards({
          where: and(
            ne(stories.authorId, story.authorId),
            inArray(
              stories.id,
              db
                .select({ id: storyTopics.storyId })
                .from(storyTopics)
                .where(inArray(storyTopics.topic, topics))
            )
          ),
          orderBy: engagementOrder,
          limit: 4,
          viewerId
        })
      : [];

    const top = mostHighlighted(highlightRows);
    const items: ResponseItem[] = responseRows.map((row) => ({
      id: row.id,
      parentId: row.parentId,
      body: row.deletedAt ? '' : row.body,
      createdAt: row.createdAt.toISOString(),
      edited: Boolean(row.editedAt),
      deleted: Boolean(row.deletedAt),
      author: {
        id: row.authorId,
        name: row.deletedAt ? 'Removed' : row.authorName,
        username: row.authorUsername,
        avatarUrl: row.deletedAt ? null : row.authorAvatar
      }
    }));

    return {
      story: {
        id: story.id,
        slug: story.slug!,
        title: story.title,
        subtitle: story.subtitle,
        description: story.description,
        coverUrl: story.coverUrl,
        coverAlt: story.coverAlt,
        html: story.html,
        wordCount: story.wordCount,
        readingMinutes: story.readingMinutes,
        publishedAt: (story.publishedAt ?? new Date(0)).toISOString(),
        updatedAt: (story.liveUpdatedAt ?? story.publishedAt ?? new Date(0)).toISOString(),
        staffPick: story.staffPick,
        clapCount: story.clapCount,
        responseCount: story.responseCount,
        topics
      },
      author: {
        id: story.authorId,
        name: story.authorName,
        username: story.authorUsername,
        bio: story.authorBio,
        avatarUrl: story.authorAvatar,
        followerCount: story.authorFollowers
      },
      responses: items,
      moreFromAuthor,
      related,
      topHighlight: top && top.count > 0
        ? { quote: top.highlight.quote, count: top.count }
        : null,
      viewerState: {
        claps: viewerState?.[0][0]?.count ?? 0,
        bookmarked: Boolean(viewerState?.[1][0]),
        followingAuthor: Boolean(viewerState?.[2][0]),
        isAuthor: viewerId === story.authorId,
        highlights: highlightRows
          .filter((row) => viewerId && row.userId === viewerId)
          .map((row) => ({ id: row.id, quote: row.quote }))
      }
    };
  });

export type StoryPageData = Awaited<ReturnType<typeof getStoryPage>>;

export const getAuthorPage = createServerFn({ method: 'GET' })
  .middleware([withViewer])
  .validator((input: { username: string; page?: number }) => ({
    username: String(input.username).toLowerCase().slice(0, 40),
    page: Math.max(1, Math.min(Number(input.page) || 1, 50))
  }))
  .handler(async ({ data, context }) => {
    const viewerId = context.viewer?.id ?? null;
    const [person] = await db
      .select({
        ...personColumns,
        followingCount: profiles.followingCount,
        joinedAt: user.createdAt
      })
      .from(profiles)
      .innerJoin(user, eq(user.id, profiles.userId))
      .where(eq(profiles.username, data.username))
      .limit(1);
    if (!person) throw notFound();
    const shown = data.page * PAGE_SIZE;
    const [cards, following, followerRows, followingRows, storyCount] =
      await Promise.all([
        selectCards({
          where: eq(stories.authorId, person.id),
          limit: shown + 1,
          viewerId
        }),
        viewerId
          ? db
              .select({ id: follows.followeeId })
              .from(follows)
              .where(and(eq(follows.followerId, viewerId), eq(follows.followeeId, person.id)))
              .limit(1)
          : Promise.resolve([]),
        db
          .select(personColumns)
          .from(follows)
          .innerJoin(profiles, eq(profiles.userId, follows.followerId))
          .innerJoin(user, eq(user.id, follows.followerId))
          .where(eq(follows.followeeId, person.id))
          .orderBy(desc(follows.createdAt))
          .limit(40),
        db
          .select(personColumns)
          .from(follows)
          .innerJoin(profiles, eq(profiles.userId, follows.followeeId))
          .innerJoin(user, eq(user.id, follows.followeeId))
          .where(eq(follows.followerId, person.id))
          .orderBy(desc(follows.createdAt))
          .limit(40),
        db
          .select({ value: count() })
          .from(stories)
          .where(and(isPublished, eq(stories.authorId, person.id)))
      ]);
    return {
      person: { ...person, joinedAt: person.joinedAt.toISOString() },
      stories: cards.slice(0, shown),
      hasMore: cards.length > shown,
      storyCount: storyCount[0]?.value ?? 0,
      following: following.length > 0,
      isSelf: viewerId === person.id,
      followers: followerRows,
      followingList: followingRows
    };
  });

export const getTopicPage = createServerFn({ method: 'GET' })
  .middleware([withViewer])
  .validator((input: { slug: string; sort?: string; page?: number }) => ({
    slug: String(input.slug),
    sort: input.sort === 'latest' ? ('latest' as const) : ('popular' as const),
    page: Math.max(1, Math.min(Number(input.page) || 1, 50))
  }))
  .handler(async ({ data, context }) => {
    const topic = getTopic(data.slug);
    if (!topic) throw notFound();
    const viewerId = context.viewer?.id ?? null;
    const inTopic = inArray(
      stories.id,
      db
        .select({ id: storyTopics.storyId })
        .from(storyTopics)
        .where(eq(storyTopics.topic, topic.slug))
    );
    const shown = data.page * PAGE_SIZE;
    let cards: StoryCard[];
    let hasMore: boolean;
    if (data.sort === 'latest') {
      const rows = await selectCards({ where: inTopic, limit: shown + 1, viewerId });
      hasMore = rows.length > shown;
      cards = rows.slice(0, shown);
    } else {
      const rows = await db
        .select(rankColumns)
        .from(stories)
        .where(and(isPublished, inTopic))
        .orderBy(desc(stories.publishedAt))
        .limit(CANDIDATES);
      const now = Math.floor(Date.now() / 1000);
      const ranked = rows
        .map((row) => ({
          ...row,
          publishedAt: Math.floor((row.published?.getTime() ?? 0) / 1000),
          topics: [] as string[]
        }))
        .sort((a, b) => popularityScore(b, now) - popularityScore(a, now));
      hasMore = ranked.length > shown;
      cards = await cardsById(
        ranked.slice(0, shown).map((story) => story.id),
        viewerId
      );
    }
    const [following, totals] = await Promise.all([
      viewerId
        ? db
            .select({ topic: topicFollows.topic })
            .from(topicFollows)
            .where(and(eq(topicFollows.userId, viewerId), eq(topicFollows.topic, topic.slug)))
            .limit(1)
        : Promise.resolve([]),
      Promise.all([
        db
          .select({ value: count() })
          .from(storyTopics)
          .innerJoin(stories, eq(stories.id, storyTopics.storyId))
          .where(and(eq(storyTopics.topic, topic.slug), isPublished)),
        db
          .select({ value: count() })
          .from(topicFollows)
          .where(eq(topicFollows.topic, topic.slug))
      ])
    ]);
    return {
      topic: { slug: topic.slug, name: topic.name, description: topic.description },
      sort: data.sort,
      stories: cards,
      hasMore,
      following: following.length > 0,
      storyCount: totals[0][0]?.value ?? 0,
      followerCount: totals[1][0]?.value ?? 0
    };
  });

export const getAllTopics = createServerFn({ method: 'GET' })
  .middleware([withViewer])
  .handler(async ({ context }) => {
    const [counts, followed] = await Promise.all([
      topicCounts(),
      context.viewer
        ? db
            .select({ topic: topicFollows.topic })
            .from(topicFollows)
            .where(eq(topicFollows.userId, context.viewer.id))
        : Promise.resolve([])
    ]);
    const byTopic = new Map(counts.map((row) => [row.topic, row.value]));
    const following = new Set(followed.map((row) => row.topic));
    return brand.topics.map((topic) => ({
      slug: topic.slug,
      name: topic.name,
      description: topic.description,
      storyCount: byTopic.get(topic.slug) ?? 0,
      following: following.has(topic.slug)
    }));
  });

const likeTerm = (term: string) =>
  `%${term.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;

export const search = createServerFn({ method: 'GET' })
  .middleware([withViewer])
  .validator((input: { q?: string }) => ({
    q: String(input.q ?? '').trim().slice(0, 120)
  }))
  .handler(async ({ data, context }) => {
    const empty = {
      q: data.q,
      rateLimited: false,
      stories: [] as StoryCard[],
      people: [] as PersonCard[],
      topics: [] as { slug: string; name: string; description: string }[]
    };
    if (data.q.length < 2) return empty;
    if (!(await checkRateLimit('search', context.viewer?.id ?? (await visitorKey())))) {
      return { ...empty, rateLimited: true };
    }
    const viewerId = context.viewer?.id ?? null;
    const terms = data.q.split(/\s+/).slice(0, 6);
    const each = (columns: Parameters<typeof like>[0][]) =>
      and(
        ...terms.map((term) =>
          or(
            ...columns.map(
              (column) => sql`${column} LIKE ${likeTerm(term)} ESCAPE '\\'`
            )
          )
        )
      );
    const phrase = likeTerm(data.q);
    const [storyRows, people] = await Promise.all([
      selectCards({
        where: each([stories.title, stories.subtitle, stories.description, stories.plainText]),
        // Title matches first, then the subtitle, then everything else.
        orderBy: [
          sql`CASE WHEN ${stories.title} LIKE ${phrase} ESCAPE '\\' THEN 0 WHEN ${stories.subtitle} LIKE ${phrase} ESCAPE '\\' THEN 1 WHEN ${stories.description} LIKE ${phrase} ESCAPE '\\' THEN 2 ELSE 3 END`,
          engagementOrder
        ],
        limit: 20,
        viewerId
      }),
      db
        .select(personColumns)
        .from(profiles)
        .innerJoin(user, eq(user.id, profiles.userId))
        .where(each([user.name, profiles.username, profiles.bio]))
        .orderBy(desc(profiles.followerCount))
        .limit(10)
    ]);
    const lowered = terms.map((term) => term.toLowerCase());
    return {
      q: data.q,
      rateLimited: false,
      stories: storyRows,
      people,
      topics: brand.topics
        .filter((topic) =>
          lowered.every((term) =>
            `${topic.name} ${topic.description}`.toLowerCase().includes(term)
          )
        )
        .map(({ slug, name, description }) => ({ slug, name, description }))
    };
  });

export const getLibrary = createServerFn({ method: 'GET' })
  .middleware([withViewer])
  .handler(async ({ context }) => {
    if (!context.viewer) throw new Error('Please sign in to do that.');
    const saved = await db
      .select({ id: bookmarks.storyId })
      .from(bookmarks)
      .where(eq(bookmarks.userId, context.viewer.id))
      .orderBy(desc(bookmarks.createdAt))
      .limit(90);
    return cardsById(
      saved.map((row) => row.id),
      context.viewer.id
    );
  });

export const siteMapEntries = createServerFn({ method: 'GET' }).handler(async () => {
  const [storyRows, authorRows] = await Promise.all([
    db
      .select({ slug: stories.slug, updatedAt: stories.liveUpdatedAt })
      .from(stories)
      .where(isPublished)
      .orderBy(desc(stories.publishedAt))
      .limit(5000),
    db
      .selectDistinct({ username: profiles.username })
      .from(profiles)
      .innerJoin(stories, eq(stories.authorId, profiles.userId))
      .where(isPublished)
      .limit(5000)
  ]);
  return { stories: storyRows, authors: authorRows };
});
