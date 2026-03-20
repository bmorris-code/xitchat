import * as secp256k1 from '@noble/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import { hmac } from '@noble/hashes/hmac';
import { localStorageService } from './localStorageService';

// CRITICAL: Configure secp256k1 v3.x with hash functions
// This MUST be done before any schnorr operations
if (typeof secp256k1.etc !== 'undefined') {
  // Set hmacSha256Sync for general operations
  if (!(secp256k1.etc as any).hmacSha256Sync) {
    (secp256k1.etc as any).hmacSha256Sync = (key: Uint8Array, ...messages: Uint8Array[]) => {
      return hmac(sha256, key, secp256k1.etc.concatBytes(...messages));
    };
  }

  // Set sha256Sync for schnorr operations (v3.x requirement)
  if (!(secp256k1.etc as any).sha256Sync) {
    (secp256k1.etc as any).sha256Sync = (...messages: Uint8Array[]) => {
      return sha256(secp256k1.etc.concatBytes(...messages));
    };
  }
}

const STORAGE_KEY = 'identity_secp256k1_sk_hex_v1';

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/^0x/i, '').toLowerCase();
  if (!/^[0-9a-f]+$/.test(clean) || clean.length % 2 !== 0) throw new Error('Invalid hex');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

// Use @noble/hashes instead of crypto.subtle for better compatibility
function sha256Bytes(data: Uint8Array): Uint8Array {
  return sha256(data);
}

function normalizePubkeyHex(pubkey: string): string {
  return pubkey.replace(/^0x/i, '').toLowerCase();
}

export type IdentityPublicKey = string; // hex, 64 chars
export type IdentitySignature = string; // hex

class IdentityService {
  private skHexPromise: Promise<string> | null = null;

  private async getOrCreateSecretKeyHex(): Promise<string> {
    if (this.skHexPromise) return this.skHexPromise;
    this.skHexPromise = (async () => {
      const existing = await localStorageService.retrieveData(STORAGE_KEY);
      if (typeof existing === 'string' && /^[0-9a-f]{64}$/i.test(existing)) {
        return existing.toLowerCase();
      }
      const sk = new Uint8Array(32);
      crypto.getRandomValues(sk);
      const skHex = bytesToHex(sk);
      await localStorageService.storeData(STORAGE_KEY, skHex);
      return skHex;
    })();
    return this.skHexPromise;
  }

  async getPublicKeyHex(): Promise<IdentityPublicKey> {
    const skHex = await this.getOrCreateSecretKeyHex();
    const pk = secp256k1.getPublicKey(hexToBytes(skHex), false); // 65 bytes uncompressed
    // drop 0x04 prefix -> 64 bytes (x||y)
    const pk64 = pk.slice(1);
    return bytesToHex(pk64);
  }

  async signEnvelope(fields: { content: string; timestamp: number; messageId: string }): Promise<{ pk: IdentityPublicKey; sig: IdentitySignature }> {
    const skHex = await this.getOrCreateSecretKeyHex();
    const pkHex = await this.getPublicKeyHex();
    const payload = `${fields.content}|${fields.timestamp}|${fields.messageId}`;
    const msg = new TextEncoder().encode(payload);
    const hash = sha256Bytes(msg); // No await - now synchronous
    const sigBytes = await (secp256k1.schnorr as any).sign(hash, hexToBytes(skHex));
    return { pk: pkHex, sig: bytesToHex(sigBytes as Uint8Array) };
  }

  async verifyEnvelope(fields: { content: string; timestamp: number; messageId: string; pk: string; sig: string }): Promise<boolean> {
    try {
      const pkHex = normalizePubkeyHex(fields.pk);
      const sigHex = fields.sig.replace(/^0x/i, '').toLowerCase();
      if (!/^[0-9a-f]{128}$/i.test(sigHex)) return false;
      if (!/^[0-9a-f]{128}$/i.test(pkHex)) return false;
      const payload = `${fields.content}|${fields.timestamp}|${fields.messageId}`;
      const msg = new TextEncoder().encode(payload);
      const hash = sha256Bytes(msg); // No await - now synchronous
      const sigBytes = hexToBytes(sigHex);
      const pkBytes = hexToBytes(pkHex);
      return await (secp256k1.schnorr as any).verify(sigBytes, hash, pkBytes);
    } catch {
      return false;
    }
  }

  async getSafetyNumber(peerPubkeyHex: string): Promise<string> {
    const myPk = await this.getPublicKeyHex();
    const a = normalizePubkeyHex(myPk);
    const b = normalizePubkeyHex(peerPubkeyHex);
    const [p1, p2] = a < b ? [a, b] : [b, a];
    const input = new TextEncoder().encode(`xitchat-safety-v1|${p1}|${p2}`);
    const hash = sha256Bytes(input); // No await - now synchronous
    // 60 bits → 5 groups of 4 digits (0000-9999-ish), stable & readable
    const view = new DataView(hash.buffer);
    const parts = [
      view.getUint16(0) % 10000,
      view.getUint16(2) % 10000,
      view.getUint16(4) % 10000,
      view.getUint16(6) % 10000,
      view.getUint16(8) % 10000
    ].map((n) => String(n).padStart(4, '0'));
    return parts.join('-');
  }
}

export const identityService = new IdentityService();

