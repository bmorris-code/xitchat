/**
 * chatPersistence.ts
 * Saves and restores all chats + messages to/from localStorage.
 * Runs silently in the background — app state unchanged.
 */
import { Chat, Message } from '../types';

const STORAGE_KEY = 'xitchat_chats_v2';
const MAX_MESSAGES_PER_CHAT = 200;

/**
 * Sanitize messages before saving — strip large base64 blobs to save space.
 */
const sanitizeMessage = (msg: Message): Message => {
  if (msg.imageUrl?.startsWith('data:') && msg.imageUrl.length > 50000) {
    return { ...msg, imageUrl: '[IMAGE_TOO_LARGE_TO_PERSIST]' };
  }
  if (msg.videoUrl?.startsWith('data:') && msg.videoUrl.length > 50000) {
    return { ...msg, videoUrl: '[VIDEO_TOO_LARGE_TO_PERSIST]' };
  }
  // ── FIX #1: strip large encryptedData blobs — they can be bigger than images ──
  if (msg.encryptedData && JSON.stringify(msg.encryptedData).length > 10000) {
    return { ...msg, encryptedData: undefined };
  }
  return msg;
};

/**
 * Save current chat state to localStorage.
 */
export const persistChats = (chats: Chat[]): void => {
  // ── FIX #2: skip empty-message chats to avoid wasting quota ──
  const chatsToConsider = chats.filter(c => c.messages.length > 0 || c.lastMessage);

  try {
    const toSave = chatsToConsider.map(chat => ({
      ...chat,
      messages: chat.messages
        .slice(-MAX_MESSAGES_PER_CHAT)
        .map(sanitizeMessage),
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch {
    // QuotaExceededError — trim aggressively and retry
    try {
      const trimmed = chatsToConsider.map(chat => ({
        ...chat,
        messages: chat.messages.slice(-50).map(sanitizeMessage),
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch {
      console.warn('[chatPersistence] localStorage full — could not save chats');
    }
  }
};

/**
 * Load chats from localStorage.
 * Returns null if nothing is saved yet.
 */
export const loadPersistedChats = (): Chat[] | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Chat[];
    if (!Array.isArray(parsed)) return null;
    // ── FIX #2: filter out any chats that lost their participant during save ──
    return parsed.filter(c => c?.id && c?.participant?.id);
  } catch {
    console.warn('[chatPersistence] Failed to parse saved chats');
    return null;
  }
};

/**
 * Merge newly discovered chats (from mesh) into persisted chats.
 * Never duplicates — uses chat ID as key.
 */
export const mergeChats = (persisted: Chat[], incoming: Chat[]): Chat[] => {
  const map = new Map<string, Chat>();
  persisted.forEach(c => map.set(c.id, c));
  incoming.forEach(c => {
    if (!map.has(c.id)) map.set(c.id, c);
  });
  return Array.from(map.values());
};

/**
 * Clear all persisted chats (factory reset).
 */
export const clearPersistedChats = (): void => {
  localStorage.removeItem(STORAGE_KEY);
};
