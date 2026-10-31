import { createFileRoute, Link, Outlet, redirect } from '@tanstack/react-router';
import { cn } from '~/lib/utils';
import { useViewer } from '~/lib/viewer';

// Everything signed in lives under /dashboard, which robots.txt keeps out of
// search. Each server function also checks the session for itself.
export const Route = createFileRoute('/_site/dashboard')({
  beforeLoad: ({ context, location }) => {
    if (!context.viewer) {
      throw redirect({ to: '/sign-in', search: { redirect: location.href } });
    }
    if (!context.viewer.username) {
      throw redirect({ to: '/welcome', search: { redirect: location.href } });
    }
    return { viewer: context.viewer };
  },
  component: DashboardLayout
});

const links = [
  { to: '/dashboard', label: 'Stories', exact: true },
  { to: '/dashboard/library', label: 'Reading list', exact: false },
  { to: '/dashboard/stats', label: 'Stats', exact: false },
  { to: '/dashboard/notifications', label: 'Notifications', exact: false },
  { to: '/dashboard/settings', label: 'Settings', exact: false }
] as const;

function DashboardLayout() {
  const viewer = useViewer();
  return (
    <div className='mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-10'>
      <nav
        aria-label='Dashboard'
        className='scrollbar-none -mx-4 flex gap-6 overflow-x-auto border-b px-4 sm:mx-0 sm:px-0'
      >
        {links.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            activeOptions={{ exact: link.exact }}
            activeProps={{ className: 'border-foreground font-medium text-foreground' }}
            inactiveProps={{ className: 'border-transparent text-muted-foreground hover:text-foreground' }}
            className={cn('-mb-px border-b py-3 text-sm whitespace-nowrap')}
          >
            {link.label}
          </Link>
        ))}
        {viewer?.role === 'admin' ? (
          <Link
            to='/dashboard/reports'
            activeProps={{ className: 'border-foreground font-medium text-foreground' }}
            inactiveProps={{ className: 'border-transparent text-muted-foreground hover:text-foreground' }}
            className='-mb-px border-b py-3 text-sm whitespace-nowrap'
          >
            Reports
          </Link>
        ) : null}
      </nav>
      <div className='pt-6'>
        <Outlet />
      </div>
    </div>
  );
}
