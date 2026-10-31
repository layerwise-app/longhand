import { cn } from '~/lib/utils';

const TINTS = ['#d9e2d3', '#e8dccb', '#d5dcec', '#ecd9d4', '#e4e0ee', '#d4e4e2'];

function tintFor(name: string) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return TINTS[hash % TINTS.length];
}

export function UserAvatar({
  name,
  src,
  size = 32,
  className
}: {
  name: string;
  src?: string | null;
  size?: number;
  className?: string;
}) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
  if (src) {
    return (
      <img
        src={src}
        alt=''
        width={size}
        height={size}
        loading='lazy'
        decoding='async'
        className={cn('shrink-0 rounded-full bg-tint object-cover', className)}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden='true'
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-medium text-[#3a3833]',
        className
      )}
      style={{
        width: size,
        height: size,
        background: tintFor(name),
        fontSize: Math.max(10, size * 0.38)
      }}
    >
      {initials}
    </span>
  );
}
