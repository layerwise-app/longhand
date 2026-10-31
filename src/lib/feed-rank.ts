// The feed is ranked at request time because the platform has no scheduled
// jobs. Everything here is a pure function of the stories and the reader.

export type RankableStory = {
  id: string;
  authorId: string;
  topics: string[];
  publishedAt: number;
  clapCount: number;
  responseCount: number;
  bookmarkCount: number;
  highlightCount: number;
  viewCount: number;
  readCount: number;
};

export type Affinity = {
  authors: ReadonlySet<string>;
  topics: ReadonlySet<string>;
  /** Stories the reader has already clapped for or saved rank lower. */
  seen?: ReadonlySet<string>;
  viewerId?: string;
};

const HOUR_SECONDS = 3600;

export function engagementScore(story: RankableStory) {
  const readRatio = story.viewCount > 20 ? story.readCount / story.viewCount : 0.4;
  return (
    Math.log1p(story.clapCount) * 1 +
    Math.log1p(story.responseCount) * 2 +
    Math.log1p(story.bookmarkCount) * 1.5 +
    Math.log1p(story.highlightCount) * 1 +
    readRatio * 2
  );
}

export function scoreStory(
  story: RankableStory,
  affinity: Affinity,
  now: number
) {
  const ageHours = Math.max(0, now - story.publishedAt) / HOUR_SECONDS;
  // Half the weight at about ten days, and it never falls to nothing, so a good
  // old story can still beat a weak new one.
  const freshness = 1 / (1 + ageHours / 240);
  let boost = 1;
  if (affinity.authors.has(story.authorId)) boost += 1.2;
  const sharedTopics = story.topics.filter((topic) =>
    affinity.topics.has(topic)
  ).length;
  boost += Math.min(sharedTopics, 3) * 0.5;
  if (affinity.seen?.has(story.id)) boost *= 0.35;
  return (1 + engagementScore(story)) * (0.35 + freshness) * boost;
}

/**
 * Highest score first, but each further story by the same author in a row of
 * results counts for less, so one prolific writer cannot fill the page.
 */
export function rankFeed<T extends RankableStory>(
  stories: T[],
  affinity: Affinity,
  now: number
): T[] {
  const pool = stories
    .filter((story) => story.authorId !== affinity.viewerId)
    .map((story) => ({ story, score: scoreStory(story, affinity, now) }));
  const perAuthor = new Map<string, number>();
  const ranked: T[] = [];
  while (pool.length) {
    let best = 0;
    let bestScore = -Infinity;
    pool.forEach((entry, index) => {
      const shown = perAuthor.get(entry.story.authorId) ?? 0;
      const adjusted = entry.score * 0.7 ** shown;
      if (adjusted > bestScore) {
        bestScore = adjusted;
        best = index;
      }
    });
    const [entry] = pool.splice(best, 1);
    ranked.push(entry!.story);
    perAuthor.set(
      entry!.story.authorId,
      (perAuthor.get(entry!.story.authorId) ?? 0) + 1
    );
  }
  return ranked;
}

/** Popular stories for a topic page: engagement, gently weighted by age. */
export function popularityScore(story: RankableStory, now: number) {
  const ageDays = Math.max(0, now - story.publishedAt) / (24 * HOUR_SECONDS);
  return engagementScore(story) / (1 + ageDays / 90);
}

type Span = { start: number; end: number };

const overlap = (a: Span, b: Span) =>
  Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));

/**
 * The most-highlighted passage. Readers rarely select identical text, so a
 * highlight counts toward a candidate when it covers at least half of it.
 */
export function mostHighlighted<T extends Span>(
  highlights: T[]
): { highlight: T; count: number } | null {
  let best: { highlight: T; count: number } | null = null;
  for (const candidate of highlights) {
    const length = candidate.end - candidate.start;
    if (length <= 0) continue;
    const count = highlights.filter(
      (other) => overlap(candidate, other) >= length / 2
    ).length;
    if (
      !best ||
      count > best.count ||
      (count === best.count &&
        length < best.highlight.end - best.highlight.start)
    ) {
      best = { highlight: candidate, count };
    }
  }
  return best;
}
