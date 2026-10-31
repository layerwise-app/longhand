import type { ReactNode } from 'react';
import { Logo } from '~/components/site/logo';

export function AuthShell({
  title,
  description,
  children
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className='flex min-h-svh flex-col items-center px-5 py-10 sm:justify-center'>
      <Logo className='mb-8' />
      <div className='w-full max-w-[24rem]'>
        <h1 className='text-center font-display text-[2.1rem] leading-tight font-normal tracking-tight'>
          {title}
        </h1>
        {description ? (
          <p className='mt-2 text-center font-serif text-[1.1rem] leading-snug text-muted-foreground'>
            {description}
          </p>
        ) : null}
        <div className='mt-7'>{children}</div>
      </div>
    </div>
  );
}
