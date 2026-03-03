import { Chat } from './types';

// Real-time mode with only XitBot seeded for AI assistance.
export const INITIAL_CHATS: Chat[] = [
  {
    id: 'chat-xitbot',
    type: 'private',
    participant: {
      id: 'xit-bot',
      name: 'XitBot (AI)',
      handle: '@xitbot',
      avatar: '/icon-192.png',
      status: 'Online',
      mood: 'Ready to assist.',
      moodEmoji: '🤖',
      reputation: 9999,
      distance: 0,
      color: '#22d3ee'
    },
    lastMessage: 'AI assistant ready.',
    unreadCount: 0,
    messages: []
  }
];
