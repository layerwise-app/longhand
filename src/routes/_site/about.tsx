import { createFileRoute, Link } from '@tanstack/react-router';
import { brand } from '~/brand.config';
import { Button } from '~/components/ui/button';
import { seo } from '~/utils/seo';

export const Route = createFileRoute('/_site/about')({
  head: () =>
    seo({
      title: `About ${brand.name}`,
      description: `${brand.name} is a calm place to read and write long-form stories, with no ads and no streaks.`,
      path: '/about'
    }),
  component: AboutPage
});

function AboutPage() {
  return (
    <div className='mx-auto max-w-[42rem] px-5 py-12 sm:py-20'>
      <h1 className='font-display text-5xl font-normal tracking-tight'>About {brand.name}</h1>
      <div className='story-body mt-8'>
        <p>
          Most places to publish online were built to keep you scrolling. {brand.name} was
          built for the opposite: to help you finish one good thing, and then maybe write one
          of your own.
        </p>
        <p>
          Anyone can read here without an account. Writers get a clean page, a plain editor
          that saves as they go, and stats that say how many people actually read to the end.
          Readers can clap, respond, highlight the sentence that stopped them, and follow the
          people and topics they care about. The feed is worked out fresh each time you open
          it, from who you follow and what other readers are finishing.
        </p>
        <h2>A note about this site</h2>
        <p>
          This is a demonstration. The writers you’ll meet here, including Wren Halloway,
          Tomasz Eberling, and Hollis Marchetti, are fictional, as are their towns, their
          boats, and their bakeries. So are the readers who clapped for them. The stories were
          written for this demo, and the artwork was drawn in code for it.
        </p>
        <p>Your own account, and anything you publish, is real.</p>
      </div>
      <div className='mt-8 flex flex-wrap gap-3'>
        <Button asChild className='rounded-full'>
          <Link to='/try'>Try the editor</Link>
        </Button>
        <Button asChild variant='outline' className='rounded-full'>
          <Link to='/guidelines'>Read the guidelines</Link>
        </Button>
      </div>
    </div>
  );
}
