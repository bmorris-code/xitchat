// Real-time Radar Service for XitChat - Mobile Mesh Edition
// TTL-based peer visibility with presence beacon integration

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
  location?: { lat: number; lng: number; geohash: string };
  capabilities: string[];
  lastSeen: number;
  ttl: number;
  isOnline: boolean;
  device: 'mobile' | 'desktop' | 'server';
  role: 'edge' | 'anchor';
  signalStrength?: number;
  connectionType: 'webrtc' | 'websocket' | 'hybrid' | 'nostr' | 'bluetooth' | 'wifi' | 'broadcast';
  distance?: number;
  transportPriority?: string[];
  confidence?: number;
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

  private myCurrentLocation: { lat: number; lng: number; geohash: string } | null = null;
  private myId: string = '';
  private myName: string = 'Anonymous';
  private myHandle: string = '@anon';

  // ── FIX #4 & #5: store unsub functions so destroy() can clean them up ──
  private lifecycleUnsubs: Array<() => void> = [];
  private serviceUnsubs: Array<() => void> = [];

  constructor() {
    this.myId = this.generatePeerId();
    this.loadUserInfo();
    this.setupPresenceIntegration();
    this.setupLifecycleIntegration();
    this.myCurrentLocation = null;
    this.startTtlCleanup();
  }

  // ── FIX #6: implement handleMeshLocationUpdate instead of leaving it as `any` ──
  handleMeshLocationUpdate = (data: any): void => {
    if (!data?.pubkey) return;
    const existing = this.peers.get(data.pubkey);
    if (existing && data.geohash) {
      existing.location = { lat: data.lat || 0, lng: data.lng || 0, geohash: data.geohash };
      existing.lastSeen = Date.now();
      this.peers.set(data.pubkey, existing);
      this.updateGeohashZones();
      this.notifyListeners('peersUpdated', Array.from(this.peers.values()));
    }
  };

  private generatePeerId(): string {
    return 'npub1' + Math.random().toString(36).substr(2, 58);
  }

  private setupPresenceIntegration(): void {
    // ── FIX #5: store unsub so we can clean up in destroy() ──
    this.serviceUnsubs.push(
      presenceBeacon.subscribe('peersUpdated', (peers: PresenceBeaconPeer[]) => {
        this.handlePresencePeersUpdate(peers);
      })
    );

    // ── FIX #1: subscribe to presenceEvent ONCE here only ──
    // (removed the duplicate subscription that was also in setupDiscovery)
    this.serviceUnsubs.push(
      nostrService.subscribe('presenceEvent', (presenceData) => {
        this.handleNostrPresenceEvent(presenceData);
      })
    );
  }

  private setupLifecycleIntegration(): void {
    // ── FIX #4: store unsub functions ──
    this.lifecycleUnsubs.push(
      mobileLifecycle.on('state_change', (event: any) => this.handleLifecycleEvent(event))
    );
    this.lifecycleUnsubs.push(
      mobileLifecycle.on('network_change', (event: any) => this.handleNetworkChange(event))
    );
  }

  private handleNostrPresenceEvent(presenceData: any): void {

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
      isOnline: true,
      connectionType: 'nostr',
      signalStrength: presenceData.signalStrength,
      location: presenceData.geohash
        ? { lat: 0, lng: 0, geohash: presenceData.geohash }
        : undefined
    };

    this.peers.set(presenceData.pubkey, radarPeer);
    this.updateGeohashZones();
    // ── FIX #2: always send full peer map ──
    this.notifyListeners('peersUpdated', Array.from(this.peers.values()));
  }

  private handlePresencePeersUpdate(presencePeers: PresenceBeaconPeer[]): void {
    const now = Date.now();
    const myPubkey = presenceBeacon.getMyPresence()?.pubkey;

    presencePeers.forEach(presencePeer => {
      if (myPubkey && presencePeer.pubkey === myPubkey) return;

      const isVisible = now - presencePeer.lastSeen < presencePeer.ttl * 1000;
      if (!isVisible) {
        this.peers.delete(presencePeer.pubkey);
        return;
      }

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
        isOnline: true,
        connectionType: this.inferConnectionType(presencePeer.caps),
        signalStrength: presencePeer.signalStrength,
        location: presencePeer.geohash
          ? { lat: 0, lng: 0, geohash: presencePeer.geohash }
          : undefined
      };

      // ── FIX #3: calculateRoutingInfo re-notifies after async resolution ──
      this.calculateRoutingInfo(radarPeer, presencePeer);
      this.peers.set(presencePeer.pubkey, radarPeer);
    });

    this.updateGeohashZones();
    // ── FIX #2: send full peer map, not just updatedPeers ──
    this.notifyListeners('peersUpdated', Array.from(this.peers.values()));
  }

  private calculateRoutingInfo(radarPeer: RadarPeer, presencePeer: PresenceBeaconPeer): void {
    try {
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
          // ── FIX #3: re-notify now that routing info is resolved ──
          this.notifyListeners('peersUpdated', Array.from(this.peers.values()));
        })
        .catch(() => {
          // Fallback to basic inference — no notification needed, already sent
        });
    } catch {}
  }

  private inferConnectionType(caps: string[]): RadarPeer['connectionType'] {
    if (caps.includes('bluetooth')) return 'bluetooth';
    if (caps.includes('wifi')) return 'wifi';
    if (caps.includes('webrtc')) return 'webrtc';
    if (caps.includes('nostr')) return 'nostr';
    if (caps.includes('broadcast')) return 'broadcast';
    return 'websocket';
  }

  private extractNameFromPubkey(pubkey: string): string {
    return `User ${pubkey.substring(0, 8)}...`;
  }

  private extractHandleFromPubkey(pubkey: string): string {
    return `@${pubkey.substring(0, 6)}`;
  }

  
  private handleLifecycleEvent(event: any): void {
    switch (event.data?.action) {
      case 'resume_mesh': this.resumeRadarOperations(); break;
      case 'pause_mesh': this.pauseRadarOperations(); break;
      case 'cleanup_all': this.cleanupAllPeers(); break;
      case 'update_presence': this.triggerPresenceUpdate(); break;
    }
  }

  private handleNetworkChange(event: any): void {
    if (event.state === 'offline') this.enableOfflineMode();
    else if (event.state === 'online') this.resumeOnlineOperations();
  }

  private startTtlCleanup(): void {
    this.cleanupInterval = setInterval(() => this.cleanupExpiredPeers(), 10000);
  }

  private cleanupExpiredPeers(): void {
    const now = Date.now();
    const expiredPeers: string[] = [];

    this.peers.forEach((peer, pubkey) => {
      if (peer.lastSeen + peer.ttl * 1000 <= now) expiredPeers.push(pubkey);
    });

    expiredPeers.forEach(pubkey => this.peers.delete(pubkey));

    if (expiredPeers.length > 0) {
      this.updateGeohashZones();
      this.notifyListeners('peersUpdated', Array.from(this.peers.values()));
    }
  }

  private updateGeohashZones(): void {
    const zones = new Map<string, RadarPeer[]>();

    this.peers.forEach(peer => {
      if (peer.location?.geohash) {
        const zoneId = peer.location.geohash.substring(0, 3);
        if (!zones.has(zoneId)) zones.set(zoneId, []);
        zones.get(zoneId)!.push(peer);
      }
    });

    zones.forEach((peers, zoneId) => {
      this.geohashZones.set(zoneId, {
        id: zoneId,
        name: `Zone ${zoneId}`,
        peerCount: peers.length,
        peers,
        signalStrength: peers.reduce((sum, p) => sum + (p.signalStrength || 0), 0) / peers.length
      });
    });

    this.geohashZones.forEach((zone, id) => {
      if (zone.peerCount === 0) this.geohashZones.delete(id);
    });
  }

  private resumeRadarOperations(): void {}
  private pauseRadarOperations(): void {}
  private triggerPresenceUpdate(): void {}
  private enableOfflineMode(): void {}
  private resumeOnlineOperations(): void {}

  private cleanupAllPeers(): void {
    this.peers.clear();
    this.updateGeohashZones();
    this.notifyListeners('peersUpdated', []);
  }

  private loadUserInfo(): void {
    const savedName = localStorage.getItem('xitchat_name');
    const savedHandle = localStorage.getItem('xitchat_handle');
    if (savedName) this.myName = savedName;
    if (savedHandle) this.myHandle = `@${savedHandle}`;
  }

  private encodeGeohash(lat: number, lng: number, precision: number): string {
    let geohash = '';
    let latMin = -90, latMax = 90;
    let lngMin = -180, lngMax = 180;

    for (let i = 0; i < precision; i++) {
      const latMid = (latMin + latMax) / 2;
      const lngMid = (lngMin + lngMax) / 2;
      geohash += lat >= latMid ? '1' : '0';
      if (lat >= latMid) latMin = latMid; else latMax = latMid;
      geohash += lng >= lngMid ? '1' : '0';
      if (lng >= lngMid) lngMin = lngMid; else lngMax = lngMid;
    }

    return geohash;
  }

  private addOrUpdatePeer(peerData: any, transport: RadarPeer['connectionType']) {
    const id = peerData.pubkey || peerData.id;
    if (!id) return;

    const radarPeer: RadarPeer = {
      id,
      pubkey: id,
      name: peerData.name || `User ${id.substring(0, 8)}`,
      handle: peerData.handle || `@${id.substring(0, 6)}`,
      device: peerData.device || 'mobile',
      role: peerData.role || 'edge',
      capabilities: peerData.caps || [],
      lastSeen: Date.now(),
      ttl: 60,
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
    // ── FIX #1: presenceEvent subscription removed from here — lives in setupPresenceIntegration() only ──
    // ── FIX #4: store unsub functions ──
    this.lifecycleUnsubs.push(
      mobileLifecycle.on('bluetooth_scan', (devices: any[]) => {
        devices.forEach(d => this.addOrUpdatePeer(d, 'bluetooth'));
      })
    );
    this.lifecycleUnsubs.push(
      mobileLifecycle.on('wifi_p2p_scan', (devices: any[]) => {
        devices.forEach(d => this.addOrUpdatePeer(d, 'wifi'));
      })
    );
  }

  // ── Public API ────────────────────────────────────────────────────────────

  async initialize(serverUrl?: string): Promise<boolean> {
    try {
      if (this.isInitialized) return true;

      await presenceBeacon.initialize();
      await presenceBeacon.start();
      this.setupDiscovery();

      const isNativeAndroid =
        (window as any).Capacitor?.isNativePlatform() &&
        (window as any).Capacitor?.getPlatform() === 'android';
      if (!isNativeAndroid) await this.testSignalingServerConnection();

      this.isInitialized = true;
      return true;
    } catch {
      return false;
    }
  }

  private async testSignalingServerConnection(): Promise<void> {
    if (window.location.protocol === 'https:') return;
  }

  getPeers(): RadarPeer[] { return Array.from(this.peers.values()); }
  getGeohashZones(): GeohashZone[] { return Array.from(this.geohashZones.values()); }
  getMyLocation() { return this.myCurrentLocation; }

  subscribe(event: string, callback: (data: any) => void): () => void {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
    return () => {
      const idx = this.listeners[event]?.indexOf(callback);
      if (idx > -1) this.listeners[event].splice(idx, 1);
    };
  }

  isRealModeEnabled(): boolean {
    return this.peers.size > 0 &&
      Array.from(this.peers.values()).some(p =>
        p.connectionType !== 'websocket' && p.connectionType !== 'broadcast'
      );
  }

  private notifyListeners(event: string, data: any): void {
    (this.listeners[event] || []).forEach(cb => cb(data));
  }

  // ── FIX #4 & #5: full cleanup in destroy() ───────────────────────────────
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Unsubscribe all lifecycle listeners
    this.lifecycleUnsubs.forEach(u => u());
    this.lifecycleUnsubs = [];

    // Unsubscribe all service listeners (presenceBeacon, nostrService)
    this.serviceUnsubs.forEach(u => u());
    this.serviceUnsubs = [];

    this.listeners = {};
    this.peers.clear();
    this.geohashZones.clear();
    this.isInitialized = false;
  }
}

export const realtimeRadar = new RealtimeRadarService();
