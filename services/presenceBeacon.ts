// Presence Beacon Service - Mobile Mesh Discovery Layer
// Short-lived, transport-agnostic, mobile-safe presence coordination

import { nodeRoleService, NodeRole } from './nodeRoles';
import { nostrService, NostrPresenceEvent } from './nostrService';

export interface PresenceBeaconPeer {
  pubkey: string;
  name?: string;
  handle?: string;
  device: 'mobile' | 'desktop' | 'server';
  role: 'edge' | 'anchor';
  caps: ('webrtc' | 'nostr' | 'bluetooth' | 'wifi' | 'broadcast')[];
  rooms: string[];
  lastSeen: number;
  ttl: number;
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

export interface PresenceBeaconConfig {
  ttl: number;
  heartbeatInterval: number;
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

  // ── FIX #3: store nostr unsub functions ──
  private nostrUnsubs: Array<() => void> = [];
  // ── FIX #5: store mobile event listener cleanup functions ──
  private mobileUnsubs: Array<() => void> = [];

  constructor() {
    const isMobile = this.detectMobile();

    this.config = {
      ttl: isMobile ? 30 : 45,
      heartbeatInterval: 15000,
      maxRetries: 3,
      isMobile,
    };

    this.baseHeartbeatInterval = this.config.heartbeatInterval;
    this.baseTtl = this.config.ttl;

    this.ensureBroadcastChannel();
    this.setupMobileOptimizations();
    this.setupNodeRoleIntegration();
    this.setupNostrIntegration();
  }

  private detectMobile(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  private ensureBroadcastChannel(): void {
    if (this.channel && !this.isChannelClosed) return;
    try {
      this.channel = new BroadcastChannel('xitchat-presence');
      this.channel.onmessage = (event) => {
        const data = event.data;
        if (data?.type === 'presence') this.handleIncomingPresence(data.peer);
      };
      this.isChannelClosed = false;
    } catch (error) {
      console.warn('⚠️ BroadcastChannel not available:', error);
      this.channel = null;
      this.isChannelClosed = true;
    }
  }

  private setupNostrIntegration(): void {
    this.isNostrAvailable = nostrService.isConnected();

    // ── FIX #3: store all nostr unsub functions ──
    this.nostrUnsubs.push(
      nostrService.subscribe('initialized', () => {
        this.isNostrAvailable = true;
      })
    );

    this.nostrUnsubs.push(
      nostrService.subscribe('disconnected', () => {
        this.isNostrAvailable = false;
      })
    );

    // ── FIX #1: presenceBeacon is the single source of truth for Nostr presence ──
    // realtimeRadar subscribes to presenceBeacon.peersUpdated, not nostrService directly.
    this.nostrUnsubs.push(
      nostrService.subscribe('presenceEvent', (presenceData) => {
        this.handleNostrPresenceEvent(presenceData);
      })
    );
  }

  private handleNostrPresenceEvent(presenceData: any): void {
    const presencePeer: PresenceBeaconPeer = {
      pubkey: presenceData.pubkey,
      name: presenceData.name,
      handle: presenceData.handle,
      device: presenceData.device,
      role: presenceData.role,
      caps: presenceData.caps,
      rooms: presenceData.rooms,
      lastSeen: presenceData.timestamp,
      ttl: presenceData.ttl,
      signalStrength: presenceData.signalStrength,
      geohash: presenceData.geohash,
      timestamp: presenceData.timestamp
    };

    this.peers.set(presencePeer.pubkey, presencePeer);
    this.notifyListeners('peersUpdated', this.getPeers());
  }

  private async publishPresenceToNostr(): Promise<void> {
    if (!this.isNostrAvailable || !this.myPresence || !this.isRunning) return;
    try {
      const nostrPresence: NostrPresenceEvent = {
        pubkey: this.myPresence.pubkey,
        name: this.myPresence.name,
        handle: this.myPresence.handle,
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
    this.currentRole = nodeRoleService.getCurrentRole();
    this.roleChangeUnsubscribe = nodeRoleService.onRoleChange((newRole) => {
      this.currentRole = newRole;
      if (this.isRunning && !this.isBackground) this.broadcastPresence();
    });
  }

  private setupMobileOptimizations(): void {
    // ── FIX #5: store all event listener unsubs ──

    const onVisibilityChange = () => {
      this.visibilityState = document.visibilityState as any;
      this.isBackground = this.visibilityState !== 'visible';
      if (this.isBackground && this.config.isMobile) {
        this.adjustForBackground();
      } else if (!this.isBackground) {
        this.sendImmediatePresencePing();
        this.adjustForForeground();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    this.mobileUnsubs.push(() => document.removeEventListener('visibilitychange', onVisibilityChange));

    const onFocus = () => {
      if (!this.isBackground) this.sendImmediatePresencePing();
    };
    window.addEventListener('focus', onFocus);
    this.mobileUnsubs.push(() => window.removeEventListener('focus', onFocus));

    const onBlur = () => {};
    window.addEventListener('blur', onBlur);
    this.mobileUnsubs.push(() => window.removeEventListener('blur', onBlur));

    const onPageHide = () => {};
    window.addEventListener('pagehide', onPageHide);
    this.mobileUnsubs.push(() => window.removeEventListener('pagehide', onPageHide));

    const onPageShow = (event: PageTransitionEvent) => {
      if (this.config.isMobile && !event.persisted) this.sendImmediatePresencePing();
    };
    window.addEventListener('pageshow', onPageShow);
    this.mobileUnsubs.push(() => window.removeEventListener('pageshow', onPageShow as any));

    const onBeforeUnload = () => {};
    window.addEventListener('beforeunload', onBeforeUnload);
    this.mobileUnsubs.push(() => window.removeEventListener('beforeunload', onBeforeUnload));

    // { once: true } — self-cleaning, no unsub needed
    document.addEventListener('touchstart', () => this.sendImmediatePresencePing(), { once: true });

    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        const onLevelChange = () => {
          if (battery.level < 0.2) this.config.ttl = 25;
        };
        battery.addEventListener('levelchange', onLevelChange);
        // Note: battery API doesn't support removeEventListener cleanup easily;
        // impact is minimal as it's a singleton
      });
    }

    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      if (connection) {
        const onConnectionChange = () => {
          if (connection.saveData || connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
            this.config.ttl = 25;
          }
        };
        connection.addEventListener('change', onConnectionChange);
        this.mobileUnsubs.push(() => connection.removeEventListener('change', onConnectionChange));
      }
    }
  }

  private adjustForBackground() {
    if (this.config.isMobile) this.config.ttl = 20;
  }

  private adjustForForeground() {
    this.config.heartbeatInterval = this.baseHeartbeatInterval;
    this.config.ttl = this.baseTtl;
  }

  async initialize(userInfo?: { name?: string; handle?: string }): Promise<boolean> {
    try {
      if (this.isInitialized) return true;

      const name = userInfo?.name || localStorage.getItem('xitchat_name') || 'Anonymous';
      const handle = userInfo?.handle || localStorage.getItem('xitchat_handle') || 'anon';
      const pubkey = (nostrService as any).getPublicKey() ||
        localStorage.getItem('xitchat_pubkey') ||
        this.generatePubkey();

      this.myPresence = {
        pubkey,
        name,
        handle: handle.startsWith('@') ? handle : `@${handle}`,
        device: this.config.isMobile ? 'mobile' : 'desktop',
        role: this.currentRole,
        caps: this.getDeviceCapabilities(),
        rooms: ['global', 'local'],
        lastSeen: Date.now(),
        ttl: this.config.ttl,
        timestamp: Date.now()
      };

      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Presence Beacon:', error);
      return false;
    }
  }

  updateIdentity(info: { name?: string; handle?: string }): void {
    if (!this.myPresence) return;
    if (info.name) this.myPresence.name = info.name;
    if (info.handle) this.myPresence.handle = info.handle.startsWith('@') ? info.handle : `@${info.handle}`;
    if (this.isRunning && !this.isBackground) this.broadcastPresence();
  }

  private getDeviceCapabilities(): ('webrtc' | 'nostr' | 'bluetooth' | 'wifi' | 'broadcast')[] {
    const caps: ('webrtc' | 'nostr' | 'bluetooth' | 'wifi' | 'broadcast')[] = [];
    const isNativeAndroid = (window as any).Capacitor?.isNativePlatform?.() &&
      (window as any).Capacitor?.getPlatform?.() === 'android';

    if ('RTCPeerConnection' in window) caps.push('webrtc');
    if (nostrService.isConnected()) caps.push('nostr');

    if (isNativeAndroid) {
      caps.push('bluetooth');
      caps.push('wifi');
    } else if (this.config.isMobile && 'bluetooth' in navigator) {
      caps.push('bluetooth');
    }

    if (!isNativeAndroid && !this.config.isMobile && 'connection' in navigator) {
      const connection = (navigator as any).connection;
      if (connection?.type === 'wifi') caps.push('wifi');
    }

    if ('BroadcastChannel' in window) caps.push('broadcast');
    return caps.length > 0 ? caps : ['webrtc'];
  }

  async start(): Promise<void> {
    if (!this.isInitialized || !this.myPresence) {
      throw new Error('Presence Beacon must be initialized before starting');
    }
    if (this.isRunning) return;

    this.isRunning = true;
    this.retryCount = 0;
    this.ensureBroadcastChannel();
    this.startGeohashUpdates();
    this.heartbeatLoop();

    // ── FIX #2: Nostr published on 60s timer ONLY — not also inside broadcastPresence ──
    if (this.nostrPublishTimer) clearInterval(this.nostrPublishTimer);
    if (this.isNostrAvailable) {
      this.nostrPublishTimer = setInterval(() => this.publishPresenceToNostr(), 60000);
    }

    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    this.cleanupTimer = setInterval(() => this.cleanupExpiredPeers(), 5000);

    await this.broadcastPresence();

    // One initial Nostr publish only
    if (this.isNostrAvailable) await this.publishPresenceToNostr();
  }

  async stop(): Promise<void> {
    this.isRunning = false;

    if (this.heartbeatTimer) { clearTimeout(this.heartbeatTimer); this.heartbeatTimer = null; }
    if (this.geohashUpdateTimer) { clearInterval(this.geohashUpdateTimer); this.geohashUpdateTimer = null; }
    if (this.nostrPublishTimer) { clearInterval(this.nostrPublishTimer); this.nostrPublishTimer = null; }
    if (this.cleanupTimer) { clearInterval(this.cleanupTimer); this.cleanupTimer = null; }

    // ── FIX #4: unsubscribe role change listener ──
    if (this.roleChangeUnsubscribe) {
      this.roleChangeUnsubscribe();
      this.roleChangeUnsubscribe = null;
    }

    // ── FIX #3: unsubscribe all nostr listeners ──
    this.nostrUnsubs.forEach(u => u());
    this.nostrUnsubs = [];

    // ── FIX #5: remove all mobile event listeners ──
    this.mobileUnsubs.forEach(u => u());
    this.mobileUnsubs = [];

    if (this.channel && !this.isChannelClosed) {
      try { this.channel.close(); } catch {}
      this.channel = null;
      this.isChannelClosed = true;
    }
  }

  private async heartbeatLoop(): Promise<void> {
    if (!this.isRunning) return;
    if (!this.isBackground) await this.broadcastPresence();
    this.heartbeatTimer = setTimeout(() => this.heartbeatLoop(), this.config.heartbeatInterval);
  }

  private startGeohashUpdates(): void {
    this.geohashUpdateTimer = setInterval(async () => {
      if (this.isRunning && !this.isBackground) await this.updateGeohash();
    }, 180000);
    this.updateGeohash();
  }

  private async updateGeohash(): Promise<void> {
    try {
      const radarLocation = (window as any).realtimeRadar?.myCurrentLocation;
      if (radarLocation?.geohash) { this.currentGeohash = radarLocation.geohash; return; }

      if (navigator.geolocation) {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000, maximumAge: 300000 });
        });
        this.currentGeohash = this.coordsToGeohash(position.coords.latitude, position.coords.longitude);
      }
    } catch {
      if (!this.currentGeohash) this.currentGeohash = '428F';
    }
  }

  private coordsToGeohash(lat: number, lng: number): string {
    let geohash = '';
    let latMin = -90, latMax = 90, lngMin = -180, lngMax = 180;
    for (let i = 0; i < 3; i++) {
      const latMid = (latMin + latMax) / 2;
      const lngMid = (lngMin + lngMax) / 2;
      geohash += lat >= latMid ? '1' : '0';
      if (lat >= latMid) latMin = latMid; else latMax = latMid;
      geohash += lng >= lngMid ? '1' : '0';
      if (lng >= lngMid) lngMin = lngMid; else lngMax = lngMid;
    }
    return geohash;
  }

  private async broadcastPresence(): Promise<void> {
    if (!this.myPresence) return;

    this.myPresence.lastSeen = Date.now();
    this.myPresence.timestamp = Date.now();
    this.myPresence.role = this.currentRole;
    this.myPresence.caps = this.getDeviceCapabilities();
    this.myPresence.ttl = this.config.ttl;

    const geohash = this.currentGeohash;
    if (geohash) this.myPresence.geohash = geohash;

    if (this.channel && !this.isChannelClosed) {
      try {
        this.channel.postMessage({ type: 'presence', peer: { ...this.myPresence } });
      } catch {
        this.isChannelClosed = true;
        this.channel = null;
      }
    }

    this.peers.set(this.myPresence.pubkey, this.myPresence);
    this.notifyListeners('peersUpdated', this.getPeers());

    // ── FIX #2: removed publishPresenceToNostr() from here — 60s timer handles it ──
  }

  private handleIncomingPresence(peer: PresenceBeaconPeer) {
    if (!this.myPresence || peer.pubkey === this.myPresence.pubkey) return;
    const now = Date.now();
    if (peer.lastSeen + peer.ttl * 1000 < now) return;
    this.peers.set(peer.pubkey, peer);
    this.notifyListeners('peersUpdated', this.getPeers());
  }

  private async sendImmediatePresencePing(): Promise<void> {
    if (!this.myPresence || !this.isRunning) return;

    this.myPresence.lastSeen = Date.now();
    this.myPresence.role = this.currentRole;
    this.myPresence.caps = this.getDeviceCapabilities();
    const geohash = this.currentGeohash;
    if (geohash) this.myPresence.geohash = geohash;

    if (this.channel && !this.isChannelClosed) {
      try {
        this.channel.postMessage({ type: 'presence', peer: { ...this.myPresence } });
      } catch {
        this.isChannelClosed = true;
        this.channel = null;
      }
    }

    this.peers.set(this.myPresence.pubkey, this.myPresence);
    this.notifyListeners('peersUpdated', this.getPeers());
  }

  private generatePubkey(): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    localStorage.setItem('xitchat_pubkey', hex);
    return hex;
  }

  private cleanupExpiredPeers(): void {
    const now = Date.now();
    const expired: string[] = [];
    this.peers.forEach((peer, pubkey) => {
      if (peer.lastSeen + peer.ttl * 1000 <= now) expired.push(pubkey);
    });
    expired.forEach(pubkey => this.peers.delete(pubkey));
    if (expired.length > 0) {
      this.notifyListeners('peersUpdated', Array.from(this.peers.values()));
    }
  }

  async joinRoom(roomId: string): Promise<void> {
    if (!this.myPresence || this.myPresence.rooms.includes(roomId)) return;
    this.myPresence.rooms.push(roomId);
    await this.broadcastPresence();
  }

  async leaveRoom(roomId: string): Promise<void> {
    if (!this.myPresence) return;
    const idx = this.myPresence.rooms.indexOf(roomId);
    if (idx > -1) {
      this.myPresence.rooms.splice(idx, 1);
      await this.broadcastPresence();
    }
  }

  getPeers(): PresenceBeaconPeer[] { return Array.from(this.peers.values()); }
  getMyPresence(): PresenceBeaconPeer | null { return this.myPresence; }
  getCurrentRole(): NodeRole { return this.currentRole; }
  isConnected(): boolean { return this.isRunning; }

  addExternalPeer(peer: PresenceBeaconPeer): void {
    if (!peer.pubkey || !peer.lastSeen || !peer.ttl) return;
    const now = Date.now();
    if (peer.lastSeen + peer.ttl * 1000 < now) return;
    this.peers.set(peer.pubkey, peer);
    this.notifyListeners('peersUpdated', this.getPeers());
    // ── FIX #6: downgraded to debug to avoid flooding on every mesh tick ──
    console.debug(`🗼 External peer added: ${peer.pubkey.substring(0, 8)}... via ${peer.caps.join(',')}`);
  }

  subscribe(event: string, callback: (data: any) => void): () => void {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
    return () => { this.listeners[event] = this.listeners[event].filter(cb => cb !== callback); };
  }

  private notifyListeners(event: string, data: any): void {
    (this.listeners[event] || []).forEach(cb => cb(data));
  }
}

export const presenceBeacon = new PresenceBeaconService();
