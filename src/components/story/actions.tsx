import { useState } from 'react';
import { BookmarkIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthGate } from '~/components/site/auth-gate';
import { Button } from '~/components/ui/button';
import {
  setFollow,
  setTopicFollow,
  toggleBookmark
} from '~/functions/community.functions';
import { cn } from '~/lib/utils';

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Something went wrong. Please try again.';

export function BookmarkButton({
  storyId,
  initial,
  className
}: {
  storyId: string;
  initial: boolean;
  className?: string;
}) {
  const gate = useAuthGate();
  const [saved, setSaved] = useState(initial);
  const toggle = async () => {
    if (!gate('save stories to your reading list')) return;
    const next = !saved;
    setSaved(next);
    try {
      await toggleBookmark({ data: { storyId, saved: next } });
    } catch (error) {
      setSaved(!next);
      toast.error(errorMessage(error));
    }
  };
  return (
    <button
      type='button'
      onClick={toggle}
      aria-pressed={saved}
      aria-label={saved ? 'Remove from reading list' : 'Save to reading list'}
      className={cn(
        'inline-flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground',
        saved && 'text-primary hover:text-primary',
        className
      )}
    >
      <BookmarkIcon className='size-[1.15rem]' fill={saved ? 'currentColor' : 'none'} />
    </button>
  );
}

export function FollowButton({
  userId,
  name,
  initial,
  size = 'sm',
  className
}: {
  userId: string;
  name: string;
  initial: boolean;
  size?: 'sm' | 'default';
  className?: string;
}) {
  const gate = useAuthGate();
  const [following, setFollowing] = useState(initial);
  const [busy, setBusy] = useState(false);
  const toggle = async () => {
    if (!gate(`follow ${name}`)) return;
    const next = !following;
    setFollowing(next);
    setBusy(true);
    try {
      await setFollow({ data: { userId, following: next } });
    } catch (error) {
      setFollowing(!next);
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button
      type='button'
      size={size}
      variant={following ? 'outline' : 'default'}
      disabled={busy}
      aria-pressed={following}
      onClick={toggle}
      className={cn('rounded-full px-3.5', className)}
    >
      {following ? 'Following' : 'Follow'}
      <span className='sr-only'> {name}</span>
    </Button>
  );
}

export function TopicFollowButton({
  topic,
  name,
  initial,
  size = 'sm',
  className
}: {
  topic: string;
  name: string;
  initial: boolean;
  size?: 'sm' | 'default';
  className?: string;
}) {
  const gate = useAuthGate();
  const [following, setFollowing] = useState(initial);
  const toggle = async () => {
    if (!gate(`follow ${name}`)) return;
    const next = !following;
    setFollowing(next);
    try {
      await setTopicFollow({ data: { topic, following: next } });
    } catch (error) {
      setFollowing(!next);
      toast.error(errorMessage(error));
    }
  };
  return (
    <Button
      type='button'
      size={size}
      variant={following ? 'outline' : 'default'}
      aria-pressed={following}
      onClick={toggle}
      className={cn('rounded-full px-3.5', className)}
    >
      {following ? 'Following' : 'Follow'}
      <span className='sr-only'> {name}</span>
    </Button>
  );
}
