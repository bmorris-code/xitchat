import { meshPermissions } from './meshPermissions';
import { bluetoothMesh, MeshMessage } from './bluetoothMesh';

export interface GeohashChannel {
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
  private relayNodes: string[] = [];

  constructor() {
    this.initializeGeohashService();
    this.loadChannels();
  }

  private initializeGeohashService() {
    // Initialize location services
    this.initializeLocationServices();
    
    // Connect to public relays
    this.connectToRelays();
    
    // Start background sync
    this.startBackgroundSync();
  }

 private initializeLocationServices() {
    if (!('geolocation' in navigator)) {
      console.warn('Geolocation is not supported by this browser.');
      return;
    }

    const onLocationSuccess = (position: GeolocationPosition) => {
      this.updateLocation(position.coords.latitude, position.coords.longitude);
    };

    // 1. Final Safety Net: If everything fails, set location to (0,0) so app doesn't crash
    const onTotalFailure = (error: GeolocationPositionError) => {
      console.error(`Location totally failed (${error.message}). Defaulting to fallback.`);
      this.updateLocation(0, 0); 
    };

    // 2. Fallback: Try Low Accuracy (Wifi/Cell)
    const startLowAccuracyWatch = () => {
      console.log('Switching to low accuracy location mode...');
      
      const lowAccWatchId = navigator.geolocation.watchPosition(
        onLocationSuccess,
        (error) => {
          // If this fails too, STOP watching and use the safety net
          console.error('Low accuracy also failed:', error);
          navigator.geolocation.clearWatch(lowAccWatchId);
          onTotalFailure(error);
        },
        {
          enableHighAccuracy: false, 
          timeout: 30000,
          maximumAge: 60000
        }
      );
    };

    // 3. First Attempt: High Accuracy (GPS)
    const highAccWatchId = navigator.geolocation.watchPosition(
      onLocationSuccess,
      (error) => {
        // Stop the high accuracy watcher immediately on error
        navigator.geolocation.clearWatch(highAccWatchId);

        // If it was a timeout (3) or unavailable (2), try the fallback
        if (error.code === 3 || error.code === 2) {
          console.warn(`High accuracy failed (${error.message}). Falling back.`);
          startLowAccuracyWatch();
        } else {
          // If Permission Denied (1), give up immediately
          onTotalFailure(error);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000, 
        maximumAge: 10000
      }
    );
  }
  
  private updateLocation(latitude: number, longitude: number) {
    const geohash = this.encodeGeohash(latitude, longitude, 7); // 7 chars = ~150m precision
    
    this.currentLocation = {
      latitude,
      longitude,
      geohash,
      accuracy: 150,
      timestamp: Date.now()
    };

    // Find nearby channels
    this.findNearbyChannels();
    
    // Notify listeners
    this.notifyListeners('locationUpdated', this.currentLocation);
  }

  private encodeGeohash(lat: number, lng: number, precision: number): string {
    // Simplified geohash encoding
    const base32 = '0123456789bcdefghjkmnpqrstuvwxyz';
    let hash = '';
    let latRange = [-90, 90];
    let lngRange = [-180, 180];
    let bit = 0;
    let even = true;

    while (hash.length < precision) {
      let mid;
      if (even) {
        mid = (lngRange[0] + lngRange[1]) / 2;
        if (lng >= mid) {
          hash += '1';
          lngRange[0] = mid;
        } else {
          hash += '0';
          lngRange[1] = mid;
        }
      } else {
        mid = (latRange[0] + latRange[1]) / 2;
        if (lat >= mid) {
          hash += '1';
          latRange[0] = mid;
        } else {
          hash += '0';
          latRange[1] = mid;
        }
      }
      even = !even;
    }

    // Convert binary to base32
    let result = '';
    for (let i = 0; i < hash.length; i += 5) {
      const chunk = hash.substr(i, 5);
      const index = parseInt(chunk, 2);
      result += base32[index] || '0';
    }

    return result;
  }

  private async connectToRelays() {
    // Connect to public internet relays for extended range
    try {
      const relayServers = [
        'relay1.xitchat.net',
        'relay2.xitchat.net',
        'relay3.xitchat.net'
      ];

      for (const relay of relayServers) {
        // In real implementation, establish WebSocket connection
        this.relayNodes.push(relay);
      }

      this.isConnected = true;
      this.notifyListeners('relayConnected', this.relayNodes);
    } catch (error) {
      console.error('Failed to connect to relays:', error);
    }
  }

  private findNearbyChannels() {
    if (!this.currentLocation) return;

    const nearby: GeohashChannel[] = [];
    const currentGeohash = this.currentLocation.geohash;

    // Check channels in same geohash and adjacent ones
    const geohashesToCheck = [
      currentGeohash,
      this.getAdjacentGeohashes(currentGeohash)
    ].flat();

    this.channels.forEach(channel => {
      if (geohashesToCheck.includes(channel.geohash)) {
        // Check if user has permission to view this channel
        if (this.canViewChannel(channel)) {
          nearby.push(channel);
        }
      }
    });

    this.nearbyChannels = nearby.sort((a, b) => b.lastActivity - a.lastActivity);
    this.notifyListeners('nearbyChannelsUpdated', this.nearbyChannels);
  }

  private getAdjacentGeohashes(geohash: string): string[] {
    // Simplified adjacent geohash calculation
    // In real implementation, this would calculate all 8 adjacent geohashes
    const adjacent = [];
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        if (i === 0 && j === 0) continue;
        adjacent.push(geohash); // Simplified - would calculate actual adjacent
      }
    }
    return adjacent;
  }

  canViewChannel(channel: GeohashChannel): boolean {
    // Public channels are visible to everyone
    if (channel.isPublic) return true;

    // Private channels require invitation
    if (channel.requiresInvite) {
      return channel.participants.includes('me') || channel.createdBy === 'me';
    }

    // Check if creator granted permission
    return meshPermissions.canViewMarketplace(channel.createdBy);
  }

  private startBackgroundSync() {
    // Sync channels every 2 minutes
    setInterval(() => {
      this.syncChannels();
    }, 120000);

    // Sync messages every 30 seconds
    setInterval(() => {
      this.syncMessages();
    }, 30000);
  }

  private async syncChannels() {
    if (!this.isConnected) return;

    // Request channel updates from relays
    const syncRequest = {
      type: 'channel_sync_request',
      geohash: this.currentLocation?.geohash,
      timestamp: Date.now()
    };

    // Send to all relay nodes
    for (const relay of this.relayNodes) {
      // In real implementation, send via WebSocket
      console.log('Syncing channels with relay:', relay);
    }
  }

  private async syncMessages() {
    // Sync recent messages for active channels
    this.nearbyChannels.forEach(channel => {
      if (this.canViewChannel(channel)) {
        this.requestChannelMessages(channel.id);
      }
    });
  }

  private async requestChannelMessages(channelId: string) {
    const messageRequest = {
      type: 'message_sync_request',
      channelId,
      lastSync: Date.now() - (5 * 60 * 1000), // Last 5 minutes
      timestamp: Date.now()
    };

    // Send to relay nodes
    for (const relay of this.relayNodes) {
      console.log('Requesting messages for channel:', channelId);
    }
  }

  // PUBLIC API METHODS
  async createChannel(name: string, description: string, isPublic: boolean = true): Promise<string> {
    if (!this.currentLocation) {
      throw new Error('Location required to create channel');
    }

    const channelId = `channel_${Date.now()}`;
    
    const channel: GeohashChannel = {
      id: channelId,
      geohash: this.currentLocation.geohash,
      name,
      description,
      participants: ['me'],
      isPublic,
      requiresInvite: !isPublic,
      createdBy: 'me',
      createdAt: Date.now(),
      lastActivity: Date.now(),
      messageCount: 0
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
      
      // Send join message
      await this.sendMessage(channelId, `@symbolic joined the channel`, 'system');
      
      this.saveChannels();
      this.notifyListeners('channelJoined', channel);
    }

    return true;
  }

  async leaveChannel(channelId: string): Promise<boolean> {
    const channel = this.channels.get(channelId);
    if (!channel) return false;

    channel.participants = channel.participants.filter(p => p !== 'me');
    
    // Send leave message
    await this.sendMessage(channelId, `@symbolic left the channel`, 'system');
    
    this.saveChannels();
    this.notifyListeners('channelLeft', channel);

    return true;
  }

  async sendMessage(channelId: string, content: string, type: GeohashMessage['type'] = 'text'): Promise<string> {
    const channel = this.channels.get(channelId);
    if (!channel) {
      throw new Error('Channel not found');
    }

    if (!this.canViewChannel(channel)) {
      throw new Error('No permission to send messages to this channel');
    }

    const message: GeohashMessage = {
      id: `msg_${Date.now()}`,
      channelId,
      nodeId: 'me',
      nodeHandle: '@symbolic',
      content,
      timestamp: Date.now(),
      type
    };

    // Add to local messages
    if (!this.messages.has(channelId)) {
      this.messages.set(channelId, []);
    }
    this.messages.get(channelId)!.push(message);

    // Update channel activity
    channel.lastActivity = Date.now();
    channel.messageCount++;

    // Broadcast via mesh and relays
    await this.broadcastMessage(message);

    this.saveChannels();
    this.saveMessages();
    this.notifyListeners('messageSent', message);

    return message.id;
  }

  private async broadcastMessage(message: GeohashMessage) {
    const messageData = {
      type: 'geohash_message',
      payload: message,
      timestamp: Date.now()
    };

    // Send via Bluetooth mesh to all available peers
    const peers = bluetoothMesh.getPeers();
    for (const peer of peers) {
      await bluetoothMesh.sendMessage(peer.id, JSON.stringify(messageData));
    }

    // Send via relay nodes for extended range
    for (const relay of this.relayNodes) {
      // In real implementation, send via WebSocket
      console.log('Broadcasting message via relay:', relay);
    }
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

  getMyChannels(): GeohashChannel[] {
    return Array.from(this.channels.values()).filter(c => c.participants.includes('me'));
  }

  isConnectedToRelays(): boolean {
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
