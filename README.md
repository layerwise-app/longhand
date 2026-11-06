<a href="https://layerwise.app"><picture><source media="(prefers-color-scheme: dark)" srcset="https://layerwise.app/powered-by-dark.png"><img src="https://layerwise.app/powered-by.png" alt="Powered by Layerwise" width="174" height="28"></picture></a>

# Longhand

Longhand is a calm, reading-first publishing platform for essays, field notes,
and short fiction. It suits anyone who wants to run a home for long-form
writing, such as a writing community, a small magazine, or a team's essays,
without ads, streaks, or an endless scroll.

Visitors can read every story without an account, browse topics and writers,
and search the whole site. With an account they can write and publish in a
write-in-place editor, follow writers and topics, clap, respond, highlight
passages, and keep a reading list. It ships with 24 original stories by 8
fictional writers, so the site is full the first time it loads. See the live
demo at [longhand.layerwise.site](https://longhand.layerwise.site/).

Longhand was built with [Layerwise](https://layerwise.app), and you can open it
in Layerwise to make your own version.

It runs on TanStack Start, React, Tailwind CSS, and shadcn/ui, on Cloudflare
Workers with Layerwise Database, Authentication, Storage, and Email.

## Make it your own

**Start with [`src/brand.config.ts`](src/brand.config.ts).** The product name,
tagline, description, home page hero, footer note, colors for both themes, fonts,
and topics all live in that one file, and the rest of the app reads from it.
Comments in the file explain how to swap a font.

**Add a topic** by adding an entry to `topics` in `src/brand.config.ts` with a
`slug`, `name`, and `description`. Keep slugs stable once stories use them; names
and descriptions can change any time.

Other things you'll probably want to change:

- **Page copy:** the About, Guidelines, and Privacy pages are in
  `src/routes/_site/about.tsx`, `guidelines.tsx`, and `privacy.tsx`. The text of
  new follower and new response emails is in `src/server/mailer.ts`.
- **Footer:** `src/components/site/footer.tsx` holds the footer links and the
  Powered by Layerwise badge.
- **Logo and favicons:** `src/components/site/logo.tsx` holds the mark, and
  `pnpm art` redraws the favicons and share image from `scripts/art/generate.mjs`.
- **Seed content:** the stories are Markdown files in `scripts/seed/stories/`. See
  [Seed data](#seed-data) for how to add one, and read it before you change seed
  content on a live site.
- **Limits:** upload size, topics per story, claps per reader, and field lengths are
  in `src/lib/limits.ts`. Rate limits are in `src/server/rate-limit.ts`.
- **Feed ranking:** the scoring is in `src/lib/feed-rank.ts`, with tests beside it.
- **Search and sharing:** the site name, description, and share image come from
  `src/lib/site.ts`. When you connect a custom domain, set `site.url` there.

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
pnpm dev                                  # Local development (Layerwise runs this for you)
pnpm check-types                          # Type check
pnpm test                                 # Unit tests
pnpm build                                # Type check and production build
pnpm db:generate --name <migration_name>  # Generate a migration after a schema change
pnpm db:migrate                           # Apply migrations to the local database
pnpm seed:build                           # Rebuild the seed migration from scripts/seed/
pnpm art                                  # Redraw covers, figures, avatars, share image, and icons
pnpm cf-typegen                           # Regenerate Worker binding types after changing wrangler.jsonc
```

`pnpm art` renders in a headless Chromium through `playwright-core`. It uses
Playwright's Chromium by default; set `CHROME_PATH` or pass `--exe` to use another
browser, and `--only <name>` to redraw one piece. It isn't part of the build, and
its output is committed to `public/`.

## Seed data

The stories, people, claps, responses, and stats are inserted by one migration,
`drizzle/20261031174523_seed_content/`. Every count on the site is backed by real
rows, and dates are relative to when the migration runs. Seed accounts have no
password and never receive email.

**To add a seed story,** create `scripts/seed/stories/<slug>.md`. The file name is
the story's URL slug. Its front matter needs `title`, `subtitle`, `description`,
`author` (one of the writers defined at the top of `scripts/seed/build.mjs`),
`topics` (comma-separated topic slugs), `cover_alt`, `days_ago`, and
`top_highlight`, which must appear word for word in the story. Responses go after
a `===responses===` line, one `@writer: text` per line, indented for a reply. The cover is read from
`public/art/covers/<slug>.jpg`, with a `<slug>-sm.webp` thumbnail beside it: add a
drawing to `covers` in `scripts/art/generate.mjs` and run `pnpm art --only <slug>`,
or add both files yourself. Then run `pnpm seed:build`.

`pnpm seed:build` rewrites the seed migration in place, which is safe only until it
has run in production. After you've published, change content through the app, or
generate a new migration with `pnpm db:generate --custom --name <name>`.

## Important files

- `src/brand.config.ts`: name, copy, colors, fonts, and topics
- `src/routes/`: pages and server routes
- `src/functions/`: server functions, each with its own auth check
- `src/server/`: rate limits, the mailer, and shared server code
- `src/components/site/`: header, footer, logo, and sign-in layout
- `src/components/story/`: the reader and everything on the story page
- `src/components/editor/`: the editor, loaded only when someone writes
- `src/lib/story-doc.ts`: the document sanitizer and HTML renderer
- `src/db/schema.ts`: database tables
- `src/lib/site.ts` and `src/utils/seo.ts`: search and sharing

## Search and sharing

Every public page sets its title, description, and canonical URL with `seo()`. Stories
add Article structured data and use their cover as the share image. `/sitemap.xml`
lists published stories, authors, and topics. The editor, drafts, stats, and sign-in
pages are kept out of search.

The Worker stays small: there is no image renderer in it, and the editor only ships
to the browser when someone opens it.
