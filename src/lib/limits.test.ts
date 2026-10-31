import { describe, expect, it } from 'vitest';
import { normalizeUsername, safeRedirect, usernameError } from '~/lib/limits';

describe('usernames', () => {
  it('normalizes what people type', () => {
    expect(normalizeUsername(' @Wren_H ')).toBe('wren_h');
  });

  it('accepts good names and rejects bad ones', () => {
    expect(usernameError('wren_h')).toBeNull();
    expect(usernameError('ab')).toMatch(/at least/);
    expect(usernameError('a'.repeat(25))).toMatch(/at most/);
    expect(usernameError('has space')).toMatch(/lowercase/);
    expect(usernameError('admin')).toMatch(/reserved/);
  });
});

describe('safeRedirect', () => {
  it('allows same-site paths only', () => {
    expect(safeRedirect('/story/abc?x=1')).toBe('/story/abc?x=1');
    expect(safeRedirect('https://evil.example')).toBe('/');
    expect(safeRedirect('//evil.example')).toBe('/');
    expect(safeRedirect('/\\evil.example')).toBe('/');
    expect(safeRedirect(undefined, '/dashboard')).toBe('/dashboard');
  });
});
