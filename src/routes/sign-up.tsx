import { useState } from 'react';
import { createFileRoute, Link, useRouter } from '@tanstack/react-router';
import { useMutation } from '@tanstack/react-query';
import { brand } from '~/brand.config';
import { AuthShell } from '~/components/site/auth-shell';
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
import { Textarea } from '~/components/ui/textarea';
import {
  completeProfile,
  updateProfile
} from '~/functions/community.functions';
import { authClient } from '~/lib/auth-client';
import { limits, normalizeUsername, safeRedirect } from '~/lib/limits';
import { useSessionRefresh } from '~/lib/use-session-refresh';
import { seo } from '~/utils/seo';

type SignUpSearch = { redirect?: string };

export const Route = createFileRoute('/sign-up')({
  validateSearch: (search: Record<string, unknown>): SignUpSearch => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined
  }),
  head: () => seo({ title: `Join ${brand.name}`, noindex: true }),
  component: SignUpPage
});

type Step = 'account' | 'verify' | 'profile';

function SignUpPage() {
  const { redirect } = Route.useSearch();
  const router = useRouter();
  const refresh = useSessionRefresh();
  const [step, setStep] = useState<Step>('account');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameOk, setUsernameOk] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const destination = safeRedirect(redirect, '/');
  const isImport = destination.includes('import=try');

  const finish = async () => {
    await refresh();
    router.history.push(destination);
  };

  const signUp = useMutation({
    mutationFn: async () => {
      const { error } = await authClient.signUp.email({ name, email, password });
      if (error) {
        throw new Error(
          error.status === 429
            ? 'Too many sign-ups from here. Please wait a while and try again.'
            : error.code === 'USER_ALREADY_EXISTS' ||
                error.code === 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL'
              ? 'That email already has an account. Try signing in.'
              : (error.message ?? 'We couldn’t create your account.')
        );
      }
      try {
        await completeProfile({ data: { username: normalizeUsername(username) } });
      } catch {
        // Someone took the name in the last few seconds. Let them pick another.
        await refresh();
        router.navigate({ to: '/welcome', search: { redirect: destination } });
        return false;
      }
      await authClient.emailOtp.sendVerificationOtp({ email, type: 'email-verification' });
      return true;
    },
    onSuccess: (ok) => {
      if (ok) setStep('verify');
    }
  });

  const verify = useMutation({
    mutationFn: async () => {
      const { error } = await authClient.emailOtp.verifyEmail({ email, otp });
      if (error) throw new Error(error.message ?? 'That code didn’t work.');
    },
    onSuccess: () => setStep('profile')
  });

  const resend = useMutation({
    mutationFn: async () => {
      const { error } = await authClient.emailOtp.sendVerificationOtp({
        email,
        type: 'email-verification'
      });
      if (error) throw new Error(error.message ?? 'We couldn’t send a new code.');
    }
  });

  const saveProfile = useMutation({
    mutationFn: () =>
      updateProfile({
        data: { name, username: normalizeUsername(username), bio, avatarUrl }
      }),
    onSuccess: finish
  });

  if (step === 'verify') {
    return (
      <AuthShell
        title='Check your email'
        description={`We sent a six-digit code to ${email}. It turns on email notifications.`}
      >
        <form
          className='flex flex-col gap-4'
          onSubmit={(event) => {
            event.preventDefault();
            verify.mutate();
          }}
        >
          <InputOTP
            autoFocus
            autoComplete='one-time-code'
            containerClassName='w-full justify-center'
            maxLength={6}
            value={otp}
            onChange={setOtp}
            aria-label='Verification code'
          >
            <InputOTPGroup>
              {Array.from({ length: 6 }, (_, index) => (
                <InputOTPSlot key={index} index={index} className='size-12 text-lg' />
              ))}
            </InputOTPGroup>
          </InputOTP>
          {verify.error ? <p className='text-center text-sm text-destructive'>{verify.error.message}</p> : null}
          <Button type='submit' size='lg' className='rounded-full' disabled={otp.length < 6 || verify.isPending}>
            {verify.isPending ? 'Checking…' : 'Verify email'}
          </Button>
          <div className='flex items-center justify-center gap-4 text-sm text-muted-foreground'>
            <button type='button' className='underline underline-offset-2 hover:text-foreground' onClick={() => resend.mutate()} disabled={resend.isPending}>
              {resend.isSuccess ? 'Code sent' : 'Send a new code'}
            </button>
            <button type='button' className='underline underline-offset-2 hover:text-foreground' onClick={() => setStep('profile')}>
              Do this later
            </button>
          </div>
          {resend.error ? <p className='text-center text-sm text-destructive'>{resend.error.message}</p> : null}
        </form>
      </AuthShell>
    );
  }

  if (step === 'profile') {
    return (
      <AuthShell
        title='Add a little about you'
        description='This shows on your profile and under your stories. You can change it any time.'
      >
        <form
          className='flex flex-col gap-5'
          onSubmit={(event) => {
            event.preventDefault();
            saveProfile.mutate();
          }}
        >
          <AvatarPicker name={name} value={avatarUrl} onChange={setAvatarUrl} />
          <div className='flex flex-col gap-1.5'>
            <Label htmlFor='bio'>Short bio</Label>
            <Textarea
              id='bio'
              rows={3}
              maxLength={limits.bioMax}
              value={bio}
              placeholder='What do you do, and what do you write about?'
              onChange={(event) => setBio(event.target.value)}
            />
            <p className='text-right text-xs text-muted-foreground'>{bio.length}/{limits.bioMax}</p>
          </div>
          {saveProfile.error ? <p className='text-sm text-destructive'>{saveProfile.error.message}</p> : null}
          <Button type='submit' size='lg' className='rounded-full' disabled={saveProfile.isPending}>
            {saveProfile.isPending ? 'Saving…' : isImport ? 'Save and open your draft' : 'Finish'}
          </Button>
          <button type='button' className='text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground' onClick={finish}>
            Skip for now
          </button>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={isImport ? 'Keep your draft' : `Join ${brand.name}`}
      description={
        isImport
          ? 'Create a free account and your draft moves over with you, images and all.'
          : 'Read, write, and follow the people worth following.'
      }
    >
      <form
        className='flex flex-col gap-4'
        onSubmit={(event) => {
          event.preventDefault();
          if (usernameOk) signUp.mutate();
        }}
      >
        <div className='flex flex-col gap-1.5'>
          <Label htmlFor='name'>Name</Label>
          <Input
            id='name'
            autoComplete='name'
            required
            maxLength={limits.nameMax}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <UsernameField value={username} onChange={setUsername} onValidChange={setUsernameOk} />
        <div className='flex flex-col gap-1.5'>
          <Label htmlFor='email'>Email</Label>
          <Input
            id='email'
            type='email'
            autoComplete='email'
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className='flex flex-col gap-1.5'>
          <Label htmlFor='password'>Password</Label>
          <Input
            id='password'
            type='password'
            autoComplete='new-password'
            minLength={8}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <p className='text-xs text-muted-foreground'>At least 8 characters.</p>
        </div>
        {signUp.error ? <p className='text-sm text-destructive' role='alert'>{signUp.error.message}</p> : null}
        <Button type='submit' size='lg' className='rounded-full' disabled={!usernameOk || signUp.isPending}>
          {signUp.isPending ? 'Creating your account…' : 'Create account'}
        </Button>
        <p className='text-center text-sm text-muted-foreground'>
          Already have an account?{' '}
          <Link to='/sign-in' search={{ redirect }} className='underline underline-offset-2'>
            Sign in
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
