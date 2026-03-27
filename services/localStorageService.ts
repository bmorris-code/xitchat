// Local Storage Service - Ensures all data stays on device
// No external API calls, no cloud sync, completely offline

export interface StorageQuota {
  used: number;
  total: number;
  available: number;
}

export interface StoredData {
  chats: any[];
  messages: any[];
  images: any[];
  userSettings: any;
  encryptionKeys: any;
  privacySettings: any;
}

// ── FIX #4: removed static singleton — just export the instance directly ──
class LocalStorageService {
  private readonly STORAGE_PREFIX = 'xitchat_';
  // ── FIX #3: corrected to real browser localStorage limit ──
  private readonly QUOTA_LIMIT = 5 * 1024 * 1024; // 5MB — real browser limit

  // ── FIX #5: safe localStorage key iteration helper ──
  private getStorageKeys(): string[] {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) keys.push(key);
    }
    return keys;
  }

  getStorageQuota(): StorageQuota {
    let used = 0;
    try {
      this.getStorageKeys().forEach(key => {
        if (key.startsWith(this.STORAGE_PREFIX)) {
          used += (localStorage.getItem(key) || '').length;
        }
      });
    } catch (error) {
      console.error('Failed to calculate storage usage:', error);
    }
    return { used, total: this.QUOTA_LIMIT, available: this.QUOTA_LIMIT - used };
  }

  async storeData(key: string, data: any): Promise<boolean> {
    try {
      const fullKey = this.STORAGE_PREFIX + key;
      const serialized = JSON.stringify(data);

      const quota = this.getStorageQuota();
      if (quota.used + serialized.length > quota.total) {
        await this.cleanupOldData();
        const newQuota = this.getStorageQuota();
        if (newQuota.used + serialized.length > newQuota.total) {
          throw new Error('Storage quota exceeded');
        }
      }

      // ── FIX #1: no compression — avoids circular dependency with encryptionService ──
      // Data-at-rest encryption is handled by the OS on Android/iOS.
      localStorage.setItem(fullKey, serialized);
      return true;
    } catch (error) {
      console.error('Failed to store data:', error);
      return false;
    }
  }

  async retrieveData(key: string): Promise<any> {
    try {
      const fullKey = this.STORAGE_PREFIX + key;
      const stored = localStorage.getItem(fullKey);
      if (!stored) return null;

      // ── FIX #1: handle legacy encrypted payloads gracefully ──
      const decompressed = await this.legacyDecryptIfNeeded(stored);

      // ── FIX #2: removed broken JSON recovery regex — just clear and return null ──
      try {
        return JSON.parse(decompressed);
      } catch {
        console.warn(`Corrupted data for key ${key} — clearing`);
        localStorage.removeItem(fullKey);
        return null;
      }
    } catch (error) {
      console.error('Failed to retrieve data:', error);
      return null;
    }
  }

  // ── FIX #1: handle legacy encrypted payloads written by old compress() ──
  private async legacyDecryptIfNeeded(stored: string): Promise<string> {
    if (!stored.startsWith('{"_sv":1,')) return stored;
    try {
      const { encryptionService } = await import('./encryptionService');
      const parsed = JSON.parse(stored);
      const decrypted = await encryptionService.decryptSymmetric(parsed);
      return decrypted || stored;
    } catch {
      return stored;
    }
  }

  deleteData(key: string): boolean {
    try {
      localStorage.removeItem(this.STORAGE_PREFIX + key);
      return true;
    } catch (error) {
      console.error('Failed to delete data:', error);
      return false;
    }
  }

  async storeEncryptedMessage(chatId: string, messageId: string, encryptedMessage: any): Promise<boolean> {
    const key = `messages_${chatId}`;
    const existingMessages = await this.retrieveData(key) || [];
    existingMessages.push({ id: messageId, encrypted: encryptedMessage, timestamp: Date.now(), storedAt: Date.now() });
    return this.storeData(key, existingMessages);
  }

  async getEncryptedMessages(chatId: string): Promise<any[]> {
    return await this.retrieveData(`messages_${chatId}`) || [];
  }

  async storeEncryptedImage(imageId: string, encryptedImage: any, metadata: any): Promise<boolean> {
    return this.storeData(`images_${imageId}`, {
      id: imageId, encrypted: encryptedImage, metadata,
      timestamp: Date.now(), storedAt: Date.now()
    });
  }

  async getEncryptedImage(imageId: string): Promise<any> {
    return this.retrieveData(`images_${imageId}`);
  }

  async deleteMessage(chatId: string, messageId: string): Promise<boolean> {
    const messages = await this.retrieveData(`messages_${chatId}`) || [];
    return this.storeData(`messages_${chatId}`, messages.filter((m: any) => m.id !== messageId));
  }

  async deleteImage(imageId: string): Promise<boolean> {
    return this.deleteData(`images_${imageId}`);
  }

  async clearAllData(): Promise<boolean> {
    try {
      // ── FIX #5: use safe key iteration ──
      const keysToRemove = this.getStorageKeys().filter(k => k.startsWith(this.STORAGE_PREFIX));
      keysToRemove.forEach(key => localStorage.removeItem(key));
      return true;
    } catch (error) {
      console.error('Failed to clear all data:', error);
      return false;
    }
  }

  async exportData(): Promise<string> {
    try {
      const exportData: StoredData = {
        chats: await this.retrieveData('chats') || [],
        messages: [],
        images: [],
        userSettings: await this.retrieveData('userSettings') || {},
        encryptionKeys: await this.retrieveData('encryptionKeys') || {},
        privacySettings: await this.retrieveData('privacySettings') || {}
      };

      // ── FIX #5: safe key iteration ──
      const allKeys = this.getStorageKeys();

      for (const key of allKeys) {
        if (key.startsWith(this.STORAGE_PREFIX + 'messages_')) {
          const chatId = key.replace(this.STORAGE_PREFIX + 'messages_', '');
          exportData.messages.push({ chatId, data: await this.retrieveData(`messages_${chatId}`) });
        }
      }

      for (const key of allKeys) {
        if (key.startsWith(this.STORAGE_PREFIX + 'images_')) {
          const imageId = key.replace(this.STORAGE_PREFIX + 'images_', '');
          exportData.images.push({ imageId, data: await this.retrieveData(`images_${imageId}`) });
        }
      }

      return JSON.stringify(exportData);
    } catch (error) {
      console.error('Failed to export data:', error);
      throw error;
    }
  }

  async importData(exportedData: string): Promise<boolean> {
    try {
      const data: StoredData = JSON.parse(exportedData);
      await this.clearAllData();
      await this.storeData('chats', data.chats);
      await this.storeData('userSettings', data.userSettings);
      await this.storeData('encryptionKeys', data.encryptionKeys);
      await this.storeData('privacySettings', data.privacySettings);
      for (const msgData of data.messages) await this.storeData(`messages_${msgData.chatId}`, msgData.data);
      for (const imgData of data.images) await this.storeData(`images_${imgData.imageId}`, imgData.data);
      return true;
    } catch (error) {
      console.error('Failed to import data:', error);
      return false;
    }
  }

  private async cleanupOldData(): Promise<void> {
    try {
      const cutoffTime = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const allKeys = this.getStorageKeys();

      for (const key of allKeys) {
        if (key.startsWith(this.STORAGE_PREFIX + 'messages_')) {
          const cleanKey = key.replace(this.STORAGE_PREFIX, '');
          const messages = await this.retrieveData(cleanKey);
          if (messages) {
            const filtered = messages.filter((m: any) => m.timestamp > cutoffTime);
            if (filtered.length !== messages.length) await this.storeData(cleanKey, filtered);
          }
        }
        if (key.startsWith(this.STORAGE_PREFIX + 'images_')) {
          const cleanKey = key.replace(this.STORAGE_PREFIX, '');
          const image = await this.retrieveData(cleanKey);
          if (image?.timestamp < cutoffTime) localStorage.removeItem(key);
        }
      }
    } catch (error) {
      console.error('Failed to cleanup old data:', error);
    }
  }

  async getStorageStats(): Promise<any> {
    const quota = this.getStorageQuota();
    const stats = {
      quota,
      dataTypes: { messages: 0, images: 0, settings: 0, other: 0 },
      itemCounts: { messages: 0, images: 0, chats: 0 }
    };

    try {
      this.getStorageKeys().forEach(key => {
        if (!key.startsWith(this.STORAGE_PREFIX)) return;
        const value = localStorage.getItem(key) || '';
        const size = value.length;
        const cleanKey = key.replace(this.STORAGE_PREFIX, '');

        if (cleanKey.startsWith('messages_')) {
          stats.dataTypes.messages += size;
          try { stats.itemCounts.messages += JSON.parse(value).length; } catch {}
        } else if (cleanKey.startsWith('images_')) {
          stats.dataTypes.images += size;
          stats.itemCounts.images++;
        } else if (cleanKey.includes('settings') || cleanKey.includes('keys')) {
          stats.dataTypes.settings += size;
        } else if (cleanKey === 'chats') {
          stats.dataTypes.other += size;
          try { stats.itemCounts.chats = JSON.parse(value).length; } catch {}
        } else {
          stats.dataTypes.other += size;
        }
      });
    } catch (error) {
      console.error('Failed to get storage stats:', error);
    }

    return stats;
  }
}

// ── FIX #4: simple export, no redundant singleton ──
export const localStorageService = new LocalStorageService();
