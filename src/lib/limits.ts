// Product limits shared by the browser and the server.
export const limits = {
  titleMax: 140,
  subtitleMax: 200,
  descriptionMax: 200,
  topicsMax: 5,
  clapsPerReader: 50,
  responseMax: 4000,
  highlightMax: 600,
  bioMax: 200,
  nameMax: 60,
  usernameMin: 3,
  usernameMax: 24,
  reportDetailsMax: 1000,
  imageMaxBytes: 8 * 1024 * 1024,
  imageTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  /** Stored documents larger than this are refused, in characters of JSON. */
  docMaxChars: 400_000,
  /** Accounts younger than this never appear in staff picks. */
  staffPickMinAccountAgeDays: 30
} as const;

export const imageLimitMessage = 'Use a JPG, PNG, WebP, or GIF up to 8 MB.';

const RESERVED_USERNAMES = new Set([
  'admin',
  'api',
  'about',
  'dashboard',
  'help',
  'guidelines',
  'longhand',
  'me',
  'media',
  'moderator',
  'privacy',
  'root',
  'search',
  'settings',
  'sign-in',
  'sign-up',
  'staff',
  'support',
  'system',
  'topics',
  'try',
  'write'
]);

/** Returns an error message, or null when the username is acceptable. */
export function usernameError(username: string): string | null {
  if (username.length < limits.usernameMin)
    return `Use at least ${limits.usernameMin} characters.`;
  if (username.length > limits.usernameMax)
    return `Use at most ${limits.usernameMax} characters.`;
  if (!/^[a-z0-9_]+$/.test(username))
    return 'Use only lowercase letters, numbers, and underscores.';
  if (RESERVED_USERNAMES.has(username)) return 'That username is reserved.';
  return null;
}

export const normalizeUsername = (value: string) =>
  value.trim().replace(/^@/, '').toLowerCase();

/** A same-site path that is safe to redirect to, or the fallback. */
export function safeRedirect(path: unknown, fallback = '/'): string {
  if (typeof path !== 'string') return fallback;
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\'))
    return fallback;
  return path;
}
