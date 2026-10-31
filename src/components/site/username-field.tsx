import { useEffect, useState } from 'react';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { checkUsername } from '~/functions/community.functions';
import { limits, normalizeUsername, usernameError } from '~/lib/limits';

/** Username input that checks availability as you type. */
export function UsernameField({
  value,
  onChange,
  onValidChange,
  current,
  id = 'username'
}: {
  value: string;
  onChange: (value: string) => void;
  onValidChange?: (valid: boolean) => void;
  current?: string;
  id?: string;
}) {
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    const username = normalizeUsername(value);
    if (!username || username === current) {
      setStatus(null);
      onValidChange?.(username === current && Boolean(current));
      return;
    }
    const problem = usernameError(username);
    if (problem) {
      setStatus({ ok: false, message: problem });
      onValidChange?.(false);
      return;
    }
    let cancelled = false;
    onValidChange?.(false);
    const timer = setTimeout(async () => {
      try {
        const result = await checkUsername({ data: { username } });
        if (cancelled) return;
        setStatus({ ok: result.available, message: result.message });
        onValidChange?.(result.available);
      } catch {
        // The server checks again on submit.
        if (!cancelled) onValidChange?.(true);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, current]);

  return (
    <div className='flex flex-col gap-1.5'>
      <Label htmlFor={id}>Username</Label>
      <div className='relative'>
        <span className='pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground'>@</span>
        <Input
          id={id}
          required
          autoComplete='username'
          autoCapitalize='none'
          autoCorrect='off'
          spellCheck={false}
          maxLength={limits.usernameMax + 1}
          value={value}
          aria-invalid={status ? !status.ok : undefined}
          aria-describedby={`${id}-status`}
          onChange={(event) => onChange(event.target.value)}
          className='pl-7'
        />
      </div>
      <p
        id={`${id}-status`}
        role='status'
        className={`min-h-4 text-xs ${status?.ok === false ? 'text-destructive' : 'text-muted-foreground'}`}
      >
        {status?.message ?? 'Letters, numbers, and underscores. This is your public address.'}
      </p>
    </div>
  );
}
