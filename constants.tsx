
import { User, Chat } from './types';

export const INITIAL_CHATS: Chat[] = [
  {
    id: 'chat-1',
    type: 'private',
    participant: {
      id: 'xit-bot',
      name: 'XitBot (AI)',
      handle: '@xitbot',
      avatar: 'https://picsum.photos/seed/bot/200',
      status: 'Online',
      mood: 'Monitoring mesh network...',
      moodEmoji: '🤖',
      reputation: 9999,
      distance: 0,
      color: '#22d3ee',
      location: { lat: -26.2041, lng: 28.0473 }
    },
    lastMessage: "System operational. Waiting for mesh peers...",
    unreadCount: 1,
    messages: [
      { id: 'm1', senderId: 'xit-bot', text: "XitChat Pure Mesh Mode Active. I will assist you when connections are established.", timestamp: Date.now(), isAi: true }
    ]
  },
  {
    id: 'room-1',
    type: 'room',
    participant: {
      id: 'room-gen',
      name: 'General Lobby',
      handle: '#general_lobby',
      avatar: '',
      status: 'Online',
      mood: 'Public gathering space'
    },
    lastMessage: "Channel Open",
    unreadCount: 0,
    messages: []
  }
];
