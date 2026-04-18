
// IndexedDB Wrapper for Local Persistence

const DB_NAME = 'QuantDash_Data';
const DB_VERSION = 1;

export const STORES = {
  STOCKS: 'stocks',       // Stores stock lists (key: type)
  LADDER: 'ladder',       // Stores ladder data (key: date string)
  SENTIMENT: 'sentiment'  // Stores sentiment cycle data (key: date string)
};

class LocalDB {
  private db: IDBDatabase | null = null;

  async connect(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error("Database error:", request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // 1. Stock List Store
        if (!db.objectStoreNames.contains(STORES.STOCKS)) {
          db.createObjectStore(STORES.STOCKS, { keyPath: 'type' });
        }
        
        // 2. Ladder Data Store
        if (!db.objectStoreNames.contains(STORES.LADDER)) {
          db.createObjectStore(STORES.LADDER, { keyPath: 'date' });
        }
        
        // 3. Sentiment Data Store
        if (!db.objectStoreNames.contains(STORES.SENTIMENT)) {
          db.createObjectStore(STORES.SENTIMENT, { keyPath: 'date' });
        }
      };
    });
  }

  async get<T>(storeName: string, key: string): Promise<T | undefined> {
    const db = await this.connect();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async put(storeName: string, value: any): Promise<void> {
    const db = await this.connect();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(value);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getAll<T>(storeName: string): Promise<T[]> {
    const db = await this.connect();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }
}

export const db = new LocalDB();
