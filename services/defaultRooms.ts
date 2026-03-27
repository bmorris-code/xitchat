// Default Public Rooms Service
// Auto-joins users to default rooms on first launch so they see activity immediately

import { geohashChannels, GeohashChannel, GeohashMessage } from './geohashChannels';

export interface DefaultRoom {
  id: string;
  name: string;
  description: string;
  welcomeMessage: string;
  // ── FIX #2: offsets instead of absolute timestamps computed at module load ──
  seedMessages: Array<{
    handle: string;
    text: string;
    timestampOffset: number; // ms relative to Date.now() at join time (negative = in the past)
  }>;
}

export const DEFAULT_ROOMS: DefaultRoom[] = [
  {
    id: 'room-gen',
    name: 'General Lobby',
    description: 'The main entrance to the mesh. Say hi!',
    welcomeMessage: 'Welcome to the General Lobby! This is a global room where everyone can chat.',
    seedMessages: [
      { handle: '@alice', text: 'Hey everyone! Just discovered XitChat, this is amazing!', timestampOffset: -3600000 },
      { handle: '@bob', text: 'Welcome @alice! Yeah, the mesh networking is super cool', timestampOffset: -3500000 },
      { handle: '@charlie', text: 'Anyone testing the Bluetooth mesh? Works great on my phone!', timestampOffset: -3000000 },
      { handle: '@diana', text: 'Just sent my first encrypted message. Love the privacy!', timestampOffset: -2400000 },
      { handle: '@eve', text: 'This app is perfect for our local community group', timestampOffset: -1800000 }
    ]
  },
  {
    id: 'room-help',
    name: 'Help & Support',
    description: 'New to XitChat? Ask questions here!',
    welcomeMessage: 'Welcome to Help & Support! Ask any questions about using XitChat.',
    seedMessages: [
      { handle: '@helper', text: 'Welcome! Common questions:\n• How do I add friends? Use QR codes or handles\n• How do I join rooms? Tap the Rooms tab\n• How does offline work? Bluetooth mesh!', timestampOffset: -7200000 },
      { handle: '@newbie', text: 'How do I know if my message was delivered?', timestampOffset: -6000000 },
      { handle: '@helper', text: '@newbie Look for the green badge that says "DELIVERED:NOSTR" or "DELIVERED:BLUETOOTH"', timestampOffset: -5900000 },
      { handle: '@curious', text: 'Does this work without internet?', timestampOffset: -4800000 },
      { handle: '@helper', text: '@curious Yes! On Android, Bluetooth and WiFi Direct work offline. Web uses Nostr relays (needs internet).', timestampOffset: -4700000 }
    ]
  },
  {
    id: 'room-local',
    name: 'Local Chat',
    description: 'Connect with people nearby.',
    welcomeMessage: 'Welcome to Local Chat! This room connects you with people in your area.',
    seedMessages: [
      { handle: '@local1', text: 'Anyone in Johannesburg? 👋', timestampOffset: -5400000 },
      { handle: '@local2', text: 'Cape Town here! This app is great for local meetups', timestampOffset: -4800000 },
      { handle: '@local3', text: 'Testing the geohash channels - works perfectly!', timestampOffset: -3600000 }
    ]
  },
  {
    id: 'room-trade',
    name: 'Trading Floor',
    description: 'Swap skins and stickers for XC.',
    welcomeMessage: 'Welcome to the Trading Floor! Buy, sell, and trade using XC tokens.',
    seedMessages: [
      { handle: '@trader1', text: 'WTS: Rare green terminal skin - 50 XC', timestampOffset: -7200000 },
      { handle: '@trader2', text: 'WTB: Custom emoji pack - offering 30 XC', timestampOffset: -6000000 },
      { handle: '@trader3', text: 'Just completed my first trade! The escrow system works great', timestampOffset: -4800000 }
    ]
  }
];

class DefaultRoomsService {
  // ── FIX #1: use hasInitialized as synchronous in-flight guard ──
  private hasInitialized = false;

  async initializeDefaultRooms(): Promise<void> {
    // ── FIX #1: check in-memory flag first — prevents concurrent double-init ──
    if (this.hasInitialized) return;
    const hasJoinedBefore = localStorage.getItem('xitchat_default_rooms_joined');
    if (hasJoinedBefore) { this.hasInitialized = true; return; }

    // ── FIX #1: set flag BEFORE async work to prevent race condition ──
    this.hasInitialized = true;

    console.log('🏠 First launch — auto-joining default rooms...');

    for (const room of DEFAULT_ROOMS) {
      try {
        await geohashChannels.joinChannel(room.id);
        // ── FIX #3: actually insert seed messages into the channel store ──
        this.addSeedMessages(room);
        console.log(`✅ Auto-joined room: ${room.name}`);
      } catch (error) {
        console.error(`❌ Failed to auto-join room ${room.name}:`, error);
      }
    }

    localStorage.setItem('xitchat_default_rooms_joined', 'true');
    console.log('✅ Default rooms initialized');
  }

  // ── FIX #3: actually add seed messages to the channel message store ──
  // ── FIX #2: timestamps computed NOW (at join time), not at module load ──
  private addSeedMessages(room: DefaultRoom): void {
    const now = Date.now();
    const messages = geohashChannels.getChannelMessages(room.id);

    // Only seed if the channel is empty (don't re-seed on subsequent launches)
    if (messages.length > 0) return;

    room.seedMessages.forEach((seed, i) => {
      // Access the internal message store via sendMessage is async and
      // would broadcast — instead we inject directly via a synthetic receive.
      // We dispatch a custom event that geohashChannels listens for,
      // or use the public API with a system-type message.
      // Since we can't call private methods, we use the public channel message
      // storage pattern via a window event injection:
      const syntheticMsg: GeohashMessage = {
        id: `seed-${room.id}-${i}`,
        channelId: room.id,
        nodeId: seed.handle,
        nodeHandle: seed.handle,
        content: seed.text,
        // ── FIX #2: offset from current time, not module-load time ──
        timestamp: now + seed.timestampOffset,
        type: 'text'
      };

      // Dispatch as a synthetic meshDataReceived event so geohashChannels
      // processes it through its normal addReceivedMessage path (dedup-safe).
      window.dispatchEvent(new CustomEvent('geohashSeedMessage', { detail: syntheticMsg }));
    });
  }

  getDefaultRoomIds(): string[] { return DEFAULT_ROOMS.map(r => r.id); }
  isDefaultRoom(roomId: string): boolean { return DEFAULT_ROOMS.some(r => r.id === roomId); }

  reset(): void {
    localStorage.removeItem('xitchat_default_rooms_joined');
    this.hasInitialized = false;
  }
}

export const defaultRoomsService = new DefaultRoomsService();
