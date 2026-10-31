import {
  sqliteTable,
  text,
  integer,
  index,
  primaryKey,
  uniqueIndex
} from 'drizzle-orm/sqlite-core';
import type { StoryDoc } from '~/lib/story-doc';

// Better Auth tables. After adding an auth plugin, run
// `pnpm run auth:generate --yes`, copy only its new tables and columns from the
// generated `auth-schema.ts` into this section, then delete that file.

export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' })
    .notNull()
    .default(false),
  image: text('image'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  role: text('role'),
  banned: integer('banned', { mode: 'boolean' }).default(false),
  banReason: text('ban_reason'),
  banExpires: integer('ban_expires', { mode: 'timestamp' })
});

export const session = sqliteTable('session', {
  id: text('id').primaryKey(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  token: text('token').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  impersonatedBy: text('impersonated_by')
});

export const account = sqliteTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: integer('access_token_expires_at', {
    mode: 'timestamp'
  }),
  refreshTokenExpiresAt: integer('refresh_token_expires_at', {
    mode: 'timestamp'
  }),
  scope: text('scope'),
  password: text('password'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
});

export const verification = sqliteTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(
    () => new Date()
  ),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(
    () => new Date()
  )
});

// Longhand tables. Topics are not stored here: they live in `src/brand.config.ts`
// and rows refer to them by slug.

const createdAt = () =>
  integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date());

/** Public writer profile, one row per user who finished signing up. */
export const profiles = sqliteTable('profiles', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  username: text('username').notNull().unique(),
  bio: text('bio').notNull().default(''),
  /** `/media/avatars/…` for uploads, `/art/avatars/…` for seed authors. */
  avatarUrl: text('avatar_url'),
  emailOnFollower: integer('email_on_follower', { mode: 'boolean' })
    .notNull()
    .default(true),
  emailOnResponse: integer('email_on_response', { mode: 'boolean' })
    .notNull()
    .default(true),
  /** Fictional accounts from the seed. They have no inbox and are never emailed. */
  isSeed: integer('is_seed', { mode: 'boolean' }).notNull().default(false),
  followerCount: integer('follower_count').notNull().default(0),
  followingCount: integer('following_count').notNull().default(0),
  createdAt: createdAt()
});

export const stories = sqliteTable(
  'stories',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    authorId: text('author_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    /** Set on first publish and never changed, so links keep working. */
    slug: text('slug').unique(),
    status: text('status', { enum: ['draft', 'published'] })
      .notNull()
      .default('draft'),

    // The working copy. Autosave only touches these, so editing a published
    // story changes nothing for readers until it is published again.
    draftTitle: text('draft_title').notNull().default(''),
    draftSubtitle: text('draft_subtitle').notNull().default(''),
    draftDoc: text('draft_doc', { mode: 'json' }).$type<StoryDoc>().notNull(),
    revision: integer('revision').notNull().default(1),
    draftUpdatedAt: integer('draft_updated_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),

    // What readers see. Everything here was produced by the server's sanitizer.
    title: text('title').notNull().default(''),
    subtitle: text('subtitle').notNull().default(''),
    description: text('description').notNull().default(''),
    coverUrl: text('cover_url'),
    coverAlt: text('cover_alt').notNull().default(''),
    html: text('html').notNull().default(''),
    plainText: text('plain_text').notNull().default(''),
    wordCount: integer('word_count').notNull().default(0),
    readingMinutes: integer('reading_minutes').notNull().default(1),
    publishedAt: integer('published_at', { mode: 'timestamp' }),
    /** The last time the live copy changed. */
    liveUpdatedAt: integer('live_updated_at', { mode: 'timestamp' }),
    staffPick: integer('staff_pick', { mode: 'boolean' })
      .notNull()
      .default(false),

    clapCount: integer('clap_count').notNull().default(0),
    responseCount: integer('response_count').notNull().default(0),
    highlightCount: integer('highlight_count').notNull().default(0),
    bookmarkCount: integer('bookmark_count').notNull().default(0),
    viewCount: integer('view_count').notNull().default(0),
    readCount: integer('read_count').notNull().default(0),
    createdAt: createdAt()
  },
  (table) => [
    index('stories_status_published_idx').on(table.status, table.publishedAt),
    index('stories_author_status_idx').on(
      table.authorId,
      table.status,
      table.publishedAt
    ),
    index('stories_staff_pick_idx').on(table.staffPick, table.publishedAt)
  ]
);

export const storyTopics = sqliteTable(
  'story_topics',
  {
    storyId: text('story_id')
      .notNull()
      .references(() => stories.id, { onDelete: 'cascade' }),
    topic: text('topic').notNull()
  },
  (table) => [
    primaryKey({ columns: [table.storyId, table.topic] }),
    index('story_topics_topic_idx').on(table.topic, table.storyId)
  ]
);

export const claps = sqliteTable(
  'claps',
  {
    storyId: text('story_id')
      .notNull()
      .references(() => stories.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    count: integer('count').notNull().default(0),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date())
  },
  (table) => [
    primaryKey({ columns: [table.storyId, table.userId] }),
    index('claps_user_idx').on(table.userId)
  ]
);

export const responses = sqliteTable(
  'responses',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    storyId: text('story_id')
      .notNull()
      .references(() => stories.id, { onDelete: 'cascade' }),
    authorId: text('author_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    /** The response this one replies to; null at the top of a thread. */
    parentId: text('parent_id'),
    body: text('body').notNull(),
    createdAt: createdAt(),
    editedAt: integer('edited_at', { mode: 'timestamp' }),
    /** Removed responses stay as a placeholder when they have replies. */
    deletedAt: integer('deleted_at', { mode: 'timestamp' })
  },
  (table) => [
    index('responses_story_idx').on(table.storyId, table.createdAt),
    index('responses_parent_idx').on(table.parentId)
  ]
);

export const highlights = sqliteTable(
  'highlights',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    storyId: text('story_id')
      .notNull()
      .references(() => stories.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    quote: text('quote').notNull(),
    /** Offsets into the story's plain text, used to group overlapping highlights. */
    start: integer('start').notNull(),
    end: integer('end').notNull(),
    createdAt: createdAt()
  },
  (table) => [
    index('highlights_story_idx').on(table.storyId),
    uniqueIndex('highlights_unique_idx').on(
      table.storyId,
      table.userId,
      table.start,
      table.end
    )
  ]
);

export const bookmarks = sqliteTable(
  'bookmarks',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    storyId: text('story_id')
      .notNull()
      .references(() => stories.id, { onDelete: 'cascade' }),
    createdAt: createdAt()
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.storyId] }),
    index('bookmarks_user_idx').on(table.userId, table.createdAt)
  ]
);

export const follows = sqliteTable(
  'follows',
  {
    followerId: text('follower_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    followeeId: text('followee_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: createdAt()
  },
  (table) => [
    primaryKey({ columns: [table.followerId, table.followeeId] }),
    index('follows_followee_idx').on(table.followeeId, table.createdAt)
  ]
);

export const topicFollows = sqliteTable(
  'topic_follows',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    topic: text('topic').notNull(),
    createdAt: createdAt()
  },
  (table) => [primaryKey({ columns: [table.userId, table.topic] })]
);

export const notifications = sqliteTable(
  'notifications',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    actorId: text('actor_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    type: text('type', {
      enum: ['follow', 'response', 'reply', 'clap', 'highlight']
    }).notNull(),
    storyId: text('story_id').references(() => stories.id, {
      onDelete: 'cascade'
    }),
    responseId: text('response_id').references(() => responses.id, {
      onDelete: 'cascade'
    }),
    createdAt: createdAt(),
    readAt: integer('read_at', { mode: 'timestamp' })
  },
  (table) => [
    index('notifications_user_idx').on(table.userId, table.createdAt),
    index('notifications_actor_idx').on(table.actorId, table.type)
  ]
);

/** Daily totals for writer stats. No per-visitor data and no IP addresses. */
export const storyStatsDaily = sqliteTable(
  'story_stats_daily',
  {
    storyId: text('story_id')
      .notNull()
      .references(() => stories.id, { onDelete: 'cascade' }),
    /** UTC date, `YYYY-MM-DD`. */
    day: text('day').notNull(),
    views: integer('views').notNull().default(0),
    reads: integer('reads').notNull().default(0),
    claps: integer('claps').notNull().default(0)
  },
  (table) => [
    primaryKey({ columns: [table.storyId, table.day] }),
    index('story_stats_day_idx').on(table.day)
  ]
);

/** Fixed-window counters. Keys hold a salted hash for visitors, never an IP. */
export const rateLimits = sqliteTable(
  'rate_limits',
  {
    key: text('key').primaryKey(),
    count: integer('count').notNull().default(0),
    resetAt: integer('reset_at').notNull()
  },
  (table) => [index('rate_limits_reset_idx').on(table.resetAt)]
);

export const reports = sqliteTable(
  'reports',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    /** Null when the reader was signed out. */
    reporterId: text('reporter_id').references(() => user.id, {
      onDelete: 'set null'
    }),
    targetType: text('target_type', {
      enum: ['story', 'response', 'user']
    }).notNull(),
    targetId: text('target_id').notNull(),
    reason: text('reason').notNull(),
    details: text('details').notNull().default(''),
    status: text('status', { enum: ['open', 'resolved', 'dismissed'] })
      .notNull()
      .default('open'),
    createdAt: createdAt()
  },
  (table) => [index('reports_status_idx').on(table.status, table.createdAt)]
);
