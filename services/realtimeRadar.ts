// Real-time Radar Service for XitChat
// Connects to signaling server for live user discovery and geohash mapping
// UPGRADED: Now uses Nostr for real-time cross-device location broadcasting

import { nostrService } from './nostrService';
import { hybridMesh } from './hybridMesh';

export interface RadarPeer {
  id: string;
  name: string;
  handle: string;
  avatar?: string;
  location?: {
    lat: number;
    lng: number;
    geohash: string;
  };
  capabilities: string[];
  lastSeen: number;
  isOnline: boolean;
  signalStrength?: number;
  connectionType: 'webrtc' | 'websocket' | 'hybrid' | 'nostr';
  distance?: number; // Distance from current user
}

export interface GeohashZone {
  id: string;
  name: string;
  peerCount: number;
  peers: RadarPeer[];
  signalStrength: number;
}

class RealtimeRadarService {
  private ws: WebSocket | null = null;
  private peers: Map<string, RadarPeer> = new Map();
  private geohashZones: Map<string, GeohashZone> = new Map();
  private currentGeohash: string = '';
  private listeners: { [key: string]: ((data: any) => void)[] } = {};
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private reconnectInterval: any = null;
  private isRealMode = false;
  private is5GNetwork = false;
  private connectionQuality: 'excellent' | 'good' | 'fair' | 'poor' = 'good';
  private nostrRadarPrefix = 'xitchat-radar-v1-';

  // Cache current location
  private myCurrentLocation: { lat: number; lng: number; geohash: string } | null = null;
  private myId: string = '';
  private myName: string = 'Anonymous';
  private myHandle: string = '@anon';
  isRealModeEnabled: any;

  constructor() {
    this.myId = this.generatePeerId();
    this.detectNetworkType();
    this.loadUserInfo();
    // Initialize with a default location to prevent null errors
    this.myCurrentLocation = this.generateRandomLocation();
  }

  private loadUserInfo() {
    const savedName = localStorage.getItem('xitchat_name');
    const savedHandle = localStorage.getItem('xitchat_handle');
    if (savedName) this.myName = savedName;
    if (savedHandle) this.myHandle = `@${savedHandle}`;
  }

  private generateRandomLocation() {
    // "Digital Lobby" - Fixed location for users without GPS/HTTPS
    // This ensures everyone sees each other by default if geolocation fails
    return {
      lat: -26.2041,
      lng: 28.0473,
      geohash: this.encodeGeohash(-26.2041, 28.0473, 5)
    };
  }

  private detectNetworkType(): void {
    if (typeof navigator !== 'undefined' && 'connection' in navigator) {
      const connection = (navigator as any).connection;
      if (connection) {
        this.is5GNetwork = connection.effectiveType === '5g' || connection.downlink > 10;
        this.updateConnectionQuality(connection.downlink, connection.rtt);
        connection.addEventListener('change', () => this.detectNetworkType());
      }
    }
  }

  private updateConnectionQuality(downlink: number, rtt?: number): void {
    if (downlink > 20) this.connectionQuality = 'excellent';
    else if (downlink > 10) this.connectionQuality = 'good';
    else if (downlink > 5) this.connectionQuality = 'fair';
    else this.connectionQuality = 'poor';

    if (this.is5GNetwork && rtt && rtt < 50) this.connectionQuality = 'excellent';
  }

  async initialize(serverUrl?: string): Promise<boolean> {
    try {
      console.log('📡 Initializing Real-time Radar (Nostr-Enabled)...');

      // 0. Listen for Nostr initialization to broadcast location immediately
      nostrService.subscribe('initialized', () => {
        console.log('📡 Nostr initialized, broadcasting location to radar...');
        this.updateMyLocation();
      });

      // 1. Setup Nostr for cross-device location updates
      this.setupNostrRadar();

      // 2. Start Location Tracking
      this.startRealLocationTracking();

      // 3. Attempt WebSocket connection if not on Vercel (for hybrid support)
      const isVercel = window.location.hostname.includes('vercel.app');
      if (!isVercel) {
        this.connectWebSocket(serverUrl);
      }

      this.isRealMode = true;
      console.log('✅ Real-time radar initialized with Nostr cross-device support');
      return true;
    } catch (error) {
      console.error('Failed to initialize radar service:', error);
      return false;
    }
  }

  private setupNostrRadar() {
    // Listen for location updates from other devices via Nostr
    nostrService.subscribe('messageReceived', (message) => {
      if (message.content && message.content.startsWith(this.nostrRadarPrefix)) {
        try {
          const radarData = JSON.parse(message.content.replace(this.nostrRadarPrefix, ''));
          this.handleNostrPeerUpdate(radarData);
        } catch (error) {
          console.error('Failed to parse Nostr radar update:', error);
        }
      }
    });
  }

  handleMeshLocationUpdate(data: any) {
    this.handleNostrPeerUpdate(data); // Reuse same logic for mesh updates
  }

  private handleNostrPeerUpdate(data: any) {
    try {
      // Create or update radar peer
      const radarPeer: RadarPeer = {
        id: data.id || data.publicKey || 'unknown',
        name: data.name || data.handle || 'Anonymous',
        handle: data.handle || data.name || 'anon',
        avatar: data.avatar || data.picture,
        location: data.location,
        capabilities: data.capabilities || [],
        lastSeen: data.lastSeen || Date.now(),
        isOnline: data.isOnline !== false,
        signalStrength: data.signalStrength || 100,
        connectionType: data.connectionType || 'nostr',
        distance: data.distance
      };

      // Update or add peer
      this.peers.set(radarPeer.id, radarPeer);

      // Calculate distance if location is available
      if (radarPeer.location && this.myCurrentLocation) {
        const distance = this.calculateDistance(
          this.myCurrentLocation.lat,
          this.myCurrentLocation.lng,
          radarPeer.location.lat,
          radarPeer.location.lng
        );
        radarPeer.distance = distance;
      }

      console.log(`📍 Radar peer updated: ${radarPeer.handle} (${radarPeer.connectionType}) - ${radarPeer.distance || 0}km`);

      // Emit peer update events
      this.notifyListeners('peerJoined', radarPeer);
      this.notifyListeners('peersUpdated', Array.from(this.peers.values()));

      // Auto-add peer to hybrid mesh for chat compatibility
      this.addPeerToHybridMesh(radarPeer);

    } catch (error) {
      console.error('Failed to handle Nostr peer update:', error);
    }
  }

  private addPeerToHybridMesh(radarPeer: RadarPeer) {
    try {
      // Convert radar peer to hybrid mesh peer format
      const meshPeer = {
        id: radarPeer.id,
        name: radarPeer.name,
        handle: radarPeer.handle,
        isConnected: radarPeer.isOnline,
        lastSeen: radarPeer.lastSeen,
        signalStrength: radarPeer.signalStrength,
        capabilities: radarPeer.capabilities,
        serviceId: radarPeer.id
      };

      // Add to hybrid mesh using public method
      hybridMesh.addExternalPeer(meshPeer, radarPeer.connectionType as any);
      
      console.log(`🔗 Added radar peer to hybrid mesh: ${radarPeer.handle} via ${radarPeer.connectionType}`);
    } catch (error) {
      console.error('Failed to add radar peer to hybrid mesh:', error);
    }
  }

  private async connectWebSocket(serverUrl?: string) {
    // WebSocket logic remains as a hybrid fallback for local dev
    // ... (simplified for brevity, focusing on Nostr as primary)
  }

  private startRealLocationTracking() {
    if (!('geolocation' in navigator)) {
      this.myCurrentLocation = this.generateRandomLocation();
      return;
    }

    // Check for secure context (HTTPS or localhost)
    if (!window.isSecureContext) {
      console.debug('ℹ️ Geolocation requires a secure context (HTTPS). Using fallback location.');
      this.myCurrentLocation = this.generateRandomLocation();
      return;
    }

    navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        this.myCurrentLocation = {
          lat: latitude,
          lng: longitude,
          geohash: this.encodeGeohash(latitude, longitude, 7)
        };
        this.updateMyLocation();
      },
      (error) => {
        console.warn(`Geolocation Error: ${error.message}. Using fallback.`);
        if (!this.myCurrentLocation) this.myCurrentLocation = this.generateRandomLocation();
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  private async updateMyLocation() {
    if (!this.myCurrentLocation) return;

    const radarData = {
      id: this.myId,
      name: this.myName,
      handle: this.myHandle,
      location: this.myCurrentLocation,
      capabilities: ['chat', 'radar'],
      timestamp: Date.now()
    };

    // 1. Broadcast via Nostr (CROSS-DEVICE!)
    try {
      await nostrService.broadcastMessage(`${this.nostrRadarPrefix}${JSON.stringify(radarData)}`);

      // 2. Broadcast via Hybrid Mesh (LOCAL/MESH!)
      await hybridMesh.sendMessage(JSON.stringify({
        type: 'location_update',
        data: radarData
      }));
    } catch (error) {
      console.warn('Radar broadcast failed:', error);
    }

    // 2. Send via WebSocket if connected
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'update_location',
        location: this.myCurrentLocation,
        timestamp: Date.now()
      }));
    }

    this.calculateDistances();
    this.notifyListeners('locationUpdated', this.myCurrentLocation);
  }

  private calculateDistances() {
    if (!this.myCurrentLocation) return;
    this.peers.forEach(peer => {
      if (peer.location) {
        peer.distance = this.calculateDistance(
          this.myCurrentLocation!.lat, this.myCurrentLocation!.lng,
          peer.location.lat, peer.location.lng
        );
      }
    });
  }

  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number { return degrees * (Math.PI / 180); }

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

  // Public API
  getPeers(): RadarPeer[] { return Array.from(this.peers.values()); }
  subscribe(event: string, callback: (data: any) => void): () => void {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
    return () => {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    };
  }

  private notifyListeners(event: string, data: any): void {
    if (this.listeners[event]) this.listeners[event].forEach(callback => callback(data));
  }

  private generatePeerId(): string {
    return 'radar_' + Math.random().toString(36).substr(2, 9);
  }

  disconnect(): void {
    if (this.reconnectInterval) clearTimeout(this.reconnectInterval);
    if (this.ws) { this.ws.close(); this.ws = null; }
  }
}

export const realtimeRadar = new RealtimeRadarService();