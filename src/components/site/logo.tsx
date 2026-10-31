import { Link } from '@tanstack/react-router';
import { brand } from '~/brand.config';
import { cn } from '~/lib/utils';

/** The mark: one unbroken pen stroke, a looped "l" that runs off into a line. */
export const LOGO_STROKE =
  'M15 66 C30 66 44 53 49 37 C53 24 51 12 42 12 C33 12 28 27 28 44 C28 59 30 76 34 88 C37 76 44 63 53 63 C59 63 59 71 58 78 C57 85 62 87 69 83 C75 79 81 73 86 66';

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox='0 0 100 100' aria-hidden='true' className={cn('size-7', className)}>
      <path
        d={LOGO_STROKE}
        fill='none'
        stroke='currentColor'
        strokeWidth='8'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <Link
      to='/'
      aria-label={`${brand.name} home`}
      className={cn('inline-flex items-center gap-1 text-foreground', className)}
    >
      <LogoMark className='size-7 text-primary' />
      <span className='font-display text-[1.45rem] leading-none font-medium italic'>
        {brand.name}
      </span>
    </Link>
  );
}
