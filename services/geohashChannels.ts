import { meshPermissions } from './meshPermissions';
import { nostrService } from './nostrService';
import { hybridMesh } from './hybridMesh';
import { encryptionService } from './encryptionService';

export interface GeohashChannel {
  desc: string;
  tags: any[];
  id: string;
  geohash: string;
  name: string;
  description: string;
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
  private channels: Map<string, GeohashChannel> = new Map();
  private messages: Map<string, GeohashMessage[]> = new Map();
  private currentLocation: GeohashLocation | null = null;
  private nearbyChannels: GeohashChannel[] = [];
  private listeners: { [key: string]: ((data: any) => void)[] } = {};
  private isConnected = false;
  private myHandle: string = '@anon';
  private nostrChannelPrefix = 'xitchat-local-'; // Prefix for Nostr channel IDs

  constructor() {
    this.loadChannels();
    this.initializeGeohashService();
  }

  private async initializeGeohashService() {
    // Load user handle
    const savedHandle = localStorage.getItem('xitchat_handle');
    if (savedHandle) {
      this.myHandle = `@${savedHandle}`;
    }

    // Initialize location services
    this.initializeLocationServices();

    // Subscribe to Nostr channel messages for cross-device communication
    this.subscribeToNostrMessages();

    // Subscribe to hybrid mesh messages for local P2P
    this.subscribeToMeshMessages();

    // Start background sync
    this.startBackgroundSync();
  }

  private subscribeToNostrMessages() {
    // Listen for channel messages from Nostr (this enables cross-device chat!)
    nostrService.subscribe('channelMessageReceived', (message) => {
      // Check if this is a local geohash channel message
      if (message.channelId && message.channelId.startsWith(this.nostrChannelPrefix)) {
        const geohash = message.channelId.replace(this.nostrChannelPrefix, '');

        // Only process if it's for our area
        if (this.currentLocation && this.isNearbyGeohash(geohash)) {
          const geoMessage: GeohashMessage = {
            id: message.id,
            channelId: message.channelId,
            nodeId: message.from,
            nodeHandle: `@nostr_${message.from.substring(0, 8)}`,
            content: message.content,
            timestamp: message.timestamp instanceof Date ? message.timestamp.getTime() : Date.now(),
            type: 'text'
          };

          this.addReceivedMessage(geoMessage);
        }
      }
    });

    // Also listen for broadcast messages tagged with geohash
    nostrService.subscribe('messageReceived', (message) => {
      if (message.content && message.content.startsWith('[GEOHASH:')) {
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
            type: 'text'
          };
          this.addReceivedMessage(geoMessage);
        }
      }
    });
  }

  private subscribeToMeshMessages() {
    // Listen for messages from local mesh (Bluetooth, WiFi P2P, Broadcast)
    hybridMesh.subscribe('messageReceived', async (message) => {
      if (message.content && message.content.startsWith('[GEOHASH:')) {
        const match = message.content.match(/\[GEOHASH:([^\]]+)\]/);
        if (match) {
          const cleanContent = message.content.replace(/\[GEOHASH:[^\]]+\]/, '').trim();

          let finalContent = cleanContent;
          let isEncrypted = false;

          // Try to decrypt if it looks like encrypted group data
          if (cleanContent.startsWith('{') && cleanContent.includes('data') && cleanContent.includes('iv')) {
            try {
              const parsed = JSON.parse(cleanContent);
              finalContent = await encryptionService.decryptGroupMessage(parsed, match[1]);
              isEncrypted = true;
            } catch (e) {
              // Not encrypted or wrong key, keep as is
            }
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
            encrypted: isEncrypted
          };
          this.addReceivedMessage(geoMessage);
        }
      }
    });
  }

  private addReceivedMessage(message: GeohashMessage) {
    // Don't add our own messages
    if (message.nodeHandle === this.myHandle) return;

    // Add to local messages
    if (!this.messages.has(message.channelId)) {
      this.messages.set(message.channelId, []);
    }

    // Check for duplicate
    const existingMessages = this.messages.get(message.channelId)!;
    if (!existingMessages.find(m => m.id === message.id)) {
      existingMessages.push(message);
      this.saveMessages();
      this.notifyListeners('messageReceived', message);
      console.log(`📨 Received local area message: ${message.content}`);
    }
  }

  private isNearbyGeohash(geohash: string): boolean {
    if (!this.currentLocation) return true; // Accept all if no location

    // Check if the first 4 characters match (approximately same area ~39km)
    const currentPrefix = this.currentLocation.geohash.substring(0, 4);
    const messagePrefix = geohash.substring(0, 4);
    return currentPrefix === messagePrefix;
  }

  private initializeLocationServices() {
    if (!('geolocation' in navigator)) {
      console.warn('Geolocation is not supported by this browser.');
      // Use default location
      this.updateLocation(-26.2041, 28.0473); // Johannesburg default
      return;
    }

    // Delay location request
    setTimeout(() => {
      this.requestLocationWithUserGesture();
    }, 1000);
  }

  private requestLocationWithUserGesture() {
    const onLocationSuccess = (position: GeolocationPosition) => {
      this.updateLocation(position.coords.latitude, position.coords.longitude);
    };

    const onTotalFailure = (error: GeolocationPositionError) => {
      console.warn(`Location failed (${error.message}). Using default.`);
      this.updateLocation(-26.2041, 28.0473); // Default Johannesburg
    };

    const isSecureOrigin = window.location.protocol === 'https:' ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1';

    if (!isSecureOrigin) {
      console.debug('🌐 Geolocation requires HTTPS. Using fallback location.');
      this.updateLocation(-26.2041, 28.0473);
      return;
    }

    navigator.geolocation.watchPosition(
      onLocationSuccess,
      onTotalFailure,
      {
        enableHighAccuracy: false,
        timeout: 15000,
        maximumAge: 60000
      }
    );
  }

  private updateLocation(latitude: number, longitude: number) {
    const geohash = this.encodeGeohash(latitude, longitude, 7);

    this.currentLocation = {
      latitude,
      longitude,
      geohash,
      accuracy: 150,
      timestamp: Date.now()
    };

    console.log(`📍 Location updated: ${geohash} (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`);

    // Auto-create or join the local area channel
    this.ensureLocalAreaChannel();

    // Find nearby channels
    this.findNearbyChannels();

    // Notify listeners
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
        isEncrypted: false
      };

      this.channels.set(localChannelId, channel);
      this.saveChannels();
      console.log(`🏠 Created local area channel: ${localChannelId}`);
    }
  }

  private encodeGeohash(lat: number, lng: number, precision: number): string {
    const base32 = '0123456789bcdefghjkmnpqrstuvwxyz';
    let hash = '';
    let latRange = [-90, 90];
    let lngRange = [-180, 180];
    let even = true;
    let bit = 0;
    let ch = 0;

    while (hash.length < precision) {
      let mid;
      if (even) {
        mid = (lngRange[0] + lngRange[1]) / 2;
        if (lng >= mid) {
          ch = ch * 2 + 1;
          lngRange[0] = mid;
        } else {
          ch = ch * 2;
          lngRange[1] = mid;
        }
      } else {
        mid = (latRange[0] + latRange[1]) / 2;
        if (lat >= mid) {
          ch = ch * 2 + 1;
          latRange[0] = mid;
        } else {
          ch = ch * 2;
          latRange[1] = mid;
        }
      }
      even = !even;
      bit++;

      if (bit === 5) {
        hash += base32[ch];
        bit = 0;
        ch = 0;
      }
    }

    return hash;
  }

  private findNearbyChannels() {
    if (!this.currentLocation) return;

    const nearby: GeohashChannel[] = [];
    const currentGeohashPrefix = this.currentLocation.geohash.substring(0, 4);

    this.channels.forEach(channel => {
      // Check if channel is in nearby area
      if (channel.geohash.startsWith(currentGeohashPrefix) || channel.isPublic) {
        if (this.canViewChannel(channel)) {
          nearby.push(channel);
        }
      }
    });

    this.nearbyChannels = nearby.sort((a, b) => b.lastActivity - a.lastActivity);
    this.notifyListeners('nearbyChannelsUpdated', this.nearbyChannels);
  }

  canViewChannel(channel: GeohashChannel): boolean {
    if (channel.isPublic) return true;
    if (channel.requiresInvite) {
      return channel.participants.includes('me') || channel.createdBy === 'me';
    }
    return meshPermissions.canViewMarketplace(channel.createdBy);
  }

  private startBackgroundSync() {
    // Sync channels every 2 minutes
    setInterval(() => {
      this.findNearbyChannels();
    }, 120000);
  }

  // PUBLIC API METHODS
  async createChannel(name: string, description: string, isPublic: boolean = true, isEncrypted?: boolean, isTradingChannel?: boolean): Promise<string> {
    if (!this.currentLocation) {
      throw new Error('Location required to create channel');
    }

    const channelId = `${this.nostrChannelPrefix}${this.currentLocation.geohash.substring(0, 5)}_${Date.now()}`;

    const channel: GeohashChannel = {
      id: channelId,
      geohash: this.currentLocation.geohash,
      name,
      description,
      desc: description,
      tags: isTradingChannel ? ['trade', 'private'] : (isPublic ? ['local', 'auto'] : ['private']),
      participants: ['me'],
      isPublic,
      requiresInvite: !isPublic,
      createdBy: 'me',
      createdAt: Date.now(),
      lastActivity: Date.now(),
      messageCount: 0,
      isEncrypted: isTradingChannel ? true : (isEncrypted !== undefined ? isEncrypted : !isPublic),
      isTradingChannel
    };

    this.channels.set(channelId, channel);
    this.saveChannels();
    this.findNearbyChannels();
    this.notifyListeners('channelCreated', channel);

    return channelId;
  }

  async joinChannel(channelId: string): Promise<boolean> {
    const channel = this.channels.get(channelId);
    if (!channel) return false;

    if (!this.canViewChannel(channel)) {
      throw new Error('No permission to join this channel');
    }

    if (!channel.participants.includes('me')) {
      channel.participants.push('me');
      channel.lastActivity = Date.now();

      await this.sendMessage(channelId, `${this.myHandle} joined the channel`, 'system');

      this.saveChannels();
      this.notifyListeners('channelJoined', channel);
    }

    return true;
  }

  async leaveChannel(channelId: string): Promise<boolean> {
    const channel = this.channels.get(channelId);
    if (!channel) return false;

    channel.participants = channel.participants.filter(p => p !== 'me');

    await this.sendMessage(channelId, `${this.myHandle} left the channel`, 'system');

    this.saveChannels();
    this.notifyListeners('channelLeft', channel);

    return true;
  }

  async sendMessage(channelId: string, content: string, type: GeohashMessage['type'] = 'text'): Promise<string> {
    const channel = this.channels.get(channelId);
    if (!channel && !channelId.startsWith(this.nostrChannelPrefix)) {
      throw new Error('Channel not found');
    }

    const geohash = this.currentLocation?.geohash || 'unknown';

    const message: GeohashMessage = {
      id: `msg_${Date.now()}`,
      channelId,
      nodeId: 'me',
      nodeHandle: this.myHandle,
      content,
      timestamp: Date.now(),
      type
    };

    // Encrypt for group if not a system message AND channel is encrypted
    let broadcastContent = content;
    if (type !== 'system' && channel?.isEncrypted) {
      try {
        const encrypted = await encryptionService.encryptGroupMessage(content, geohash);
        broadcastContent = JSON.stringify(encrypted);
      } catch (e) {
        console.warn('Failed to encrypt group message, sending plain');
      }
    }

    // Add to local messages
    if (!this.messages.has(channelId)) {
      this.messages.set(channelId, []);
    }
    this.messages.get(channelId)!.push(message);

    // Update channel activity
    if (channel) {
      channel.lastActivity = Date.now();
      channel.messageCount++;
    }

    // Broadcast via ALL available channels for cross-device real-time chat
    await this.broadcastMessage(message.id, broadcastContent, geohash);

    this.saveChannels();
    this.saveMessages();
    this.notifyListeners('messageSent', message);

    return message.id;
  }

  // Send message to local area (cross-device via Nostr + local mesh)
  async sendToLocalArea(content: string): Promise<string> {
    if (!this.currentLocation) {
      throw new Error('Location required to send local area message');
    }

    const localChannelId = `${this.nostrChannelPrefix}${this.currentLocation.geohash.substring(0, 5)}`;
    return this.sendMessage(localChannelId, content);
  }

  private async broadcastMessage(messageId: string, content: string, geohash: string) {
    const taggedContent = `[GEOHASH:${geohash}]${content}`;

    // 1. Send via Nostr (CROSS-DEVICE - reaches other phones!)
    try {
      await nostrService.broadcastMessage(taggedContent);
      console.log('📡 Message sent via Nostr (cross-device)');
    } catch (error) {
      console.warn('Nostr broadcast failed:', error);
    }

    // 2. Send via Hybrid Mesh (local devices - Bluetooth, WiFi P2P, BroadcastChannel)
    try {
      await hybridMesh.sendMessage(taggedContent);
      console.log('📶 Message sent via local mesh');
    } catch (error) {
      console.warn('Mesh broadcast failed:', error);
    }
  }

  // Quick method to send to friends in same room/area
  async chatInRoom(content: string): Promise<string> {
    return this.sendToLocalArea(content);
  }

  // GETTERS
  getCurrentLocation(): GeohashLocation | null {
    return this.currentLocation;
  }

  getNearbyChannels(): GeohashChannel[] {
    return this.nearbyChannels;
  }

  getChannelMessages(channelId: string): GeohashMessage[] {
    return this.messages.get(channelId) || [];
  }

  getLocalAreaChannel(): GeohashChannel | null {
    if (!this.currentLocation) return null;
    const localChannelId = `${this.nostrChannelPrefix}${this.currentLocation.geohash.substring(0, 5)}`;
    return this.channels.get(localChannelId) || null;
  }

  getLocalAreaMessages(): GeohashMessage[] {
    const localChannel = this.getLocalAreaChannel();
    if (!localChannel) return [];
    return this.getChannelMessages(localChannel.id);
  }

  getMyChannels(): GeohashChannel[] {
    return Array.from(this.channels.values()).filter(c => c.participants.includes('me'));
  }

  isConnectedToNetwork(): boolean {
    return this.isConnected;
  }

  // PERSISTENCE
  private loadChannels() {
    try {
      const saved = localStorage.getItem('geohash_channels');
      if (saved) {
        const channels: GeohashChannel[] = JSON.parse(saved);
        channels.forEach(channel => {
          this.channels.set(channel.id, channel);
        });
      }

      const savedMessages = localStorage.getItem('geohash_messages');
      if (savedMessages) {
        const messages: { [key: string]: GeohashMessage[] } = JSON.parse(savedMessages);
        Object.entries(messages).forEach(([channelId, channelMessages]) => {
          this.messages.set(channelId, channelMessages);
        });
      }
    } catch (error) {
      console.error('Failed to load geohash data:', error);
    }
  }

  private saveChannels() {
    localStorage.setItem('geohash_channels', JSON.stringify(Array.from(this.channels.values())));
  }

  private saveMessages() {
    const messagesData: { [key: string]: GeohashMessage[] } = {};
    this.messages.forEach((msgs, channelId) => {
      messagesData[channelId] = msgs;
    });
    localStorage.setItem('geohash_messages', JSON.stringify(messagesData));
  }

  // EVENT LISTENERS
  subscribe(event: string, callback: (data: any) => void): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);

    return () => {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    };
  }

  private notifyListeners(event: string, data: any) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(data));
    }
  }
}

export const geohashChannels = new GeohashChannelsService();
