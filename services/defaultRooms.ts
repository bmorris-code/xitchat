// Default Public Rooms Service
// Auto-joins users to default rooms on first launch.

import { geohashChannels } from './geohashChannels';

export interface DefaultRoom {
  id: string;
  name: string;
  description: string;
  welcomeMessage: string;
}

export const DEFAULT_ROOMS: DefaultRoom[] = [
  {
    id: 'room-gen',
    name: 'General Lobby',
    description: 'The main entrance to the mesh. Say hi!',
    welcomeMessage: 'Welcome to the General Lobby! This is a global room where everyone can chat.'
  },
  {
    id: 'room-help',
    name: 'Help & Support',
    description: 'New to XitChat? Ask questions here!',
    welcomeMessage: 'Welcome to Help & Support! Ask any questions about using XitChat.'
  },
  {
    id: 'room-local',
    name: 'Local Chat',
    description: 'Connect with people nearby.',
    welcomeMessage: 'Welcome to Local Chat! This room connects you with people in your area.'
  },
  {
    id: 'room-trade',
    name: 'Trading Floor',
    description: 'Swap skins and stickers for XC.',
    welcomeMessage: 'Welcome to the Trading Floor! Buy, sell, and trade using XC tokens.'
  }
];

class DefaultRoomsService {
  private hasInitialized = false;

  async initializeDefaultRooms(): Promise<void> {
    if (this.hasInitialized) return;
    const hasJoinedBefore = localStorage.getItem('xitchat_default_rooms_joined');
    if (hasJoinedBefore) {
      this.hasInitialized = true;
      return;
    }

    this.hasInitialized = true;

    console.log('First launch - auto-joining default rooms...');

    for (const room of DEFAULT_ROOMS) {
      try {
        await geohashChannels.joinChannel(room.id);
        console.log(`Auto-joined room: ${room.name}`);
      } catch (error) {
        console.error(`Failed to auto-join room ${room.name}:`, error);
      }
    }

    localStorage.setItem('xitchat_default_rooms_joined', 'true');
    console.log('Default rooms initialized');
  }

  getDefaultRoomIds(): string[] { return DEFAULT_ROOMS.map(r => r.id); }
  isDefaultRoom(roomId: string): boolean { return DEFAULT_ROOMS.some(r => r.id === roomId); }

  reset(): void {
    localStorage.removeItem('xitchat_default_rooms_joined');
    this.hasInitialized = false;
  }
}

export const defaultRoomsService = new DefaultRoomsService();
