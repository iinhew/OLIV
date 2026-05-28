import { Preferences } from '@capacitor/preferences';

export class StorageManager {
  private static cache: Record<string, string> = {};

  /**
   * Initializes the cache by pre-loading keys from Native Preferences.
   * If not found natively, tries to migrate from localStorage.
   */
  static async init(keys: string[]) {
    for (const key of keys) {
      try {
        const { value } = await Preferences.get({ key });
        if (value !== null) {
          this.cache[key] = value;
        } else if (typeof window !== 'undefined') {
          // Fallback to web localStorage & migrate
          const webValue = localStorage.getItem(key);
          if (webValue !== null) {
            this.cache[key] = webValue;
            await Preferences.set({ key, value: webValue });
          }
        }
      } catch (e) {
        console.error(`Error loading key ${key} from Preferences:`, e);
      }
    }
  }

  /**
   * Synchronously gets a value from the in-memory cache.
   */
  static getItem(key: string): string | null {
    return this.cache[key] !== undefined ? this.cache[key] : null;
  }

  /**
   * Synchronously updates the cache and asynchronously saves to Native Storage & localStorage.
   */
  static setItem(key: string, value: string) {
    this.cache[key] = value;
    
    // Save async in background
    Preferences.set({ key, value }).catch(e => console.error(`Error saving ${key} to Preferences:`, e));
    
    // Keep web fallback in sync
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, value);
    }
  }

  /**
   * Synchronously deletes from cache and asynchronously from Native Storage.
   */
  static removeItem(key: string) {
    delete this.cache[key];
    
    Preferences.remove({ key }).catch(e => console.error(`Error removing ${key} from Preferences:`, e));
    
    if (typeof window !== 'undefined') {
      localStorage.removeItem(key);
    }
  }
}
