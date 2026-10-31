import { useState } from 'react';
import { createFileRoute, Link, useRouter } from '@tanstack/react-router';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AvatarPicker } from '~/components/site/avatar-picker';
import { UsernameField } from '~/components/site/username-field';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot
} from '~/components/ui/input-otp';
import { Label } from '~/components/ui/label';
import { Switch } from '~/components/ui/switch';
import { Textarea } from '~/components/ui/textarea';
import {
  getSettings,
  updateEmailSettings,
  updateProfile
} from '~/functions/community.functions';
import { limits } from '~/lib/limits';
import { useSessionRefresh } from '~/lib/use-session-refresh';
import { useViewer } from '~/lib/viewer';
import { seo } from '~/utils/seo';

export const Route = createFileRoute('/_site/dashboard/settings')({
  loader: () => getSettings(),
  head: () => seo({ title: 'Settings', noindex: true }),
  component: SettingsPage
});

function EmailToggle({
  id,
  label,
  description,
  initial,
  field,
  disabled
}: {
  id: string;
  label: string;
  description: string;
  initial: boolean;
  field: 'emailOnFollower' | 'emailOnResponse';
  disabled: boolean;
}) {
  const [checked, setChecked] = useState(initial);
  const change = async (next: boolean) => {
    setChecked(next);
    try {
      await updateEmailSettings({ data: { [field]: next } });
    } catch {
      setChecked(!next);
      toast.error('We couldn’t save that. Please try again.');
    }
  };
  return (
    <div className='flex items-center justify-between gap-6 py-3.5'>
      <div>
        <Label htmlFor={id} className='text-[15px] font-medium'>{label}</Label>
        <p className='text-sm text-muted-foreground'>{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={change} disabled={disabled} />
    </div>
  );
}

function VerifyEmail({ email }: { email: string }) {
  const refresh = useSessionRefresh();
  const [sent, setSent] = useState(false);
  const [otp, setOtp] = useState('');
  const send = useMutation({
    mutationFn: async () => {
      const { authClient } = await import('~/lib/auth-client');
      const { error } = await authClient.emailOtp.sendVerificationOtp({
        email,
        type: 'email-verification'
      });
      if (error) throw new Error(error.message ?? 'We couldn’t send the code.');
    },
    onSuccess: () => setSent(true)
  });
  const verify = useMutation({
    mutationFn: async () => {
      const { authClient } = await import('~/lib/auth-client');
      const { error } = await authClient.emailOtp.verifyEmail({ email, otp });
      if (error) throw new Error(error.message ?? 'That code didn’t work.');
    },
    onSuccess: async () => {
      toast.success('Email verified.');
      await refresh();
    }
  });
  return (
    <div className='rounded-lg bg-tint p-4'>
      <p className='text-sm font-medium'>Verify your email to get these messages</p>
      <p className='mt-0.5 text-sm text-muted-foreground'>
        We only send mail to addresses we’ve confirmed. You’ll still see everything under Notifications.
      </p>
      {sent ? (
        <form
          className='mt-3 flex flex-wrap items-center gap-3'
          onSubmit={(event) => {
            event.preventDefault();
            verify.mutate();
          }}
        >
          <InputOTP maxLength={6} value={otp} onChange={setOtp} aria-label='Verification code' autoFocus>
            <InputOTPGroup>
              {Array.from({ length: 6 }, (_, index) => (
                <InputOTPSlot key={index} index={index} />
              ))}
            </InputOTPGroup>
          </InputOTP>
          <Button type='submit' size='sm' className='rounded-full' disabled={otp.length < 6 || verify.isPending}>
            Verify
          </Button>
        </form>
      ) : (
        <Button size='sm' variant='outline' className='mt-3 rounded-full bg-transparent' disabled={send.isPending} onClick={() => send.mutate()}>
          {send.isPending ? 'Sending…' : `Send a code to ${email}`}
        </Button>
      )}
      {send.error || verify.error ? (
        <p className='mt-2 text-sm text-destructive'>{(send.error ?? verify.error)?.message}</p>
      ) : null}
    </div>
  );
}

function SettingsPage() {
  const email = Route.useLoaderData();
  const viewer = useViewer()!;
  const refresh = useSessionRefresh();
  const router = useRouter();
  const [name, setName] = useState(viewer.name);
  const [username, setUsername] = useState(viewer.username ?? '');
  const [usernameOk, setUsernameOk] = useState(true);
  const [bio, setBio] = useState(viewer.bio);
  const [avatarUrl, setAvatarUrl] = useState(viewer.avatarUrl);
  const save = useMutation({
    mutationFn: () => updateProfile({ data: { name, username, bio, avatarUrl } }),
    onSuccess: async () => {
      toast.success('Profile saved.');
      await refresh();
    }
  });
  return (
    <div className='max-w-xl'>
      <h1 className='font-display text-4xl font-normal tracking-tight'>Settings</h1>

      <section aria-labelledby='profile-heading' className='mt-7'>
        <h2 id='profile-heading' className='text-sm font-semibold'>Profile</h2>
        <form
          className='mt-4 flex flex-col gap-4'
          onSubmit={(event) => {
            event.preventDefault();
            if (usernameOk) save.mutate();
          }}
        >
          <AvatarPicker name={name} value={avatarUrl} onChange={setAvatarUrl} />
          <div className='flex flex-col gap-1.5'>
            <Label htmlFor='name'>Name</Label>
            <Input id='name' required maxLength={limits.nameMax} value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <UsernameField value={username} onChange={setUsername} onValidChange={setUsernameOk} current={viewer.username ?? undefined} />
          <div className='flex flex-col gap-1.5'>
            <Label htmlFor='bio'>Short bio</Label>
            <Textarea id='bio' rows={3} maxLength={limits.bioMax} value={bio} onChange={(event) => setBio(event.target.value)} />
            <p className='text-right text-xs text-muted-foreground'>{bio.length}/{limits.bioMax}</p>
          </div>
          {save.error ? <p className='text-sm text-destructive' role='alert'>{save.error.message}</p> : null}
          <div>
            <Button type='submit' className='rounded-full' disabled={!usernameOk || save.isPending}>
              {save.isPending ? 'Saving…' : 'Save profile'}
            </Button>
          </div>
        </form>
      </section>

      <section aria-labelledby='email-heading' className='mt-10 border-t pt-7'>
        <h2 id='email-heading' className='text-sm font-semibold'>Email</h2>
        <p className='mt-1 text-sm text-muted-foreground'>
          Sent to {viewer.email}. We don’t send newsletters or digests.
        </p>
        {viewer.emailVerified ? null : (
          <div className='mt-4'>
            <VerifyEmail email={viewer.email} />
          </div>
        )}
        <div className='mt-2 divide-y'>
          <EmailToggle
            id='email-follower'
            label='New followers'
            description='When someone starts following you.'
            initial={email.emailOnFollower}
            field='emailOnFollower'
            disabled={!viewer.emailVerified}
          />
          <EmailToggle
            id='email-response'
            label='New responses'
            description='When someone responds to your story or replies to you.'
            initial={email.emailOnResponse}
            field='emailOnResponse'
            disabled={!viewer.emailVerified}
          />
        </div>
      </section>

      <section className='mt-10 border-t pt-7 text-sm text-muted-foreground'>
        <Link to='/forgot-password' className='underline underline-offset-2 hover:text-foreground'>Change your password</Link>
        <span aria-hidden='true'> · </span>
        <button type='button' className='underline underline-offset-2 hover:text-foreground' onClick={() => router.navigate({ to: '/privacy' })}>
          How your data is used
        </button>
      </section>
    </div>
  );
}
