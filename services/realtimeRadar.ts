// Real-time Radar Service for XitChat - Mobile Mesh Edition
// TTL-based peer visibility with presence beacon integration
// Fixes mobile invisibility by using presence coordination layer

import { presenceBeacon, PresenceBeaconPeer } from './presenceBeacon';
import { smartRouter } from './smartRouter';
import { mobileLifecycle } from './mobileLifecycle';
import { nostrService } from './nostrService';

export interface RadarPeer {
  id: string;
  pubkey: string;
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
  ttl: number; // Time to live in seconds
  isOnline: boolean;
  device: 'mobile' | 'desktop' | 'server';
  role: 'edge' | 'anchor';
  signalStrength?: number;
  connectionType: 'webrtc' | 'websocket' | 'hybrid' | 'nostr' | 'bluetooth' | 'wifi' | 'broadcast';
  distance?: number; // Distance from current user
  transportPriority?: string[];
  confidence?: number; // Routing confidence
}

export interface GeohashZone {
  id: string;
  name: string;
  peerCount: number;
  peers: RadarPeer[];
  signalStrength: number;
}

class RealtimeRadarService {
  private peers: Map<string, RadarPeer> = new Map();
  private geohashZones: Map<string, GeohashZone> = new Map();
  private listeners: { [key: string]: ((data: any) => void)[] } = {};
  private cleanupInterval: any = null;
  private isInitialized = false;

  // Cache current location
  private myCurrentLocation: { lat: number; lng: number; geohash: string } | null = null;
  private myId: string = '';
  private myName: string = 'Anonymous';
  private myHandle: string = '@anon';
  handleMeshLocationUpdate: any;

  constructor() {
    this.myId = this.generatePeerId();
    this.loadUserInfo();
    this.setupPresenceIntegration();
    this.setupLifecycleIntegration();
    
    // Initialize with a default location to prevent null errors
    this.myCurrentLocation = this.generateRandomLocation();
    
    // Start TTL-based cleanup
    this.startTtlCleanup();
  }

  private generatePeerId(): string {
    return 'npub1' + Math.random().toString(36).substr(2, 58);
  }

  private setupPresenceIntegration(): void {
    // Listen for presence beacon updates
    presenceBeacon.subscribe('peersUpdated', (peers: PresenceBeaconPeer[]) => {
      this.handlePresencePeersUpdate(peers);
    });
    
    // Listen for Nostr presence events (global users).
    // Do not gate this on current connection state; Nostr may initialize later.
    nostrService.subscribe('presenceEvent', (presenceData) => {
      this.handleNostrPresenceEvent(presenceData);
    });
  }

  private setupLifecycleIntegration(): void {
    // Listen for mobile lifecycle events
    mobileLifecycle.on('state_change', (event: any) => {
      this.handleLifecycleEvent(event);
    });

    // Listen for network changes
    mobileLifecycle.on('network_change', (event: any) => {
      this.handleNetworkChange(event);
    });
  }

  private handleNostrPresenceEvent(presenceData: any): void {
    if (this.isSimulatedPeerId(presenceData?.pubkey)) {
      return;
    }

    // Convert Nostr presence data to radar peer format
    const radarPeer: RadarPeer = {
      id: presenceData.pubkey,
      pubkey: presenceData.pubkey,
      name: this.extractNameFromPubkey(presenceData.pubkey),
      handle: this.extractHandleFromPubkey(presenceData.pubkey),
      device: presenceData.device,
      role: presenceData.role,
      capabilities: presenceData.caps,
      lastSeen: presenceData.timestamp,
      ttl: presenceData.ttl,
      isOnline: true, // Nostr presence events are always online
      connectionType: 'nostr', // Global users come via Nostr
      signalStrength: presenceData.signalStrength,
      location: presenceData.geohash ? {
        lat: 0, lng: 0, // Will be calculated if needed
        geohash: presenceData.geohash
      } : undefined
    };

    // Add or update peer in radar
    this.peers.set(presenceData.pubkey, radarPeer);
    
    // Update geohash zones
    this.updateGeohashZones();
    
    // Notify listeners
    this.notifyListeners('peersUpdated', Array.from(this.peers.values()));
    
    console.log(`🗼 Radar: Added global peer from Nostr: ${presenceData.pubkey.substring(0, 8)}...`);
  }

  private handlePresencePeersUpdate(presencePeers: PresenceBeaconPeer[]): void {
    console.log(`🗼 Updating radar with ${presencePeers.length} presence peers`);

    const now = Date.now();
    const updatedPeers: RadarPeer[] = [];

    const myPubkey = presenceBeacon.getMyPresence()?.pubkey;
    presencePeers.forEach(presencePeer => {
      // Skip self
      if (myPubkey && presencePeer.pubkey === myPubkey) return;
      if (this.isSimulatedPeerId(presencePeer.pubkey)) return;

      // TTL-based visibility check (CRITICAL for mobile)
      const isVisible = now - presencePeer.lastSeen < (presencePeer.ttl * 1000);
      
      if (!isVisible) {
        // Remove expired peer
        this.peers.delete(presencePeer.pubkey);
        return;
      }

      // Convert presence peer to radar peer
      const radarPeer: RadarPeer = {
        id: presencePeer.pubkey,
        pubkey: presencePeer.pubkey,
        name: this.extractNameFromPubkey(presencePeer.pubkey),
        handle: this.extractHandleFromPubkey(presencePeer.pubkey),
        device: presencePeer.device,
        role: presencePeer.role,
        capabilities: presencePeer.caps,
        lastSeen: presencePeer.lastSeen,
        ttl: presencePeer.ttl,
        isOnline: true, // Presence peers are always online by definition
        connectionType: this.inferConnectionType(presencePeer.caps),
        signalStrength: presencePeer.signalStrength,
        location: presencePeer.geohash ? {
          lat: 0, lng: 0, // Will be calculated if needed
          geohash: presencePeer.geohash
        } : undefined
      };

      // Calculate routing information
      this.calculateRoutingInfo(radarPeer, presencePeer);

      this.peers.set(presencePeer.pubkey, radarPeer);
      updatedPeers.push(radarPeer);
    });

    // Update geohash zones
    this.updateGeohashZones();

    // Notify listeners
    this.notifyListeners('peersUpdated', updatedPeers);
    
    console.log(`🗼 Radar now shows ${this.peers.size} visible peers (TTL-filtered)`);
  }

  private calculateRoutingInfo(radarPeer: RadarPeer, presencePeer: PresenceBeaconPeer): void {
    try {
      // Get routing decision from smart router
      const presencePeerForRouting = {
        ...presencePeer,
        name: radarPeer.name,
        handle: radarPeer.handle,
        signalStrength: presencePeer.signalStrength,
        geohash: presencePeer.geohash,
        capabilities: presencePeer.caps,
        lastSeen: presencePeer.lastSeen,
        ttl: presencePeer.ttl,
        timestamp: presencePeer.timestamp,
        device: presencePeer.device,
        role: presencePeer.role,
        rooms: presencePeer.rooms
      };

      smartRouter.selectBestTransport(presencePeerForRouting)
        .then(decision => {
          radarPeer.transportPriority = [decision.transport, ...decision.fallbackOptions];
          radarPeer.confidence = decision.confidence;
          radarPeer.connectionType = decision.transport as any;
        })
        .catch(error => {
          console.debug('Routing calculation failed:', error);
          // Fallback to basic inference
        });
    } catch (error) {
      console.debug('Error calculating routing info:', error);
    }
  }

  private inferConnectionType(caps: string[]): RadarPeer['connectionType'] {
    if (caps.includes('bluetooth')) return 'bluetooth';
    if (caps.includes('wifi')) return 'wifi';
    if (caps.includes('webrtc')) return 'webrtc';
    if (caps.includes('nostr')) return 'nostr';
    if (caps.includes('broadcast')) return 'broadcast';
    return 'websocket'; // Fallback
  }

  private extractNameFromPubkey(pubkey: string): string {
    return `User ${pubkey.substring(0, 8)}...`;
  }

  private extractHandleFromPubkey(pubkey: string): string {
    return `@${pubkey.substring(0, 6)}`;
  }

  private isSimulatedPeerId(id?: string): boolean {
    if (!id) return true;
    const normalized = id.toLowerCase();
    return normalized.startsWith('sim_') ||
      normalized.startsWith('sim-') ||
      normalized.startsWith('simulated-') ||
      normalized.includes('mock') ||
      normalized.includes('test-');
  }

  private handleLifecycleEvent(event: any): void {
    console.log('📱 Radar handling lifecycle event:', event);

    switch (event.data.action) {
      case 'resume_mesh':
        this.resumeRadarOperations();
        break;
      case 'pause_mesh':
        this.pauseRadarOperations();
        break;
      case 'cleanup_all':
        this.cleanupAllPeers();
        break;
      case 'update_presence':
        this.triggerPresenceUpdate();
        break;
    }
  }

  private handleNetworkChange(event: any): void {
    console.log('🌐 Radar handling network change:', event);

    if (event.state === 'offline') {
      // Switch to offline mode
      this.enableOfflineMode();
    } else if (event.state === 'online') {
      // Resume online operations
      this.resumeOnlineOperations();
    }
  }

  private startTtlCleanup(): void {
    // Clean up expired peers every 10 seconds
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredPeers();
    }, 10000);
  }

  private cleanupExpiredPeers(): void {
    const now = Date.now();
    const expiredPeers: string[] = [];

    this.peers.forEach((peer, pubkey) => {
      // TTL-based peer visibility (CRITICAL for mobile reliability)
      if (peer.lastSeen + (peer.ttl * 1000) <= now) {
        expiredPeers.push(pubkey);
      }
    });

    expiredPeers.forEach(pubkey => {
      this.peers.delete(pubkey);
    });

    if (expiredPeers.length > 0) {
      console.log(`🗼 Cleaned up ${expiredPeers.length} expired peers from radar`);
      this.updateGeohashZones();
      this.notifyListeners('peersUpdated', Array.from(this.peers.values()));
    }
  }

  private updateGeohashZones(): void {
    // Group peers by geohash for zone-based organization
    const zones = new Map<string, RadarPeer[]>();
    
    this.peers.forEach(peer => {
      if (peer.location?.geohash) {
        const zoneId = peer.location.geohash.substring(0, 3); // 3-char precision
        if (!zones.has(zoneId)) {
          zones.set(zoneId, []);
        }
        zones.get(zoneId)!.push(peer);
      }
    });

    // Update zones map
    zones.forEach((peers, zoneId) => {
      const zone: GeohashZone = {
        id: zoneId,
        name: `Zone ${zoneId}`,
        peerCount: peers.length,
        peers,
        signalStrength: peers.reduce((sum, p) => sum + (p.signalStrength || 0), 0) / peers.length
      };
      this.geohashZones.set(zoneId, zone);
    });

    // Remove empty zones
    this.geohashZones.forEach((zone, id) => {
      if (zone.peerCount === 0) {
        this.geohashZones.delete(id);
      }
    });
  }

  private resumeRadarOperations(): void {
    console.log('📡 Resuming radar operations');
  }

  private pauseRadarOperations(): void {
    console.log('⏸️ Pausing radar operations');
  }

  private cleanupAllPeers(): void {
    console.log('🧹 Cleaning up all radar peers');
    this.peers.clear();
    this.updateGeohashZones();
    this.notifyListeners('peersUpdated', []);
  }

  private triggerPresenceUpdate(): void {
    console.log('📡 Triggering presence update from radar');
    // This will be handled by presence beacon
  }

  private enableOfflineMode(): void {
    console.log('📴 Radar switching to offline mode');
    // Enable offline simulation in presence beacon
  }

  private resumeOnlineOperations(): void {
    console.log('🌐 Radar resuming online operations');
    // Resume normal operations
  }

  private loadUserInfo(): void {
    const savedName = localStorage.getItem('xitchat_name');
    const savedHandle = localStorage.getItem('xitchat_handle');
    if (savedName) this.myName = savedName;
    if (savedHandle) this.myHandle = `@${savedHandle}`;
  }

  private generateRandomLocation(): { lat: number; lng: number; geohash: string } {
    // "Digital Lobby" - Fixed location for users without GPS/HTTPS
    // This ensures everyone sees each other by default if geolocation fails
    const lat = -26.2041;
    const lng = 28.0473;
    return {
      lat,
      lng,
      geohash: this.encodeGeohash(lat, lng, 5)
    };
  }

  private encodeGeohash(lat: number, lng: number, precision: number): string {
    // Simplified geohash implementation
    const latRange = [-90, 90];
    const lngRange = [-180, 180];
    
    let geohash = '';
    let latMin = latRange[0], latMax = latRange[1];
    let lngMin = lngRange[0], lngMax = lngRange[1];
    
    for (let i = 0; i < precision; i++) {
      const latMid = (latMin + latMax) / 2;
      const lngMid = (lngMin + lngMax) / 2;
      
      if (lat >= latMid) {
        geohash += '1';
        latMin = latMid;
      } else {
        geohash += '0';
        latMax = latMid;
      }
      
      if (lng >= lngMid) {
        geohash += '1';
        lngMin = lngMid;
      } else {
        geohash += '0';
        lngMax = lngMid;
      }
    }
    
    return geohash;
  }

  private updateMyLocation(): void {
    // Update my location for presence beacon
    if (this.myCurrentLocation) {
      // This will be picked up by presence beacon
      console.log('📍 Updating my location for presence beacon');
    }
  }

  private notifyListeners(event: string, data: any): void {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(data));
    }
  }

  private addOrUpdatePeer(peerData: any, transport: RadarPeer['connectionType']) {
  const id = peerData.pubkey || peerData.id;

  const radarPeer: RadarPeer = {
    id,
    pubkey: id,
    name: peerData.name || `User ${id.substring(0, 8)}`,
    handle: peerData.handle || `@${id.substring(0, 6)}`,
    device: peerData.device || 'mobile',
    role: peerData.role || 'edge',
    capabilities: peerData.caps || [],
    lastSeen: Date.now(),
    ttl: 60, // keep peer for 60 seconds by default
    isOnline: true,
    connectionType: transport,
    signalStrength: peerData.signalStrength || 0,
    location: peerData.geohash ? { lat: 0, lng: 0, geohash: peerData.geohash } : undefined
  };

  this.peers.set(id, radarPeer);
  this.updateGeohashZones();
  this.notifyListeners('peersUpdated', Array.from(this.peers.values()));
}

private setupDiscovery(): void {
  // Bluetooth scanning
  mobileLifecycle.on('bluetooth_scan', (devices: any[]) => {
    devices.forEach(d => this.addOrUpdatePeer(d, 'bluetooth'));
  });

  // WiFi P2P scanning
  mobileLifecycle.on('wifi_p2p_scan', (devices: any[]) => {
    devices.forEach(d => this.addOrUpdatePeer(d, 'wifi'));
  });

  // WebRTC peers (real P2P)
  nostrService.subscribe('presenceEvent', (presenceData: any) => {
    this.handleNostrPresenceEvent(presenceData);
  });
}
  
  // Public API methods
  async initialize(serverUrl?: string): Promise<boolean> {
    try {
      if (this.isInitialized) {
        return true;
      }

      console.log('📡 Initializing SERVERLESS Mobile Mesh Radar...');

      // Initialize presence beacon first
      const presenceInitialized = await presenceBeacon.initialize();
      if (!presenceInitialized) {
        console.warn('⚠️ Presence beacon initialization failed');
      }

      // Start presence beacon
      await presenceBeacon.start();

      // Update my location
      this.updateMyLocation();

      // SERVERLESS: Skip server connection test - use direct P2P only
      const isNativeAndroid = (window as any).Capacitor?.isNativePlatform() && (window as any).Capacitor?.getPlatform() === 'android';
      
      if (isNativeAndroid) {
        console.log('📱 Android: Using SERVERLESS mesh (Bluetooth + WiFi Direct + Nostr)');
        console.log('🔥 No signaling server needed - direct P2P connections only');
      } else {
        console.log('🌐 Web: Testing optional signaling server...');
        await this.testSignalingServerConnection();
      }

      console.log('✅ Serverless Mobile Mesh Radar initialized successfully');
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize serverless radar:', error);
      return false;
    }
  }

  private async testSignalingServerConnection(): Promise<void> {
    // ANDROID SERVERLESS: Skip all WebSocket connections - use true P2P only
    const isNativeAndroid = (window as any).Capacitor?.isNativePlatform() && (window as any).Capacitor?.getPlatform() === 'android';
    
    if (isNativeAndroid) {
      console.log('📱 Android: SKIPPING WebSocket server connections - using serverless P2P only');
      console.log('🔥 True serverless mesh - no signaling servers needed');
      return;
    }

    // Web-only: Optional WebSocket testing (but skip for serverless deployment)
    if (window.location.protocol === 'https:') {
      console.log('🌐 HTTPS detected: Skipping WebSocket connections for security');
      return;
    }

    console.log('🌐 Web: WebSocket connections disabled in serverless mode');
    return;
  }

  getPeers(): RadarPeer[] {
    return Array.from(this.peers.values());
  }

  getGeohashZones(): GeohashZone[] {
    return Array.from(this.geohashZones.values());
  }

  getMyLocation(): { lat: number; lng: number; geohash: string } | null {
    return this.myCurrentLocation;
  }

  subscribe(event: string, callback: (data: any) => void): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
    
    return () => {
      const listeners = this.listeners[event];
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }

  isRealModeEnabled(): boolean {
    // Check if we have any real peers (not simulated)
    return this.peers.size > 0 && Array.from(this.peers.values()).some(peer => 
      peer.connectionType !== 'websocket' && 
      peer.connectionType !== 'broadcast'
    );
  }

  // Cleanup
  destroy(): void {
    console.log('🧹 Destroying Mobile Mesh Radar');
    
    // Clear cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    // Clear all listeners
    this.listeners = {};
    
    // Clear peers
    this.peers.clear();
    this.geohashZones.clear();
    this.isInitialized = false;
  }
}

export const realtimeRadar = new RealtimeRadarService();
