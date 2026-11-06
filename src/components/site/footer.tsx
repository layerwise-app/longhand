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

/** Links to Layerwise; the image follows the site's light or dark theme. */
function PoweredByLayerwise() {
  return (
    <a
      href='https://layerwise.app'
      target='_blank'
      rel='noopener noreferrer'
      className='inline-flex w-fit shrink-0 rounded-sm'
    >
      <img
        src='https://layerwise.app/powered-by.png'
        alt='Powered by Layerwise'
        width={174}
        height={28}
        loading='lazy'
        className='h-7 w-[174px] dark:hidden'
      />
      <img
        src='https://layerwise.app/powered-by-dark.png'
        alt='Powered by Layerwise'
        width={174}
        height={28}
        loading='lazy'
        className='hidden h-7 w-[174px] dark:block'
      />
    </a>
  );
}

export function SiteFooter() {
  return (
    <footer className='border-t'>
      <div className='mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-end sm:justify-between sm:px-6'>
        <div className='flex flex-col gap-4'>
          <div className='flex items-center gap-2 text-sm text-muted-foreground'>
            <LogoMark className='size-5 text-primary' />
            {brand.footerNote}
          </div>
          <PoweredByLayerwise />
        </div>
        {/* Lines the links up with the middle of the badge on wide screens. */}
        <div className='sm:pb-1'>
          <FooterLinks />
        </div>
      </div>
    </footer>
  );
}
