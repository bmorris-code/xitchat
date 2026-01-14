// Offline-First Storage for XitChat
import { Chat, Message, User } from '../types';

class OfflineStorage {
  private dbName = 'XitChatDB';
  private version = 1;
  private db: IDBDatabase | null = null;

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object stores
        if (!db.objectStoreNames.contains('chats')) {
          db.createObjectStore('chats', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('messages')) {
          db.createObjectStore('messages', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('users')) {
          db.createObjectStore('users', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };
    });
  }

  async saveChat(chat: Chat): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const transaction = this.db.transaction(['chats'], 'readwrite');
    const store = transaction.objectStore('chats');
    store.put(chat);
    
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async getChats(): Promise<Chat[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    const transaction = this.db.transaction(['chats'], 'readonly');
    const store = transaction.objectStore('chats');
    const request = store.getAll();
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async saveMessage(message: Message, chatId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const messageWithChat = { ...message, chatId };
    const transaction = this.db.transaction(['messages'], 'readwrite');
    const store = transaction.objectStore('messages');
    store.add(messageWithChat);
    
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async getMessages(chatId: string): Promise<Message[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    const transaction = this.db.transaction(['messages'], 'readonly');
    const store = transaction.objectStore('messages');
    const index = store.index('chatId');
    const request = index.getAll(chatId);
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async saveSetting(key: string, value: any): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const transaction = this.db.transaction(['settings'], 'readwrite');
    const store = transaction.objectStore('settings');
    store.put({ key, value });
    
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async getSetting(key: string): Promise<any> {
    if (!this.db) throw new Error('Database not initialized');
    
    const transaction = this.db.transaction(['settings'], 'readonly');
    const store = transaction.objectStore('settings');
    const request = store.get(key);
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result?.value);
      request.onerror = () => reject(request.error);
    });
  }

  // Sync when online
  async syncWhenOnline(): Promise<void> {
    if (navigator.onLine) {
      console.log('Syncing offline data...');
      // Implement sync logic here
    }
  }
}

export const offlineStorage = new OfflineStorage();
