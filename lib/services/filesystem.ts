import { ProcessingError as ProcessingErrorClass } from '@/types';

// Create a proper error class
class ProcessingError extends Error {
  stage: string;
  timestamp: Date;

  constructor({ stage, message, timestamp }: { stage: string; message: string; timestamp: Date }) {
    super(message);
    this.stage = stage;
    this.timestamp = timestamp;
    this.name = 'ProcessingError';
  }
}

// Helper to check if code is running in browser environment
const isBrowser = () => typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';

export class FileSystemService {
  private dbName = 'MediaCacheDB';
  private dbVersion = 1;
  private stores = {
    audio: 'audioFiles',
    image: 'imageFiles',
    video: 'videoFiles'
  };
  private isInitialized = false;

  constructor() {
    // Initialize the database when the service is created, but only in browser environment
    if (isBrowser()) {
      this.initializeDB().catch(error => {
        console.error('[CacheStorage] Failed to initialize database:', error);
      });
    } else {
      console.log('[CacheStorage] Not initializing IndexedDB (not in browser environment)');
    }
  }

  /**
   * Initialize the IndexedDB database
   */
  private async initializeDB(): Promise<IDBDatabase | null> {
    if (!isBrowser()) {
      console.log('[CacheStorage] IndexedDB not available (not in browser environment)');
      return null;
    }

    return new Promise((resolve, reject) => {
      console.log('[CacheStorage] Initializing database');
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onupgradeneeded = (event) => {
        console.log('[CacheStorage] Database upgrade needed');
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create object stores if they don't exist
        if (!db.objectStoreNames.contains(this.stores.audio)) {
          db.createObjectStore(this.stores.audio);
          console.log(`[CacheStorage] Created ${this.stores.audio} store`);
        }
        
        if (!db.objectStoreNames.contains(this.stores.image)) {
          db.createObjectStore(this.stores.image);
          console.log(`[CacheStorage] Created ${this.stores.image} store`);
        }
        
        if (!db.objectStoreNames.contains(this.stores.video)) {
          db.createObjectStore(this.stores.video);
          console.log(`[CacheStorage] Created ${this.stores.video} store`);
        }
      };

      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        console.log('[CacheStorage] Database initialized successfully');
        this.isInitialized = true;
        resolve(db);
      };

      request.onerror = (event) => {
        console.error('[CacheStorage] Database initialization error:', (event.target as IDBOpenDBRequest).error);
        reject((event.target as IDBOpenDBRequest).error);
      };
    });
  }

  /**
   * Get a database connection
   */
  private async getDB(): Promise<IDBDatabase | null> {
    if (!isBrowser()) {
      console.log('[CacheStorage] IndexedDB not available (not in browser environment)');
      return null;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onsuccess = (event) => {
        resolve((event.target as IDBOpenDBRequest).result);
      };

      request.onerror = (event) => {
        reject((event.target as IDBOpenDBRequest).error);
      };
    });
  }

  /**
   * Initialize the storage (compatibility method with old API)
   */
  async initialize(userInitiated = false): Promise<boolean> {
    if (!isBrowser()) {
      console.log('[CacheStorage] IndexedDB not available (not in browser environment)');
      return false;
    }

    try {
      await this.initializeDB();
      return true;
    } catch (error) {
      console.error('[CacheStorage] Initialization error:', error);
      return false;
    }
  }

  /**
   * Save a file to the cache
   */
  async saveFile(data: Blob | Buffer, filename: string, type: 'image' | 'audio' | 'video'): Promise<string> {
    if (!isBrowser()) {
      console.log('[CacheStorage] IndexedDB not available (not in browser environment)');
      return `mock-${Date.now()}-${filename}`;
    }

    try {
      console.log(`[CacheStorage] Saving ${type} file: ${filename}`);
      
      // Create a unique ID for the file
      const fileId = `${Date.now()}-${filename}`;
      const storeName = this.stores[type];
      
      // Convert Buffer to Blob if needed
      const blob = data instanceof Blob ? data : new Blob([data], { 
        type: type === 'audio' ? 'audio/mpeg' : 
              type === 'image' ? 'image/png' : 
              'video/mp4' 
      });
      
      // Save to IndexedDB
      const db = await this.getDB();
      if (!db) return fileId;
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        
        const request = store.put(blob, fileId);
        
        request.onsuccess = () => {
          console.log(`[CacheStorage] Successfully saved ${type} file: ${fileId}`);
          resolve(fileId);
        };
        
        request.onerror = (event) => {
          console.error(`[CacheStorage] Error saving ${type} file:`, (event.target as IDBRequest).error);
          reject(new ProcessingError({
            stage: 'file-save',
            message: `Failed to save ${type} file: ${(event.target as IDBRequest).error?.message || 'Unknown error'}`,
            timestamp: new Date(),
          }));
        };
      });
    } catch (error: any) {
      console.error('[CacheStorage] File save error:', error);
      throw new ProcessingError({
        stage: 'file-save',
        message: `Failed to save ${type} file: ${error.message}`,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Read a file from the cache
   */
  async readFile(fileId: string, type: 'image' | 'audio' | 'video'): Promise<Blob> {
    if (!isBrowser()) {
      console.log('[CacheStorage] IndexedDB not available (not in browser environment)');
      // Return an empty blob when not in browser
      return new Blob([], { type: 'application/octet-stream' });
    }

    try {
      console.log(`[CacheStorage] Reading ${type} file: ${fileId}`);
      
      const storeName = this.stores[type];
      const db = await this.getDB();
      
      if (!db) {
        throw new ProcessingError({
          stage: 'file-read',
          message: 'IndexedDB not available',
          timestamp: new Date(),
        });
      }
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        
        const request = store.get(fileId);
        
        request.onsuccess = (event) => {
          const blob = (event.target as IDBRequest).result as Blob;
          
          if (!blob) {
            console.error(`[CacheStorage] File not found: ${fileId}`);
            reject(new ProcessingError({
              stage: 'file-read',
              message: `File not found: ${fileId}`,
              timestamp: new Date(),
            }));
            return;
          }
          
          console.log(`[CacheStorage] Successfully read ${type} file:`, {
            type: blob.type,
            size: blob.size
          });
          
          resolve(blob);
        };
        
        request.onerror = (event) => {
          console.error(`[CacheStorage] Error reading ${type} file:`, (event.target as IDBRequest).error);
          reject(new ProcessingError({
            stage: 'file-read',
            message: `Failed to read ${type} file: ${(event.target as IDBRequest).error?.message || 'Unknown error'}`,
            timestamp: new Date(),
          }));
        };
      });
    } catch (error: any) {
      console.error('[CacheStorage] File read error:', error);
      throw new ProcessingError({
        stage: 'file-read',
        message: `Failed to read ${type} file: ${error.message}`,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Delete a file from the cache
   */
  async deleteFile(fileId: string, type: 'image' | 'audio' | 'video'): Promise<void> {
    if (!isBrowser()) {
      console.log('[CacheStorage] IndexedDB not available (not in browser environment)');
      return;
    }

    try {
      console.log(`[CacheStorage] Deleting ${type} file: ${fileId}`);
      
      const storeName = this.stores[type];
      const db = await this.getDB();
      
      if (!db) {
        throw new ProcessingError({
          stage: 'file-delete',
          message: 'IndexedDB not available',
          timestamp: new Date(),
        });
      }
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        
        const request = store.delete(fileId);
        
        request.onsuccess = () => {
          console.log(`[CacheStorage] Successfully deleted ${type} file: ${fileId}`);
          resolve();
        };
        
        request.onerror = (event) => {
          console.error(`[CacheStorage] Error deleting ${type} file:`, (event.target as IDBRequest).error);
          reject(new ProcessingError({
            stage: 'file-delete',
            message: `Failed to delete ${type} file: ${(event.target as IDBRequest).error?.message || 'Unknown error'}`,
            timestamp: new Date(),
          }));
        };
      });
    } catch (error: any) {
      console.error('[CacheStorage] File delete error:', error);
      throw new ProcessingError({
        stage: 'file-delete',
        message: `Failed to delete ${type} file: ${error.message}`,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Clear all cached files
   */
  async clearCache(): Promise<void> {
    if (!isBrowser()) {
      console.log('[CacheStorage] IndexedDB not available (not in browser environment)');
      return;
    }

    try {
      console.log('[CacheStorage] Clearing all cached files');
      
      const db = await this.getDB();
      
      if (!db) {
        throw new ProcessingError({
          stage: 'cache-clear',
          message: 'IndexedDB not available',
          timestamp: new Date(),
        });
      }
      
      // Clear each store
      for (const storeType of Object.keys(this.stores) as Array<keyof typeof this.stores>) {
        const storeName = this.stores[storeType];
        
        await new Promise<void>((resolve, reject) => {
          const transaction = db.transaction([storeName], 'readwrite');
          const store = transaction.objectStore(storeName);
          
          const request = store.clear();
          
          request.onsuccess = () => {
            console.log(`[CacheStorage] Successfully cleared ${storeName} store`);
            resolve();
          };
          
          request.onerror = (event) => {
            console.error(`[CacheStorage] Error clearing ${storeName} store:`, (event.target as IDBRequest).error);
            reject(new ProcessingError({
              stage: 'cache-clear',
              message: `Failed to clear ${storeName} store: ${(event.target as IDBRequest).error?.message || 'Unknown error'}`,
              timestamp: new Date(),
            }));
          };
        });
      }
      
      console.log('[CacheStorage] Successfully cleared all cached files');
    } catch (error: any) {
      console.error('[CacheStorage] Cache clear error:', error);
      throw new ProcessingError({
        stage: 'cache-clear',
        message: `Failed to clear cache: ${error.message}`,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Get the size of all cached files
   */
  async getCacheSize(): Promise<{ total: number; audio: number; image: number; video: number }> {
    if (!isBrowser()) {
      console.log('[CacheStorage] IndexedDB not available (not in browser environment)');
      return { total: 0, audio: 0, image: 0, video: 0 };
    }

    try {
      console.log('[CacheStorage] Getting cache size');
      
      const db = await this.getDB();
      
      if (!db) {
        throw new ProcessingError({
          stage: 'cache-size',
          message: 'IndexedDB not available',
          timestamp: new Date(),
        });
      }
      
      const result = { total: 0, audio: 0, image: 0, video: 0 };
      
      // Get size for each store
      for (const storeType of Object.keys(this.stores) as Array<keyof typeof this.stores>) {
        const storeName = this.stores[storeType];
        
        const size = await new Promise<number>((resolve, reject) => {
          const transaction = db.transaction([storeName], 'readonly');
          const store = transaction.objectStore(storeName);
          const request = store.openCursor();
          
          let storeSize = 0;
          
          request.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest).result as IDBCursorWithValue;
            
            if (cursor) {
              const blob = cursor.value as Blob;
              storeSize += blob.size;
              cursor.continue();
            } else {
              resolve(storeSize);
            }
          };
          
          request.onerror = (event) => {
            console.error(`[CacheStorage] Error getting size for ${storeName}:`, (event.target as IDBRequest).error);
            reject(new ProcessingError({
              stage: 'cache-size',
              message: `Failed to get size for ${storeName}: ${(event.target as IDBRequest).error?.message || 'Unknown error'}`,
              timestamp: new Date(),
            }));
          };
        });
        
        result[storeType] = size;
        result.total += size;
      }
      
      console.log('[CacheStorage] Cache size:', result);
      return result;
    } catch (error: any) {
      console.error('[CacheStorage] Error getting cache size:', error);
      throw new ProcessingError({
        stage: 'cache-size',
        message: `Failed to get cache size: ${error.message}`,
        timestamp: new Date(),
      });
    }
  }
} 