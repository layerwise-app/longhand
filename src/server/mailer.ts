import { env, waitUntil } from 'cloudflare:workers';
import { eq } from 'drizzle-orm';
import { brand } from '~/brand.config';
import { db } from '~/db';
import { profiles, user } from '~/db/schema';
import { siteUrl } from '~/lib/site';

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

function layout(body: string, cta: { label: string; url: string }) {
  const { ink, muted, accent, line } = brand.colors.light;
  return `<!doctype html><html><body style="margin:0;padding:0;background:#ffffff">
<div style="max-width:520px;margin:0 auto;padding:32px 24px;font-family:Georgia,'Times New Roman',serif;color:${ink};font-size:17px;line-height:1.55">
<p style="margin:0 0 24px;font-size:20px;font-style:italic">${escapeHtml(brand.name)}</p>
${body}
<p style="margin:28px 0"><a href="${cta.url}" style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;font-family:system-ui,-apple-system,sans-serif;font-size:15px;padding:10px 18px;border-radius:999px">${escapeHtml(cta.label)}</a></p>
<p style="margin:32px 0 0;padding-top:16px;border-top:1px solid ${line};font-family:system-ui,-apple-system,sans-serif;font-size:13px;color:${muted}">You can turn these emails off in <a href="${siteUrl('/dashboard/settings')}" style="color:${muted}">your settings</a>.</p>
</div></body></html>`;
}

const excerpt = (text: string, max = 280) =>
  text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;

type Setting = 'follower' | 'response';

/**
 * Loads the recipient and sends, without failing or delaying the action that
 * triggered it. Only verified addresses are emailed: otherwise anyone could sign
 * up with a stranger's address and send them mail by following themselves.
 */
async function deliver(
  recipientId: string,
  setting: Setting,
  message: { subject: string; html: string; text: string }
) {
  const [recipient] = await db
    .select({
      email: user.email,
      emailVerified: user.emailVerified,
      emailOnFollower: profiles.emailOnFollower,
      emailOnResponse: profiles.emailOnResponse,
      isSeed: profiles.isSeed
    })
    .from(user)
    .innerJoin(profiles, eq(profiles.userId, user.id))
    .where(eq(user.id, recipientId))
    .limit(1);
  if (!recipient || recipient.isSeed || !recipient.emailVerified) return;
  if (setting === 'follower' && !recipient.emailOnFollower) return;
  if (setting === 'response' && !recipient.emailOnResponse) return;

  const { error } = await env.EMAIL.send({ to: recipient.email, ...message });
  if (!error) return;
  console.warn(`[email] ${setting}: ${error.code} ${error.message}`);
  // These addresses can't take mail, so stop trying.
  if (error.code === 'unsubscribed' || error.code === 'suppressed') {
    await db
      .update(profiles)
      .set({ emailOnFollower: false, emailOnResponse: false })
      .where(eq(profiles.userId, recipientId));
  }
}

function inBackground(work: Promise<void>) {
  const safe = work.catch((error) => console.warn('[email] failed', error));
  try {
    waitUntil(safe);
  } catch {
    // Outside a request there is nothing to extend.
  }
}

export function sendFollowerEmail(input: {
  recipientId: string;
  followerName: string;
  followerUsername: string;
}) {
  const url = siteUrl(`/@${input.followerUsername}`);
  const name = escapeHtml(input.followerName);
  inBackground(
    deliver(input.recipientId, 'follower', {
      subject: `${input.followerName} started following you on ${brand.name}`,
      html: layout(
        `<p style="margin:0">${name} (@${escapeHtml(input.followerUsername)}) started following you. They’ll see your new stories in their feed.</p>`,
        { label: `See ${input.followerName}’s profile`, url }
      ),
      text: `${input.followerName} (@${input.followerUsername}) started following you on ${brand.name}.\n\n${url}\n\nTurn these emails off in your settings: ${siteUrl('/dashboard/settings')}`
    })
  );
}

export function sendResponseEmail(input: {
  recipientId: string;
  responderName: string;
  storyTitle: string;
  storySlug: string;
  body: string;
  isReply: boolean;
}) {
  const url = siteUrl(`/story/${input.storySlug}#responses`);
  const name = escapeHtml(input.responderName);
  const title = escapeHtml(input.storyTitle);
  const snippet = excerpt(input.body);
  const lead = input.isReply
    ? `replied to your response on`
    : `responded to your story`;
  inBackground(
    deliver(input.recipientId, 'response', {
      subject: input.isReply
        ? `${input.responderName} replied to you on “${input.storyTitle}”`
        : `${input.responderName} responded to “${input.storyTitle}”`,
      html: layout(
        `<p style="margin:0 0 16px">${name} ${lead} <em>${title}</em>.</p><blockquote style="margin:0;padding:0 0 0 16px;border-left:3px solid ${brand.colors.light.line};color:${brand.colors.light.muted}">${escapeHtml(snippet).replace(/\n/g, '<br>')}</blockquote>`,
        { label: 'Read and reply', url }
      ),
      text: `${input.responderName} ${lead} “${input.storyTitle}”.\n\n${snippet}\n\n${url}\n\nTurn these emails off in your settings: ${siteUrl('/dashboard/settings')}`
    })
  );
}
