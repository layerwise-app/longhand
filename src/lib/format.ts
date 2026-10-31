// Formatting shared by the server render and the browser. Dates use UTC so both
// produce identical markup.
const sameYear = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC'
});
const withYear = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC'
});
const long = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC'
});

export function formatDate(iso: string | Date) {
  const date = new Date(iso);
  return date.getUTCFullYear() === new Date().getUTCFullYear()
    ? sameYear.format(date)
    : withYear.format(date);
}

export const formatLongDate = (iso: string | Date) => long.format(new Date(iso));

export function formatCount(value: number) {
  if (value < 1000) return String(value);
  if (value < 10_000) return `${(value / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  if (value < 1_000_000) return `${Math.round(value / 1000)}K`;
  return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
}

export const plural = (count: number, one: string, many = `${one}s`) =>
  `${count.toLocaleString('en-US')} ${count === 1 ? one : many}`;
