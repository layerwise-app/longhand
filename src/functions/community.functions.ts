import { createServerFn } from '@tanstack/react-start';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { isTopicSlug } from '~/brand.config';
import { db } from '~/db';
import {
  bookmarks,
  claps,
  follows,
  highlights,
  notifications,
  profiles,
  reports,
  responses,
  stories,
  storyStatsDaily,
  topicFollows,
  user
} from '~/db/schema';
import { limits, normalizeUsername, usernameError } from '~/lib/limits';
import { sendFollowerEmail, sendResponseEmail } from '~/server/mailer';
import {
  requireAdmin,
  requireProfile,
  requireUser,
  withViewer
} from '~/server/middleware';
import {
  checkRateLimit,
  enforceRateLimit,
  visitorKey
} from '~/server/rate-limit';

const today = () => new Date().toISOString().slice(0, 10);

async function publishedStory(id: string) {
  const [story] = await db
    .select({
      id: stories.id,
      authorId: stories.authorId,
      title: stories.title,
      slug: stories.slug,
      plainText: stories.plainText
    })
    .from(stories)
    .where(and(eq(stories.id, id), eq(stories.status, 'published')))
    .limit(1);
  if (!story) throw new Error('Story not found.');
  return story;
}

export const clapStory = createServerFn({ method: 'POST' })
  .middleware([requireProfile])
  .validator((input: { storyId: string; add: number }) => ({
    storyId: String(input.storyId),
    add: Math.max(1, Math.min(Math.floor(Number(input.add)) || 1, limits.clapsPerReader))
  }))
  .handler(async ({ data, context }) => {
    const viewerId = context.viewer.id;
    await enforceRateLimit('clap', viewerId);
    const story = await publishedStory(data.storyId);
    if (story.authorId === viewerId) {
      throw new Error('You can’t clap for your own story.');
    }
    const [existing] = await db
      .select({ count: claps.count })
      .from(claps)
      .where(and(eq(claps.storyId, story.id), eq(claps.userId, viewerId)))
      .limit(1);
    const before = existing?.count ?? 0;
    const after = Math.min(limits.clapsPerReader, before + data.add);
    const added = after - before;
    if (added > 0) {
      await db.batch([
        // The cap is enforced in SQL too, so two quick requests can't pass 50.
        db
          .insert(claps)
          .values({ storyId: story.id, userId: viewerId, count: after })
          .onConflictDoUpdate({
            target: [claps.storyId, claps.userId],
            set: {
              count: sql`min(${limits.clapsPerReader}, ${claps.count} + ${added})`,
              updatedAt: new Date()
            }
          }),
        db
          .update(stories)
          .set({
            clapCount: sql`(SELECT COALESCE(SUM(count), 0) FROM claps WHERE claps.story_id = ${story.id})`
          })
          .where(eq(stories.id, story.id)),
        db
          .insert(storyStatsDaily)
          .values({ storyId: story.id, day: today(), claps: added })
          .onConflictDoUpdate({
            target: [storyStatsDaily.storyId, storyStatsDaily.day],
            set: { claps: sql`${storyStatsDaily.claps} + ${added}` }
          }),
        ...(before === 0
          ? [
              db.insert(notifications).values({
                userId: story.authorId,
                actorId: viewerId,
                type: 'clap' as const,
                storyId: story.id
              })
            ]
          : [])
      ]);
    }
    const [row] = await db
      .select({ clapCount: stories.clapCount })
      .from(stories)
      .where(eq(stories.id, story.id))
      .limit(1);
    return { mine: after, total: row?.clapCount ?? 0 };
  });

export const toggleBookmark = createServerFn({ method: 'POST' })
  .middleware([requireProfile])
  .validator((input: { storyId: string; saved: boolean }) => ({
    storyId: String(input.storyId),
    saved: Boolean(input.saved)
  }))
  .handler(async ({ data, context }) => {
    await publishedStory(data.storyId);
    const viewerId = context.viewer.id;
    const recount = db
      .update(stories)
      .set({
        bookmarkCount: sql`(SELECT COUNT(*) FROM bookmarks WHERE bookmarks.story_id = ${data.storyId})`
      })
      .where(eq(stories.id, data.storyId));
    await db.batch([
      data.saved
        ? db
            .insert(bookmarks)
            .values({ userId: viewerId, storyId: data.storyId })
            .onConflictDoNothing()
        : db
            .delete(bookmarks)
            .where(
              and(eq(bookmarks.userId, viewerId), eq(bookmarks.storyId, data.storyId))
            ),
      recount
    ]);
    return { saved: data.saved };
  });

export const setFollow = createServerFn({ method: 'POST' })
  .middleware([requireProfile])
  .validator((input: { userId: string; following: boolean }) => ({
    userId: String(input.userId),
    following: Boolean(input.following)
  }))
  .handler(async ({ data, context }) => {
    const viewerId = context.viewer.id;
    await enforceRateLimit('follow', viewerId);
    if (data.userId === viewerId) throw new Error('You can’t follow yourself.');
    const [target] = await db
      .select({ id: profiles.userId })
      .from(profiles)
      .where(eq(profiles.userId, data.userId))
      .limit(1);
    if (!target) throw new Error('Writer not found.');
    const recounts = [
      db
        .update(profiles)
        .set({
          followerCount: sql`(SELECT COUNT(*) FROM follows WHERE follows.followee_id = ${data.userId})`
        })
        .where(eq(profiles.userId, data.userId)),
      db
        .update(profiles)
        .set({
          followingCount: sql`(SELECT COUNT(*) FROM follows WHERE follows.follower_id = ${viewerId})`
        })
        .where(eq(profiles.userId, viewerId))
    ] as const;
    if (!data.following) {
      await db.batch([
        db
          .delete(follows)
          .where(and(eq(follows.followerId, viewerId), eq(follows.followeeId, data.userId))),
        ...recounts
      ]);
      return { following: false };
    }
    // A notification from an earlier follow means they've already been told once.
    const [earlier] = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, data.userId),
          eq(notifications.actorId, viewerId),
          eq(notifications.type, 'follow')
        )
      )
      .limit(1);
    await db.batch([
      db
        .insert(follows)
        .values({ followerId: viewerId, followeeId: data.userId })
        .onConflictDoNothing(),
      ...recounts,
      ...(earlier
        ? []
        : [
            db.insert(notifications).values({
              userId: data.userId,
              actorId: viewerId,
              type: 'follow' as const
            })
          ])
    ]);
    if (!earlier) {
      sendFollowerEmail({
        recipientId: data.userId,
        followerName: context.viewer.name,
        followerUsername: context.viewer.username
      });
    }
    return { following: true };
  });

export const setTopicFollow = createServerFn({ method: 'POST' })
  .middleware([requireProfile])
  .validator((input: { topic: string; following: boolean }) => ({
    topic: String(input.topic),
    following: Boolean(input.following)
  }))
  .handler(async ({ data, context }) => {
    if (!isTopicSlug(data.topic)) throw new Error('Topic not found.');
    await enforceRateLimit('follow', context.viewer.id);
    if (data.following) {
      await db
        .insert(topicFollows)
        .values({ userId: context.viewer.id, topic: data.topic })
        .onConflictDoNothing();
    } else {
      await db
        .delete(topicFollows)
        .where(
          and(eq(topicFollows.userId, context.viewer.id), eq(topicFollows.topic, data.topic))
        );
    }
    return { following: data.following };
  });

export const addResponse = createServerFn({ method: 'POST' })
  .middleware([requireProfile])
  .validator((input: { storyId: string; parentId?: string | null; body: string }) => ({
    storyId: String(input.storyId),
    parentId: input.parentId ? String(input.parentId) : null,
    body: String(input.body ?? '').trim().slice(0, limits.responseMax)
  }))
  .handler(async ({ data, context }) => {
    const viewerId = context.viewer.id;
    if (!data.body) throw new Error('Write something first.');
    await enforceRateLimit('respond', viewerId);
    const story = await publishedStory(data.storyId);
    let parentAuthorId: string | null = null;
    if (data.parentId) {
      const [parent] = await db
        .select({ authorId: responses.authorId })
        .from(responses)
        .where(
          and(
            eq(responses.id, data.parentId),
            eq(responses.storyId, story.id),
            isNull(responses.deletedAt)
          )
        )
        .limit(1);
      if (!parent) throw new Error('That response is gone.');
      parentAuthorId = parent.authorId;
    }
    const id = crypto.randomUUID();
    const now = new Date();
    const notifyAuthor = story.authorId !== viewerId;
    const notifyParent =
      parentAuthorId && parentAuthorId !== viewerId && parentAuthorId !== story.authorId;
    await db.batch([
      db.insert(responses).values({
        id,
        storyId: story.id,
        authorId: viewerId,
        parentId: data.parentId,
        body: data.body,
        createdAt: now
      }),
      db
        .update(stories)
        .set({ responseCount: sql`${stories.responseCount} + 1` })
        .where(eq(stories.id, story.id)),
      ...(notifyAuthor
        ? [
            db.insert(notifications).values({
              userId: story.authorId,
              actorId: viewerId,
              type: 'response' as const,
              storyId: story.id,
              responseId: id
            })
          ]
        : []),
      ...(notifyParent
        ? [
            db.insert(notifications).values({
              userId: parentAuthorId!,
              actorId: viewerId,
              type: 'reply' as const,
              storyId: story.id,
              responseId: id
            })
          ]
        : [])
    ]);
    const emailBase = {
      responderName: context.viewer.name,
      storyTitle: story.title,
      storySlug: story.slug!,
      body: data.body
    };
    if (notifyAuthor) {
      sendResponseEmail({
        ...emailBase,
        recipientId: story.authorId,
        isReply: parentAuthorId === story.authorId
      });
    }
    if (notifyParent) {
      sendResponseEmail({ ...emailBase, recipientId: parentAuthorId!, isReply: true });
    }
    return {
      id,
      parentId: data.parentId,
      body: data.body,
      createdAt: now.toISOString(),
      edited: false,
      deleted: false,
      author: {
        id: viewerId,
        name: context.viewer.name,
        username: context.viewer.username,
        avatarUrl: context.viewer.avatarUrl
      }
    };
  });

export const editResponse = createServerFn({ method: 'POST' })
  .middleware([requireProfile])
  .validator((input: { id: string; body: string }) => ({
    id: String(input.id),
    body: String(input.body ?? '').trim().slice(0, limits.responseMax)
  }))
  .handler(async ({ data, context }) => {
    if (!data.body) throw new Error('Write something first.');
    const [row] = await db
      .update(responses)
      .set({ body: data.body, editedAt: new Date() })
      .where(
        and(
          eq(responses.id, data.id),
          eq(responses.authorId, context.viewer.id),
          isNull(responses.deletedAt)
        )
      )
      .returning({ id: responses.id });
    if (!row) throw new Error('Response not found.');
    return { body: data.body };
  });

export const deleteResponse = createServerFn({ method: 'POST' })
  .middleware([requireProfile])
  .validator((input: { id: string }) => ({ id: String(input.id) }))
  .handler(async ({ data, context }) => {
    const [row] = await db
      .update(responses)
      .set({ deletedAt: new Date(), body: '' })
      .where(
        and(
          eq(responses.id, data.id),
          eq(responses.authorId, context.viewer.id),
          isNull(responses.deletedAt)
        )
      )
      .returning({ storyId: responses.storyId });
    if (!row) throw new Error('Response not found.');
    await db
      .update(stories)
      .set({ responseCount: sql`max(0, ${stories.responseCount} - 1)` })
      .where(eq(stories.id, row.storyId));
    return { ok: true };
  });

export const addHighlight = createServerFn({ method: 'POST' })
  .middleware([requireProfile])
  .validator((input: { storyId: string; quote: string }) => ({
    storyId: String(input.storyId),
    quote: String(input.quote ?? '').replace(/\s+/g, ' ').trim()
  }))
  .handler(async ({ data, context }) => {
    const viewerId = context.viewer.id;
    await enforceRateLimit('highlight', viewerId);
    if (data.quote.length < 3 || data.quote.length > limits.highlightMax) {
      throw new Error('Select a shorter passage to highlight.');
    }
    const story = await publishedStory(data.storyId);
    // A highlight has to quote the story, so this can't store anything else.
    const start = story.plainText.indexOf(data.quote);
    if (start < 0) throw new Error('Select text within a single paragraph.');
    const end = start + data.quote.length;
    const [existing] = await db
      .select({ id: highlights.id })
      .from(highlights)
      .where(
        and(
          eq(highlights.storyId, story.id),
          eq(highlights.userId, viewerId),
          eq(highlights.start, start),
          eq(highlights.end, end)
        )
      )
      .limit(1);
    if (existing) return { id: existing.id, quote: data.quote };
    const id = crypto.randomUUID();
    const [earlierNotice] = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, story.authorId),
          eq(notifications.actorId, viewerId),
          eq(notifications.type, 'highlight'),
          eq(notifications.storyId, story.id)
        )
      )
      .limit(1);
    await db.batch([
      db.insert(highlights).values({
        id,
        storyId: story.id,
        userId: viewerId,
        quote: data.quote,
        start,
        end
      }),
      db
        .update(stories)
        .set({ highlightCount: sql`${stories.highlightCount} + 1` })
        .where(eq(stories.id, story.id)),
      ...(story.authorId !== viewerId && !earlierNotice
        ? [
            db.insert(notifications).values({
              userId: story.authorId,
              actorId: viewerId,
              type: 'highlight' as const,
              storyId: story.id
            })
          ]
        : [])
    ]);
    return { id, quote: data.quote };
  });

export const removeHighlight = createServerFn({ method: 'POST' })
  .middleware([requireProfile])
  .validator((input: { id: string }) => ({ id: String(input.id) }))
  .handler(async ({ data, context }) => {
    const [row] = await db
      .delete(highlights)
      .where(and(eq(highlights.id, data.id), eq(highlights.userId, context.viewer.id)))
      .returning({ storyId: highlights.storyId });
    if (!row) throw new Error('Highlight not found.');
    await db
      .update(stories)
      .set({ highlightCount: sql`max(0, ${stories.highlightCount} - 1)` })
      .where(eq(stories.id, row.storyId));
    return { ok: true };
  });

export const reportReasons = [
  'Spam or advertising',
  'Harassment or hate',
  'Sexual content',
  'Violence or threats',
  'Stolen or plagiarized writing',
  'Something else'
] as const;

export const reportContent = createServerFn({ method: 'POST' })
  .middleware([withViewer])
  .validator(
    (input: {
      targetType: 'story' | 'response' | 'user';
      targetId: string;
      reason: string;
      details?: string;
    }) => ({
      targetType: (['story', 'response', 'user'] as const).includes(input.targetType)
        ? input.targetType
        : ('story' as const),
      targetId: String(input.targetId).slice(0, 200),
      reason: reportReasons.includes(input.reason as (typeof reportReasons)[number])
        ? input.reason
        : 'Something else',
      details: String(input.details ?? '').trim().slice(0, limits.reportDetailsMax)
    })
  )
  .handler(async ({ data, context }) => {
    const subject = context.viewer?.id ?? (await visitorKey());
    await enforceRateLimit('report', subject);
    await db.insert(reports).values({
      reporterId: context.viewer?.id ?? null,
      targetType: data.targetType,
      targetId: data.targetId,
      reason: data.reason,
      details: data.details
    });
    return { ok: true };
  });

export const listReports = createServerFn({ method: 'GET' })
  .middleware([requireAdmin])
  .handler(async () => {
    const rows = await db
      .select({
        id: reports.id,
        targetType: reports.targetType,
        targetId: reports.targetId,
        reason: reports.reason,
        details: reports.details,
        status: reports.status,
        createdAt: reports.createdAt
      })
      .from(reports)
      .orderBy(desc(reports.createdAt))
      .limit(100);
    const storyIds = rows.filter((row) => row.targetType === 'story').map((row) => row.targetId);
    const responseIds = rows.filter((row) => row.targetType === 'response').map((row) => row.targetId);
    const [storyRows, responseRows] = await Promise.all([
      storyIds.length
        ? db
            .select({ id: stories.id, title: stories.title, slug: stories.slug })
            .from(stories)
            .where(inArray(stories.id, storyIds))
        : Promise.resolve([]),
      responseIds.length
        ? db
            .select({ id: responses.id, body: responses.body, slug: stories.slug })
            .from(responses)
            .innerJoin(stories, eq(stories.id, responses.storyId))
            .where(inArray(responses.id, responseIds))
        : Promise.resolve([])
    ]);
    const titles = new Map(storyRows.map((row) => [row.id, row]));
    const bodies = new Map(responseRows.map((row) => [row.id, row]));
    return rows.map((row) => {
      const story = titles.get(row.targetId);
      const response = bodies.get(row.targetId);
      return {
        ...row,
        createdAt: row.createdAt.toISOString(),
        label: story?.title ?? response?.body.slice(0, 140) ?? row.targetId,
        slug: story?.slug ?? response?.slug ?? null
      };
    });
  });

export const setReportStatus = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator((input: { id: string; status: 'open' | 'resolved' | 'dismissed' }) => ({
    id: String(input.id),
    status: (['open', 'resolved', 'dismissed'] as const).includes(input.status)
      ? input.status
      : ('open' as const)
  }))
  .handler(async ({ data }) => {
    await db.update(reports).set({ status: data.status }).where(eq(reports.id, data.id));
    return { ok: true };
  });

export const getNotifications = createServerFn({ method: 'GET' })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const rows = await db
      .select({
        id: notifications.id,
        type: notifications.type,
        createdAt: notifications.createdAt,
        readAt: notifications.readAt,
        actorName: user.name,
        actorUsername: profiles.username,
        actorAvatar: profiles.avatarUrl,
        storyTitle: stories.title,
        storySlug: stories.slug,
        responseBody: responses.body
      })
      .from(notifications)
      .innerJoin(user, eq(user.id, notifications.actorId))
      .innerJoin(profiles, eq(profiles.userId, notifications.actorId))
      .leftJoin(stories, eq(stories.id, notifications.storyId))
      .leftJoin(responses, eq(responses.id, notifications.responseId))
      .where(eq(notifications.userId, context.viewer.id))
      .orderBy(desc(notifications.createdAt))
      .limit(60);
    return rows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
      unread: !row.readAt
    }));
  });

export const markNotificationsRead = createServerFn({ method: 'POST' })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(eq(notifications.userId, context.viewer.id), isNull(notifications.readAt))
      );
    return { ok: true };
  });

export const checkUsername = createServerFn({ method: 'GET' })
  .validator((input: { username: string }) => ({
    username: normalizeUsername(String(input.username))
  }))
  .handler(async ({ data }) => {
    if (!(await checkRateLimit('checkUsername', await visitorKey()))) {
      return { available: false, message: 'Slow down a little and try again.' };
    }
    const problem = usernameError(data.username);
    if (problem) return { available: false, message: problem };
    const [taken] = await db
      .select({ id: profiles.userId })
      .from(profiles)
      .where(eq(profiles.username, data.username))
      .limit(1);
    return {
      available: !taken,
      message: taken ? 'That username is taken.' : `@${data.username} is available.`
    };
  });

const avatarAllowed = (url: unknown, userId: string) =>
  typeof url === 'string' &&
  new RegExp(
    `^/media/avatars/${userId.replace(/[^a-zA-Z0-9_-]/g, '')}/[0-9a-f-]{36}\\.(jpg|png|webp|gif)$`
  ).test(url);

const uniqueError = (error: unknown) =>
  String((error as Error)?.message ?? '').includes('UNIQUE') ||
  String((error as { cause?: Error })?.cause?.message ?? '').includes('UNIQUE');

/** Finishes sign-up: everyone needs a unique username before doing anything public. */
export const completeProfile = createServerFn({ method: 'POST' })
  .middleware([requireUser])
  .validator((input: { name?: string; username: string; bio?: string }) => ({
    name: String(input.name ?? '').replace(/\s+/g, ' ').trim().slice(0, limits.nameMax),
    username: normalizeUsername(String(input.username)),
    bio: String(input.bio ?? '').trim().slice(0, limits.bioMax)
  }))
  .handler(async ({ data, context }) => {
    const problem = usernameError(data.username);
    if (problem) throw new Error(problem);
    if (context.viewer.username) throw new Error('Your profile is already set up.');
    try {
      await db.batch([
        db.insert(profiles).values({
          userId: context.viewer.id,
          username: data.username,
          bio: data.bio
        }),
        ...(data.name
          ? [db.update(user).set({ name: data.name }).where(eq(user.id, context.viewer.id))]
          : [])
      ]);
    } catch (error) {
      if (uniqueError(error)) throw new Error('That username is taken.');
      throw error;
    }
    return { username: data.username };
  });

export const updateProfile = createServerFn({ method: 'POST' })
  .middleware([requireProfile])
  .validator(
    (input: { name: string; username: string; bio: string; avatarUrl?: string | null }) => ({
      name: String(input.name ?? '').replace(/\s+/g, ' ').trim().slice(0, limits.nameMax),
      username: normalizeUsername(String(input.username)),
      bio: String(input.bio ?? '').trim().slice(0, limits.bioMax),
      avatarUrl: input.avatarUrl
    })
  )
  .handler(async ({ data, context }) => {
    if (!data.name) throw new Error('Add your name.');
    const problem = usernameError(data.username);
    if (problem) throw new Error(problem);
    if (data.avatarUrl && !avatarAllowed(data.avatarUrl, context.viewer.id)) {
      throw new Error('Upload that picture again.');
    }
    try {
      await db.batch([
        db
          .update(profiles)
          .set({
            username: data.username,
            bio: data.bio,
            ...(data.avatarUrl !== undefined ? { avatarUrl: data.avatarUrl } : {})
          })
          .where(eq(profiles.userId, context.viewer.id)),
        db.update(user).set({ name: data.name }).where(eq(user.id, context.viewer.id))
      ]);
    } catch (error) {
      if (uniqueError(error)) throw new Error('That username is taken.');
      throw error;
    }
    return { username: data.username };
  });

export const getSettings = createServerFn({ method: 'GET' })
  .middleware([requireProfile])
  .handler(async ({ context }) => {
    const [row] = await db
      .select({
        emailOnFollower: profiles.emailOnFollower,
        emailOnResponse: profiles.emailOnResponse
      })
      .from(profiles)
      .where(eq(profiles.userId, context.viewer.id))
      .limit(1);
    return row!;
  });

export const updateEmailSettings = createServerFn({ method: 'POST' })
  .middleware([requireProfile])
  .validator((input: { emailOnFollower?: boolean; emailOnResponse?: boolean }) => input)
  .handler(async ({ data, context }) => {
    await db
      .update(profiles)
      .set({
        ...(data.emailOnFollower !== undefined
          ? { emailOnFollower: Boolean(data.emailOnFollower) }
          : {}),
        ...(data.emailOnResponse !== undefined
          ? { emailOnResponse: Boolean(data.emailOnResponse) }
          : {})
      })
      .where(eq(profiles.userId, context.viewer.id));
    return { ok: true };
  });
