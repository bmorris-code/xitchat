// Device-bound key storage using IndexedDB.
// No accounts, no server. Keys persist on the device.

const DB_NAME = 'xitchat-secure-store';
const DB_VERSION = 1;
const STORE_NAME = 'keys';
const MASTER_KEY_ID = 'device-master-key-v1';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getFromStore<T>(key: string): Promise<T | null> {
  const db = await openDb();
  try {
    return await new Promise<T | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

async function putInStore<T>(key: string, value: T): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(value as any, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export async function getOrCreateDeviceMasterKey(): Promise<CryptoKey> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    throw new Error('IndexedDB not available');
  }
  if (!window.crypto?.subtle) {
    throw new Error('WebCrypto not available');
  }

  const existing = await getFromStore<CryptoKey>(MASTER_KEY_ID);
  if (existing) return existing;

  // Non-exportable, device-bound key; persists via IndexedDB structured clone.
  const created = await window.crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  await putInStore(MASTER_KEY_ID, created);
  return created;
}

