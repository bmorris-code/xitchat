// Global BigInt and Date serialization setup
import { safeJsonStringify } from './jsonUtils';

// ============================================================================
// FIX: Configure @noble/hashes for nostr-tools v2.x
// ============================================================================
// nostr-tools v2.x requires explicit hash configuration
// This must be done BEFORE any nostr-tools imports are used
import { sha256 } from '@noble/hashes/sha256';
import { sha512 } from '@noble/hashes/sha512';
import { hmac } from '@noble/hashes/hmac';
import { pbkdf2 } from '@noble/hashes/pbkdf2';
import { ripemd160 } from '@noble/hashes/ripemd160';

// Set up the hashes object for nostr-tools
if (typeof window !== 'undefined') {
  (window as any).nobleHashes = {
    sha256,
    sha512,
    hmac,
    pbkdf2,
    ripemd160
  };
}

// Also configure for @noble/secp256k1 if needed
import * as secp256k1 from '@noble/secp256k1';
if (typeof secp256k1.etc !== 'undefined' && secp256k1.etc.hmacSha256Sync === undefined) {
  secp256k1.etc.hmacSha256Sync = (key: Uint8Array, ...messages: Uint8Array[]) => {
    return hmac(sha256, key, secp256k1.etc.concatBytes(...messages));
  };
}

// Override JSON.stringify globally to handle BigInt and Date objects
const originalStringify = JSON.stringify;
(JSON.stringify as any) = function(obj: any, replacer?: ((key: string, value: any) => any) | (string | number)[], space?: string | number): string {
  // Use our safe serialization by default if no custom replacer
  if (replacer === undefined) {
    return safeJsonStringify(obj, space as number);
  }
  
  // If custom replacer is provided, handle it appropriately
  if (replacer != null && Array.isArray(replacer)) {
    // Array replacer - just filter properties, then apply our BigInt handling
    return originalStringify.call(this, obj, (key, value) => {
      // Handle BigInt
      if (typeof value === 'bigint') {
        return value.toString() + 'n';
      }
      // Handle Date objects
      if (value instanceof Date) {
        return value.getTime();
      }
      return value;
    }, space);
  } else if (replacer != null && typeof replacer === 'function') {
    // Function replacer - chain it with our BigInt handler
    return originalStringify.call(this, obj, (key, value) => {
      // Handle BigInt first
      if (typeof value === 'bigint') {
        return value.toString() + 'n';
      }
      // Handle Date objects
      if (value instanceof Date) {
        return value.getTime();
      }
      // Then apply custom replacer
      try {
        return (replacer as (key: string, value: any) => any)(key, value);
      } catch (error) {
        console.warn('Replacer function error:', error);
        return value;
      }
    }, space);
  } else {
    // No valid replacer, use our safe serialization
    return safeJsonStringify(obj, space as number);
  }
};

export {};
