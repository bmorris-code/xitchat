// GeohashChannels.ts
import { meshPermissions } from './meshPermissions';
import { nostrService } from './nostrService';
import { hybridMesh } from './hybridMesh';
import { encryptionService, EncryptedData } from './encryptionService';

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

class GeohashChannelsService {
  private static instance: GeohashChannelsService;
  private channels: Map<string, GeohashChannel> = new Map();
  private messages: Map<string, GeohashMessage[]> = new Map();
  private currentLocation: GeohashLocation | null = null;
  private nearbyChannels: GeohashChannel[] = [];
  private listeners: { [key: string]: ((data: any) => void)[] } = {};
  private isConnected = false;
  private myHandle: string = '@anon';
  private nostrChannelPrefix = 'xitchat-local-'; // Prefix for Nostr channel IDs
  private myId = 'me';

  static getInstance() {
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
    this.startBackgroundSync();
  }

  private subscribeToNostrMessages() {
    nostrService.subscribe('channelMessageReceived', (message) => {
      if (message.channelId?.startsWith(this.nostrChannelPrefix)) {
        const geohash = message.channelId.replace(this.nostrChannelPrefix, '');
        if (this.currentLocation && this.isNearbyGeohash(geohash)) {
          const geoMessage: GeohashMessage = {
            id: message.id,
            channelId: message.channelId,
            nodeId: message.from,
            nodeHandle: `@nostr_${message.from.substring(0, 8)}`,
            content: message.content,
            timestamp: message.timestamp instanceof Date ? message.timestamp.getTime() : Date.now(),
            type: 'text',
          };
          this.addReceivedMessage(geoMessage);
        }
      }
    });

    nostrService.subscribe('messageReceived', (message) => {
      if (message.content?.startsWith('[GEOHASH:')) {
        const match = message.content.match(/\[GEOHASH:([^\]]+)\]/);
        if (match && this.isNearbyGeohash(match[1])) {
          const cleanContent = message.content.replace(/\[GEOHASH:[^\]]+\]/, '').trim();
          const geoMessage: GeohashMessage = {
            id: message.id || `nostr_${Date.now()}`,
            channelId: `${this.nostrChannelPrefix}${match[1]}`,
            nodeId: message.from,
            nodeHandle: `@${message.from?.substring(0, 8) || 'unknown'}`,
            content: cleanContent,
            timestamp: message.timestamp instanceof Date ? message.timestamp.getTime() : Date.now(),
            type: 'text',
          };
          this.addReceivedMessage(geoMessage);
        }
      }
    });
  }

  private subscribeToMeshMessages() {
    hybridMesh.subscribe('messageReceived', async (message) => {
      if (message.content?.startsWith('[GEOHASH:')) {
        const match = message.content.match(/\[GEOHASH:([^\]]+)\]/);
        if (!match) return;

        const cleanContent = message.content.replace(/\[GEOHASH:[^\]]+\]/, '').trim();
        let finalContent = cleanContent;
        let isEncrypted = false;

        if (cleanContent.startsWith('{') && cleanContent.includes('data') && cleanContent.includes('iv')) {
          try {
            const parsed = JSON.parse(cleanContent);
            finalContent = await encryptionService.decryptGroupMessage(parsed, match[1]);
            isEncrypted = true;
          } catch {}
        }

        const geoMessage: GeohashMessage = {
          id: message.id || `mesh_${Date.now()}`,
          channelId: `${this.nostrChannelPrefix}${match[1]}`,
          nodeId: message.from,
          nodeHandle: message.senderHandle || `@${message.from?.substring(0, 8) || 'unknown'}`,
          content: finalContent,
          timestamp: message.timestamp || Date.now(),
          type: 'text',
          // @ts-ignore
          encrypted: isEncrypted,
        };

        this.addReceivedMessage(geoMessage);
      }
    });
  }

  private addReceivedMessage(message: GeohashMessage) {
    if (message.nodeHandle === this.myHandle) return;

    if (!this.messages.has(message.channelId)) this.messages.set(message.channelId, []);

    const existing = this.messages.get(message.channelId)!;
    if (!existing.find((m) => m.id === message.id)) {
      existing.push(message);
      this.saveMessages();
      this.notifyListeners('messageReceived', message);
      console.log(`📨 Received local area message: ${message.content}`);
    }
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

    setTimeout(() => this.requestLocationWithUserGesture(), 1000);
  }

  private requestLocationWithUserGesture() {
    const onSuccess = (pos: GeolocationPosition) => this.updateLocation(pos.coords.latitude, pos.coords.longitude);
    const onFail = (_: GeolocationPositionError) => this.updateLocation(-26.2041, 28.0473);

    const secureOrigin = window.location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(window.location.hostname);
    if (!secureOrigin) return this.updateLocation(-26.2041, 28.0473);

    navigator.geolocation.watchPosition(onSuccess, onFail, { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 });
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
      const channel: GeohashChannel = {
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
        isEncrypted: false,
      };
      this.channels.set(localChannelId, channel);
      this.saveChannels();
      console.log(`🏠 Created local area channel: ${localChannelId}`);
    }
  }

  private encodeGeohash(lat: number, lng: number, precision: number) {
    const base32 = '0123456789bcdefghjkmnpqrstuvwxyz';
    let hash = '';
    let latRange = [-90, 90];
    let lngRange = [-180, 180];
    let even = true, bit = 0, ch = 0;
    while (hash.length < precision) {
      let mid;
      if (even) {
        mid = (lngRange[0] + lngRange[1]) / 2;
        if (lng >= mid) { ch = ch * 2 + 1; lngRange[0] = mid; } else { ch = ch * 2; lngRange[1] = mid; }
      } else {
        mid = (latRange[0] + latRange[1]) / 2;
        if (lat >= mid) { ch = ch * 2 + 1; latRange[0] = mid; } else { ch = ch * 2; latRange[1] = mid; }
      }
      even = !even;
      bit++;
      if (bit === 5) { hash += base32[ch]; bit = 0; ch = 0; }
    }
    return hash;
  }

  private findNearbyChannels() {
    if (!this.currentLocation) return;
    const nearby: GeohashChannel[] = [];
    const prefix = this.currentLocation.geohash.substring(0, 4);
    this.channels.forEach(channel => {
      if (channel.geohash.startsWith(prefix) || channel.isPublic) {
        if (this.canViewChannel(channel)) nearby.push(channel);
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

  private startBackgroundSync() {
    setInterval(() => this.findNearbyChannels(), 120000);
  }

  // ---------------- PUBLIC API ----------------

  async sendMessage(channelId: string, content: string, type: GeohashMessage['type'] = 'text'): Promise<string> {
    const channel = this.channels.get(channelId);
    if (!channel && !channelId.startsWith(this.nostrChannelPrefix)) throw new Error('Channel not found');

    const message: GeohashMessage = {
      id: `msg_${Date.now()}`,
      channelId,
      nodeId: 'me',
      nodeHandle: this.myHandle,
      content,
      timestamp: Date.now(),
      type,
    };

    // Encrypt if group
    let broadcastContent = content;
    if (type !== 'system' && channel?.isEncrypted) {
      try { broadcastContent = JSON.stringify(await encryptionService.encryptGroupMessage(content, this.currentLocation!.geohash)); }
      catch { console.warn('Failed to encrypt message'); }
    }

    if (!this.messages.has(channelId)) this.messages.set(channelId, []);
    this.messages.get(channelId)!.push(message);

    if (channel) { channel.lastActivity = Date.now(); channel.messageCount++; }

    await this.broadcastMessage(message.id, broadcastContent, this.currentLocation?.geohash || 'unknown');

    this.saveChannels();
    this.saveMessages();
    this.notifyListeners('messageSent', message);

    return message.id;
  }

  private async broadcastMessage(messageId: string, content: string, geohash: string) {
    const tagged = `[GEOHASH:${geohash}]${content}`;
    try { await nostrService.broadcastMessage(tagged); } catch {}
    try { await hybridMesh.sendMessage(tagged); } catch {}
  }

  // ---------------- STORAGE ----------------

  private loadChannels() {
    try {
      const saved = localStorage.getItem('geohash_channels');
      if (saved) JSON.parse(saved).forEach((c: GeohashChannel) => this.channels.set(c.id, c));

      const savedMessages = localStorage.getItem('geohash_messages');
      if (savedMessages) Object.entries(JSON.parse(savedMessages)).forEach(([id, msgs]) => this.messages.set(id, msgs as GeohashMessage[]));
    } catch { }
  }

  private saveChannels() { localStorage.setItem('geohash_channels', JSON.stringify(Array.from(this.channels.values()))); }
  private saveMessages() {
    const out: { [key: string]: GeohashMessage[] } = {};
    this.messages.forEach((msgs, id) => { out[id] = msgs; });
    localStorage.setItem('geohash_messages', JSON.stringify(out));
  }

  // ---------------- LISTENERS ----------------

  subscribe(event: string, callback: (data: any) => void) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
    return () => this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
  }
  private notifyListeners(event: string, data: any) { if (this.listeners[event]) this.listeners[event].forEach(cb => cb(data)); }

 // ---------------- GETTERS ----------------
getNearbyChannels() { return this.nearbyChannels; }
getChannelMessages(channelId: string) { return this.messages.get(channelId) || []; }
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
  return this.currentLocation;
}

export const geohashChannels = GeohashChannelsService.getInstance();
