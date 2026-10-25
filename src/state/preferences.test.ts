import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SETTINGS_KEY } from '../data/constants';
import {
  defaultPreferences,
  readPreferences,
  usePreferences,
} from './preferences';

beforeEach(() => {
  localStorage.clear();
  usePreferences.setState({
    preferences: { ...defaultPreferences },
    storageStatus: 'ready',
  });
});

describe('preferences storage', () => {
  it('uses safe defaults for a new browser', () => {
    expect(readPreferences(localStorage)).toEqual({
      preferences: defaultPreferences,
      storageStatus: 'ready',
    });
  });
  it('round trips a changed preference', () => {
    usePreferences.getState().setPreference('highContrast', true);
    expect(readPreferences(localStorage).preferences.highContrast).toBe(true);
  });
  it.each([
    '{broken',
    '{"version":"99.0","reduceMotion":true,"highContrast":true}',
    '{"version":"1.0","reduceMotion":"true","highContrast":false}',
  ])('preserves unrecognized data: %s', (raw) => {
    localStorage.setItem(SETTINGS_KEY, raw);
    const loaded = readPreferences(localStorage);
    expect(loaded.storageStatus).toBe('invalid');
    usePreferences.setState(loaded);
    usePreferences.getState().setPreference('reduceMotion', true);
    expect(localStorage.getItem(SETTINGS_KEY)).toBe(raw);
    expect(usePreferences.getState().preferences.reduceMotion).toBe(true);
  });
  it('handles unavailable reads', () => {
    const storage = {
      getItem: () => {
        throw new DOMException('blocked', 'SecurityError');
      },
    };
    expect(readPreferences(storage).storageStatus).toBe('unavailable');
  });
  it('keeps a working in-memory preference when writes fail', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    usePreferences.getState().setPreference('highContrast', true);
    expect(usePreferences.getState().preferences.highContrast).toBe(true);
    expect(usePreferences.getState().storageStatus).toBe('unavailable');
  });
});
