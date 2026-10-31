import { useState } from 'react';
import { createFileRoute, redirect, useRouter } from '@tanstack/react-router';
import { useMutation } from '@tanstack/react-query';
import { AuthShell } from '~/components/site/auth-shell';
import { UsernameField } from '~/components/site/username-field';
import { Button } from '~/components/ui/button';
import { Label } from '~/components/ui/label';
import { Textarea } from '~/components/ui/textarea';
import { completeProfile } from '~/functions/community.functions';
import { limits, normalizeUsername, safeRedirect } from '~/lib/limits';
import { useSessionRefresh } from '~/lib/use-session-refresh';
import { seo } from '~/utils/seo';

type WelcomeSearch = { redirect?: string };

// Reached by anyone signed in without a profile, for example if the username
// they picked at sign-up was taken at the last moment.
export const Route = createFileRoute('/welcome')({
  validateSearch: (search: Record<string, unknown>): WelcomeSearch => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined
  }),
  beforeLoad: ({ context, search }) => {
    if (!context.viewer) throw redirect({ to: '/sign-in' });
    if (context.viewer.username) {
      throw redirect({ href: safeRedirect(search.redirect, '/') });
    }
  },
  head: () => seo({ title: 'Finish your profile', noindex: true }),
  component: WelcomePage
});

function WelcomePage() {
  const { redirect: destination } = Route.useSearch();
  const router = useRouter();
  const refresh = useSessionRefresh();
  const [username, setUsername] = useState('');
  const [valid, setValid] = useState(false);
  const [bio, setBio] = useState('');
  const save = useMutation({
    mutationFn: () =>
      completeProfile({ data: { username: normalizeUsername(username), bio } }),
    onSuccess: async () => {
      await refresh();
      router.history.push(safeRedirect(destination, '/'));
    }
  });
  return (
    <AuthShell title='Pick a username' description='You need one before you can publish or join a conversation.'>
      <form
        className='flex flex-col gap-4'
        onSubmit={(event) => {
          event.preventDefault();
          if (valid) save.mutate();
        }}
      >
        <UsernameField value={username} onChange={setUsername} onValidChange={setValid} />
        <div className='flex flex-col gap-1.5'>
          <Label htmlFor='bio'>Short bio (optional)</Label>
          <Textarea
            id='bio'
            rows={3}
            maxLength={limits.bioMax}
            value={bio}
            onChange={(event) => setBio(event.target.value)}
          />
        </div>
        {save.error ? <p className='text-sm text-destructive' role='alert'>{save.error.message}</p> : null}
        <Button type='submit' size='lg' className='rounded-full' disabled={!valid || save.isPending}>
          {save.isPending ? 'Saving…' : 'Continue'}
        </Button>
      </form>
    </AuthShell>
  );
}
