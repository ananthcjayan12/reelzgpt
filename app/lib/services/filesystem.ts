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

export class FileSystemService {
  private dbName = 'MediaCacheDB';
  private dbVersion = 1;
  private stores = {
    audio: 'audioFiles',
    image: 'imageFiles',
    video: 'videoFiles'
  };

  constructor() {
    // Initialize the database when the service is created
    this.initializeDB().catch(error => {
      console.error('[CacheStorage] Failed to initialize database:', error);
    });
  }

  /**
   * Initialize the IndexedDB database
   */
  private async initializeDB(): Promise<IDBDatabase> {
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
  private async getDB(): Promise<IDBDatabase> {
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
    try {
      console.log(`[CacheStorage] Reading ${type} file: ${fileId}`);
      
      const storeName = this.stores[type];
      const db = await this.getDB();
      
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
    try {
      console.log(`[CacheStorage] Deleting ${type} file: ${fileId}`);
      
      const storeName = this.stores[type];
      const db = await this.getDB();
      
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
    try {
      console.log('[CacheStorage] Clearing all cached files');
      
      const db = await this.getDB();
      const storeNames = Object.values(this.stores);
      
      for (const storeName of storeNames) {
        await new Promise<void>((resolve, reject) => {
          const transaction = db.transaction([storeName], 'readwrite');
          const store = transaction.objectStore(storeName);
          
          const request = store.clear();
          
          request.onsuccess = () => {
            console.log(`[CacheStorage] Successfully cleared ${storeName}`);
            resolve();
          };
          
          request.onerror = (event) => {
            console.error(`[CacheStorage] Error clearing ${storeName}:`, (event.target as IDBRequest).error);
            reject((event.target as IDBRequest).error);
          };
        });
      }
      
      console.log('[CacheStorage] All caches cleared successfully');
    } catch (error) {
      console.error('[CacheStorage] Error clearing cache:', error);
      throw new ProcessingError({
        stage: 'cache-clear',
        message: `Failed to clear cache: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Get the estimated size of the cache
   */
  async getCacheSize(): Promise<{ total: number; audio: number; image: number; video: number }> {
    try {
      const db = await this.getDB();
      const sizes = {
        audio: 0,
        image: 0,
        video: 0,
        total: 0
      };
      
      for (const [type, storeName] of Object.entries(this.stores)) {
        const size = await new Promise<number>((resolve, reject) => {
          const transaction = db.transaction([storeName], 'readonly');
          const store = transaction.objectStore(storeName);
          
          const request = store.getAll();
          
          request.onsuccess = (event) => {
            const blobs = (event.target as IDBRequest).result as Blob[];
            const storeSize = blobs.reduce((total, blob) => total + blob.size, 0);
            resolve(storeSize);
          };
          
          request.onerror = () => resolve(0);
        });
        
        sizes[type as 'audio' | 'image' | 'video'] = size;
        sizes.total += size;
      }
      
      return sizes;
    } catch (error) {
      console.error('[CacheStorage] Error getting cache size:', error);
      return { total: 0, audio: 0, image: 0, video: 0 };
    }
  }
} 