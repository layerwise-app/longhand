import { createServerFn } from '@tanstack/react-start';
import { env } from 'cloudflare:workers';
import { and, desc, eq, sql } from 'drizzle-orm';
import { isTopicSlug } from '~/brand.config';
import { db } from '~/db';
import { highlights, stories, storyTopics } from '~/db/schema';
import { limits, imageLimitMessage } from '~/lib/limits';
import { getStorageErrorCode } from '~/lib/storage';
import {
  countWords,
  docPlainText,
  emptyDoc,
  excerptFrom,
  hasUsableBody,
  isAllowedImageSrc,
  readingMinutes,
  renderDocHtml,
  sanitizeDoc,
  slugify,
  type StoryDoc
} from '~/lib/story-doc';
import { topicsFor } from '~/server/cards';
import { requireAdmin, requireProfile } from '~/server/middleware';
import { enforceRateLimit } from '~/server/rate-limit';

const text = (value: unknown, max: number) =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';

function parseDoc(input: unknown, ownerId: string): StoryDoc {
  const doc = sanitizeDoc(input, { ownerId });
  if (JSON.stringify(doc).length > limits.docMaxChars) {
    throw new Error('This story is too long to save. Try splitting it in two.');
  }
  return doc;
}

async function ownedStory(id: string, viewerId: string) {
  const [story] = await db
    .select({
      id: stories.id,
      slug: stories.slug,
      status: stories.status,
      revision: stories.revision,
      draftTitle: stories.draftTitle,
      draftSubtitle: stories.draftSubtitle,
      draftDoc: stories.draftDoc,
      publishedAt: stories.publishedAt
    })
    .from(stories)
    .where(and(eq(stories.id, id), eq(stories.authorId, viewerId)))
    .limit(1);
  // The same message for missing and not-yours, so ids can't be probed.
  if (!story) throw new Error('Story not found.');
  return story;
}

export const createDraft = createServerFn({ method: 'POST' })
  .middleware([requireProfile])
  .validator((input: { title?: string; subtitle?: string; doc?: unknown }) => input)
  .handler(async ({ data, context }) => {
    await enforceRateLimit('createDraft', context.viewer.id);
    const [draft] = await db
      .insert(stories)
      .values({
        authorId: context.viewer.id,
        draftTitle: text(data.title, limits.titleMax),
        draftSubtitle: text(data.subtitle, limits.subtitleMax),
        draftDoc: data.doc ? parseDoc(data.doc, context.viewer.id) : emptyDoc()
      })
      .returning({ id: stories.id, revision: stories.revision });
    return draft!;
  });

export const getDraft = createServerFn({ method: 'GET' })
  .middleware([requireProfile])
  .validator((input: { id: string }) => ({ id: String(input.id) }))
  .handler(async ({ data, context }) => {
    const [story] = await db
      .select({
        id: stories.id,
        slug: stories.slug,
        status: stories.status,
        revision: stories.revision,
        draftTitle: stories.draftTitle,
        draftSubtitle: stories.draftSubtitle,
        draftDoc: stories.draftDoc,
        draftUpdatedAt: stories.draftUpdatedAt,
        title: stories.title,
        description: stories.description,
        coverUrl: stories.coverUrl,
        coverAlt: stories.coverAlt,
        liveUpdatedAt: stories.liveUpdatedAt
      })
      .from(stories)
      .where(and(eq(stories.id, data.id), eq(stories.authorId, context.viewer.id)))
      .limit(1);
    if (!story) throw new Error('Story not found.');
    const topics = (await topicsFor([story.id])).get(story.id) ?? [];
    return {
      ...story,
      topics,
      draftUpdatedAt: story.draftUpdatedAt.toISOString(),
      hasUnpublishedChanges:
        story.status === 'published' &&
        Boolean(story.liveUpdatedAt) &&
        story.draftUpdatedAt.getTime() > story.liveUpdatedAt!.getTime()
    };
  });

export type DraftData = Awaited<ReturnType<typeof getDraft>>;

export const saveDraft = createServerFn({ method: 'POST' })
  .middleware([requireProfile])
  .validator(
    (input: {
      id: string;
      baseRevision: number;
      title: string;
      subtitle: string;
      doc: unknown;
    }) => input
  )
  .handler(async ({ data, context }) => {
    await enforceRateLimit('saveDraft', context.viewer.id);
    const doc = parseDoc(data.doc, context.viewer.id);
    const nextRevision = Number(data.baseRevision) + 1;
    // Only saves from the revision on the server go through, so two open tabs
    // can't silently overwrite each other.
    const [saved] = await db
      .update(stories)
      .set({
        draftTitle: text(data.title, limits.titleMax),
        draftSubtitle: text(data.subtitle, limits.subtitleMax),
        draftDoc: doc,
        revision: nextRevision,
        draftUpdatedAt: new Date()
      })
      .where(
        and(
          eq(stories.id, String(data.id)),
          eq(stories.authorId, context.viewer.id),
          eq(stories.revision, Number(data.baseRevision))
        )
      )
      .returning({ revision: stories.revision, updatedAt: stories.draftUpdatedAt });
    if (saved) {
      return {
        ok: true as const,
        revision: saved.revision,
        savedAt: saved.updatedAt.toISOString()
      };
    }
    const current = await ownedStory(String(data.id), context.viewer.id);
    return { ok: false as const, revision: current.revision };
  });

export const publishStory = createServerFn({ method: 'POST' })
  .middleware([requireProfile])
  .validator(
    (input: {
      id: string;
      title: string;
      subtitle: string;
      description: string;
      coverUrl: string | null;
      coverAlt: string;
      topics: string[];
      doc: unknown;
    }) => input
  )
  .handler(async ({ data, context }) => {
    await enforceRateLimit('publish', context.viewer.id);
    const story = await ownedStory(String(data.id), context.viewer.id);
    const title = text(data.title, limits.titleMax);
    if (!title) throw new Error('Give your story a title first.');
    const doc = parseDoc(data.doc, context.viewer.id);
    if (!hasUsableBody(doc)) throw new Error('Write something before you publish.');
    const topics = [...new Set(data.topics ?? [])].filter(isTopicSlug);
    if (topics.length > limits.topicsMax) {
      throw new Error(`Choose up to ${limits.topicsMax} topics.`);
    }
    if (data.coverUrl && !isAllowedImageSrc(data.coverUrl, context.viewer.id)) {
      throw new Error('That cover image can’t be used. Upload it again.');
    }

    const plainText = docPlainText(doc);
    const now = new Date();
    const slug =
      story.slug ??
      `${slugify(title) || 'story'}-${crypto.randomUUID().slice(0, 6)}`;

    await db.batch([
      db
        .update(stories)
        .set({
          status: 'published',
          slug,
          draftTitle: title,
          draftSubtitle: text(data.subtitle, limits.subtitleMax),
          draftDoc: doc,
          revision: sql`${stories.revision} + 1`,
          draftUpdatedAt: now,
          title,
          subtitle: text(data.subtitle, limits.subtitleMax),
          description:
            text(data.description, limits.descriptionMax) ||
            excerptFrom(plainText),
          coverUrl: data.coverUrl || null,
          coverAlt: text(data.coverAlt, 300),
          html: renderDocHtml(doc),
          plainText,
          wordCount: countWords(plainText),
          readingMinutes: readingMinutes(doc),
          // Re-publishing after an unpublish keeps the original date.
          publishedAt: story.publishedAt ?? now,
          liveUpdatedAt: now
        })
        .where(and(eq(stories.id, story.id), eq(stories.authorId, context.viewer.id))),
      db.delete(storyTopics).where(eq(storyTopics.storyId, story.id)),
      ...(topics.length
        ? [
            db
              .insert(storyTopics)
              .values(topics.map((topic) => ({ storyId: story.id, topic })))
          ]
        : [])
    ]);

    // Edits can remove a passage someone highlighted. Keep the ones that still
    // exist, with offsets that match the new text.
    const saved = await db
      .select({
        id: highlights.id,
        quote: highlights.quote,
        start: highlights.start
      })
      .from(highlights)
      .where(eq(highlights.storyId, story.id));
    const updates = saved.flatMap((highlight) => {
      const start = plainText.indexOf(highlight.quote);
      if (start === highlight.start) return [];
      return [
        start < 0
          ? db.delete(highlights).where(eq(highlights.id, highlight.id))
          : db
              .update(highlights)
              .set({ start, end: start + highlight.quote.length })
              .where(eq(highlights.id, highlight.id))
      ];
    });
    if (updates.length) {
      await db.batch([
        ...updates,
        db
          .update(stories)
          .set({
            highlightCount: sql`(SELECT COUNT(*) FROM highlights WHERE highlights.story_id = ${story.id})`
          })
          .where(eq(stories.id, story.id))
      ] as unknown as Parameters<typeof db.batch>[0]);
    }
    return { slug };
  });

export const unpublishStory = createServerFn({ method: 'POST' })
  .middleware([requireProfile])
  .validator((input: { id: string }) => ({ id: String(input.id) }))
  .handler(async ({ data, context }) => {
    const [story] = await db
      .update(stories)
      .set({ status: 'draft' })
      .where(and(eq(stories.id, data.id), eq(stories.authorId, context.viewer.id)))
      .returning({ id: stories.id });
    if (!story) throw new Error('Story not found.');
    return { ok: true };
  });

export const deleteStory = createServerFn({ method: 'POST' })
  .middleware([requireProfile])
  .validator((input: { id: string }) => ({ id: String(input.id) }))
  .handler(async ({ data, context }) => {
    const [story] = await db
      .delete(stories)
      .where(and(eq(stories.id, data.id), eq(stories.authorId, context.viewer.id)))
      .returning({ id: stories.id });
    if (!story) throw new Error('Story not found.');
    return { ok: true };
  });

export const listMyStories = createServerFn({ method: 'GET' })
  .middleware([requireProfile])
  .handler(async ({ context }) => {
    const rows = await db
      .select({
        id: stories.id,
        slug: stories.slug,
        status: stories.status,
        draftTitle: stories.draftTitle,
        draftSubtitle: stories.draftSubtitle,
        title: stories.title,
        coverUrl: stories.coverUrl,
        readingMinutes: stories.readingMinutes,
        publishedAt: stories.publishedAt,
        draftUpdatedAt: stories.draftUpdatedAt,
        liveUpdatedAt: stories.liveUpdatedAt,
        clapCount: stories.clapCount,
        responseCount: stories.responseCount
      })
      .from(stories)
      .where(eq(stories.authorId, context.viewer.id))
      .orderBy(desc(stories.draftUpdatedAt))
      .limit(200);
    return rows.map((row) => ({
      ...row,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      draftUpdatedAt: row.draftUpdatedAt.toISOString(),
      hasUnpublishedChanges:
        row.status === 'published' &&
        Boolean(row.liveUpdatedAt) &&
        row.draftUpdatedAt.getTime() > row.liveUpdatedAt!.getTime()
    }));
  });

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif'
};

/** Identifies an image from its bytes. The browser's claimed type is not trusted. */
function sniffImage(bytes: Uint8Array): keyof typeof EXTENSIONS | null {
  const at = (...values: number[]) => values.every((value, i) => bytes[i] === value);
  if (at(0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (at(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png';
  if (at(0x47, 0x49, 0x46, 0x38)) return 'image/gif';
  if (
    at(0x52, 0x49, 0x46, 0x46) &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  )
    return 'image/webp';
  return null;
}

/** Stores an image and returns the site URL that serves it. */
export const uploadImage = createServerFn({ method: 'POST' })
  .middleware([requireProfile])
  .validator((data: FormData) => {
    const file = data.get('file');
    if (!(file instanceof File)) throw new Error('Choose an image.');
    return { file, kind: data.get('kind') === 'avatar' ? 'avatar' : 'story' };
  })
  .handler(async ({ data, context }) => {
    await enforceRateLimit('upload', context.viewer.id);
    if (data.file.size > limits.imageMaxBytes) throw new Error(imageLimitMessage);
    const bytes = new Uint8Array(await data.file.arrayBuffer());
    const type = sniffImage(bytes);
    if (!type) throw new Error(imageLimitMessage);
    const folder = data.kind === 'avatar' ? 'avatars' : 'uploads';
    const key = `${folder}/${context.viewer.id}/${crypto.randomUUID()}.${EXTENSIONS[type]}`;
    try {
      await env.STORAGE.put(key, bytes, { contentType: type as string });
    } catch (error) {
      const code = getStorageErrorCode(error);
      if (code === 'StorageQuotaExceeded') {
        throw new Error('Image storage is full right now. Please try again later.');
      }
      if (code === 'FileTooLarge') throw new Error('This image is too large.');
      if (code === 'BlockedContent') throw new Error('This image can’t be uploaded.');
      throw error;
    }
    return { url: `/media/${key}` };
  });

export const setStaffPick = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator((input: { id: string; staffPick: boolean }) => ({
    id: String(input.id),
    staffPick: Boolean(input.staffPick)
  }))
  .handler(async ({ data }) => {
    await db
      .update(stories)
      .set({ staffPick: data.staffPick })
      .where(eq(stories.id, data.id));
    return { ok: true };
  });
