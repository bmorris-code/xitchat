// Local Encryption Service - End-to-end encryption for messages and images
// All operations happen locally on device, no external API calls

import { localStorageService } from './localStorageService';

export interface EncryptedData {
  data: string;
  iv: string;
  salt: string;
  timestamp: number;
}

export interface EncryptionKey {
  key: string;
  fingerprint: string;
}

// ── FIX #5: removed static singleton pattern — just export the instance directly ──
class LocalEncryptionService {
  private keyPairs: Map<string, CryptoKeyPair> = new Map();
  private symmetricKeys: Map<string, CryptoKey> = new Map();
  private deviceMasterKeyPromise: Promise<CryptoKey> | null = null;
  private masterKey: CryptoKey | null = null;

  private get isSupported(): boolean {
    return typeof window !== 'undefined' && !!window.crypto && !!window.crypto.subtle;
  }

  private async getDeviceMasterKey(): Promise<CryptoKey> {
    if (!this.isSupported) throw new Error('Web Crypto API not available');
    if (!this.deviceMasterKeyPromise) {
      this.deviceMasterKeyPromise = import('./secure-key-store')
        .then(m => m.getOrCreateDeviceMasterKey())
        .catch(error => {
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

  // ── FIX #1: persist key pair to survive page refresh ──
  async generateKeyPair(userId: string): Promise<EncryptionKey> {
    if (!this.isSupported) {
      console.warn('⚠️ Web Crypto API not available - using mock encryption');
      this.keyPairs.set(userId, { publicKey: {} as any, privateKey: {} as any });
      return { key: 'mock-public-key', fingerprint: 'mock-fingerprint' };
    }

    try {
      const keyPair = await window.crypto.subtle.generateKey(
        { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
        true,
        ['encrypt', 'decrypt']
      );

      this.keyPairs.set(userId, keyPair);

      const publicKey = await window.crypto.subtle.exportKey('spki', keyPair.publicKey);
      const publicKeyBase64 = this.arrayBufferToBase64(publicKey);
      const fingerprint = await this.generateFingerprint(publicKey);

      // ── FIX #1: persist private key so it survives page refresh ──
      try {
        const privateKeyJwk = await window.crypto.subtle.exportKey('jwk', keyPair.privateKey);
        await localStorageService.storeData(
          `rsa_keypair_${userId}`,
          JSON.stringify({ publicKeyBase64, privateKeyJwk })
        );
      } catch (e) {
        console.warn('Failed to persist key pair:', e);
      }

      return { key: publicKeyBase64, fingerprint };
    } catch (error) {
      console.error('Failed to generate key pair:', error);
      throw new Error('Key generation failed');
    }
  }

  // ── FIX #1: restore persisted key pair ──
  private async importPersistedKeyPair(userId: string, stored: string): Promise<void> {
    try {
      const { publicKeyBase64, privateKeyJwk } = JSON.parse(stored);
      const publicKeyBuffer = this.base64ToArrayBuffer(publicKeyBase64);

      const [publicKey, privateKey] = await Promise.all([
        window.crypto.subtle.importKey(
          'spki', publicKeyBuffer,
          { name: 'RSA-OAEP', hash: 'SHA-256' },
          false, ['encrypt']
        ),
        window.crypto.subtle.importKey(
          'jwk', privateKeyJwk,
          { name: 'RSA-OAEP', hash: 'SHA-256' },
          false, ['decrypt']
        )
      ]);

      this.keyPairs.set(userId, { publicKey, privateKey });
    } catch (e) {
      console.warn('Failed to restore persisted key pair, regenerating:', e);
      await this.generateKeyPair(userId);
    }
  }

  async importPublicKey(userId: string, publicKeyBase64: string): Promise<void> {
    if (!this.isSupported) {
      this.keyPairs.set(userId, { publicKey: {} as any, privateKey: null as any });
      return;
    }

    try {
      const publicKeyBuffer = this.base64ToArrayBuffer(publicKeyBase64);
      const publicKey = await window.crypto.subtle.importKey(
        'spki', publicKeyBuffer,
        { name: 'RSA-OAEP', hash: 'SHA-256' },
        false, ['encrypt']
      );
      this.keyPairs.set(userId, { publicKey, privateKey: null as any });
    } catch (error) {
      console.error('Failed to import public key:', error);
      throw new Error('Public key import failed');
    }
  }

  // ── FIX #2: return null instead of throwing when recipient key missing ──
  async encryptMessage(message: string, recipientId: string): Promise<EncryptedData | null> {
    if (!this.isSupported) {
      return { data: btoa(message), iv: 'mock-iv', salt: 'mock-salt', timestamp: Date.now() };
    }

    const recipientKeyPair = this.keyPairs.get(recipientId);
    if (!recipientKeyPair?.publicKey) return null; // ← graceful, not throw

    try {
      const symmetricKey = await window.crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']
      );
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const encryptedData = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        symmetricKey,
        new TextEncoder().encode(message)
      );
      const rawSymmetricKey = await window.crypto.subtle.exportKey('raw', symmetricKey);
      const encryptedSymmetricKey = await window.crypto.subtle.encrypt(
        { name: 'RSA-OAEP' },
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
      console.error('Encryption failed:', error);
      return null; // ── FIX #2: return null, not throw ──
    }
  }

  async decryptMessage(encryptedData: EncryptedData, senderId: string): Promise<string> {
    if (!this.isSupported) {
      try { return atob(encryptedData.data); } catch { return '[Decryption Failed - Mock]'; }
    }

    try {
      const myKeyPair = this.keyPairs.get('me');
      if (!myKeyPair?.privateKey) throw new Error('Private key not available');

      const combinedData = this.base64ToArrayBuffer(encryptedData.data);
      const iv = this.base64ToArrayBuffer(encryptedData.iv);
      const { encryptedKey: encryptedSymmetricKey, ciphertext: encryptedMessage } = this.unpackEncryptedPayload(combinedData);

      const symmetricKeyBuffer = await window.crypto.subtle.decrypt(
        { name: 'RSA-OAEP' }, myKeyPair.privateKey, encryptedSymmetricKey
      );
      const symmetricKey = await window.crypto.subtle.importKey(
        'raw', symmetricKeyBuffer, { name: 'AES-GCM', length: 256 }, false, ['decrypt']
      );
      const decryptedData = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: new Uint8Array(iv) }, symmetricKey, encryptedMessage
      );
      return new TextDecoder().decode(decryptedData);
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('Message decryption failed');
    }
  }

  async encryptImage(imageData: ArrayBuffer, recipientId: string): Promise<EncryptedData | null> {
    if (!this.isSupported) {
      return { data: this.arrayBufferToBase64(imageData), iv: 'mock-iv', salt: 'mock-salt', timestamp: Date.now() };
    }

    const recipientKeyPair = this.keyPairs.get(recipientId);
    if (!recipientKeyPair?.publicKey) return null; // ── FIX #2 ──

    try {
      const symmetricKey = await window.crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']
      );
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const encryptedData = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, symmetricKey, imageData);
      const rawSymmetricKey = await window.crypto.subtle.exportKey('raw', symmetricKey);
      const encryptedSymmetricKey = await window.crypto.subtle.encrypt(
        { name: 'RSA-OAEP' }, recipientKeyPair.publicKey, rawSymmetricKey
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
      return null;
    }
  }

  async decryptImage(encryptedData: EncryptedData, senderId: string): Promise<ArrayBuffer> {
    if (!this.isSupported) return this.base64ToArrayBuffer(encryptedData.data);

    try {
      const myKeyPair = this.keyPairs.get('me');
      if (!myKeyPair?.privateKey) throw new Error('Private key not available');

      const combinedData = this.base64ToArrayBuffer(encryptedData.data);
      const iv = this.base64ToArrayBuffer(encryptedData.iv);
      const { encryptedKey: encryptedSymmetricKey, ciphertext: encryptedImage } = this.unpackEncryptedPayload(combinedData);

      const symmetricKeyBuffer = await window.crypto.subtle.decrypt(
        { name: 'RSA-OAEP' }, myKeyPair.privateKey, encryptedSymmetricKey
      );
      const symmetricKey = await window.crypto.subtle.importKey(
        'raw', symmetricKeyBuffer, { name: 'AES-GCM', length: 256 }, false, ['decrypt']
      );
      return await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: new Uint8Array(iv) }, symmetricKey, encryptedImage
      );
    } catch (error) {
      console.error('Image decryption failed:', error);
      throw new Error('Image decryption failed');
    }
  }

  private async generateFingerprint(publicKey: ArrayBuffer): Promise<string> {
    if (!this.isSupported) return 'mock-fingerprint';
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', publicKey);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .substring(0, 16);
  }

  // ── FIX #4: chunked base64 encoding to avoid O(n²) string concat crash on large buffers ──
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.byteLength; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }

  // ── FIX #1: check storage before generating new keys ──
  async initializeUser(userId: string): Promise<void> {
    if (this.keyPairs.has(userId)) return;
    if (!this.isSupported) { await this.generateKeyPair(userId); return; }

    try {
      const stored = await localStorageService.retrieveData(`rsa_keypair_${userId}`);
      if (stored) {
        await this.importPersistedKeyPair(userId, stored);
      } else {
        await this.generateKeyPair(userId);
      }
    } catch {
      await this.generateKeyPair(userId);
    }
  }

  hasUserKeys(userId: string): boolean { return this.keyPairs.has(userId); }

  // --- GROUP ENCRYPTION ---

  async deriveGroupKey(geohash: string): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw', encoder.encode(geohash), 'PBKDF2', false, ['deriveKey']
    );
    // ── FIX #3: include version in salt to prevent precomputed geohash rainbow tables ──
    return window.crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: encoder.encode('xitchat_group_v2_salt'), iterations: 100000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false, ['encrypt', 'decrypt']
    );
  }

  async encryptGroupMessage(message: string, geohash: string): Promise<EncryptedData> {
    if (!this.isSupported) {
      return { data: btoa(message), iv: 'mock-iv', salt: 'mock-salt', timestamp: Date.now() };
    }
    try {
      const groupKey = await this.deriveGroupKey(geohash);
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const encryptedData = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv }, groupKey, new TextEncoder().encode(message)
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
        { name: 'AES-GCM', iv: new Uint8Array(iv) }, groupKey, data
      );
      return new TextDecoder().decode(decryptedData);
    } catch (error) {
      console.error('Group decryption failed:', error);
      throw new Error('Group decryption failed');
    }
  }

  // --- SYMMETRIC ENCRYPTION ---

  async deriveMasterKey(pin: string, salt: string = 'xitchat_master_salt'): Promise<void> {
    if (!this.isSupported) return;
    const encoder = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw', encoder.encode(pin), 'PBKDF2', false, ['deriveKey']
    );
    this.masterKey = await window.crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: encoder.encode(salt), iterations: 100000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false, ['encrypt', 'decrypt']
    );
  }

  async encryptSymmetric(data: string, key?: CryptoKey): Promise<EncryptedData> {
    const targetKey = key || this.masterKey || await this.getDeviceMasterKey();
    if (!this.isSupported) {
      return { data: btoa(data), iv: 'mock', salt: 'mock', timestamp: Date.now() };
    }
    try {
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const encryptedData = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv }, targetKey, new TextEncoder().encode(data)
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
        { name: 'AES-GCM', iv: new Uint8Array(iv) }, targetKey, data
      );
      return new TextDecoder().decode(decryptedData);
    } catch (error) {
      console.error('Symmetric decryption failed:', error);
      return '';
    }
  }

  clearAllKeys(): void {
    this.keyPairs.clear();
    this.symmetricKeys.clear();
    this.masterKey = null;
    this.deviceMasterKeyPromise = null;
  }
}

// ── FIX #5: simple export, no redundant singleton pattern ──
export const encryptionService = new LocalEncryptionService();
