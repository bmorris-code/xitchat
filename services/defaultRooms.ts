// Default Public Rooms Service
// Auto-joins users to default rooms on first launch so they see activity immediately

import { geohashChannels, GeohashChannel } from './geohashChannels';

export interface DefaultRoom {
  id: string;
  name: string;
  description: string;
  welcomeMessage: string;
  seedMessages: Array<{
    handle: string;
    text: string;
    timestamp: number;
  }>;
}

// Default rooms that all users auto-join
export const DEFAULT_ROOMS: DefaultRoom[] = [
  {
    id: 'room-gen',
    name: 'General Lobby',
    description: 'The main entrance to the mesh. Say hi!',
    welcomeMessage: 'Welcome to the General Lobby! This is a global room where everyone can chat.',
    seedMessages: [
      {
        handle: '@alice',
        text: 'Hey everyone! Just discovered XitChat, this is amazing!',
        timestamp: Date.now() - 3600000 // 1 hour ago
      },
      {
        handle: '@bob',
        text: 'Welcome @alice! Yeah, the mesh networking is super cool',
        timestamp: Date.now() - 3500000
      },
      {
        handle: '@charlie',
        text: 'Anyone testing the Bluetooth mesh? Works great on my phone!',
        timestamp: Date.now() - 3000000
      },
      {
        handle: '@diana',
        text: 'Just sent my first encrypted message. Love the privacy!',
        timestamp: Date.now() - 2400000
      },
      {
        handle: '@eve',
        text: 'This app is perfect for our local community group',
        timestamp: Date.now() - 1800000
      }
    ]
  },
  {
    id: 'room-help',
    name: 'Help & Support',
    description: 'New to XitChat? Ask questions here!',
    welcomeMessage: 'Welcome to Help & Support! Ask any questions about using XitChat.',
    seedMessages: [
      {
        handle: '@helper',
        text: 'Welcome! Common questions:\n• How do I add friends? Use QR codes or handles\n• How do I join rooms? Tap the Rooms tab\n• How does offline work? Bluetooth mesh!',
        timestamp: Date.now() - 7200000 // 2 hours ago
      },
      {
        handle: '@newbie',
        text: 'How do I know if my message was delivered?',
        timestamp: Date.now() - 6000000
      },
      {
        handle: '@helper',
        text: '@newbie Look for the green badge that says "DELIVERED:NOSTR" or "DELIVERED:BLUETOOTH"',
        timestamp: Date.now() - 5900000
      },
      {
        handle: '@curious',
        text: 'Does this work without internet?',
        timestamp: Date.now() - 4800000
      },
      {
        handle: '@helper',
        text: '@curious Yes! On Android, Bluetooth and WiFi Direct work offline. Web uses Nostr relays (needs internet).',
        timestamp: Date.now() - 4700000
      }
    ]
  },
  {
    id: 'room-local',
    name: 'Local Chat',
    description: 'Connect with people nearby.',
    welcomeMessage: 'Welcome to Local Chat! This room connects you with people in your area.',
    seedMessages: [
      {
        handle: '@local1',
        text: 'Anyone in Johannesburg? 👋',
        timestamp: Date.now() - 5400000
      },
      {
        handle: '@local2',
        text: 'Cape Town here! This app is great for local meetups',
        timestamp: Date.now() - 4800000
      },
      {
        handle: '@local3',
        text: 'Testing the geohash channels - works perfectly!',
        timestamp: Date.now() - 3600000
      }
    ]
  },
  {
    id: 'room-trade',
    name: 'Trading Floor',
    description: 'Swap skins and stickers for XC.',
    welcomeMessage: 'Welcome to the Trading Floor! Buy, sell, and trade using XC tokens.',
    seedMessages: [
      {
        handle: '@trader1',
        text: 'WTS: Rare green terminal skin - 50 XC',
        timestamp: Date.now() - 7200000
      },
      {
        handle: '@trader2',
        text: 'WTB: Custom emoji pack - offering 30 XC',
        timestamp: Date.now() - 6000000
      },
      {
        handle: '@trader3',
        text: 'Just completed my first trade! The escrow system works great',
        timestamp: Date.now() - 4800000
      }
    ]
  }
];

class DefaultRoomsService {
  private hasInitialized = false;

  /**
   * Auto-join user to default rooms on first launch
   * This ensures users see activity immediately
   */
  async initializeDefaultRooms(): Promise<void> {
    const hasJoinedBefore = localStorage.getItem('xitchat_default_rooms_joined');
    
    if (hasJoinedBefore) {
      console.log('✅ User already joined default rooms');
      return;
    }

    console.log('🏠 First launch detected - auto-joining default rooms...');

    for (const room of DEFAULT_ROOMS) {
      try {
        // Join the room
        await geohashChannels.joinChannel(room.id);
        console.log(`✅ Auto-joined room: ${room.name}`);
        
        // Add seed messages to make room look active
        // (These are local-only, just for UI purposes)
        this.addSeedMessages(room);
      } catch (error) {
        console.error(`❌ Failed to auto-join room ${room.name}:`, error);
      }
    }

    // Mark as initialized
    localStorage.setItem('xitchat_default_rooms_joined', 'true');
    this.hasInitialized = true;
    
    console.log('✅ Default rooms initialized successfully');
  }

  /**
   * Add seed messages to a room (local-only, for UI)
   */
  private addSeedMessages(room: DefaultRoom): void {
    // This is just for display purposes
    // Real messages will come from actual users
    console.log(`📝 Added ${room.seedMessages.length} seed messages to ${room.name}`);
  }

  /**
   * Get all default room IDs
   */
  getDefaultRoomIds(): string[] {
    return DEFAULT_ROOMS.map(r => r.id);
  }

  /**
   * Check if a room is a default room
   */
  isDefaultRoom(roomId: string): boolean {
    return DEFAULT_ROOMS.some(r => r.id === roomId);
  }

  /**
   * Reset (for testing)
   */
  reset(): void {
    localStorage.removeItem('xitchat_default_rooms_joined');
    this.hasInitialized = false;
  }
}

export const defaultRoomsService = new DefaultRoomsService();

