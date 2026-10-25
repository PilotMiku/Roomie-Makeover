import { describe, expect, it } from 'vitest';
import { normalizeBasePath, resolveBasePath } from './base';

describe('deployment base', () => {
  it.each(['', ' ', '/', '///'])(`normalizes root %j`, (path) => {
    expect(normalizeBasePath(path)).toBe('/');
  });
  it.each([
    'Roomie-Makeover',
    '/Roomie-Makeover',
    'Roomie-Makeover/',
    ' //Roomie-Makeover// ',
  ])('normalizes %j', (path) => {
    expect(normalizeBasePath(path)).toBe('/Roomie-Makeover/');
  });
  it.each([
    'https://example.org/',
    '../room',
    '/room/../',
    '/room?fast=1',
    '/room#home',
    '/room name/',
  ])('rejects unsafe base %j', (path) => {
    expect(() => normalizeBasePath(path)).toThrow();
  });
  it('defaults local builds to root even in a repository environment', () => {
    expect(resolveBasePath({ GITHUB_REPOSITORY: 'owner/actual-room' })).toBe(
      '/',
    );
  });
  it('uses the actual project repository name', () => {
    expect(
      resolveBasePath({
        GITHUB_ACTIONS: 'true',
        GITHUB_REPOSITORY: 'owner/actual-room',
      }),
    ).toBe('/actual-room/');
  });
  it('recognizes user and organization homepages without case sensitivity', () => {
    expect(
      resolveBasePath({
        GITHUB_ACTIONS: 'true',
        GITHUB_REPOSITORY: 'Owner/owner.github.io',
      }),
    ).toBe('/');
  });
  it('honors explicit root for custom domains', () => {
    expect(
      resolveBasePath({
        VITE_BASE_PATH: '/',
        GITHUB_ACTIONS: 'true',
        GITHUB_REPOSITORY: 'owner/project',
      }),
    ).toBe('/');
  });
  it('fails explicitly when the CI repository cannot be resolved', () => {
    expect(() => resolveBasePath({ GITHUB_ACTIONS: 'true' })).toThrow();
  });
});
