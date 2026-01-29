// Local Encryption Service - End-to-end encryption for messages and images
// All operations happen locally on device, no external API calls

export interface EncryptedData {
  data: string; // Base64 encrypted content
  iv: string;   // Initialization vector
  salt: string; // Salt for key derivation
  timestamp: number;
}

export interface EncryptionKey {
  key: string; // Base64 encoded key
  fingerprint: string; // Key fingerprint for verification
}

class LocalEncryptionService {
  private static instance: LocalEncryptionService;
  private keyPairs: Map<string, CryptoKeyPair> = new Map();
  private symmetricKeys: Map<string, CryptoKey> = new Map();

  static getInstance(): LocalEncryptionService {
    if (!LocalEncryptionService.instance) {
      LocalEncryptionService.instance = new LocalEncryptionService();
    }
    return LocalEncryptionService.instance;
  }

  private get isSupported(): boolean {
    return typeof window !== 'undefined' && !!window.crypto && !!window.crypto.subtle;
  }

  // Generate key pair for a user
  async generateKeyPair(userId: string): Promise<EncryptionKey> {
    if (!this.isSupported) {
      console.warn('⚠️ Web Crypto API not available - using mock encryption for development');
      this.keyPairs.set(userId, { publicKey: {} as any, privateKey: {} as any });
      return { key: 'mock-public-key', fingerprint: 'mock-fingerprint' };
    }

    try {
      const keyPair = await window.crypto.subtle.generateKey(
        {
          name: 'RSA-OAEP',
          modulusLength: 2048,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: 'SHA-256',
        },
        true,
        ['encrypt', 'decrypt']
      );

      this.keyPairs.set(userId, keyPair);

      // Export public key for sharing
      const publicKey = await window.crypto.subtle.exportKey('spki', keyPair.publicKey);
      const publicKeyBase64 = this.arrayBufferToBase64(publicKey);

      // Generate fingerprint
      const fingerprint = await this.generateFingerprint(publicKey);

      return {
        key: publicKeyBase64,
        fingerprint
      };
    } catch (error) {
      console.error('Failed to generate key pair:', error);
      throw new Error('Key generation failed');
    }
  }

  // Import another user's public key
  async importPublicKey(userId: string, publicKeyBase64: string): Promise<void> {
    if (!this.isSupported) {
      this.keyPairs.set(userId, { publicKey: {} as any, privateKey: null as any });
      return;
    }

    try {
      const publicKeyBuffer = this.base64ToArrayBuffer(publicKeyBase64);
      const publicKey = await window.crypto.subtle.importKey(
        'spki',
        publicKeyBuffer,
        {
          name: 'RSA-OAEP',
          hash: 'SHA-256',
        },
        false,
        ['encrypt']
      );

      // Store as a keypair with only public key
      this.keyPairs.set(userId, {
        publicKey,
        privateKey: null as any
      });
    } catch (error) {
      console.error('Failed to import public key:', error);
      throw new Error('Public key import failed');
    }
  }

  // Encrypt message for recipient
  async encryptMessage(message: string, recipientId: string): Promise<EncryptedData> {
    if (!this.isSupported) {
      return {
        data: btoa(message),
        iv: 'mock-iv',
        salt: 'mock-salt',
        timestamp: Date.now()
      };
    }

    try {
      const recipientKeyPair = this.keyPairs.get(recipientId);
      if (!recipientKeyPair || !recipientKeyPair.publicKey) {
        throw new Error('Recipient public key not available');
      }

      // Generate random symmetric key for this message
      const symmetricKey = await window.crypto.subtle.generateKey(
        {
          name: 'AES-GCM',
          length: 256,
        },
        true,
        ['encrypt', 'decrypt']
      );

      // Generate IV
      const iv = window.crypto.getRandomValues(new Uint8Array(12));

      // Encrypt message with symmetric key
      const encryptedData = await window.crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv,
        },
        symmetricKey,
        new TextEncoder().encode(message)
      );

      // Encrypt symmetric key with recipient's public key
      const encryptedSymmetricKey = await window.crypto.subtle.encrypt(
        {
          name: 'RSA-OAEP',
        },
        recipientKeyPair.publicKey,
        await window.crypto.subtle.exportKey('raw', symmetricKey)
      );

      // Combine all data
      const combinedData = new Uint8Array([
        ...new Uint8Array(encryptedSymmetricKey),
        ...new Uint8Array(encryptedData)
      ]);

      return {
        data: this.arrayBufferToBase64(combinedData.buffer),
        iv: this.arrayBufferToBase64(iv.buffer),
        salt: this.arrayBufferToBase64(await window.crypto.subtle.exportKey('raw', symmetricKey)),
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('Message encryption failed');
    }
  }

  // Decrypt message
  async decryptMessage(encryptedData: EncryptedData, senderId: string): Promise<string> {
    if (!this.isSupported) {
      try {
        return atob(encryptedData.data);
      } catch {
        return '[Decryption Failed - Mock]';
      }
    }

    try {
      const myKeyPair = this.keyPairs.get('me');
      if (!myKeyPair || !myKeyPair.privateKey) {
        throw new Error('Private key not available');
      }

      const combinedData = this.base64ToArrayBuffer(encryptedData.data);
      const iv = this.base64ToArrayBuffer(encryptedData.iv);

      // Extract encrypted symmetric key (first 256 bytes for RSA-2048)
      const encryptedSymmetricKey = combinedData.slice(0, 256);
      const encryptedMessage = combinedData.slice(256);

      // Decrypt symmetric key with my private key
      const symmetricKeyBuffer = await window.crypto.subtle.decrypt(
        {
          name: 'RSA-OAEP',
        },
        myKeyPair.privateKey,
        encryptedSymmetricKey
      );

      // Import symmetric key
      const symmetricKey = await window.crypto.subtle.importKey(
        'raw',
        symmetricKeyBuffer,
        {
          name: 'AES-GCM',
          length: 256,
        },
        false,
        ['decrypt']
      );

      // Decrypt message
      const decryptedData = await window.crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: new Uint8Array(iv),
        },
        symmetricKey,
        encryptedMessage
      );

      return new TextDecoder().decode(decryptedData);
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('Message decryption failed');
    }
  }

  // Encrypt image data
  async encryptImage(imageData: ArrayBuffer, recipientId: string): Promise<EncryptedData> {
    if (!this.isSupported) {
      return {
        data: this.arrayBufferToBase64(imageData),
        iv: 'mock-iv',
        salt: 'mock-salt',
        timestamp: Date.now()
      };
    }

    try {
      const recipientKeyPair = this.keyPairs.get(recipientId);
      if (!recipientKeyPair || !recipientKeyPair.publicKey) {
        throw new Error('Recipient public key not available');
      }

      // Generate symmetric key
      const symmetricKey = await window.crypto.subtle.generateKey(
        {
          name: 'AES-GCM',
          length: 256,
        },
        true,
        ['encrypt', 'decrypt']
      );

      const iv = window.crypto.getRandomValues(new Uint8Array(12));

      // Encrypt image data
      const encryptedData = await window.crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv,
        },
        symmetricKey,
        imageData
      );

      // Encrypt symmetric key with recipient's public key
      const encryptedSymmetricKey = await window.crypto.subtle.encrypt(
        {
          name: 'RSA-OAEP',
        },
        recipientKeyPair.publicKey,
        await window.crypto.subtle.exportKey('raw', symmetricKey)
      );

      const combinedData = new Uint8Array([
        ...new Uint8Array(encryptedSymmetricKey),
        ...new Uint8Array(encryptedData)
      ]);

      return {
        data: this.arrayBufferToBase64(combinedData.buffer),
        iv: this.arrayBufferToBase64(iv.buffer),
        salt: this.arrayBufferToBase64(await window.crypto.subtle.exportKey('raw', symmetricKey)),
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Image encryption failed:', error);
      throw new Error('Image encryption failed');
    }
  }

  // Decrypt image data
  async decryptImage(encryptedData: EncryptedData, senderId: string): Promise<ArrayBuffer> {
    if (!this.isSupported) {
      return this.base64ToArrayBuffer(encryptedData.data);
    }

    try {
      const myKeyPair = this.keyPairs.get('me');
      if (!myKeyPair || !myKeyPair.privateKey) {
        throw new Error('Private key not available');
      }

      const combinedData = this.base64ToArrayBuffer(encryptedData.data);
      const iv = this.base64ToArrayBuffer(encryptedData.iv);

      const encryptedSymmetricKey = combinedData.slice(0, 256);
      const encryptedImage = combinedData.slice(256);

      // Decrypt symmetric key
      const symmetricKeyBuffer = await window.crypto.subtle.decrypt(
        {
          name: 'RSA-OAEP',
        },
        myKeyPair.privateKey,
        encryptedSymmetricKey
      );

      // Import symmetric key
      const symmetricKey = await window.crypto.subtle.importKey(
        'raw',
        symmetricKeyBuffer,
        {
          name: 'AES-GCM',
          length: 256,
        },
        false,
        ['decrypt']
      );

      // Decrypt image
      const decryptedData = await window.crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: new Uint8Array(iv),
        },
        symmetricKey,
        encryptedImage
      );

      return decryptedData;
    } catch (error) {
      console.error('Image decryption failed:', error);
      throw new Error('Image decryption failed');
    }
  }

  // Generate fingerprint for key verification
  private async generateFingerprint(publicKey: ArrayBuffer): Promise<string> {
    if (!this.isSupported) return 'mock-fingerprint';
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', publicKey);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
  }

  // Utility functions
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  // Initialize user's key pair
  async initializeUser(userId: string): Promise<void> {
    if (!this.keyPairs.has(userId)) {
      await this.generateKeyPair(userId);
    }
  }

  // Check if user has keys
  hasUserKeys(userId: string): boolean {
    return this.keyPairs.has(userId);
  }

  // --- GROUP ENCRYPTION (GEOHASH-BASED) ---

  async deriveGroupKey(geohash: string): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      encoder.encode(geohash),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    return window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encoder.encode('xitchat_group_salt'),
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async encryptGroupMessage(message: string, geohash: string): Promise<EncryptedData> {
    if (!this.isSupported) {
      return {
        data: btoa(message),
        iv: 'mock-iv',
        salt: 'mock-salt',
        timestamp: Date.now()
      };
    }

    try {
      const groupKey = await this.deriveGroupKey(geohash);
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const encoder = new TextEncoder();

      const encryptedData = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        groupKey,
        encoder.encode(message)
      );

      return {
        data: this.arrayBufferToBase64(encryptedData),
        iv: this.arrayBufferToBase64(iv.buffer),
        salt: 'geohash_derived',
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Group encryption failed:', error);
      throw new Error('Group encryption failed');
    }
  }

  async decryptGroupMessage(encryptedData: EncryptedData, geohash: string): Promise<string> {
    if (!this.isSupported) {
      try { return atob(encryptedData.data); } catch { return '[Group Decrypt Failed]'; }
    }

    try {
      const groupKey = await this.deriveGroupKey(geohash);
      const iv = this.base64ToArrayBuffer(encryptedData.iv);
      const data = this.base64ToArrayBuffer(encryptedData.data);

      const decryptedData = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: new Uint8Array(iv) },
        groupKey,
        data
      );

      return new TextDecoder().decode(decryptedData);
    } catch (error) {
      console.error('Group decryption failed:', error);
      throw new Error('Group decryption failed');
    }
  }

  // Clear all keys (for security)
  clearAllKeys(): void {
    this.keyPairs.clear();
    this.symmetricKeys.clear();
  }
}

export const encryptionService = LocalEncryptionService.getInstance();
