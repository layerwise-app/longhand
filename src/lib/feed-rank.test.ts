import { describe, expect, it } from 'vitest';
import { mostHighlighted, rankFeed, type RankableStory } from '~/lib/feed-rank';

const now = 1_800_000_000;
const day = 86_400;
const story = (id: string, overrides: Partial<RankableStory> = {}): RankableStory => ({
  id,
  authorId: `author-${id}`,
  topics: [],
  publishedAt: now - day,
  clapCount: 10,
  responseCount: 1,
  bookmarkCount: 1,
  highlightCount: 1,
  viewCount: 100,
  readCount: 50,
  ...overrides
});
const none = { authors: new Set<string>(), topics: new Set<string>() };

describe('rankFeed', () => {
  it('prefers engagement when everything else is equal', () => {
    const ranked = rankFeed([story('quiet'), story('loud', { clapCount: 500, responseCount: 20 })], none, now);
    expect(ranked[0]!.id).toBe('loud');
  });

  it('prefers fresher stories when engagement is equal', () => {
    const ranked = rankFeed([story('old', { publishedAt: now - 60 * day }), story('new')], none, now);
    expect(ranked[0]!.id).toBe('new');
  });

  it('lifts followed writers and topics', () => {
    const stories = [story('a', { clapCount: 40 }), story('b', { topics: ['food'] }), story('c', { authorId: 'friend' })];
    expect(rankFeed(stories, { authors: new Set(['friend']), topics: new Set() }, now)[0]!.id).toBe('c');
    expect(rankFeed(stories, { authors: new Set(), topics: new Set(['food']) }, now)[0]!.id).toBe('b');
  });

  it('stops one author from taking over the top of the feed', () => {
    const prolific = ['p1', 'p2', 'p3', 'p4'].map((id) => story(id, { authorId: 'prolific', clapCount: 100 }));
    const ranked = rankFeed([...prolific, story('other', { clapCount: 40 })], none, now);
    expect(ranked.slice(0, 3).map((s) => s.id)).toContain('other');
  });

  it('leaves out the reader’s own stories', () => {
    const ranked = rankFeed([story('mine', { authorId: 'me' }), story('theirs')], { ...none, viewerId: 'me' }, now);
    expect(ranked.map((s) => s.id)).toEqual(['theirs']);
  });
});

describe('mostHighlighted', () => {
  it('groups overlapping selections around the shared passage', () => {
    const top = mostHighlighted([
      { start: 0, end: 20 },
      { start: 100, end: 140 },
      { start: 105, end: 135 },
      { start: 100, end: 136 }
    ]);
    expect(top?.count).toBe(3);
    expect(top?.highlight.start).toBeGreaterThanOrEqual(100);
  });

  it('returns null with no highlights', () => {
    expect(mostHighlighted([])).toBeNull();
  });
});
