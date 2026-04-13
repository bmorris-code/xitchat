import * as secp256k1 from '@noble/secp256k1';
import { localStorageService } from './localStorageService';

// NOTE: nostr-tools v2.x handles hash configuration automatically

const STORAGE_KEY = 'identity_secp256k1_sk_hex_v1';

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
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

// sha256Bytes function removed - use secp256k1.utils.hashMessage instead

function normalizePubkeyHex(pubkey: string): string {
  return pubkey.replace(/^0x/i, '').toLowerCase();
}

export type IdentityPublicKey = string; // hex, 128 chars (64-byte x||y uncompressed, no 04 prefix)
export type IdentitySignature = string; // hex, 128 chars (64-byte Schnorr sig)

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
    // Drop 0x04 prefix → 64 bytes (x||y) = 128 hex chars
    return bytesToHex(pk.slice(1));
  }

  async signEnvelope(fields: {
    content: string;
    timestamp: number;
    messageId: string;
  }): Promise<{ pk: IdentityPublicKey; sig: IdentitySignature }> {
    const skHex = await this.getOrCreateSecretKeyHex();
    const pkHex = await this.getPublicKeyHex();
    const payload = `${fields.content}|${fields.timestamp}|${fields.messageId}`;
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));
    const sigBytes = await (secp256k1.schnorr as any).sign(hash, hexToBytes(skHex));
    return { pk: pkHex, sig: bytesToHex(sigBytes as Uint8Array) };
  }

  async verifyEnvelope(fields: {
    content: string;
    timestamp: number;
    messageId: string;
    pk: string;
    sig: string;
  }): Promise<boolean> {
    try {
      // pk:  64-byte uncompressed pubkey (x||y, no 04 prefix) = 128 hex chars
      // sig: 64-byte Schnorr signature = 128 hex chars
      const pkHex = normalizePubkeyHex(fields.pk);
      const sigHex = fields.sig.replace(/^0x/i, '').toLowerCase();
      if (!/^[0-9a-f]{128}$/.test(sigHex)) return false;
      if (!/^[0-9a-f]{128}$/.test(pkHex)) return false;

      const payload = `${fields.content}|${fields.timestamp}|${fields.messageId}`;
      const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));
      return await (secp256k1.schnorr as any).verify(
        hexToBytes(sigHex),
        hash,
        hexToBytes(pkHex)
      );
    } catch {
      return false;
    }
  }

  async getSafetyNumber(peerPubkeyHex: string): Promise<string> {
    const myPk = await this.getPublicKeyHex();
    const a = normalizePubkeyHex(myPk);
    const b = normalizePubkeyHex(peerPubkeyHex);
    // Canonical order — lower hex first for determinism on both sides
    const [p1, p2] = a < b ? [a, b] : [b, a];
    const input = new TextEncoder().encode(`xitchat-safety-v1|${p1}|${p2}`);
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', input));
    // 5 groups of 4 digits (big-endian uint16 mod 10000) = 60 bits of entropy
    const view = new DataView(hash.buffer);
    return [0, 2, 4, 6, 8]
      .map(offset => String(view.getUint16(offset) % 10000).padStart(4, '0'))
      .join('-');
  }

  // ── FIX #1: reset cached key promise after node wipe ──
  // Call this from App.tsx handleWipeNode() after clearing localStorage
  reset(): void {
    this.skHexPromise = null;
  }
}

export const identityService = new IdentityService();
