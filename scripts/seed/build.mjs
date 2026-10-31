// Turns `scripts/seed/stories/*.md` into the SQL of the seed migration, so a fresh
// database has a complete site on first load. Counts on the site are real: every
// clap, follower, and highlight below is an actual row from a fictional reader.
//
//   pnpm seed:build
//
// Only re-run this before the migration has been applied anywhere. After that,
// `drizzle-kit generate --custom` a new migration instead.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  countWords,
  docPlainText,
  readingMinutes,
  renderDocHtml,
  sanitizeDoc
} from '../../src/lib/story-doc.ts';

const here = dirname(fileURLToPath(import.meta.url));
const target = join(here, '../../drizzle/20261031174523_seed_content/migration.sql');

const authors = {
  wren: {
    name: 'Wren Halloway',
    bio: 'Builds small wooden boats in Port Alder. Has opinions about bronze screws and the moon.'
  },
  tomasz: {
    name: 'Tomasz Eberling',
    bio: 'Spent thirty years keeping other people’s databases alive. Now writes down what they were dying of.'
  },
  imani: {
    name: 'Imani Castellane',
    bio: 'Runs the early shift at Halfmoon in Larkin Falls. Writes about food between the second and third bake.'
  },
  dov: {
    name: 'Dov Achterberg',
    bio: 'Teaches high school physics in Ansel. Backyard astronomer. Owner of one very patient telescope.'
  },
  saffron: {
    name: 'Saffron Lund',
    bio: 'Independent type designer. Has drawn too many lowercase g’s and regrets none of them.'
  },
  juniper: {
    name: 'Juniper Okafor',
    bio: 'Transit planner in Calloway. In love with buses and resigned to public meetings.'
  },
  hollis: {
    name: 'Hollis Marchetti',
    bio: 'Night-shift nurse at St. Brigid’s. Writes short fiction on breaks, usually around four.'
  },
  ottoline: {
    name: 'Ottoline Vance',
    bio: 'Book editor for thirty years, now independent. Will ask you to cut your first paragraph.'
  }
};

const readerNames = [
  'Mara Ellison', 'Theo Brandvold', 'Nadia Farrow', 'Callum Reyes', 'Ines Whitlock',
  'Rafe Sandoval', 'Tovah Linden', 'Emeka Stroud', 'Greta Paley', 'Soren Ambrose',
  'Lucia Thorne', 'Mikkel Ashby', 'Yara Kessel', 'Desmond Ruiz', 'Anneke Morrow',
  'Pilar Winslow', 'Bram Oduya', 'Cleo Hartigan', 'Jonah Vesper', 'Maeve Calloway',
  'Otis Renner', 'Sunniva Hale', 'Tariq Bellamy', 'Odette Pryor', 'Felix Nakamura-Boyd',
  'Rosalind Teague', 'Amos Fairweather', 'Lena Castellano', 'Idris Colville', 'June Ostrander',
  'Marek Dunmore', 'Thea Lockhart', 'Ansel Whitford', 'Noor Hallam', 'Beckett Sorrell', 'Vera Quill'
];

const staffPicks = new Set([
  'why-your-paragraphs-feel-cramped',
  'the-lighthouse-keepers-invoice',
  'the-index-you-forgot-is-why-your-app-is-slow',
  'how-to-see-the-andromeda-galaxy-from-a-parking-lot',
  'cut-the-first-paragraph',
  'desire-paths-are-the-most-honest-urban-plan'
]);

// Repeatable random numbers, so rebuilding gives the same engagement.
function rng(seed) {
  let s = [...String(seed)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 11);
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const shuffled = (items, random) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

/** Typographer's quotes for everything except code spans. */
function smarten(text) {
  return text
    .split(/(`[^`]+`)/)
    .map((part) =>
      part.startsWith('`')
        ? part
        : part
            .replace(/(^|[\s([{\u2014\u2013*])"/g, '$1\u201C')
            .replace(/"/g, '\u201D')
            .replace(/(^|[\s([{\u2014\u2013*\u201C])'/g, '$1\u2018')
            .replace(/'/g, '\u2019')
    )
    .join('');
}

function parseInline(raw) {
  const text = smarten(raw);
  const nodes = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > last) {
      nodes.push({ type: 'text', text: text.slice(last, match.index) });
    }
    const token = match[0];
    if (token.startsWith('**')) {
      nodes.push({ type: 'text', text: token.slice(2, -2), marks: [{ type: 'bold' }] });
    } else if (token.startsWith('`')) {
      nodes.push({ type: 'text', text: token.slice(1, -1), marks: [{ type: 'code' }] });
    } else {
      nodes.push({ type: 'text', text: token.slice(1, -1), marks: [{ type: 'italic' }] });
    }
    last = match.index + token.length;
  }
  if (last < text.length) nodes.push({ type: 'text', text: text.slice(last) });
  return nodes;
}

const paragraph = (text) => ({ type: 'paragraph', content: parseInline(text) });

function parseBody(markdown) {
  const lines = markdown.split('\n');
  const blocks = [];
  for (let i = 0; i < lines.length; ) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
    } else if (line.startsWith('```')) {
      const language = line.slice(3).trim();
      const code = [];
      for (i++; i < lines.length && !lines[i].startsWith('```'); i++) code.push(lines[i]);
      i++;
      blocks.push({
        type: 'codeBlock',
        ...(language ? { attrs: { language } } : {}),
        content: [{ type: 'text', text: code.join('\n') }]
      });
    } else if (/^---+$/.test(line.trim())) {
      blocks.push({ type: 'horizontalRule' });
      i++;
    } else if (line.startsWith('### ')) {
      blocks.push({ type: 'heading', attrs: { level: 3 }, content: parseInline(line.slice(4)) });
      i++;
    } else if (line.startsWith('## ')) {
      blocks.push({ type: 'heading', attrs: { level: 2 }, content: parseInline(line.slice(3)) });
      i++;
    } else if (line.startsWith('> ')) {
      const quote = [];
      while (lines[i]?.startsWith('>')) {
        quote.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      blocks.push({
        type: 'blockquote',
        content: quote.join('\n').split(/\n\s*\n/).map((part) => paragraph(part.replace(/\n/g, ' ')))
      });
    } else if (/^- /.test(line) || /^\d+\. /.test(line)) {
      const ordered = !line.startsWith('- ');
      const items = [];
      const itemPattern = ordered ? /^\d+\. / : /^- /;
      while (lines[i] && itemPattern.test(lines[i])) {
        items.push({ type: 'listItem', content: [paragraph(lines[i].replace(itemPattern, ''))] });
        i++;
      }
      blocks.push({ type: ordered ? 'orderedList' : 'bulletList', content: items });
    } else if (line.startsWith('![')) {
      const match = line.match(/^!\[(.*)\]\(fig:([a-z-]+) "(.*)"\)$/);
      if (!match) throw new Error(`Bad figure: ${line}`);
      blocks.push({
        type: 'figure',
        attrs: { src: `/art/figures/${match[2]}.webp`, alt: smarten(match[1]), width: 1400, height: 800 },
        content: parseInline(match[3])
      });
      i++;
    } else if (line.startsWith('{{embed:')) {
      const match = line.match(/^\{\{embed:([^|]+)\|(.+)\}\}$/);
      if (!match) throw new Error(`Bad embed: ${line}`);
      blocks.push({ type: 'embed', attrs: { url: match[1], title: smarten(match[2]) } });
      i++;
    } else {
      const parts = [];
      while (
        lines[i]?.trim() &&
        !/^(```|#{2,3} |> |- |\d+\. |!\[|\{\{embed|---+$)/.test(lines[i])
      ) {
        parts.push(lines[i]);
        i++;
      }
      blocks.push(paragraph(parts.join(' ')));
    }
  }
  return { type: 'doc', content: blocks };
}

function parseStory(file, source) {
  const slug = file.replace(/\.md$/, '');
  const [, front, rest] = source.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  const meta = Object.fromEntries(
    front.split('\n').map((line) => {
      const at = line.indexOf(':');
      return [line.slice(0, at).trim(), smarten(line.slice(at + 1).trim())];
    })
  );
  const [body, responseBlock = ''] = rest.split('===responses===');
  const threads = [];
  for (const line of responseBlock.split('\n')) {
    const match = line.match(/^(\s*)@([a-z]+):\s*(.+)$/);
    if (!match) continue;
    const entry = { by: match[2], body: smarten(match[3]), replies: [] };
    if (match[1].length) threads.at(-1).replies.push(entry);
    else threads.push(entry);
  }
  const doc = sanitizeDoc(parseBody(body), { ownerId: null });
  const plainText = docPlainText(doc);
  const start = plainText.indexOf(meta.top_highlight);
  if (start < 0) throw new Error(`${slug}: top highlight not found in text`);
  if (!authors[meta.author]) throw new Error(`${slug}: unknown author ${meta.author}`);
  return {
    slug,
    doc,
    plainText,
    threads,
    title: meta.title,
    subtitle: meta.subtitle,
    description: meta.description,
    author: meta.author,
    topics: meta.topics.split(',').map((topic) => topic.trim()),
    coverAlt: meta.cover_alt,
    daysAgo: Number(meta.days_ago),
    quote: meta.top_highlight,
    quoteStart: start
  };
}

const sql = (value) => {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (typeof value === 'object' && value.raw) return value.raw;
  return `'${String(value).replace(/'/g, "''")}'`;
};
const raw = (expression) => ({ raw: expression });
const ago = (days, hours = 0) => raw(`unixepoch() - ${Math.round(days * 86400 + hours * 3600)}`);

const statements = [];
function insert(table, columns, rows, chunk = 100) {
  for (let i = 0; i < rows.length; i += chunk) {
    const values = rows
      .slice(i, i + chunk)
      .map((row) => `(${row.map(sql).join(', ')})`)
      .join(',\n');
    statements.push(`INSERT INTO ${table} (${columns.join(', ')}) VALUES\n${values};`);
  }
}

const storiesDir = join(here, 'stories');
const stories = readdirSync(storiesDir)
  .filter((file) => file.endsWith('.md'))
  .sort()
  .map((file) => parseStory(file, readFileSync(join(storiesDir, file), 'utf8')));

const uid = (name) => `seed_u_${name}`;
const authorNames = Object.keys(authors);
const readers = readerNames.map((name, index) => {
  const handle = name.toLowerCase().replace(/[^a-z]+/g, '_');
  return { key: handle, name, createdDays: 90 + ((index * 37) % 260) };
});
const everyone = [...authorNames, ...readers.map((reader) => reader.key)];

// People.
insert(
  '"user"',
  ['id', 'name', 'email', 'email_verified', 'created_at', 'updated_at', 'role'],
  [
    ...authorNames.map((key, index) => [
      uid(key), authors[key].name, `${key}@authors.longhand.example`, true,
      ago(500 + index * 21), ago(500 + index * 21), 'user'
    ]),
    ...readers.map((reader) => [
      uid(reader.key), reader.name, `${reader.key}@readers.longhand.example`, true,
      ago(reader.createdDays), ago(reader.createdDays), 'user'
    ])
  ]
);

// Follows.
const follows = new Set();
const followRandom = rng('follows');
for (const key of everyone) {
  const count = authors[key] ? 3 : 2 + Math.floor(followRandom() * 4);
  for (const other of shuffled(authorNames, followRandom).slice(0, count)) {
    if (other !== key) follows.add(`${key}|${other}`);
  }
}
const followerCount = (key) => [...follows].filter((f) => f.endsWith(`|${key}`)).length;
const followingCount = (key) => [...follows].filter((f) => f.startsWith(`${key}|`)).length;

insert(
  'profiles',
  ['user_id', 'username', 'bio', 'avatar_url', 'email_on_follower', 'email_on_response', 'is_seed', 'follower_count', 'following_count', 'created_at'],
  [
    ...authorNames.map((key, index) => [
      uid(key), key, authors[key].bio, `/art/avatars/${key}.webp`, false, false, true,
      followerCount(key), followingCount(key), ago(500 + index * 21)
    ]),
    ...readers.map((reader) => [
      uid(reader.key), reader.key.replace(/_/g, ''), 'Reader.', null, false, false, true,
      0, followingCount(reader.key), ago(reader.createdDays)
    ])
  ]
);
insert(
  'follows',
  ['follower_id', 'followee_id', 'created_at'],
  [...follows].map((pair, index) => {
    const [follower, followee] = pair.split('|');
    return [uid(follower), uid(followee), ago(20 + (index * 7) % 180)];
  })
);

const topicRandom = rng('topic-follows');
const allTopics = [...new Set(stories.flatMap((story) => story.topics))];
insert(
  'topic_follows',
  ['user_id', 'topic', 'created_at'],
  everyone.flatMap((key) =>
    shuffled(allTopics, topicRandom)
      .slice(0, 2 + Math.floor(topicRandom() * 3))
      .map((topic, index) => [uid(key), topic, ago(30 + index * 11)])
  )
);

// Stories and their engagement.
const responseRows = [];
const clapRows = [];
const bookmarkRows = [];
const highlightRows = [];
const statRows = [];
const topicRows = [];

stories.forEach((story) => {
  const random = rng(story.slug);
  const id = `seed_s_${story.slug.replace(/-/g, '_')}`;
  const pool = shuffled(everyone.filter((key) => key !== story.author), random);
  // Some stories catch on and most do not, and that shape should show.
  const reach = (staffPicks.has(story.slug) ? 0.55 : 0.18) + random() * 0.42;

  const clappers = pool.slice(0, Math.max(5, Math.round(pool.length * reach)));
  let clapTotal = 0;
  for (const key of clappers) {
    const count = Math.min(50, 1 + Math.floor(random() ** 2.4 * 50));
    clapTotal += count;
    clapRows.push([id, uid(key), count, ago(Math.max(0, story.daysAgo * random()))]);
  }

  const bookmarkers = shuffled(pool, random).slice(0, 2 + Math.floor(reach * 12 * random()));
  for (const key of bookmarkers) {
    bookmarkRows.push([uid(key), id, ago(Math.max(0, story.daysAgo * random()))]);
  }

  const highlighters = shuffled(pool, random).slice(0, 3 + Math.floor(reach * 16));
  for (const key of highlighters) {
    highlightRows.push([
      `seed_h_${randomId(random)}`, id, uid(key), story.quote,
      story.quoteStart, story.quoteStart + story.quote.length,
      ago(Math.max(0, story.daysAgo * random()))
    ]);
  }

  let responseCount = 0;
  story.threads.forEach((thread, threadIndex) => {
    const parentId = `seed_r_${randomId(random)}`;
    const parentAge = Math.max(0.2, story.daysAgo * (0.9 - threadIndex * 0.2));
    responseRows.push([parentId, id, uid(thread.by), null, thread.body, ago(parentAge)]);
    responseCount += 1;
    thread.replies.forEach((reply, replyIndex) => {
      responseRows.push([
        `seed_r_${randomId(random)}`, id, uid(reply.by), parentId, reply.body,
        ago(Math.max(0.1, parentAge - 0.2 - replyIndex * 0.3))
      ]);
      responseCount += 1;
    });
  });

  // Daily stats that add up to the story's totals, with the usual early spike.
  const days = story.daysAgo + 1;
  const weights = Array.from({ length: days }, (_, d) => 1 / (1 + d * 0.55) + random() * 0.04);
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const totalViews = Math.round(clappers.length * (22 + random() * 26));
  const readRatio = 0.34 + random() * 0.3;
  let views = 0;
  let reads = 0;
  let clapsLeft = clapTotal;
  weights.forEach((weight, d) => {
    const dayViews = Math.max(1, Math.round((totalViews * weight) / weightSum));
    const dayReads = Math.round(dayViews * (readRatio + (random() - 0.5) * 0.08));
    const dayClaps =
      d === days - 1 ? clapsLeft : Math.min(clapsLeft, Math.round((clapTotal * weight) / weightSum));
    clapsLeft -= dayClaps;
    views += dayViews;
    reads += dayReads;
    statRows.push([id, raw(`date('now', '-${story.daysAgo - d} days')`), dayViews, dayReads, dayClaps]);
  });

  for (const topic of story.topics) topicRows.push([id, topic]);

  statements.push(
    `INSERT INTO stories (id, author_id, slug, status, draft_title, draft_subtitle, draft_doc, revision, draft_updated_at, title, subtitle, description, cover_url, cover_alt, html, plain_text, word_count, reading_minutes, published_at, live_updated_at, staff_pick, clap_count, response_count, highlight_count, bookmark_count, view_count, read_count, created_at) VALUES (${[
      id, uid(story.author), story.slug, 'published', story.title, story.subtitle,
      JSON.stringify(story.doc), 1, ago(story.daysAgo, 2), story.title, story.subtitle,
      story.description, `/art/covers/${story.slug}.jpg`, story.coverAlt,
      renderDocHtml(story.doc), story.plainText, countWords(story.plainText),
      readingMinutes(story.doc), ago(story.daysAgo, 2), ago(story.daysAgo, 2),
      staffPicks.has(story.slug), clapTotal, responseCount, highlighters.length,
      bookmarkers.length, views, reads, ago(story.daysAgo + 1)
    ].map(sql).join(', ')});`
  );
});

function randomId(random) {
  return Math.floor(random() * 1e12).toString(36) + Math.floor(random() * 1e12).toString(36);
}

insert('story_topics', ['story_id', 'topic'], topicRows);
insert('claps', ['story_id', 'user_id', 'count', 'updated_at'], clapRows);
insert('bookmarks', ['user_id', 'story_id', 'created_at'], bookmarkRows);
insert('highlights', ['id', 'story_id', 'user_id', 'quote', 'start', '"end"', 'created_at'], highlightRows);
insert('responses', ['id', 'story_id', 'author_id', 'parent_id', 'body', 'created_at'], responseRows);
insert('story_stats_daily', ['story_id', 'day', 'views', 'reads', 'claps'], statRows);

const longest = Math.max(...statements.map((statement) => statement.length));
// D1 refuses a single statement over 100 KB.
if (longest > 95_000) throw new Error(`Statement too long: ${longest}`);

writeFileSync(target, `-- Generated by scripts/seed/build.mjs\n${statements.join('\n--> statement-breakpoint\n')}\n`);
console.log(
  `${stories.length} stories, ${everyone.length} people, ${clapRows.length} claps, ${responseRows.length} responses, ${statements.length} statements, longest ${longest} chars`
);
