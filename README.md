# Longhand

<a href="https://layerwise.app"><img src="https://layerwise.app/powered-by.png" alt="Powered by Layerwise" width="320" /></a>

Longhand is a calm publishing platform: anyone can write stories, and readers
can follow writers and topics. It's a complete product you can make your own in
minutes. It ships with 24 original stories by 8 fictional writers, so the site
is full the first time it loads.

Built with TanStack Start, React, Tailwind CSS, and shadcn/ui, on Cloudflare
Workers with Layerwise Database, Authentication, Storage, and Email.

## Make it your own

**Edit [`src/brand.config.ts`](src/brand.config.ts).** The product name, tagline,
home page copy, colors for both themes, fonts, and topics all live in that one
file, and the rest of the app reads from it. Comments in the file explain how to
swap a font.

A few other things you'll probably want to change:

- **Logo and favicons:** `src/components/site/logo.tsx` holds the mark, and
  `pnpm art` redraws the favicons and share image from `scripts/art/generate.mjs`.
- **Seed content:** the stories are Markdown files in `scripts/seed/stories/`. To
  change them for a project that hasn't been published, edit the files and run
  `pnpm seed:build`. See [Seed data](#seed-data) before you do this on a live site.
- **Limits:** upload size, topic count, and field lengths are in `src/lib/limits.ts`.
  Rate limits are in `src/server/rate-limit.ts`.
- **Feed ranking:** the scoring is in `src/lib/feed-rank.ts`, with tests beside it.

## What's inside

**Reading.** A landing hero that gives way to the feed, with For you and Following
tabs, topic chips, staff picks, and recommended topics. Story pages have long-form
typography, a reading progress bar, more from the author, and related stories.
Author profiles, topic pages with popular and latest stories, and search across
stories, people, and topics. Everything is readable without an account.

**Writing.** A write-in-place editor with a floating toolbar, a plus menu for images,
code, dividers, and embeds, Markdown shortcuts, and autosave with a visible saved
state. A publish dialog with a cover, preview, description, and up to five topics.
Editing a published story works on a private copy until the writer presses Update.

**Community.** Claps from 1 to 50 per reader, threaded responses, highlights with a
shared top highlight, a reading list, follows for writers and topics, notifications,
and writer stats over 30 days.

**Safety.** All ownership checks run on the server. Story content is rebuilt from a
whitelist on the server (`src/lib/story-doc.ts`), so hostile markup can't get through
a crafted request. Sign-up, publishing, responses, claps, search, and more are rate
limited. Readers can report stories and responses. "Try the editor" (`/try`) saves
a draft in the browser only and carries it over at sign-up.

## Running the site

**Make yourself an admin.** Set your row's `role` to `admin` in the `user` table
from the Database page in Layerwise. Admins get two extra tools:

- **Reports** at `/dashboard/reports`, for reviewing what readers have flagged.
- **Staff picks**, from the `…` menu on any story. Stories by accounts younger than
  30 days never appear in the staff picks sidebar, even when picked.

**Email.** New follower and new response emails go through Layerwise Email, and each
one can be turned off in `/dashboard/settings`. Only verified addresses receive
them, so nobody can sign up with a stranger's address and send them mail. Writers
who skipped the code at sign-up can verify from their settings. Longhand has no
newsletters or digests, because Layerwise Email is for transactional mail only.

**Stats and privacy.** Views and reads are stored as daily totals per story. Visitors
are counted once per half hour using a salted hash that changes daily, and raw IP
addresses are never stored, including on sessions. The feed is computed at request
time, so there are no scheduled jobs to run.

**Images.** Uploads go to Layerwise Storage as JPG, PNG, WebP, or GIF, up to 8 MB.
The `/media/*` route serves them, so files stay private in Storage and only images
used by your stories and profiles are shown.

## Commands

```bash
pnpm dev                                  # Local development
pnpm check-types                          # Type check
pnpm test                                 # Unit tests
pnpm build                                # Production build
pnpm db:generate --name <migration_name>  # Generate a migration after a schema change
pnpm db:migrate                           # Apply migrations to the local database
pnpm seed:build                           # Rebuild the seed migration from scripts/seed/
pnpm art                                  # Redraw covers, figures, avatars, and icons
pnpm cf-typegen
pnpm release
```

`pnpm art` needs a local Chromium from Playwright. It isn't part of the build, and
its output is committed to `public/art/`.

## Seed data

The stories, people, claps, responses, and stats are inserted by one migration,
`drizzle/20261031174523_seed_content/`. Every count on the site is backed by real
rows, and dates are relative to when the migration runs. Seed accounts have no
password and never receive email.

`pnpm seed:build` rewrites that migration in place, which is safe only until it has
run in production. After you've published, change content through the app, or
generate a new migration with `pnpm db:generate --custom --name <name>`.

## Important files

- `src/brand.config.ts`: name, copy, colors, fonts, and topics
- `src/routes/`: pages and server routes
- `src/functions/`: server functions, each with its own auth check
- `src/server/`: rate limits, the mailer, and shared server code
- `src/components/story/`: the reader and everything on the story page
- `src/components/editor/`: the editor, loaded only when someone writes
- `src/lib/story-doc.ts`: the document sanitizer and HTML renderer
- `src/db/schema.ts`: database tables
- `src/lib/site.ts` and `src/utils/seo.ts`: search and sharing

## Search and sharing

Every public page sets its title, description, and canonical URL with `seo()`. Stories
add Article structured data and use their cover as the share image. `/sitemap.xml`
lists published stories, authors, and topics. The editor, drafts, stats, and sign-in
pages are kept out of search. When you connect a custom domain, set `site.url` in
`src/lib/site.ts`.

The Worker stays small: there is no image renderer in it, and the editor only ships
to the browser when someone opens it.
