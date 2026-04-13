// services/geohashChannels.ts
import { meshPermissions } from './meshPermissions';
import { nostrService } from './nostrService';
import { hybridMesh } from './hybridMesh';
import { encryptionService, EncryptedData } from './encryptionService';

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'msg-' + Date.now() + '-' +
    Math.random().toString(36).substring(2, 15) + '-' +
    Math.random().toString(36).substring(2, 15);
}

// -------------------- TYPES --------------------
export interface ChannelMessage {
  id: string;
  channelId: string;
  senderId: string;
  text: string;
  encryptedData?: EncryptedData;
  timestamp: number;
  type: string;
}

export interface GeohashChannel {
  id: string;
  geohash: string;
  name: string;
  description: string;
  desc: string;
  tags: any[];
  participants: string[];
  isPublic: boolean;
  requiresInvite: boolean;
  createdBy: string;
  createdAt: number;
  lastActivity: number;
  messageCount: number;
  isEncrypted: boolean;
  isTradingChannel?: boolean;
}

export interface GeohashMessage {
  id: string;
  channelId: string;
  nodeId: string;
  nodeHandle: string;
  content: string;
  timestamp: number;
  type: 'text' | 'image' | 'location' | 'system';
  replyTo?: string;
  reactions?: { [emoji: string]: string[] };
}

export interface GeohashLocation {
  latitude: number;
  longitude: number;
  geohash: string;
  accuracy: number;
  timestamp: number;
}

// -------------------- SERVICE --------------------
class GeohashChannelsService {
  // ── FIX #7: instance fields declared at the top of the class ──
  private static instance: GeohashChannelsService;

  private channels: Map<string, GeohashChannel> = new Map();
  private messages: Map<string, GeohashMessage[]> = new Map();
  private currentLocation: GeohashLocation | null = null;
  private nearbyChannels: GeohashChannel[] = [];
  private listeners: { [key: string]: ((data: any) => void)[] } = {};
  private isConnected = false;
  private myHandle: string = '@anon';
  private readonly nostrChannelPrefix = 'xitchat-local-';
  private myId = 'me';

  // ── FIX #1: store sync interval ──
  private syncInterval: any = null;
  // ── FIX #2: store subscription unsub functions ──
  private unsubs: Array<() => void> = [];
  // ── FIX #3: debounce timer for saveMessages ──
  private saveMessagesTimer: any = null;
  // ── FIX #5: store geolocation watch ID ──
  private geoWatchId: number | null = null;

  private readonly MAX_STORED_MESSAGES = 100;

  static getInstance(): GeohashChannelsService {
    if (!this.instance) this.instance = new GeohashChannelsService();
    return this.instance;
  }

  constructor() {
    this.loadChannels();
    this.initializeGeohashService();
  }

  private async initializeGeohashService() {
    const savedHandle = localStorage.getItem('xitchat_handle');
    if (savedHandle) this.myHandle = `@${savedHandle}`;
    this.initializeLocationServices();
    this.subscribeToNostrMessages();
    this.subscribeToMeshMessages();
    this.subscribeToSeedMessages();
    this.startBackgroundSync();
  }

  // ── FIX #2: store unsub functions ──
  private subscribeToNostrMessages() {
    this.unsubs.push(
      nostrService.subscribe('channelMessageReceived', (message) => {
        if (message.channelId?.startsWith(this.nostrChannelPrefix)) {
          const geohash = message.channelId.replace(this.nostrChannelPrefix, '');
          if (this.currentLocation && this.isNearbyGeohash(geohash)) {
            this.addReceivedMessage({
              id: message.id,
              channelId: message.channelId,
              nodeId: message.from,
              nodeHandle: `@nostr_${message.from.substring(0, 8)}`,
              content: message.content,
              timestamp: message.timestamp instanceof Date ? message.timestamp.getTime() : Date.now(),
              type: 'text'
            });
          }
        }
      })
    );

    this.unsubs.push(
      nostrService.subscribe('messageReceived', (message) => {
        console.log(`[XC] NOSTR RAW content_prefix=${message.content?.substring(0, 40)}`);
        if (!message.content?.startsWith('[GEOHASH:')) return;
        const geohashMatch = message.content.match(/\[GEOHASH:([^\]]+)\]/);
        if (!geohashMatch) return;
        const channelMatch = message.content.match(/\[CHANNEL:([^\]]+)\]/);
        const channelId = channelMatch ? channelMatch[1] : `${this.nostrChannelPrefix}${geohashMatch[1]}`;
        // Skip geohash proximity filter for named rooms (they are global, not geo-local)
        const isNamedRoom = channelMatch !== null;
        if (!isNamedRoom && !this.isNearbyGeohash(geohashMatch[1])) return;
        console.log(`[XC] NOSTR MATCH ch=${channelId}`);
        const cleanContent = message.content.replace(/\[GEOHASH:[^\]]+\]/, '').replace(/\[CHANNEL:[^\]]+\]/, '').trim();
        this.addReceivedMessage({
          id: message.id || generateUUID(),
          channelId,
          nodeId: message.from,
          nodeHandle: `@${message.from?.substring(0, 8) || 'unknown'}`,
          content: cleanContent,
          timestamp: message.timestamp instanceof Date ? message.timestamp.getTime() : Date.now(),
          type: 'text'
        });
      })
    );
  }

  // ---- FIX #2: store unsub function ----
  private subscribeToSeedMessages() {
    const handleSeedMessage = (event: CustomEvent) => {
      const message = event.detail as GeohashMessage;
      console.log(`[XC] SEED MESSAGE: ch=${message.channelId} from=${message.nodeHandle}`);
      this.addReceivedMessage(message);
    };
    
    window.addEventListener('geohashSeedMessage', handleSeedMessage as EventListener);
    
    this.unsubs.push(() => {
      window.removeEventListener('geohashSeedMessage', handleSeedMessage as EventListener);
    });
  }

  // ---- FIX #2: store unsub function ----
  private subscribeToMeshMessages() {
    this.unsubs.push(
      hybridMesh.subscribe('messageReceived', async (message) => {
        console.log(`[XC] MESH RAW message from=${message.from} content_prefix=${message.content?.substring(0, 40)}`);
        if (!message.content?.startsWith('[GEOHASH:')) return;
        console.log(`[XC] MESH Processing geohash message`);
        const geohashMatch = message.content.match(/\[GEOHASH:([^\]]+)\]/);
        if (!geohashMatch) return;

        const channelMatch = message.content.match(/\[CHANNEL:([^\]]+)\]/);
        const channelId = channelMatch ? channelMatch[1] : `${this.nostrChannelPrefix}${geohashMatch[1]}`;
        // Skip geohash proximity filter for named rooms (they are global, not geo-local)
        const isNamedRoom = channelMatch !== null;
        if (!isNamedRoom && !this.isNearbyGeohash(geohashMatch[1])) return;
        const cleanContent = message.content.replace(/\[GEOHASH:[^\]]+\]/, '').replace(/\[CHANNEL:[^\]]+\]/, '').trim();
        let finalContent = cleanContent;

        if (cleanContent.startsWith('{') && cleanContent.includes('data') && cleanContent.includes('iv')) {
          try {
            const parsed = JSON.parse(cleanContent);
            finalContent = await encryptionService.decryptGroupMessage(parsed, geohashMatch[1]);
          } catch {}
        }

        const geohashMessage: GeohashMessage = {
          id: message.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          channelId: channelId,
          nodeId: message.nodeId || message.from || 'unknown',
          nodeHandle: message.nodeHandle ||
            message.senderHandle ||
            `@${String(message.from || message.nodeId || 'peer').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toLowerCase() || 'peer'}`,
          content: finalContent,
          timestamp: message.timestamp instanceof Date ? message.timestamp.getTime() : (message.timestamp || Date.now()),
          type: 'text' as const
        };
        console.log(`[XC] Adding received message: ch=${channelId} from=${geohashMessage.nodeHandle} content=${finalContent.substring(0, 50)}...`);
        this.addReceivedMessage(geohashMessage);
      })
    );
  }

  private addReceivedMessage(message: GeohashMessage) {
    console.log(`[XC] addReceivedMessage: id=${message.id} ch=${message.channelId} from=${message.nodeHandle}`);
    if (!message?.id) return;
    if (message.nodeHandle === this.myHandle) {
      console.log(`[XC] Skipping own message from ${message.nodeHandle}`);
      return;
    }

    if (!this.messages.has(message.channelId)) {
      console.log(`[XC] Creating new message array for channel ${message.channelId}`);
      this.messages.set(message.channelId, []);
    }

    const existing = this.messages.get(message.channelId)!;
    if (existing.some(m => m.id === message.id)) return;

    existing.push({ ...message, id: String(message.id) });

    // ── FIX #3: debounced save instead of immediate write per message ──
    this.saveMessagesDebounced();
    this.notifyListeners('messageReceived', message);
    console.log(`[XC] MSG IN ch=${message.channelId} from=${message.nodeHandle} content=${message.content?.substring(0, 50)}`);
  }

  // ── FIX #3: debounced saveMessages ──
  private saveMessagesDebounced() {
    if (this.saveMessagesTimer) clearTimeout(this.saveMessagesTimer);
    this.saveMessagesTimer = setTimeout(() => {
      this.saveMessagesTimer = null;
      this.saveMessages();
    }, 1000);
  }

  private isNearbyGeohash(geohash: string) {
    if (!this.currentLocation) return true;
    return this.currentLocation.geohash.substring(0, 4) === geohash.substring(0, 4);
  }

  private initializeLocationServices() {
    if (!('geolocation' in navigator)) {
      this.updateLocation(-26.2041, 28.0473);
      return;
    }
    this.updateLocation(-26.2041, 28.0473);
    setTimeout(() => this.requestLocationWithUserGesture(), 1000);
  }

  private requestLocationWithUserGesture() {
    const onSuccess = (pos: GeolocationPosition) =>
      this.updateLocation(pos.coords.latitude, pos.coords.longitude);
    const onFail = (_: GeolocationPositionError) =>
      this.updateLocation(-26.2041, 28.0473);

    const secureOrigin =
      window.location.protocol === 'https:' ||
      ['localhost', '127.0.0.1'].includes(window.location.hostname);
    if (!secureOrigin) { this.updateLocation(-26.2041, 28.0473); return; }

    // ── FIX #5: store watch ID for cleanup ──
    if (this.geoWatchId !== null) navigator.geolocation.clearWatch(this.geoWatchId);
    this.geoWatchId = navigator.geolocation.watchPosition(
      onSuccess, onFail,
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
    );
  }

  private updateLocation(lat: number, lng: number) {
    const geohash = this.encodeGeohash(lat, lng, 7);
    this.currentLocation = { latitude: lat, longitude: lng, geohash, accuracy: 150, timestamp: Date.now() };
    this.ensureLocalAreaChannel();
    this.findNearbyChannels();
    this.notifyListeners('locationUpdated', this.currentLocation);
    this.isConnected = true;
  }

  private ensureLocalAreaChannel() {
    if (!this.currentLocation) return;
    const localChannelId = `${this.nostrChannelPrefix}${this.currentLocation.geohash.substring(0, 5)}`;
    if (!this.channels.has(localChannelId)) {
      this.channels.set(localChannelId, {
        id: localChannelId,
        geohash: this.currentLocation.geohash.substring(0, 5),
        name: `Local Area ${this.currentLocation.geohash.substring(0, 5)}`,
        description: 'Auto-created channel for your local area',
        desc: 'Auto-created channel for your local area',
        tags: ['local', 'auto'],
        participants: ['me'],
        isPublic: true,
        requiresInvite: false,
        createdBy: 'system',
        createdAt: Date.now(),
        lastActivity: Date.now(),
        messageCount: 0,
        isEncrypted: false
      });
      this.saveChannels();
    }
  }

  private encodeGeohash(lat: number, lng: number, precision: number) {
    const base32 = '0123456789bcdefghjkmnpqrstuvwxyz';
    let hash = '', latRange = [-90, 90], lngRange = [-180, 180];
    let even = true, bit = 0, ch = 0;
    while (hash.length < precision) {
      let mid;
      if (even) {
        mid = (lngRange[0] + lngRange[1]) / 2;
        if (lng >= mid) { ch = ch * 2 + 1; lngRange[0] = mid; }
        else { ch = ch * 2; lngRange[1] = mid; }
      } else {
        mid = (latRange[0] + latRange[1]) / 2;
        if (lat >= mid) { ch = ch * 2 + 1; latRange[0] = mid; }
        else { ch = ch * 2; latRange[1] = mid; }
      }
      even = !even;
      bit++;
      if (bit === 5) { hash += base32[ch]; bit = 0; ch = 0; }
    }
    return hash;
  }

  private findNearbyChannels() {
    if (!this.currentLocation) return;
    const prefix = this.currentLocation.geohash.substring(0, 4);
    const nearby: GeohashChannel[] = [];
    this.channels.forEach(channel => {
      if ((channel.geohash.startsWith(prefix) || channel.isPublic) && this.canViewChannel(channel)) {
        nearby.push(channel);
      }
    });
    this.nearbyChannels = nearby.sort((a, b) => b.lastActivity - a.lastActivity);
    this.notifyListeners('nearbyChannelsUpdated', this.nearbyChannels);
  }

  canViewChannel(channel: GeohashChannel) {
    if (channel.isPublic) return true;
    if (channel.requiresInvite) return channel.participants.includes('me') || channel.createdBy === 'me';
    return meshPermissions.canViewMarketplace(channel.createdBy);
  }

  // ── FIX #1: store interval ──
  private startBackgroundSync() {
    if (this.syncInterval) clearInterval(this.syncInterval);
    this.syncInterval = setInterval(() => this.findNearbyChannels(), 120000);
  }

  async createChannel(
    newRoomName: string,
    newRoomDesc: string,
    isPublic: boolean,
    requiresInvite: boolean,
    isTrading: boolean
  ): Promise<string> {
    const base = (newRoomName || 'room').trim().toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const currentGeohash = this.currentLocation?.geohash?.substring(0, 5) || 'global';
    const channelId = `${this.nostrChannelPrefix}${currentGeohash}-${base || 'room'}-${Math.random().toString(36).slice(2, 7)}`;

    const channel: GeohashChannel = {
      id: channelId,
      geohash: currentGeohash,
      name: newRoomName?.trim() || 'New Room',
      description: newRoomDesc?.trim() || 'Mesh room',
      desc: newRoomDesc?.trim() || 'Mesh room',
      tags: [isTrading ? 'trading' : 'chat', isPublic ? 'public' : 'private'],
      participants: ['me'],
      isPublic,
      requiresInvite,
      createdBy: this.myId,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      messageCount: 0,
      isEncrypted: !isPublic || requiresInvite,
      isTradingChannel: !!isTrading
    };

    this.channels.set(channelId, channel);
    this.messages.set(channelId, []);
    this.findNearbyChannels();
    this.saveChannels();
    this.saveMessages();
    this.notifyListeners('channelsUpdated', Array.from(this.channels.values()));
    return channelId;
  }

  async sendMessage(channelId: string, content: string, type: GeohashMessage['type'] = 'text'): Promise<string> {
    let channel = this.channels.get(channelId);

    if (!channel) {
      if (channelId.startsWith(this.nostrChannelPrefix)) this.ensureLocalAreaChannel();
      channel = this.channels.get(channelId);
    }

    if (!channel) {
      channel = {
        id: channelId,
        geohash: channelId.replace(this.nostrChannelPrefix, ''),
        name: `Channel ${channelId}`,
        description: 'Auto-created channel',
        desc: 'Auto-created channel',
        tags: ['auto'],
        participants: ['me'],
        isPublic: true,
        requiresInvite: false,
        createdBy: 'system',
        createdAt: Date.now(),
        lastActivity: Date.now(),
        messageCount: 0,
        isEncrypted: false
      };
      this.channels.set(channelId, channel);
      this.saveChannels();
    }

    const message: GeohashMessage = {
      id: generateUUID(),
      channelId,
      nodeId: 'me',
      nodeHandle: this.myHandle,
      content,
      timestamp: Date.now(),
      type
    };

    let broadcastContent = content;
    if (type !== 'system' && channel.isEncrypted) {
      try {
        const groupKey = this.currentLocation?.geohash || 'global';
        broadcastContent = JSON.stringify(await encryptionService.encryptGroupMessage(content, groupKey));
      } catch {
        console.warn('Failed to encrypt message');
      }
    }

    if (!this.messages.has(channelId)) this.messages.set(channelId, []);
    const msgs = this.messages.get(channelId)!;
    if (!msgs.find(m => m.id === message.id)) msgs.push(message);

    channel.lastActivity = Date.now();
    channel.messageCount++;

    await this.broadcastMessage(channelId, message.id, broadcastContent, this.currentLocation?.geohash || 'unknown');

    this.saveChannels();
    // ── FIX #3: use debounced save ──
    this.saveMessagesDebounced();
    this.notifyListeners('messageSent', message);
    return message.id;
  }

  private async broadcastMessage(channelId: string, messageId: string, content: string, geohash: string) {
    const tagged = `[GEOHASH:${geohash}][CHANNEL:${channelId}]${content}`;
    console.log(`[XC] SEND ch=${channelId} geohash=${geohash} len=${content.length}`);
    const [meshResult, nostrResult] = await Promise.allSettled([
      hybridMesh.sendMessage(tagged),
      nostrService.broadcastMessage(tagged)
    ]);
    console.log(`[XC] SENT mesh=${meshResult.status} nostr=${nostrResult.status}`);
  }

  async broadcastToNearby(content: string): Promise<void> {
    const geohash = this.currentLocation?.geohash || 'unknown';
    await this.broadcastMessage('broadcast', generateUUID(), content, geohash);
  }

  async joinChannel(channelId: string): Promise<void> {
    let channel = this.channels.get(channelId);
    if (!channel) {
      const geohash = this.currentLocation?.geohash?.substring(0, 5) || 'global';
      channel = {
        id: channelId,
        geohash,
        name: channelId.startsWith('room-')
          ? channelId.replace('room-', '').toUpperCase()
          : channelId,
        description: 'Auto-created room',
        desc: 'Auto-created room',
        tags: ['auto'],
        participants: [],
        isPublic: true,
        requiresInvite: false,
        createdBy: 'system',
        createdAt: Date.now(),
        lastActivity: Date.now(),
        messageCount: 0,
        isEncrypted: false,
        isTradingChannel: channelId.toLowerCase().includes('trade')
      };
      this.channels.set(channelId, channel);
      if (!this.messages.has(channelId)) this.messages.set(channelId, []);
      this.saveChannels();
      this.saveMessages();
    }

    if (!channel.participants.includes('me')) {
      channel.participants.push('me');
      this.saveChannels();
    }

    this.notifyListeners('channelJoined', channelId);
  }

  async leaveChannel(channelId: string): Promise<void> {
    const channel = this.channels.get(channelId);
    if (!channel) return;
    channel.participants = channel.participants.filter(p => p !== 'me');
    this.saveChannels();
    this.notifyListeners('channelLeft', channelId);
  }

  private loadChannels() {
    try {
      const saved = localStorage.getItem('geohash_channels');
      if (saved) JSON.parse(saved).forEach((c: GeohashChannel) => this.channels.set(c.id, c));
      const savedMessages = localStorage.getItem('geohash_messages');
      if (savedMessages)
        Object.entries(JSON.parse(savedMessages)).forEach(([id, msgs]) =>
          this.messages.set(id, msgs as GeohashMessage[])
        );
    } catch {}
  }

  private saveChannels() {
    try {
      localStorage.setItem('geohash_channels', JSON.stringify(Array.from(this.channels.values())));
    } catch {
      console.warn('[geohashChannels] Failed to save channels');
    }
  }

  // ── FIX #4: cap messages per channel before saving ──
  private saveMessages() {
    const out: { [key: string]: GeohashMessage[] } = {};
    this.messages.forEach((msgs, id) => {
      out[id] = msgs.slice(-this.MAX_STORED_MESSAGES);
    });
    try {
      localStorage.setItem('geohash_messages', JSON.stringify(out));
    } catch {
      console.warn('[geohashChannels] localStorage full — emergency trim');
      const slim: { [key: string]: GeohashMessage[] } = {};
      this.messages.forEach((msgs, id) => { slim[id] = msgs.slice(-20); });
      try { localStorage.setItem('geohash_messages', JSON.stringify(slim)); } catch {}
    }
  }

  subscribe(event: string, callback: (data: any) => void) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
    return () => { this.listeners[event] = this.listeners[event].filter(cb => cb !== callback); };
  }

  private notifyListeners(event: string, data: any) {
    (this.listeners[event] || []).forEach(cb => cb(data));
  }

  getNearbyChannels() { return this.nearbyChannels; }
  getChannelMessages(channelId: string) { return this.messages?.get(channelId) || []; }

  getLocalAreaChannel() {
    return this.currentLocation
      ? this.channels.get(`${this.nostrChannelPrefix}${this.currentLocation.geohash.substring(0, 5)}`) || null
      : null;
  }

  getLocalAreaMessages() {
    const c = this.getLocalAreaChannel();
    return c ? this.getChannelMessages(c.id) : [];
  }

  getCurrentLocation(): GeohashLocation | null {
    return this.currentLocation || {
      latitude: -26.2041, longitude: 28.0473,
      geohash: this.encodeGeohash(-26.2041, 28.0473, 7),
      accuracy: 150, timestamp: Date.now()
    };
  }

  // ── FIX #1, #2, #5: full cleanup ──
  destroy(): void {
    if (this.syncInterval) { clearInterval(this.syncInterval); this.syncInterval = null; }
    if (this.saveMessagesTimer) { clearTimeout(this.saveMessagesTimer); this.saveMessagesTimer = null; this.saveMessages(); }
    if (this.geoWatchId !== null) { navigator.geolocation.clearWatch(this.geoWatchId); this.geoWatchId = null; }
    this.unsubs.forEach(u => u());
    this.unsubs = [];
    this.listeners = {};
  }
}

export const geohashChannels: GeohashChannelsService = GeohashChannelsService.getInstance();

export function getGeohashChannelsInstance(): GeohashChannelsService {
  return geohashChannels;
}
