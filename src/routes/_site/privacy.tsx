import { createFileRoute } from '@tanstack/react-router';
import { brand } from '~/brand.config';
import { seo } from '~/utils/seo';

export const Route = createFileRoute('/_site/privacy')({
  head: () =>
    seo({
      title: `Privacy on ${brand.name}`,
      description: 'What this site stores about you, and what it deliberately does not.',
      path: '/privacy'
    }),
  component: PrivacyPage
});

function PrivacyPage() {
  return (
    <div className='mx-auto max-w-[42rem] px-5 py-12 sm:py-20'>
      <h1 className='font-display text-5xl font-normal tracking-tight'>Privacy</h1>
      <div className='story-body mt-8'>
        <p>{brand.name} keeps what it needs to run, and very little beyond that.</p>
        <h2>If you read without an account</h2>
        <p>
          We count views and reads per story, per day. Those totals are all we store. To count
          each visitor once, your address is combined with a secret and the date and put through a
          one-way hash. The hash changes every day, and old ones are deleted as they expire. Your
          IP address is never written to the {brand.name} database.
        </p>
        <h2>If you have an account</h2>
        <p>
          We store your email, your profile, what you publish, and what you do here: claps,
          responses, highlights, bookmarks, and follows. Your responses, claps, and shared
          highlights are visible to others. Your bookmarks and drafts are not.
        </p>
        <h2>Email</h2>
        <p>
          We email you when someone follows you or responds to you, and you can turn either one
          off in your settings. We don’t send newsletters, digests, or marketing.
        </p>
        <h2>Embeds</h2>
        <p>
          Video and other players from outside sites load only when you click them. Until then,
          those sites don’t know you’re here.
        </p>
      </div>
    </div>
  );
}
