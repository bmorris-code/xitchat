// Presence Beacon Service - Mobile Mesh Discovery Layer
// Short-lived, transport-agnostic, mobile-safe presence coordination
// This is NOT a chat server - only tracks who is alive right now
// 
// SCOPE CLARIFICATION:
// - BroadcastChannel = same device / same origin (local coherence only)
// - Nostr = global discovery backbone (serverless global presence)
// - Presence ≠ Messaging (never sends chat messages)
// - Mobile presence only exists while app is foregrounded

import { nodeRoleService, NodeRole } from './nodeRoles';
import { nostrService, NostrPresenceEvent } from './nostrService';

export interface PresenceBeaconPeer {
  pubkey: string;
  device: 'mobile' | 'desktop' | 'server';
  role: 'edge' | 'anchor';
  caps: ('webrtc' | 'nostr' | 'bluetooth' | 'wifi' | 'broadcast')[];
  rooms: string[];
  lastSeen: number;
  ttl: number; // Time to live in seconds (30-60 max)
  signalStrength?: number;
  geohash?: string;
  timestamp: number;
}

export interface PresencePing {
  type: 'presence';
  pubkey: string;
  device: 'mobile' | 'desktop' | 'server';
  role: 'edge' | 'anchor';
  caps: ('webrtc' | 'nostr' | 'bluetooth' | 'wifi' | 'broadcast')[];
  rooms: string[];
  timestamp: number;
  ttl: number;
}

export interface PresenceResponse {
  peers: PresenceBeaconPeer[];
}

export interface PresenceBeaconConfig {
  ttl: number; // Default TTL in seconds (30-60 max)
  heartbeatInterval: number; // How often to ping (15 seconds foreground)
  maxRetries: number;
  isMobile: boolean;
}

class PresenceBeaconService {
  private config: PresenceBeaconConfig;
  private baseHeartbeatInterval: number;
  private baseTtl: number;
  private isInitialized = false;
  private isRunning = false;
  private heartbeatTimer: any = null;
  private retryCount = 0;
  private peers: Map<string, PresenceBeaconPeer> = new Map();
  private listeners: { [key: string]: ((data: any) => void)[] } = {};
  private myPresence: PresenceBeaconPeer | null = null;
  private isBackground = false;
  private visibilityState: 'visible' | 'hidden' | 'prerender' = 'visible';
  private currentGeohash: string | null = null;
  private geohashUpdateTimer: any = null;
  private currentRole: NodeRole = 'edge';
  private roleChangeUnsubscribe: (() => void) | null = null;
  private channel: BroadcastChannel | null = null;
  private nostrPublishTimer: any = null;
  private cleanupTimer: any = null;
  private isNostrAvailable = false;
  private isChannelClosed = false;

  constructor() {
    // Auto-detect mobile and configure according to spec
    const isMobile = this.detectMobile();
    const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    // Spec compliance: 15 second foreground pings, 30-60 second TTL
    this.config = {
      ttl: isMobile ? 30 : 45, // Mobile: 30s, Desktop: 45s (within 30-60s range)
      heartbeatInterval: 15000, // Exactly 15 seconds as per spec
      maxRetries: 3,
      isMobile,
    };

    // Store base values to prevent drift
    this.baseHeartbeatInterval = this.config.heartbeatInterval;
    this.baseTtl = this.config.ttl;

    // Initialize BroadcastChannel for realtime presence
    this.ensureBroadcastChannel();

    this.setupMobileOptimizations();
    this.setupNodeRoleIntegration();
    this.setupNostrIntegration();
  }

  private detectMobile(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  private ensureBroadcastChannel(): void {
    if (this.channel && !this.isChannelClosed) {
      return;
    }

    try {
      this.channel = new BroadcastChannel('xitchat-presence');
      this.channel.onmessage = (event) => {
        const data = event.data;
        if (!data?.type) return;

        if (data.type === 'presence') {
          this.handleIncomingPresence(data.peer);
        }
      };
      this.isChannelClosed = false;
    } catch (error) {
      console.warn('⚠️ BroadcastChannel not available:', error);
      this.channel = null;
      this.isChannelClosed = true;
    }
  }

  private setupNostrIntegration(): void {
    // Nostr transport availability should be tied to our internal service state,
    // not browser extension objects (window.nostr/webln).
    this.isNostrAvailable = nostrService.isConnected();

    nostrService.subscribe('initialized', () => {
      this.isNostrAvailable = true;
      console.log('🗼 Nostr integration enabled for global presence');
    });

    nostrService.subscribe('disconnected', () => {
      this.isNostrAvailable = false;
      console.log('🗼 Nostr integration disabled (service disconnected)');
    });

    // Always subscribe; events will flow once Nostr is initialized.
    nostrService.subscribe('presenceEvent', (presenceData) => {
      this.handleNostrPresenceEvent(presenceData);
    });
  }

  private handleNostrPresenceEvent(presenceData: any): void {
    // Convert Nostr presence event to local presence peer format
    const presencePeer: PresenceBeaconPeer = {
      pubkey: presenceData.pubkey,
      device: presenceData.device,
      role: presenceData.role,
      caps: presenceData.caps as ('webrtc' | 'nostr' | 'bluetooth' | 'wifi' | 'broadcast')[],
      rooms: presenceData.rooms,
      lastSeen: presenceData.timestamp,
      ttl: presenceData.ttl,
      signalStrength: presenceData.signalStrength,
      geohash: presenceData.geohash,
      timestamp: presenceData.timestamp
    };

    // Add to local peers cache
    this.peers.set(presencePeer.pubkey, presencePeer);
    this.notifyListeners('peersUpdated', this.getPeers());
    
    console.log(`🗼 Added global peer from Nostr: ${presencePeer.pubkey.substring(0, 8)}...`);
  }

  private async publishPresenceToNostr(): Promise<void> {
    if (!this.isNostrAvailable || !this.myPresence || !this.isRunning) return;

    try {
      const nostrPresence: NostrPresenceEvent = {
        pubkey: this.myPresence.pubkey,
        device: this.myPresence.device,
        role: this.myPresence.role,
        caps: this.myPresence.caps,
        rooms: this.myPresence.rooms,
        ttl: this.myPresence.ttl,
        timestamp: this.myPresence.timestamp,
        geohash: this.myPresence.geohash,
        signalStrength: this.myPresence.signalStrength
      };

      await nostrService.publishPresenceEvent(nostrPresence);
    } catch (error) {
      console.debug('Failed to publish presence to Nostr:', error);
    }
  }

  private setupNodeRoleIntegration(): void {
    // Get initial role
    this.currentRole = nodeRoleService.getCurrentRole();
    
    // Listen for role changes
    this.roleChangeUnsubscribe = nodeRoleService.onRoleChange((newRole) => {
      this.currentRole = newRole;
      console.log(`🔄 Presence beacon updated to role: ${newRole}`);
      
      // Re-broadcast presence with new role
      if (this.isRunning && !this.isBackground) {
        this.broadcastPresence();
      }
    });
  }

  private setupMobileOptimizations(): void {
    // Handle page visibility changes for mobile lifecycle
    document.addEventListener('visibilitychange', () => {
      this.visibilityState = document.visibilityState as any;
      this.isBackground = this.visibilityState !== 'visible';
      
      if (this.isBackground && this.config.isMobile) {
        console.log('📱 App went to background - presence will expire naturally');
        this.adjustForBackground();
      } else if (!this.isBackground) {
        console.debug('📱 App came to foreground, resuming presence pings');
        this.sendImmediatePresencePing();
        this.adjustForForeground();
      }
    });

    // Handle page focus/blur for additional mobile detection
    window.addEventListener('focus', () => {
      if (!this.isBackground) {
        console.debug('📱 Window focused, sending immediate presence ping');
        this.sendImmediatePresencePing();
      }
    });

    window.addEventListener('blur', () => {
      // Empty handler for consistency
    });

    // Handle page hide for mobile browsers
    window.addEventListener('pagehide', () => {
      if (this.config.isMobile) {
        console.log('📱 Page hiding - presence will expire naturally');
      }
    });

    // Handle page show events for mobile PWA
    window.addEventListener('pageshow', (event) => {
      if (this.config.isMobile && !event.persisted) {
        console.debug('📱 Page showing, resuming presence');
        this.sendImmediatePresencePing();
      }
    });

    // Handle beforeunload
    window.addEventListener('beforeunload', () => {
      // Presence expires naturally via TTL - no cleanup needed
    });

    // Battery optimization (reduce frequency but maintain spec compliance)
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        battery.addEventListener('levelchange', () => {
          if (battery.level < 0.2) {
            // Still maintain 15s interval per spec, but can reduce TTL
            this.config.ttl = 25; // Slightly reduced but within range
            console.log('🔋 Battery low, reducing TTL to 25s');
          }
        });
      });
    }

    // Network optimization
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      if (connection) {
        connection.addEventListener('change', () => {
          if (connection.saveData || connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
            // Maintain 15s interval but reduce TTL for slow connections
            this.config.ttl = 25;
            console.log('🐌 Slow connection detected, reducing TTL to 25s');
          }
        });
      }
    }

    // iOS Safari wake-up fix - CRITICAL for mobile presence
    document.addEventListener(
      'touchstart',
      () => {
        console.debug('📱 iOS wake-up ping');
        this.sendImmediatePresencePing();
      },
      { once: true }
    );
  }

  private adjustForBackground() {
    // Background: presence expires naturally (no special handling needed per spec)
    // Just reduce TTL to help cleanup
    if (this.config.isMobile) {
      this.config.ttl = 20; // Shorter TTL for background cleanup
    }
  }

  private adjustForForeground() {
    // Foreground: restore normal TTL
    this.config.heartbeatInterval = this.baseHeartbeatInterval;
    this.config.ttl = this.baseTtl;
  }

  async initialize(userInfo?: { name?: string; handle?: string }): Promise<boolean> {
    try {
      // Prevent multiple initializations
      if (this.isInitialized) {
        console.debug('🗼 Presence Beacon already initialized');
        return true;
      }

      console.log('🗼 Initializing Serverless Mesh Presence Beacon...');

      // Get user info from localStorage if not provided
      const name = userInfo?.name || localStorage.getItem('xitchat_name') || 'Anonymous';
      const handle = userInfo?.handle || localStorage.getItem('xitchat_handle') || 'anon';
      const pubkey = localStorage.getItem('xitchat_pubkey') || this.generatePubkey();

      // Create my presence record according to spec
      this.myPresence = {
        pubkey,
        device: this.config.isMobile ? 'mobile' : 'desktop',
        role: this.currentRole,
        caps: this.getDeviceCapabilities(),
        rooms: ['global', 'local'], // Default rooms
        lastSeen: Date.now(),
        ttl: this.config.ttl,
        timestamp: Date.now()
      };

      this.isInitialized = true;
      console.log('✅ Serverless Mesh Presence Beacon initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Presence Beacon:', error);
      return false;
    }
  }

  private getDeviceCapabilities(): ('webrtc' | 'nostr' | 'bluetooth' | 'wifi' | 'broadcast')[] {
    const caps: ('webrtc' | 'nostr' | 'bluetooth' | 'wifi' | 'broadcast')[] = [];
    
    // WebRTC capability
    if ('RTCPeerConnection' in window) caps.push('webrtc');
    
    // Nostr capability comes from service connectivity.
    if (nostrService.isConnected()) caps.push('nostr');
    
    // Bluetooth capability (mobile only)
    if (this.config.isMobile && 'bluetooth' in navigator) caps.push('bluetooth');
    
    // WiFi P2P capability (heuristic)
    if (!this.config.isMobile && 'connection' in navigator) {
      const connection = (navigator as any).connection;
      if (connection?.type === 'wifi') caps.push('wifi');
    }
    
    // Broadcast capability
    if ('BroadcastChannel' in window) caps.push('broadcast');
    
    return caps.length > 0 ? caps : ['webrtc']; // Fallback
  }


  async start(): Promise<void> {
    if (!this.isInitialized || !this.myPresence) {
      throw new Error('Presence Beacon must be initialized before starting');
    }

    if (this.isRunning) {
      console.debug('🗼 Presence Beacon already running');
      return;
    }

    console.log('🗼 Starting Serverless Mesh Presence Beacon (15s intervals)...');
    this.isRunning = true;
    this.retryCount = 0;
    this.ensureBroadcastChannel();

    // Start geohash updates
    this.startGeohashUpdates();
    
    // Start heartbeat loop (15 seconds per spec)
    this.heartbeatLoop();
    
    // Start Nostr presence publishing (every 60 seconds to match Nostr rate limits)
    if (this.isNostrAvailable) {
      this.nostrPublishTimer = setInterval(() => {
        this.publishPresenceToNostr();
      }, 60000); // Publish to Nostr every 60 seconds (reduced from 30)
    }
    
    // Start TTL cleanup loop (critical for serverless)
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredPeers();
    }, 5000);
    
    // Initial presence broadcast
    await this.broadcastPresence();
    
    // Initial Nostr presence publish
    if (this.isNostrAvailable) {
      await this.publishPresenceToNostr();
    }
  }

  async stop(): Promise<void> {
    console.log('🗼 Stopping Presence Beacon...');
    this.isRunning = false;
    
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    if (this.geohashUpdateTimer) {
      clearInterval(this.geohashUpdateTimer);
      this.geohashUpdateTimer = null;
    }

    if (this.nostrPublishTimer) {
      clearInterval(this.nostrPublishTimer);
      this.nostrPublishTimer = null;
    }

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    // Close BroadcastChannel
    if (this.channel && !this.isChannelClosed) {
      try {
        this.channel.close();
      } catch (error) {
        console.debug('Error closing BroadcastChannel:', error);
      }
      this.channel = null;
      this.isChannelClosed = true;
    }
  }

  private async heartbeatLoop(): Promise<void> {
    if (!this.isRunning) return;

    if (!this.isBackground) {
      await this.broadcastPresence();
    }

    // Self-scheduling loop for iOS compatibility (exactly 15 seconds per spec)
    this.heartbeatTimer = setTimeout(
      () => this.heartbeatLoop(),
      this.config.heartbeatInterval
    );
  }

  private startGeohashUpdates(): void {
    // Update geohash periodically (every 2-3 minutes)
    this.geohashUpdateTimer = setInterval(async () => {
      if (this.isRunning && !this.isBackground) {
        await this.updateGeohash();
      }
    }, 180000); // 3 minutes

    // Initial geohash update
    this.updateGeohash();
  }

  private async updateGeohash(): Promise<void> {
    try {
      // Try to get geohash from realtimeRadar if available
      const radarLocation = (window as any).realtimeRadar?.myCurrentLocation;
      if (radarLocation?.geohash) {
        this.currentGeohash = radarLocation.geohash;
        return;
      }

      // Fallback to browser geolocation (async, with timeout)
      if (navigator.geolocation) {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            resolve,
            reject,
            { timeout: 5000, maximumAge: 300000 } // 5s timeout, 5min cache
          );
        });

        // Convert coordinates to simple geohash (simplified implementation)
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        this.currentGeohash = this.coordsToGeohash(lat, lng);
      }
    } catch (error) {
      console.debug('Geolocation update failed:', error);
      // Keep current geohash or use default
      if (!this.currentGeohash) {
        this.currentGeohash = '428F'; // Default geohash for Johannesburg area
      }
    }
  }

  private coordsToGeohash(lat: number, lng: number): string {
    // Simplified geohash implementation (3 characters = ~100km precision)
    const latRange = [-90, 90];
    const lngRange = [-180, 180];
    
    let geohash = '';
    let latMin = latRange[0], latMax = latRange[1];
    let lngMin = lngRange[0], lngMax = lngRange[1];
    
    for (let i = 0; i < 3; i++) {
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

  private getCurrentGeohash(): string | null {
    return this.currentGeohash;
  }

  private async broadcastPresence(): Promise<void> {
    if (!this.myPresence) return;

    // Update presence with current data
    this.myPresence.lastSeen = Date.now();
    this.myPresence.timestamp = Date.now();
    this.myPresence.role = this.currentRole;
    this.myPresence.caps = this.getDeviceCapabilities();
    this.myPresence.ttl = this.config.ttl;

    // Add current geohash if available
    const geohash = this.getCurrentGeohash();
    if (geohash) {
      this.myPresence.geohash = geohash;
    }

    // Broadcast via BroadcastChannel (realtime, serverless) - with error handling
    if (this.channel && !this.isChannelClosed) {
      try {
        this.channel.postMessage({
          type: 'presence',
          peer: { ...this.myPresence }
        });
        console.debug('🗼 Presence broadcast successful (realtime)');
      } catch (error) {
        console.debug('⚠️ Failed to broadcast via BroadcastChannel:', error);
        this.isChannelClosed = true;
        this.channel = null;
      }
    } else {
      console.debug('🗼 BroadcastChannel unavailable, skipping local broadcast');
    }

    // Also update local cache so YOU see yourself instantly
    this.peers.set(this.myPresence.pubkey, this.myPresence);
    this.notifyListeners('peersUpdated', this.getPeers());
    
    // Also publish to Nostr for global visibility
    if (this.isNostrAvailable) {
      // Don't await - fire and forget to avoid blocking
      this.publishPresenceToNostr().catch(() => {});
    }
  }

  private handleIncomingPresence(peer: PresenceBeaconPeer) {
    if (!this.myPresence) return;
    if (peer.pubkey === this.myPresence.pubkey) return;

    // TTL check
    const now = Date.now();
    if (peer.lastSeen + peer.ttl * 1000 < now) return;

    this.peers.set(peer.pubkey, peer);
    this.notifyListeners('peersUpdated', this.getPeers());
  }


  private async sendImmediatePresencePing(): Promise<void> {
    if (!this.myPresence || !this.isRunning) return;

    console.debug('📱 Sending immediate presence ping (realtime)');
    
    // Update presence with current data
    this.myPresence.lastSeen = Date.now();
    this.myPresence.role = this.currentRole;
    this.myPresence.caps = this.getDeviceCapabilities();
    
    // Add current geohash if available
    const geohash = this.getCurrentGeohash();
    if (geohash) {
      this.myPresence.geohash = geohash;
    }

    // Broadcast immediately via BroadcastChannel - with error handling
    if (this.channel && !this.isChannelClosed) {
      try {
        this.channel.postMessage({
          type: 'presence',
          peer: { ...this.myPresence }
        });
        console.debug('📱 Immediate presence ping successful (realtime)');
      } catch (error) {
        console.debug('⚠️ Failed to send immediate ping via BroadcastChannel:', error);
        this.isChannelClosed = true;
        this.channel = null;
      }
    }

    // Update local cache
    this.peers.set(this.myPresence.pubkey, this.myPresence);
    this.notifyListeners('peersUpdated', this.getPeers());
  }

  private generatePubkey(): string {
    // Generate a simple pubkey for demo purposes
    // In a real implementation, this would use proper cryptographic key generation
    return 'npub1' + Math.random().toString(36).substr(2, 58);
  }

  private cleanupExpiredPeers(): void {
    const now = Date.now();
    const expiredPeers: string[] = [];
    
    this.peers.forEach((peer, pubkey) => {
      // TTL-based peer visibility per spec
      if (peer.lastSeen + (peer.ttl * 1000) <= now) {
        expiredPeers.push(pubkey);
      }
    });

    expiredPeers.forEach(pubkey => {
      this.peers.delete(pubkey);
    });

    if (expiredPeers.length > 0) {
      console.debug(`🗼 Cleaned up ${expiredPeers.length} expired peers`);
      this.notifyListeners('peersUpdated', Array.from(this.peers.values()));
    }
  }

  // Room management
  async joinRoom(roomId: string): Promise<void> {
    if (!this.myPresence) return;

    if (!this.myPresence.rooms.includes(roomId)) {
      this.myPresence.rooms.push(roomId);
      await this.broadcastPresence();
      console.debug(`🗼 Joined room: ${roomId}`);
    }
  }

  async leaveRoom(roomId: string): Promise<void> {
    if (!this.myPresence) return;

    const index = this.myPresence.rooms.indexOf(roomId);
    if (index > -1) {
      this.myPresence.rooms.splice(index, 1);
      await this.broadcastPresence();
      console.debug(`🗼 Left room: ${roomId}`);
    }
  }

  // Public API methods
  getPeers(): PresenceBeaconPeer[] {
    return Array.from(this.peers.values());
  }

  getMyPresence(): PresenceBeaconPeer | null {
    return this.myPresence;
  }

  getCurrentRole(): NodeRole {
    return this.currentRole;
  }

  isConnected(): boolean {
    return this.isRunning;
  }

  subscribe(event: string, callback: (data: any) => void): () => void {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
    return () => {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    };
  }

  private notifyListeners(event: string, data: any): void {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(data));
    }
  }

}

export const presenceBeacon = new PresenceBeaconService();
