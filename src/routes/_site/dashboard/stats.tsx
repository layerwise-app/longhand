import { useMemo, useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { getStats } from '~/functions/stats.functions';
import { formatCount } from '~/lib/format';
import { cn } from '~/lib/utils';
import { seo } from '~/utils/seo';

export const Route = createFileRoute('/_site/dashboard/stats')({
  loader: () => getStats(),
  head: () => seo({ title: 'Your stats', noindex: true }),
  component: StatsPage
});

type Metric = 'views' | 'reads' | 'claps';

const percent = (reads: number, views: number) =>
  views ? `${Math.round((reads / views) * 100)}%` : '–';

const dayLabel = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const formatDay = (day: string) => dayLabel.format(new Date(`${day}T00:00:00Z`));

/** One series of columns over thirty days, with a label on hover or focus. */
function DailyChart({
  days,
  values,
  metric
}: {
  days: string[];
  values: number[];
  metric: Metric;
}) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...values);
  const shown = active ?? values.length - 1;
  const total = values.reduce((sum, value) => sum + value, 0);
  return (
    <div>
      <p className='text-sm text-muted-foreground' aria-live='polite'>
        <span className='font-medium text-foreground tabular-nums'>{values[shown]}</span>{' '}
        {values[shown] === 1 ? metric.slice(0, -1) : metric} on {formatDay(days[shown]!)}
      </p>
      <div
        role='img'
        aria-label={`${metric} per day over the last ${days.length} days, ${total} in total`}
        className='mt-3 flex h-40 items-end gap-[2px] sm:gap-[3px]'
        onMouseLeave={() => setActive(null)}
      >
        {values.map((value, index) => (
          <div
            key={days[index]}
            onMouseEnter={() => setActive(index)}
            onTouchStart={() => setActive(index)}
            className='flex h-full flex-1 items-end'
          >
            <div
              className={cn(
                'w-full rounded-t-[3px] transition-colors',
                value === 0
                  ? 'bg-border'
                  : index === shown
                    ? 'bg-primary'
                    : 'bg-primary/55'
              )}
              style={{ height: `${value === 0 ? 1.5 : Math.max(3, (value / max) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <div className='mt-2 flex justify-between text-xs text-muted-foreground'>
        <span>{formatDay(days[0]!)}</span>
        <span>{formatDay(days[days.length - 1]!)}</span>
      </div>
    </div>
  );
}

function StatsPage() {
  const data = Route.useLoaderData();
  const [metric, setMetric] = useState<Metric>('views');
  const [storyId, setStoryId] = useState<string | null>(null);

  const series = useMemo(() => {
    const values = data.days.map(() => 0);
    const index = new Map(data.days.map((day, position) => [day, position]));
    for (const row of data.rows) {
      if (storyId && row.storyId !== storyId) continue;
      const position = index.get(row.day);
      if (position !== undefined) values[position]! += row[metric];
    }
    return values;
  }, [data, metric, storyId]);

  const totals = useMemo(() => {
    const rows = storyId ? data.stories.filter((story) => story.id === storyId) : data.stories;
    return rows.reduce(
      (sum, story) => ({
        views: sum.views + story.views,
        reads: sum.reads + story.reads,
        claps: sum.claps + story.claps
      }),
      { views: 0, reads: 0, claps: 0 }
    );
  }, [data, storyId]);

  const selected = data.stories.find((story) => story.id === storyId);
  const tiles: { key: Metric | null; label: string; value: string }[] = [
    { key: 'views', label: 'Views', value: formatCount(totals.views) },
    { key: 'reads', label: 'Reads', value: formatCount(totals.reads) },
    { key: null, label: 'Read ratio', value: percent(totals.reads, totals.views) },
    { key: 'claps', label: 'Claps', value: formatCount(totals.claps) }
  ];

  return (
    <>
      <h1 className='font-display text-4xl font-normal tracking-tight'>Stats</h1>
      <p className='mt-1 font-serif text-lg text-muted-foreground'>
        {selected ? (
          <>
            Last {data.days.length} days for <em>{selected.title}</em>.{' '}
            <button type='button' onClick={() => setStoryId(null)} className='underline underline-offset-2 hover:text-foreground'>
              Show all stories
            </button>
          </>
        ) : (
          `Last ${data.days.length} days, across all your stories.`
        )}
      </p>

      <div className='mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-4'>
        {tiles.map((tile) => {
          const isActive = tile.key === metric;
          const content = (
            <>
              <span className='block text-[13px] text-muted-foreground'>{tile.label}</span>
              <span className='mt-0.5 block font-display text-[2rem] leading-tight tabular-nums'>{tile.value}</span>
            </>
          );
          return tile.key ? (
            <button
              key={tile.label}
              type='button'
              aria-pressed={isActive}
              onClick={() => setMetric(tile.key!)}
              className={cn(
                'bg-background px-4 py-3 text-left transition-colors hover:bg-tint/60',
                isActive && 'shadow-[inset_0_-2px_0_var(--primary)]'
              )}
            >
              {content}
            </button>
          ) : (
            <div key={tile.label} className='bg-background px-4 py-3'>{content}</div>
          );
        })}
      </div>

      <div className='mt-6'>
        <DailyChart days={data.days} values={series} metric={metric} />
      </div>

      <h2 className='mt-10 text-sm font-semibold'>By story</h2>
      {data.stories.length ? (
        <div className='mt-2'>
          <table className='w-full text-[13px] sm:text-sm'>
            <thead>
              <tr className='border-b text-left text-[13px] text-muted-foreground'>
                <th scope='col' className='py-2 pr-2 font-normal sm:pr-4'>Story</th>
                <th scope='col' className='px-1.5 py-2 text-right font-normal sm:px-3'>Views</th>
                <th scope='col' className='px-1.5 py-2 text-right font-normal sm:px-3'>Reads</th>
                <th scope='col' className='px-1.5 py-2 text-right font-normal sm:px-3'>
                  <span className='sm:hidden'>Ratio</span>
                  <span className='hidden sm:inline'>Read ratio</span>
                </th>
                <th scope='col' className='py-2 pl-1.5 text-right font-normal sm:pl-3'>Claps</th>
              </tr>
            </thead>
            <tbody>
              {data.stories.map((story) => (
                <tr key={story.id} className={cn('border-b last:border-b-0', story.id === storyId && 'bg-tint/60')}>
                  <td className='py-2.5 pr-2 sm:max-w-[18rem] sm:pr-4'>
                    <button
                      type='button'
                      onClick={() => setStoryId(story.id === storyId ? null : story.id)}
                      className='line-clamp-2 text-left font-medium hover:underline sm:line-clamp-1'
                      title={story.title}
                    >
                      {story.title}
                    </button>
                    <span className='text-xs text-muted-foreground'>
                      {story.live && story.slug ? (
                        <Link to='/story/$slug' params={{ slug: story.slug }} className='hover:underline'>View story</Link>
                      ) : (
                        'Unpublished'
                      )}
                    </span>
                  </td>
                  <td className='px-1.5 py-2.5 text-right tabular-nums sm:px-3'>{story.views.toLocaleString('en-US')}</td>
                  <td className='px-1.5 py-2.5 text-right tabular-nums sm:px-3'>{story.reads.toLocaleString('en-US')}</td>
                  <td className='px-1.5 py-2.5 text-right tabular-nums sm:px-3'>{percent(story.reads, story.views)}</td>
                  <td className='py-2.5 pl-1.5 text-right tabular-nums sm:pl-3'>{story.claps.toLocaleString('en-US')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className='py-10 text-center font-serif text-lg text-muted-foreground'>
          Publish a story and the numbers will start here.
        </p>
      )}
    </>
  );
}
