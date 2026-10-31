import { Link } from '@tanstack/react-router';
import { UserAvatar } from '~/components/site/user-avatar';
import { FollowButton } from '~/components/story/actions';
import type { PersonCard } from '~/server/cards';

export function PersonRow({
  person,
  following = false,
  showFollow = true,
  compact = false
}: {
  person: PersonCard;
  following?: boolean;
  showFollow?: boolean;
  compact?: boolean;
}) {
  return (
    <div className='flex items-start gap-3'>
      <Link to='/@{$username}' params={{ username: person.username }} tabIndex={-1} aria-hidden='true'>
        <UserAvatar name={person.name} src={person.avatarUrl} size={compact ? 32 : 44} />
      </Link>
      <div className='min-w-0 flex-1'>
        <Link
          to='/@{$username}'
          params={{ username: person.username }}
          className='block truncate text-sm font-medium hover:underline'
        >
          {person.name}
        </Link>
        <p className={`text-[13px] leading-snug text-muted-foreground ${compact ? 'line-clamp-2' : 'line-clamp-3'}`}>
          {person.bio || `@${person.username}`}
        </p>
      </div>
      {showFollow ? (
        <FollowButton userId={person.id} name={person.name} initial={following} />
      ) : null}
    </div>
  );
}
