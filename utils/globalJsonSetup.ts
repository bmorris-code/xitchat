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
  if (Array.isArray(replacer)) {
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
  } else if (typeof replacer === 'function') {
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
      return (replacer as (key: string, value: any) => any)(key, value);
    }, space);
  } else {
    // replacer is null or other type - just apply our BigInt handling
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
  }
};

export {};
