import { cn } from '~/lib/utils';

/** Two palms coming together, with a little burst of energy above them. */
export function ClapIcon({ className, filled }: { className?: string; filled?: boolean }) {
  return (
    <svg
      viewBox='0 0 24 24'
      aria-hidden='true'
      className={cn('size-5', className)}
      fill={filled ? 'currentColor' : 'none'}
      stroke='currentColor'
      strokeWidth='1.5'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <path d='M9.3 21.2c-2.5-.6-4.3-2.6-4.8-5.1L3.2 10.4c-.2-.9.9-1.5 1.6-.8l1.9 2.1-1.4-5.2c-.2-.9 1-1.5 1.7-.6l3.7 5.1' />
      <path d='M9.3 21.2c2.8.7 5.8-.3 7.6-2.6l2.7-3.5c.6-.8-.3-1.9-1.2-1.3l-2.4 1.7 2.2-5c.4-.9-.8-1.7-1.5-.8l-3 4.2.6-5.4c.1-1-1.3-1.3-1.7-.4l-2.6 6.3c-.9 2.1-.8 4.3.3 6.2' />
      <path d='M12 3v1.8M8.6 3.6l.7 1.5M15.4 3.6l-.7 1.5' fill='none' />
    </svg>
  );
}

export function ResponseIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox='0 0 24 24'
      aria-hidden='true'
      className={cn('size-5', className)}
      fill='none'
      stroke='currentColor'
      strokeWidth='1.5'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <path d='M20 11.5c0 3.9-3.6 7-8 7-1.1 0-2.1-.2-3.1-.5L4.5 19.5l1.2-3.4C4.6 14.9 4 13.3 4 11.5c0-3.9 3.6-7 8-7s8 3.1 8 7Z' />
    </svg>
  );
}
