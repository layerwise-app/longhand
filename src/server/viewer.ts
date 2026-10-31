import { getRequestHeaders } from '@tanstack/react-start/server';
import { eq } from 'drizzle-orm';
import { db } from '~/db';
import { profiles } from '~/db/schema';
import { auth } from '~/lib/auth';

export type Viewer = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  role: string | null;
  /** Null until the person has picked a username. */
  username: string | null;
  bio: string;
  avatarUrl: string | null;
};

/** The signed-in person, or null. Signed-out readers never touch the database. */
export async function loadViewer(): Promise<Viewer | null> {
  const headers = getRequestHeaders();
  const cookie = headers.get('cookie') ?? '';
  if (!cookie.includes('better-auth')) return null;
  const session = await auth.api.getSession({ headers });
  if (!session) return null;
  const [profile] = await db
    .select({
      username: profiles.username,
      bio: profiles.bio,
      avatarUrl: profiles.avatarUrl
    })
    .from(profiles)
    .where(eq(profiles.userId, session.user.id))
    .limit(1);
  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    emailVerified: session.user.emailVerified,
    role: session.user.role ?? null,
    username: profile?.username ?? null,
    bio: profile?.bio ?? '',
    avatarUrl: profile?.avatarUrl ?? null
  };
}
