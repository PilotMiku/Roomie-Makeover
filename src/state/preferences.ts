import { create } from 'zustand';
import { z } from 'zod';
import { PREFERENCES_VERSION, SETTINGS_KEY } from '../data/constants';

const preferencesSchema = z
  .object({
    version: z.literal(PREFERENCES_VERSION),
    reduceMotion: z.boolean(),
    highContrast: z.boolean(),
  })
  .strict();

type Preferences = z.infer<typeof preferencesSchema>;
type PreferenceKey = 'reduceMotion' | 'highContrast';
type StorageStatus = 'ready' | 'unavailable' | 'invalid';

export const defaultPreferences: Preferences = {
  version: PREFERENCES_VERSION,
  reduceMotion: false,
  highContrast: false,
};

export function readPreferences(storage: Pick<Storage, 'getItem'>): {
  preferences: Preferences;
  storageStatus: StorageStatus;
} {
  try {
    const raw = storage.getItem(SETTINGS_KEY);
    if (raw === null)
      return { preferences: { ...defaultPreferences }, storageStatus: 'ready' };
    const result = preferencesSchema.safeParse(JSON.parse(raw));
    if (!result.success)
      return {
        preferences: { ...defaultPreferences },
        storageStatus: 'invalid',
      };
    return { preferences: result.data, storageStatus: 'ready' };
  } catch (error) {
    return {
      preferences: { ...defaultPreferences },
      storageStatus: error instanceof SyntaxError ? 'invalid' : 'unavailable',
    };
  }
}

function loadPreferences() {
  try {
    return readPreferences(window.localStorage);
  } catch {
    return {
      preferences: { ...defaultPreferences },
      storageStatus: 'unavailable' as const,
    };
  }
}

interface PreferencesStore {
  preferences: Preferences;
  storageStatus: StorageStatus;
  setPreference: (key: PreferenceKey, value: boolean) => void;
}

export const usePreferences = create<PreferencesStore>((set, get) => ({
  ...loadPreferences(),
  setPreference: (key, value) => {
    const preferences = { ...get().preferences, [key]: value };
    // Preserve an unrecognized original; no silent overwrite of newer/corrupt data.
    if (get().storageStatus === 'invalid') {
      set({ preferences });
      return;
    }
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(preferences));
      set({ preferences, storageStatus: 'ready' });
    } catch {
      set({ preferences, storageStatus: 'unavailable' });
    }
  },
}));
