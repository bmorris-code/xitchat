/**
 * chatPersistence.ts
 * Saves and restores all chats + messages to/from localStorage.
 * Runs silently in the background — app state unchanged.
 */

import { Chat, Message } from '../types';

const STORAGE_KEY = 'xitchat_chats_v2';
const MAX_MESSAGES_PER_CHAT = 200; // keep last 200 per chat to avoid blowing localStorage

/**
 * Sanitize messages before saving — strip large base64 imageUrls to save space.
 */
const sanitizeMessage = (msg: Message): Message => {
    if (msg.imageUrl && msg.imageUrl.startsWith('data:') && msg.imageUrl.length > 50000) {
        return { ...msg, imageUrl: '[IMAGE_TOO_LARGE_TO_PERSIST]' };
    }
    if (msg.videoUrl && msg.videoUrl.startsWith('data:') && msg.videoUrl.length > 50000) {
        return { ...msg, videoUrl: '[VIDEO_TOO_LARGE_TO_PERSIST]' };
    }
    return msg;
};

/**
 * Save current chat state to localStorage.
 */
export const persistChats = (chats: Chat[]): void => {
    try {
        const toSave = chats.map(chat => ({
            ...chat,
            messages: chat.messages
                .slice(-MAX_MESSAGES_PER_CHAT) // keep only recent messages
                .map(sanitizeMessage),
        }));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch (err) {
        // QuotaExceededError — trim aggressively and retry
        try {
            const trimmed = chats.map(chat => ({
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
        // Validate basic structure
        if (!Array.isArray(parsed)) return null;
        return parsed;
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
        if (!map.has(c.id)) {
            map.set(c.id, c);
        }
    });
    return Array.from(map.values());
};

/**
 * Clear all persisted chats (factory reset).
 */
export const clearPersistedChats = (): void => {
    localStorage.removeItem(STORAGE_KEY);
};
