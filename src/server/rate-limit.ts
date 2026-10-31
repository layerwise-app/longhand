import { env } from 'cloudflare:workers';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { lte, sql } from 'drizzle-orm';
import { db } from '~/db';
import { rateLimits } from '~/db/schema';

type Rule = { limit: number; windowSeconds: number };

const MINUTE = 60;
const HOUR = 60 * MINUTE;

export const rules = {
  signUp: { limit: 8, windowSeconds: HOUR },
  signIn: { limit: 30, windowSeconds: 15 * MINUTE },
  sendCode: { limit: 8, windowSeconds: 15 * MINUTE },
  checkUsername: { limit: 60, windowSeconds: MINUTE },
  createDraft: { limit: 40, windowSeconds: HOUR },
  saveDraft: { limit: 240, windowSeconds: 10 * MINUTE },
  publish: { limit: 12, windowSeconds: HOUR },
  upload: { limit: 60, windowSeconds: HOUR },
  respond: { limit: 20, windowSeconds: 10 * MINUTE },
  clap: { limit: 120, windowSeconds: MINUTE },
  highlight: { limit: 40, windowSeconds: 10 * MINUTE },
  follow: { limit: 60, windowSeconds: 10 * MINUTE },
  search: { limit: 40, windowSeconds: MINUTE },
  report: { limit: 10, windowSeconds: HOUR },
  // One view and one read per visitor, per story, per half hour.
  track: { limit: 1, windowSeconds: 30 * MINUTE }
} satisfies Record<string, Rule>;

export type RateLimitAction = keyof typeof rules;

/** Counts one attempt and reports whether it is allowed. */
export async function checkRateLimit(
  action: RateLimitAction,
  subject: string
): Promise<boolean> {
  const { limit, windowSeconds } = rules[action];
  const now = Math.floor(Date.now() / 1000);
  const [row] = await db
    .insert(rateLimits)
    .values({
      key: `${action}:${subject}`,
      count: 1,
      resetAt: now + windowSeconds
    })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`CASE WHEN ${rateLimits.resetAt} <= ${now} THEN 1 ELSE ${rateLimits.count} + 1 END`,
        resetAt: sql`CASE WHEN ${rateLimits.resetAt} <= ${now} THEN ${now + windowSeconds} ELSE ${rateLimits.resetAt} END`
      }
    })
    .returning({ count: rateLimits.count });

  // There are no scheduled jobs, so a small share of requests tidy up.
  if (Math.random() < 0.01) {
    await db.delete(rateLimits).where(lte(rateLimits.resetAt, now));
  }
  return (row?.count ?? 0) <= limit;
}

export class RateLimitError extends Error {
  constructor() {
    super('You’re doing that a little too often. Please wait a moment and try again.');
  }
}

export async function enforceRateLimit(action: RateLimitAction, subject: string) {
  if (!(await checkRateLimit(action, subject))) throw new RateLimitError();
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value)
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * An opaque key for the current visitor. The IP address is only ever hashed with
 * a server secret and the date, is never stored, and the key changes every day.
 */
export async function visitorKey(headers?: Headers | null) {
  const source = headers ?? (getRequestHeaders() as unknown as Headers);
  const ip =
    source.get('cf-connecting-ip') ||
    source.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'local';
  const day = new Date().toISOString().slice(0, 10);
  const hash = await sha256(`${env.BETTER_AUTH_SECRET || 'longhand'}|${day}|${ip}`);
  return hash.slice(0, 32);
}
