import { createFileRoute } from '@tanstack/react-router';
import { brand } from '~/brand.config';
import { seo } from '~/utils/seo';

export const Route = createFileRoute('/_site/guidelines')({
  head: () =>
    seo({
      title: `Guidelines for ${brand.name}`,
      description: 'What belongs here, what does not, and what happens when you report something.',
      path: '/guidelines'
    }),
  component: GuidelinesPage
});

function GuidelinesPage() {
  return (
    <div className='mx-auto max-w-[42rem] px-5 py-12 sm:py-20'>
      <h1 className='font-display text-5xl font-normal tracking-tight'>Guidelines</h1>
      <div className='story-body mt-8'>
        <p>Write what you mean, and be decent to the people reading it. In practice:</p>
        <ul>
          <li>Publish your own work, or say clearly whose it is.</li>
          <li>Disagree with ideas without going after the person who holds them.</li>
          <li>No harassment, threats, or hate aimed at anyone or any group.</li>
          <li>No spam, no advertising dressed up as a story, no link farms.</li>
          <li>No sexual content involving minors, ever, and nothing that sexualizes real people without their consent.</li>
        </ul>
        <h2>Reporting</h2>
        <p>
          Every story, response, and profile has a Report action, and you don’t need an account
          to use it. Reports go to the moderators and stay private. We may remove what breaks
          these guidelines and suspend accounts that keep doing it.
        </p>
        <h2>New accounts</h2>
        <p>
          Stories from accounts younger than thirty days can be read, shared, and recommended
          like any other, but they can’t appear in staff picks.
        </p>
      </div>
    </div>
  );
}
