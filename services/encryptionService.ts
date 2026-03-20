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
  private deviceMasterKeyPromise: Promise<CryptoKey> | null = null;

  static getInstance(): LocalEncryptionService {
    if (!LocalEncryptionService.instance) {
      LocalEncryptionService.instance = new LocalEncryptionService();
    }
    return LocalEncryptionService.instance;
  }

  private get isSupported(): boolean {
    return typeof window !== 'undefined' && !!window.crypto && !!window.crypto.subtle;
  }

  private async getDeviceMasterKey(): Promise<CryptoKey> {
    if (!this.isSupported) {
      throw new Error('Web Crypto API not available');
    }
    if (!this.deviceMasterKeyPromise) {
      this.deviceMasterKeyPromise = import('./secure-key-store')
        .then((m) => m.getOrCreateDeviceMasterKey())
        .catch((error) => {
          this.deviceMasterKeyPromise = null;
          throw error;
        });
    }
    return this.deviceMasterKeyPromise;
  }

  private packEncryptedPayload(encryptedKey: ArrayBuffer, ciphertext: ArrayBuffer): ArrayBuffer {
    const keyBytes = new Uint8Array(encryptedKey);
    const ctBytes = new Uint8Array(ciphertext);
    if (keyBytes.byteLength > 65535) throw new Error('Encrypted key too large');

    const header = new Uint8Array(2);
    header[0] = (keyBytes.byteLength >> 8) & 0xff;
    header[1] = keyBytes.byteLength & 0xff;

    const out = new Uint8Array(2 + keyBytes.byteLength + ctBytes.byteLength);
    out.set(header, 0);
    out.set(keyBytes, 2);
    out.set(ctBytes, 2 + keyBytes.byteLength);
    return out.buffer;
  }

  private unpackEncryptedPayload(packed: ArrayBuffer): { encryptedKey: ArrayBuffer; ciphertext: ArrayBuffer } {
    const bytes = new Uint8Array(packed);
    if (bytes.byteLength < 3) throw new Error('Invalid encrypted payload');
    const keyLen = (bytes[0] << 8) | bytes[1];
    const keyStart = 2;
    const keyEnd = keyStart + keyLen;
    if (keyLen <= 0 || keyEnd >= bytes.byteLength) throw new Error('Invalid encrypted payload header');
    return {
      encryptedKey: bytes.slice(keyStart, keyEnd).buffer,
      ciphertext: bytes.slice(keyEnd).buffer
    };
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
      const rawSymmetricKey = await window.crypto.subtle.exportKey('raw', symmetricKey);
      const encryptedSymmetricKey = await window.crypto.subtle.encrypt(
        {
          name: 'RSA-OAEP',
        },
        recipientKeyPair.publicKey,
        rawSymmetricKey
      );

      const combinedData = this.packEncryptedPayload(encryptedSymmetricKey, encryptedData);

      return {
        data: this.arrayBufferToBase64(combinedData),
        iv: this.arrayBufferToBase64(iv.buffer),
        // Version marker; MUST NOT contain key material.
        salt: 'v2',
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

      const { encryptedKey: encryptedSymmetricKey, ciphertext: encryptedMessage } = this.unpackEncryptedPayload(combinedData);

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
      const rawSymmetricKey = await window.crypto.subtle.exportKey('raw', symmetricKey);
      const encryptedSymmetricKey = await window.crypto.subtle.encrypt(
        {
          name: 'RSA-OAEP',
        },
        recipientKeyPair.publicKey,
        rawSymmetricKey
      );

      const combinedData = this.packEncryptedPayload(encryptedSymmetricKey, encryptedData);

      return {
        data: this.arrayBufferToBase64(combinedData),
        iv: this.arrayBufferToBase64(iv.buffer),
        salt: 'v2',
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

      const { encryptedKey: encryptedSymmetricKey, ciphertext: encryptedImage } = this.unpackEncryptedPayload(combinedData);

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

  // --- GENERAL SYMMETRIC ENCRYPTION (FOR SECURE STORAGE) ---

  private masterKey: CryptoKey | null = null;

  async deriveMasterKey(pin: string, salt: string = 'xitchat_master_salt'): Promise<void> {
    if (!this.isSupported) return;

    const encoder = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      encoder.encode(pin),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    this.masterKey = await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encoder.encode(salt),
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async encryptSymmetric(data: string, key?: CryptoKey): Promise<EncryptedData> {
    const targetKey = key || this.masterKey || await this.getDeviceMasterKey();

    if (!this.isSupported) {
      return { data: btoa(data), iv: 'mock', salt: 'mock', timestamp: Date.now() };
    }

    try {
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const encoder = new TextEncoder();

      const encryptedData = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        targetKey,
        encoder.encode(data)
      );

      return {
        data: this.arrayBufferToBase64(encryptedData),
        iv: this.arrayBufferToBase64(iv.buffer),
        salt: 'device',
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Symmetric encryption failed:', error);
      throw error;
    }
  }

  async decryptSymmetric(encryptedData: EncryptedData, key?: CryptoKey): Promise<string> {
    const targetKey = key || this.masterKey || await this.getDeviceMasterKey();

    if (!this.isSupported) {
      try { return atob(encryptedData.data); } catch { return ''; }
    }

    try {
      const iv = this.base64ToArrayBuffer(encryptedData.iv);
      const data = this.base64ToArrayBuffer(encryptedData.data);

      const decryptedData = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: new Uint8Array(iv) },
        targetKey,
        data
      );

      return new TextDecoder().decode(decryptedData);
    } catch (error) {
      console.error('Symmetric decryption failed:', error);
      return '';
    }
  }

  // Clear all keys (for security)
  clearAllKeys(): void {
    this.keyPairs.clear();
    this.symmetricKeys.clear();
    this.masterKey = null;
    this.deviceMasterKeyPromise = null;
  }
}

export const encryptionService = LocalEncryptionService.getInstance();
