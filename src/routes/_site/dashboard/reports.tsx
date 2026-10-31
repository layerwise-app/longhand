import { createFileRoute, Link, redirect, useRouter } from '@tanstack/react-router';
import { Button } from '~/components/ui/button';
import { listReports, setReportStatus } from '~/functions/community.functions';
import { formatDate } from '~/lib/format';
import { seo } from '~/utils/seo';

export const Route = createFileRoute('/_site/dashboard/reports')({
  beforeLoad: ({ context }) => {
    if (context.viewer?.role !== 'admin') throw redirect({ to: '/dashboard' });
  },
  loader: () => listReports(),
  head: () => seo({ title: 'Reports', noindex: true }),
  component: ReportsPage
});

function ReportsPage() {
  const reports = Route.useLoaderData();
  const router = useRouter();
  const update = async (id: string, status: 'resolved' | 'dismissed' | 'open') => {
    await setReportStatus({ data: { id, status } });
    await router.invalidate();
  };
  return (
    <>
      <h1 className='font-display text-4xl font-normal tracking-tight'>Reports</h1>
      {reports.length ? (
        <ul className='mt-4'>
          {reports.map((report) => (
            <li key={report.id} className='border-b py-4 last:border-b-0'>
              <p className='text-[13px] text-muted-foreground'>
                {report.targetType} · {formatDate(report.createdAt)} · {report.status}
              </p>
              <p className='mt-1 font-medium'>{report.reason}</p>
              {report.slug ? (
                <Link to='/story/$slug' params={{ slug: report.slug }} className='font-serif underline underline-offset-2'>
                  {report.label}
                </Link>
              ) : (
                <p className='font-serif'>{report.label}</p>
              )}
              {report.details ? <p className='mt-1 text-sm text-muted-foreground'>{report.details}</p> : null}
              <div className='mt-2 flex gap-2'>
                {report.status === 'open' ? (
                  <>
                    <Button size='sm' variant='outline' className='rounded-full' onClick={() => update(report.id, 'resolved')}>Resolve</Button>
                    <Button size='sm' variant='ghost' className='rounded-full' onClick={() => update(report.id, 'dismissed')}>Dismiss</Button>
                  </>
                ) : (
                  <Button size='sm' variant='ghost' className='rounded-full' onClick={() => update(report.id, 'open')}>Reopen</Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className='py-14 text-center font-serif text-lg text-muted-foreground'>No reports. A good day.</p>
      )}
    </>
  );
}
