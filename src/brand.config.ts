// The one file to edit when you make this product your own: name, copy, colors,
// fonts, and topics. Everything else in the app reads from here.
//
// To change a font: `pnpm add @fontsource-variable/<font>`, swap the imports
// below, and update the matching family under `fonts`.
import '@fontsource-variable/newsreader/opsz.css';
import '@fontsource-variable/newsreader/opsz-italic.css';
import '@fontsource-variable/instrument-sans/wght.css';

export const brand = {
  name: 'Longhand',
  tagline: 'Good writing takes its time.',
  description:
    'Longhand is a quiet place to read essays and stories from people who care about their sentences, and to write your own.',
  hero: {
    title: 'Good writing takes its time.',
    body: 'Essays, field notes, and short fiction from people who care about their sentences. Read without an account. Write when you have something to say.'
  },
  /** Used by emails and the footer. */
  footerNote: 'A place for writing that takes its time.',

  /** Colors for each theme. Any CSS color works. */
  colors: {
    light: {
      paper: '#fbfaf7',
      surface: '#ffffff',
      tint: '#f2f0ea',
      ink: '#1d1c1a',
      muted: '#68655e',
      line: '#e4e1d9',
      accent: '#2438a6',
      accentInk: '#ffffff',
      marker: '#ffeb99',
      danger: '#b3261e'
    },
    dark: {
      paper: '#141518',
      surface: '#1b1c20',
      tint: '#24262b',
      ink: '#ecebe6',
      muted: '#a09e97',
      line: '#303238',
      accent: '#a3b3ff',
      accentInk: '#10152e',
      marker: '#6b5a14',
      danger: '#f2867e'
    }
  },

  /** Font stacks. The first family must match one of the imports above. */
  fonts: {
    display: "'Newsreader Variable', Georgia, 'Times New Roman', serif",
    body: "'Newsreader Variable', Georgia, 'Times New Roman', serif",
    ui: "'Instrument Sans Variable', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
    mono: "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace"
  },

  /**
   * Topics writers can tag stories with, and readers can follow. Keep slugs
   * stable once stories use them; names and descriptions can change any time.
   */
  topics: [
    {
      slug: 'writing',
      name: 'Writing',
      description: 'The craft of putting one sentence after another.'
    },
    {
      slug: 'technology',
      name: 'Technology',
      description: 'Software and systems, from the people who keep them up.'
    },
    {
      slug: 'science',
      name: 'Science',
      description: 'How the world works, explained by people who still find it strange.'
    },
    {
      slug: 'design',
      name: 'Design',
      description: 'Type, objects, and the decisions nobody notices until they go wrong.'
    },
    {
      slug: 'food',
      name: 'Food',
      description: 'What we cook, what we remember, and why butter matters.'
    },
    {
      slug: 'cities',
      name: 'Cities',
      description: 'Streets, buses, benches, and how people actually move through a place.'
    },
    {
      slug: 'nature',
      name: 'Nature',
      description: 'Tides, skies, and the world that keeps its own schedule.'
    },
    {
      slug: 'work',
      name: 'Work',
      description: 'What it is like to do a job well, or badly, for a long time.'
    },
    {
      slug: 'books',
      name: 'Books',
      description: 'Reading, rereading, and arguing about both.'
    },
    {
      slug: 'fiction',
      name: 'Fiction',
      description: 'Short stories, told plainly.'
    }
  ]
} as const;

export type Topic = (typeof brand.topics)[number];
export type TopicSlug = Topic['slug'];

const topicsBySlug = new Map<string, Topic>(
  brand.topics.map((topic) => [topic.slug, topic])
);

export const getTopic = (slug: string) => topicsBySlug.get(slug);
export const isTopicSlug = (slug: string): slug is TopicSlug =>
  topicsBySlug.has(slug);

/** The config as CSS variables; the root route adds this to the page head. */
export function brandCss() {
  const vars = (colors: Record<string, string>) =>
    Object.entries(colors)
      .map(
        ([name, value]) =>
          `--brand-${name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}:${value}`
      )
      .join(';');
  const fonts = Object.entries(brand.fonts)
    .map(([name, value]) => `--brand-font-${name}:${value}`)
    .join(';');
  return `:root{${vars(brand.colors.light)};${fonts}}.dark{${vars(brand.colors.dark)}}`;
}
