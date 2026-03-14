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

class LocalStorageService {
  private static instance: LocalStorageService;
  private readonly STORAGE_PREFIX = 'xitchat_';
  private readonly QUOTA_LIMIT = 100 * 1024 * 1024; // 100MB limit
  private compressionEnabled = true;

  static getInstance(): LocalStorageService {
    if (!LocalStorageService.instance) {
      LocalStorageService.instance = new LocalStorageService();
    }
    return LocalStorageService.instance;
  }

  // Check storage quota
  getStorageQuota(): StorageQuota {
    let used = 0;
    
    try {
      for (let key in localStorage) {
        if (key.startsWith(this.STORAGE_PREFIX)) {
          used += localStorage[key].length;
        }
      }
    } catch (error) {
      console.error('Failed to calculate storage usage:', error);
    }

    return {
      used,
      total: this.QUOTA_LIMIT,
      available: this.QUOTA_LIMIT - used
    };
  }

  // Store data with compression
  async storeData(key: string, data: any): Promise<boolean> {
    try {
      const fullKey = this.STORAGE_PREFIX + key;
      const serialized = JSON.stringify(data);
      
      // Check quota
      const quota = this.getStorageQuota();
      if (quota.used + serialized.length > quota.total) {
        await this.cleanupOldData();
        
        // Check again after cleanup
        const newQuota = this.getStorageQuota();
        if (newQuota.used + serialized.length > newQuota.total) {
          throw new Error('Storage quota exceeded');
        }
      }

      // Compress data if enabled
      const finalData = this.compressionEnabled ? await this.compress(serialized) : serialized;
      
      localStorage.setItem(fullKey, finalData);
      return true;
    } catch (error) {
      console.error('Failed to store data:', error);
      return false;
    }
  }

  // Retrieve data with decompression
  async retrieveData(key: string): Promise<any> {
    try {
      const fullKey = this.STORAGE_PREFIX + key;
      const stored = localStorage.getItem(fullKey);
      
      if (!stored) {
        return null;
      }

      // Decompress if needed
      const decompressed = this.compressionEnabled ? await this.decompress(stored) : stored;
      
      // Enhanced JSON parsing with error recovery
      try {
        return JSON.parse(decompressed);
      } catch (parseError) {
        console.warn(`JSON parse failed for key ${key}, attempting recovery...`, parseError.message);
        
        // Try to fix common JSON issues
        let fixedJson = decompressed;
        
        // Remove trailing commas
        fixedJson = fixedJson.replace(/,(\s*[}\]])/g, '$1');
        
        // Fix quotes around property names
        fixedJson = fixedJson.replace(/(\w+):/g, '"$1":');
        
        try {
          return JSON.parse(fixedJson);
        } catch (secondError) {
          console.error(`JSON recovery failed for key ${key}, clearing corrupted data`);
          // Clear corrupted data to prevent repeated errors
          localStorage.removeItem(fullKey);
          return null;
        }
      }
    } catch (error) {
      console.error('Failed to retrieve data:', error);
      return null;
    }
  }

  // Delete data
  deleteData(key: string): boolean {
    try {
      const fullKey = this.STORAGE_PREFIX + key;
      localStorage.removeItem(fullKey);
      return true;
    } catch (error) {
      console.error('Failed to delete data:', error);
      return false;
    }
  }

  // Store encrypted message
  async storeEncryptedMessage(chatId: string, messageId: string, encryptedMessage: any): Promise<boolean> {
    const key = `messages_${chatId}`;
    const existingMessages = await this.retrieveData(key) || [];
    
    const messageData = {
      id: messageId,
      encrypted: encryptedMessage,
      timestamp: Date.now(),
      storedAt: Date.now()
    };

    existingMessages.push(messageData);
    return await this.storeData(key, existingMessages);
  }

  // Retrieve encrypted messages for chat
  async getEncryptedMessages(chatId: string): Promise<any[]> {
    const key = `messages_${chatId}`;
    return await this.retrieveData(key) || [];
  }

  // Store encrypted image
  async storeEncryptedImage(imageId: string, encryptedImage: any, metadata: any): Promise<boolean> {
    const key = `images_${imageId}`;
    const imageData = {
      id: imageId,
      encrypted: encryptedImage,
      metadata,
      timestamp: Date.now(),
      storedAt: Date.now()
    };

    return await this.storeData(key, imageData);
  }

  // Retrieve encrypted image
  async getEncryptedImage(imageId: string): Promise<any> {
    const key = `images_${imageId}`;
    return await this.retrieveData(key);
  }

  // Delete message
  async deleteMessage(chatId: string, messageId: string): Promise<boolean> {
    const key = `messages_${chatId}`;
    const messages = await this.retrieveData(key) || [];
    
    const filteredMessages = messages.filter((msg: any) => msg.id !== messageId);
    return await this.storeData(key, filteredMessages);
  }

  // Delete image
  async deleteImage(imageId: string): Promise<boolean> {
    return this.deleteData(`images_${imageId}`);
  }

  // Clear all data (factory reset)
  async clearAllData(): Promise<boolean> {
    try {
      const keysToRemove: string[] = [];
      
      for (let key in localStorage) {
        if (key.startsWith(this.STORAGE_PREFIX)) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach(key => localStorage.removeItem(key));
      return true;
    } catch (error) {
      console.error('Failed to clear all data:', error);
      return false;
    }
  }

  // Export data for backup (user-controlled)
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

      // Get all message data
      for (let key in localStorage) {
        if (key.startsWith(this.STORAGE_PREFIX + 'messages_')) {
          const chatId = key.replace(this.STORAGE_PREFIX + 'messages_', '');
          exportData.messages.push({
            chatId,
            data: await this.retrieveData(`messages_${chatId}`)
          });
        }
      }

      // Get all image data
      for (let key in localStorage) {
        if (key.startsWith(this.STORAGE_PREFIX + 'images_')) {
          const imageId = key.replace(this.STORAGE_PREFIX + 'images_', '');
          exportData.images.push({
            imageId,
            data: await this.retrieveData(`images_${imageId}`)
          });
        }
      }

      return JSON.stringify(exportData);
    } catch (error) {
      console.error('Failed to export data:', error);
      throw error;
    }
  }

  // Import data from backup
  async importData(exportedData: string): Promise<boolean> {
    try {
      const data: StoredData = JSON.parse(exportedData);
      
      // Clear existing data
      await this.clearAllData();
      
      // Import all data
      await this.storeData('chats', data.chats);
      await this.storeData('userSettings', data.userSettings);
      await this.storeData('encryptionKeys', data.encryptionKeys);
      await this.storeData('privacySettings', data.privacySettings);
      
      // Import messages
      for (const msgData of data.messages) {
        await this.storeData(`messages_${msgData.chatId}`, msgData.data);
      }
      
      // Import images
      for (const imgData of data.images) {
        await this.storeData(`images_${imgData.imageId}`, imgData.data);
      }
      
      return true;
    } catch (error) {
      console.error('Failed to import data:', error);
      return false;
    }
  }

  // Clean up old data to free space
  private async cleanupOldData(): Promise<void> {
    try {
      const cutoffTime = Date.now() - (30 * 24 * 60 * 60 * 1000); // 30 days ago
      
      // Clean up old messages
      for (let key in localStorage) {
        if (key.startsWith(this.STORAGE_PREFIX + 'messages_')) {
          const messages = await this.retrieveData(key.replace(this.STORAGE_PREFIX, ''));
          if (messages) {
            const filtered = messages.filter((msg: any) => msg.timestamp > cutoffTime);
            if (filtered.length !== messages.length) {
              await this.storeData(key.replace(this.STORAGE_PREFIX, ''), filtered);
            }
          }
        }
      }

      // Clean up old images
      for (let key in localStorage) {
        if (key.startsWith(this.STORAGE_PREFIX + 'images_')) {
          const image = await this.retrieveData(key.replace(this.STORAGE_PREFIX, ''));
          if (image && image.timestamp < cutoffTime) {
            localStorage.removeItem(key);
          }
        }
      }
    } catch (error) {
      console.error('Failed to cleanup old data:', error);
    }
  }

  // Securely store data with encryption
  private async compress(data: string): Promise<string> {
    try {
      const { encryptionService } = await import('./encryptionService');
      const encrypted = await encryptionService.encryptSymmetric(data);
      // Return as JSON string with a marker
      return JSON.stringify({ _sv: 1, ...encrypted });
    } catch (error) {
      console.error('Secure storage failed, falling back to plaintext:', error);
      return data;
    }
  }

  // Securely retrieve and decrypt data
  private async decompress(data: string): Promise<string> {
    try {
      if (!data.startsWith('{')) return data; // Not JSON, likely old plaintext
      
      const parsed = JSON.parse(data);
      if (parsed?._sv !== 1) return data; // Not an encrypted payload

      const { encryptionService } = await import('./encryptionService');
      const decrypted = await encryptionService.decryptSymmetric(parsed);
      return decrypted || data;
    } catch (error) {
      // If it's not valid JSON or decryption fails, return as-is (might be old format)
      return data;
    }
  }

  // Get storage statistics
  async getStorageStats(): Promise<any> {
    const quota = this.getStorageQuota();
    const stats = {
      quota,
      dataTypes: {
        messages: 0,
        images: 0,
        settings: 0,
        other: 0
      },
      itemCounts: {
        messages: 0,
        images: 0,
        chats: 0
      }
    };

    try {
      for (let key in localStorage) {
        if (key.startsWith(this.STORAGE_PREFIX)) {
          const size = localStorage[key].length;
          const cleanKey = key.replace(this.STORAGE_PREFIX, '');
          
          if (cleanKey.startsWith('messages_')) {
            stats.dataTypes.messages += size;
            const messages = JSON.parse(localStorage[key]);
            stats.itemCounts.messages += messages.length;
          } else if (cleanKey.startsWith('images_')) {
            stats.dataTypes.images += size;
            stats.itemCounts.images++;
          } else if (cleanKey.includes('settings') || cleanKey.includes('keys')) {
            stats.dataTypes.settings += size;
          } else if (cleanKey === 'chats') {
            stats.dataTypes.other += size;
            stats.itemCounts.chats = JSON.parse(localStorage[key]).length;
          } else {
            stats.dataTypes.other += size;
          }
        }
      }
    } catch (error) {
      console.error('Failed to get storage stats:', error);
    }

    return stats;
  }
}

export const localStorageService = LocalStorageService.getInstance();
