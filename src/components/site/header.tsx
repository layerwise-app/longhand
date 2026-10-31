import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useRouter, useRouterState } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  BarChart3Icon,
  BellIcon,
  BookmarkIcon,
  FileTextIcon,
  LogOutIcon,
  MoonIcon,
  SearchIcon,
  SettingsIcon,
  ShieldIcon,
  SquarePenIcon,
  SunIcon,
  UserIcon
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { Logo } from '~/components/site/logo';
import { UserAvatar } from '~/components/site/user-avatar';
import { Button } from '~/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '~/components/ui/dropdown-menu';
import { useViewer } from '~/lib/viewer';
import { cn } from '~/lib/utils';

function SearchBox({ className }: { className?: string }) {
  const navigate = useNavigate();
  const current = useRouterState({
    select: (state) =>
      state.location.pathname === '/search'
        ? String((state.location.search as { q?: string }).q ?? '')
        : ''
  });
  const [value, setValue] = useState(current);
  useEffect(() => setValue(current), [current]);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const q = value.trim();
    if (q) navigate({ to: '/search', search: { q } });
  };
  return (
    <form role='search' onSubmit={submit} className={cn('relative', className)}>
      <SearchIcon className='pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground' />
      <input
        type='search'
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder='Search'
        aria-label='Search stories, people, and topics'
        className='h-9 w-full rounded-full bg-tint pr-3 pl-9 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/40'
      />
    </form>
  );
}

function ThemeItem() {
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme === 'dark';
  return (
    <DropdownMenuItem onSelect={() => setTheme(dark ? 'light' : 'dark')}>
      {dark ? <SunIcon /> : <MoonIcon />}
      {dark ? 'Light theme' : 'Dark theme'}
    </DropdownMenuItem>
  );
}

function UserMenu() {
  const viewer = useViewer()!;
  const router = useRouter();
  const queryClient = useQueryClient();
  const signOut = async () => {
    const { authClient } = await import('~/lib/auth-client');
    await authClient.signOut();
    queryClient.removeQueries({ queryKey: ['viewer'] });
    await router.invalidate();
    router.navigate({ to: '/' });
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label='Open your menu'
        className='rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/50'
      >
        <UserAvatar name={viewer.name} src={viewer.avatarUrl} size={34} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-56'>
        <DropdownMenuLabel className='font-normal'>
          <div className='truncate text-sm font-medium'>{viewer.name}</div>
          {viewer.username ? (
            <div className='truncate text-xs text-muted-foreground'>@{viewer.username}</div>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {viewer.username ? (
          <DropdownMenuItem asChild>
            <Link to='/@{$username}' params={{ username: viewer.username }}>
              <UserIcon /> Profile
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem asChild>
          <Link to='/dashboard'>
            <FileTextIcon /> Your stories
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to='/dashboard/library'>
            <BookmarkIcon /> Reading list
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to='/dashboard/stats'>
            <BarChart3Icon /> Stats
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to='/dashboard/settings'>
            <SettingsIcon /> Settings
          </Link>
        </DropdownMenuItem>
        {viewer.role === 'admin' ? (
          <DropdownMenuItem asChild>
            <Link to='/dashboard/reports'>
              <ShieldIcon /> Reports
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <ThemeItem />
        <DropdownMenuItem onSelect={signOut}>
          <LogOutIcon /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SiteHeader({ autoHide = false }: { autoHide?: boolean }) {
  const viewer = useViewer();
  const location = useRouterState({ select: (state) => state.location.href });
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);

  // On long stories the header slides away going down and returns going up.
  useEffect(() => {
    if (!autoHide) {
      setHidden(false);
      return;
    }
    const onScroll = () => {
      const y = window.scrollY;
      if (Math.abs(y - lastY.current) < 8) return;
      setHidden(y > lastY.current && y > 120);
      lastY.current = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [autoHide]);

  return (
    <header
      className={cn(
        'sticky top-0 z-40 border-b bg-background/95 backdrop-blur-sm transition-transform duration-200 supports-[backdrop-filter]:bg-background/85',
        hidden && '-translate-y-full'
      )}
    >
      <div className='mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6'>
        <Logo />
        <SearchBox className='ml-3 hidden w-60 md:block' />
        <div className='ml-auto flex items-center gap-1 sm:gap-2'>
          <Button asChild variant='ghost' size='icon' className='rounded-full md:hidden'>
            <Link to='/search' search={{ q: '' }} aria-label='Search'>
              <SearchIcon className='size-5' />
            </Link>
          </Button>
          {viewer ? (
            <>
              <Button asChild variant='ghost' className='rounded-full'>
                <Link to='/dashboard/write/$id' params={{ id: 'new' }} preload={false}>
                  <SquarePenIcon className='size-5' />
                  <span className='hidden sm:inline'>Write</span>
                  <span className='sr-only sm:hidden'>Write a story</span>
                </Link>
              </Button>
              <Button asChild variant='ghost' size='icon' className='relative rounded-full'>
                <Link
                  to='/dashboard/notifications'
                  aria-label={
                    viewer.unread
                      ? `Notifications, ${viewer.unread} unread`
                      : 'Notifications'
                  }
                >
                  <BellIcon className='size-5' />
                  {viewer.unread ? (
                    <span className='absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground'>
                      {viewer.unread > 9 ? '9+' : viewer.unread}
                    </span>
                  ) : null}
                </Link>
              </Button>
              <UserMenu />
            </>
          ) : (
            <>
              <Button asChild variant='ghost' className='hidden rounded-full sm:inline-flex'>
                <Link to='/try'>Try the editor</Link>
              </Button>
              <Button asChild variant='ghost' className='rounded-full'>
                <Link to='/sign-in' search={{ redirect: location }}>
                  Sign in
                </Link>
              </Button>
              <Button asChild className='rounded-full'>
                <Link to='/sign-up' search={{ redirect: location }}>
                  Get started
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
