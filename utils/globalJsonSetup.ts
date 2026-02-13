// Global BigInt and Date serialization setup
import { safeJsonStringify } from './jsonUtils';

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
