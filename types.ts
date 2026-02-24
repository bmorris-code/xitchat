
export type Status = 'Online' | 'Away' | 'DND' | 'Offline';

export interface User {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  status: Status;
  mood?: string;
  moodEmoji?: string;
  reputation?: number;
  distance?: number;
  color?: string;
  location?: {
    lat: number;
    lng: number;
  };
}

export interface Reaction {
  emoji: string;
  count: number;
  users: string[];
}

export interface Listing {
  id: string;
  title: string;
  price: string;
  senderHandle: string;
  timestamp: number;
  // Added 'EVENT' to the base Listing category to allow specialized listings to extend it correctly
  category: 'WANT' | 'HAVE' | 'SERVICE' | 'EVENT';
  description: string;
}

export interface Message {
  id: string;
  senderId: string;
  senderHandle?: string;
  text: string;
  imageUrl?: string;
  videoUrl?: string;
  replyTo?: {
    id: string;
    senderHandle: string;
    text: string;
  };
  reactions?: Reaction[];
  timestamp: number;
  isAi?: boolean;
  encryptedData?: {
    data: string;
    iv: string;
    salt: string;
  };
}

export interface Chat {
  id: string;
  type: 'private' | 'room';
  participant: User;
  lastMessage: string;
  unreadCount: number;
  messages: Message[];
  isEncrypted?: boolean;
}

export type View = 'chats' | 'map' | 'apps' | 'tradepost' | 'joebanker' | 'buzz' | 'gallery' | 'rooms' | 'games' | 'profile' | 'settings' | 'marketplace' | 'native' | 'xc_dashboard';
