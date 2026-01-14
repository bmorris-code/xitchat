// JSON Serialization utilities for handling BigInt and other non-serializable types

/**
 * Safely stringify objects with BigInt support
 * Converts BigInt values to strings during serialization
 */
export function safeJsonStringify(obj: any, space?: number): string {
  return JSON.stringify(obj, (key, value) => {
    // Convert BigInt to string
    if (typeof value === 'bigint') {
      return value.toString() + 'n'; // Add 'n' suffix to identify BigInt
    }
    // Convert Date objects to timestamps
    if (value instanceof Date) {
      return value.getTime();
    }
    return value;
  }, space);
}

/**
 * Safely parse JSON strings that may contain BigInt values
 * Converts string representations back to BigInt
 */
export function safeJsonParse(json: string): any {
  return JSON.parse(json, (key, value) => {
    // Convert string back to BigInt if it has the 'n' suffix
    if (typeof value === 'string' && value.endsWith('n') && /^\d+n$/.test(value)) {
      return BigInt(value.slice(0, -1));
    }
    // Convert timestamps back to Date objects if they look like timestamps
    if (typeof value === 'number' && value > 1000000000000 && value < 2000000000000) {
      // This is likely a timestamp (between 2001 and 2033)
      return new Date(value);
    }
    return value;
  });
}

/**
 * Create a safe message object for transmission
 * Ensures all fields are serializable and handles BigInt properly
 */
export function createSafeMessage<T extends Record<string, any>>(message: T): T {
  const safe = { ...message };
  
  // Recursively process all properties
  const processValue = (value: any): any => {
    if (typeof value === 'bigint') {
      return value.toString() + 'n';
    }
    if (value instanceof Date) {
      return value.getTime();
    }
    if (Array.isArray(value)) {
      return value.map(processValue);
    }
    if (value && typeof value === 'object') {
      const result: any = {};
      for (const [k, v] of Object.entries(value)) {
        result[k] = processValue(v);
      }
      return result;
    }
    return value;
  };
  
  return processValue(safe) as T;
}

/**
 * Get current timestamp as number (consistent across the app)
 */
export function getCurrentTimestamp(): number {
  return Date.now();
}

/**
 * Convert any timestamp-like value to number
 */
export function normalizeTimestamp(timestamp: any): number {
  if (timestamp instanceof Date) {
    return timestamp.getTime();
  }
  if (typeof timestamp === 'bigint') {
    return Number(timestamp);
  }
  if (typeof timestamp === 'string') {
    const parsed = parseInt(timestamp, 10);
    if (!isNaN(parsed)) {
      return parsed;
    }
  }
  if (typeof timestamp === 'number') {
    return timestamp;
  }
  return getCurrentTimestamp();
}
