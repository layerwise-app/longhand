import { Link } from '@tanstack/react-router';
import { brand } from '~/brand.config';
import { LogoMark } from '~/components/site/logo';

export function FooterLinks() {
  return (
    <nav aria-label='About' className='flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-muted-foreground'>
      <Link to='/about' className='hover:text-foreground'>About</Link>
      <Link to='/topics' className='hover:text-foreground'>Topics</Link>
      <Link to='/try' className='hover:text-foreground'>Try the editor</Link>
      <Link to='/guidelines' className='hover:text-foreground'>Guidelines</Link>
      <Link to='/privacy' className='hover:text-foreground'>Privacy</Link>
    </nav>
  );
}

export function SiteFooter() {
  return (
    <footer className='border-t'>
      <div className='mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6'>
        <div className='flex items-center gap-2 text-sm text-muted-foreground'>
          <LogoMark className='size-5 text-primary' />
          {brand.footerNote}
        </div>
        <FooterLinks />
      </div>
    </footer>
  );
}
