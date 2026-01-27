// Smart Router - Transport Priority System - Fixed v2025.01.27.19.05
// Automatically selects best transport based on conditions and peer capabilities

import { presenceBeacon, PresenceBeaconPeer } from './presenceBeacon';
import { nodeRoleService, NodeRole } from './nodeRoles';

export type TransportType = 'bluetooth' | 'wifi' | 'webrtc' | 'nostr' | 'broadcast';

export interface TransportCapability {
  type: TransportType;
  available: boolean;
  priority: number; // Lower number = higher priority
  conditions: string[];
  maxRange?: string;
  speed?: string;
  reliability?: number; // 0-1
}

export interface RoutingDecision {
  transport: TransportType;
  peer: PresenceBeaconPeer;
  confidence: number; // 0-1
  reasoning: string;
  fallbackOptions: TransportType[];
}

export interface ConnectionContext {
  isLocal: boolean;
  sameNetwork: boolean;
  bluetoothAvailable: boolean;
  webrtcPossible: boolean;
  nostrAvailable: boolean;
  networkQuality: 'excellent' | 'good' | 'fair' | 'poor';
  deviceType: 'mobile' | 'desktop';
}

class SmartRouter {
  private transports: Map<TransportType, TransportCapability> = new Map();
  private connectionContext: ConnectionContext;
  private routingHistory: Map<string, RoutingDecision[]> = new Map();

  constructor() {
    this.connectionContext = this.assessConnectionContext();
    this.initializeTransports();
    this.setupConnectionMonitoring();
  }

  private initializeTransports(): void {
    // Bluetooth - Highest priority for local mobile
    this.transports.set('bluetooth', {
      type: 'bluetooth',
      available: this.isBluetoothAvailable(),
      priority: 1,
      conditions: ['isLocal', 'bluetoothAvailable', 'nearbyAndroid'],
      maxRange: '~10m',
      speed: '2 Mbps',
      reliability: 0.8
    });

    // WiFi P2P - High priority for same network
    this.transports.set('wifi', {
      type: 'wifi',
      available: this.isWifiP2PAvailable(),
      priority: 2,
      conditions: ['sameNetwork', 'wifiEnabled'],
      maxRange: '~200m',
      speed: '250 Mbps',
      reliability: 0.9
    });

    // WebRTC - Medium priority for NAT traversal
    this.transports.set('webrtc', {
      type: 'webrtc',
      available: this.isWebRTCAvailable(),
      priority: 3,
      conditions: ['webrtcPossible', 'internetConnection'],
      maxRange: 'Global',
      speed: '10-100 Mbps',
      reliability: 0.7
    });

    // Nostr - Lower priority for global fallback
    this.transports.set('nostr', {
      type: 'nostr',
      available: this.isNostrAvailable(),
      priority: 4,
      conditions: ['nostrAvailable', 'internetConnection'],
      maxRange: 'Global',
      speed: '1-10 Mbps',
      reliability: 0.6
    });

    // Broadcast - Emergency fallback
    this.transports.set('broadcast', {
      type: 'broadcast',
      available: this.isBroadcastAvailable(),
      priority: 5,
      conditions: ['sameOrigin', 'browserSupport'],
      maxRange: 'Same browser',
      speed: 'Fast',
      reliability: 0.5
    });
  }

  private assessConnectionContext(): ConnectionContext {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    // Assess network quality
    let networkQuality: ConnectionContext['networkQuality'] = 'fair';
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      if (connection) {
        const effectiveType = connection.effectiveType;
        if (effectiveType === '4g') networkQuality = 'excellent';
        else if (effectiveType === '3g') networkQuality = 'good';
        else if (effectiveType === '2g') networkQuality = 'poor';
      }
    }

    return {
      isLocal: this.detectLocalNetwork(),
      sameNetwork: this.detectSameNetwork(networkQuality),
      bluetoothAvailable: this.isBluetoothAvailable(),
      webrtcPossible: this.isWebRTCAvailable(),
      nostrAvailable: this.isNostrAvailable(),
      networkQuality,
      deviceType: isMobile ? 'mobile' : 'desktop'
    };
  }

  private detectLocalNetwork(): boolean {
    // Heuristic: if we're on WiFi and have local IP ranges
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      if (connection?.type === 'wifi') return true;
    }
    return false;
  }

  private detectSameNetwork(networkQuality: ConnectionContext['networkQuality']): boolean {
    // Enhanced detection for same network
    return this.detectLocalNetwork() && networkQuality !== 'poor';
  }

  private isBluetoothAvailable(): boolean {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    return 'bluetooth' in navigator && isMobile;
  }

  private isWifiP2PAvailable(): boolean {
    // Desktop WiFi detection - Updated to fix initialization
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (!isMobile && 'connection' in navigator) {
      const connection = (navigator as any).connection;
      return connection?.type === 'wifi';
    }
    return false;
  }

  private isWebRTCAvailable(): boolean {
    return 'RTCPeerConnection' in window && 'RTCDataChannel' in window;
  }

  private isNostrAvailable(): boolean {
    return !!(window as any).nostr || !!(window as any).webln;
  }

  private isBroadcastAvailable(): boolean {
    return 'BroadcastChannel' in window;
  }

  private setupConnectionMonitoring(): void {
    // Monitor connection changes
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      if (connection) {
        connection.addEventListener('change', () => {
          this.connectionContext = this.assessConnectionContext();
          this.updateTransportAvailability();
        });
      }
    }

    // Monitor device capabilities
    if (this.isBluetoothAvailable()) {
      (navigator as any).bluetooth.addEventListener('availabilitychanged', () => {
        this.updateTransportAvailability();
      });
    }
  }

  private updateTransportAvailability(): void {
    // Update Bluetooth
    const bluetooth = this.transports.get('bluetooth');
    if (bluetooth) {
      bluetooth.available = this.isBluetoothAvailable();
    }

    // Update WiFi
    const wifi = this.transports.get('wifi');
    if (wifi) {
      wifi.available = this.isWifiP2PAvailable();
    }

    // Update WebRTC
    const webrtc = this.transports.get('webrtc');
    if (webrtc) {
      webrtc.available = this.isWebRTCAvailable();
    }

    // Update Nostr
    const nostr = this.transports.get('nostr');
    if (nostr) {
      nostr.available = this.isNostrAvailable();
    }
  }

  // Main routing decision method
  async selectBestTransport(peer: PresenceBeaconPeer): Promise<RoutingDecision> {
    const availableTransports = this.getCompatibleTransports(peer);
    
    if (availableTransports.length === 0) {
      throw new Error('No compatible transports available for peer');
    }

    // Sort by priority (lower number = higher priority)
    availableTransports.sort((a, b) => a.priority - b.priority);

    const selected = availableTransports[0];
    const confidence = this.calculateConfidence(selected, peer);
    const fallbackOptions = availableTransports.slice(1).map(t => t.type);

    const decision: RoutingDecision = {
      transport: selected.type,
      peer,
      confidence,
      reasoning: this.generateReasoning(selected, peer),
      fallbackOptions
    };

    // Store in history
    this.recordRoutingDecision(peer.pubkey, decision);

    return decision;
  }

  private getCompatibleTransports(peer: PresenceBeaconPeer): TransportCapability[] {
    const compatible: TransportCapability[] = [];

    for (const transport of this.transports.values()) {
      if (!transport.available) continue;

      // Check peer capabilities
      if (!peer.caps.includes(transport.type as any)) continue;

      // Check conditions
      if (this.meetsConditions(transport.conditions)) {
        compatible.push(transport);
      }
    }

    return compatible;
  }

  private meetsConditions(conditions: string[]): boolean {
    return conditions.every(condition => {
      switch (condition) {
        case 'isLocal':
          return this.connectionContext.isLocal;
        case 'sameNetwork':
          return this.connectionContext.sameNetwork;
        case 'bluetoothAvailable':
          return this.connectionContext.bluetoothAvailable;
        case 'nearbyAndroid':
          return this.connectionContext.bluetoothAvailable && this.connectionContext.deviceType === 'mobile';
        case 'wifiEnabled':
          return this.connectionContext.sameNetwork;
        case 'webrtcPossible':
          return this.connectionContext.webrtcPossible;
        case 'nostrAvailable':
          return this.connectionContext.nostrAvailable;
        case 'internetConnection':
          return this.connectionContext.networkQuality !== 'poor';
        case 'sameOrigin':
          return true; // Always true for same origin
        case 'browserSupport':
          return this.isBroadcastAvailable();
        default:
          return false;
      }
    });
  }

  private calculateConfidence(transport: TransportCapability, peer: PresenceBeaconPeer): number {
    let confidence = transport.reliability || 0.5;

    // Boost confidence based on conditions
    if (transport.type === 'bluetooth' && this.connectionContext.isLocal) {
      confidence += 0.2;
    }
    if (transport.type === 'wifi' && this.connectionContext.sameNetwork) {
      confidence += 0.15;
    }
    if (transport.type === 'webrtc' && this.connectionContext.networkQuality === 'excellent') {
      confidence += 0.1;
    }

    // Consider peer role (anchors are more reliable)
    if (peer.role === 'anchor') {
      confidence += 0.1;
    }

    // Consider device compatibility
    if (peer.device === this.connectionContext.deviceType) {
      confidence += 0.05;
    }

    return Math.min(confidence, 1.0);
  }

  private generateReasoning(transport: TransportCapability, peer: PresenceBeaconPeer): string {
    const reasons: string[] = [];

    switch (transport.type) {
      case 'bluetooth':
        reasons.push('Nearby Android device detected');
        reasons.push('Direct Bluetooth connection available');
        break;
      case 'wifi':
        reasons.push('Same WiFi network detected');
        reasons.push('High-speed WiFi P2P available');
        break;
      case 'webrtc':
        reasons.push('WebRTC capable peer');
        reasons.push(`Network quality: ${this.connectionContext.networkQuality}`);
        break;
      case 'nostr':
        reasons.push('Global fallback via Nostr network');
        reasons.push('Peer supports Nostr protocol');
        break;
      case 'broadcast':
        reasons.push('Same browser broadcast channel');
        reasons.push('Emergency local communication');
        break;
    }

    if (peer.role === 'anchor') {
      reasons.push('Anchor node - high reliability');
    }

    return reasons.join('; ');
  }

  private recordRoutingDecision(peerPubkey: string, decision: RoutingDecision): void {
    if (!this.routingHistory.has(peerPubkey)) {
      this.routingHistory.set(peerPubkey, []);
    }

    const history = this.routingHistory.get(peerPubkey)!;
    history.push(decision);

    // Keep only last 10 decisions
    if (history.length > 10) {
      history.shift();
    }
  }

  // Smart routing rules implementation
  async routeToPeer(peer: PresenceBeaconPeer): Promise<RoutingDecision> {
    // Apply smart routing rules from spec
    if (this.connectionContext.isLocal && this.connectionContext.bluetoothAvailable && 
        peer.caps.includes('bluetooth')) {
      console.log('🔵 Smart Router: Choosing Bluetooth for local Android');
      return await this.selectTransport('bluetooth', peer);
    }

    if (this.connectionContext.sameNetwork && peer.caps.includes('wifi')) {
      console.log('📡 Smart Router: Choosing WiFi P2P for same network');
      return await this.selectTransport('wifi', peer);
    }

    if (this.connectionContext.webrtcPossible && peer.caps.includes('webrtc')) {
      console.log('🌐 Smart Router: Choosing WebRTC for NAT traversal');
      return await this.selectTransport('webrtc', peer);
    }

    if (this.connectionContext.nostrAvailable && peer.caps.includes('nostr')) {
      console.log('🕊️ Smart Router: Choosing Nostr for global fallback');
      return await this.selectTransport('nostr', peer);
    }

    // Emergency broadcast fallback
    if (peer.caps.includes('broadcast')) {
      console.log('📢 Smart Router: Choosing Broadcast as emergency fallback');
      return await this.selectTransport('broadcast', peer);
    }

    throw new Error(`No compatible transport found for peer ${peer.pubkey}`);
  }

  private async selectTransport(type: TransportType, peer: PresenceBeaconPeer): Promise<RoutingDecision> {
    const transport = this.transports.get(type);
    if (!transport || !transport.available) {
      throw new Error(`Transport ${type} not available`);
    }

    const confidence = this.calculateConfidence(transport, peer);
    const fallbackOptions = this.getCompatibleTransports(peer)
      .filter(t => t.type !== type)
      .map(t => t.type);

    return {
      transport: type,
      peer,
      confidence,
      reasoning: this.generateReasoning(transport, peer),
      fallbackOptions
    };
  }

  // Public API methods
  getAvailableTransports(): TransportCapability[] {
    return Array.from(this.transports.values()).filter(t => t.available);
  }

  getConnectionContext(): ConnectionContext {
    return { ...this.connectionContext };
  }

  getRoutingHistory(peerPubkey?: string): Map<string, RoutingDecision[]> | RoutingDecision[] {
    if (peerPubkey) {
      return this.routingHistory.get(peerPubkey) || [];
    }
    return new Map(this.routingHistory);
  }

  // Utility methods for UI
  getTransportIcon(type: TransportType): string {
    const icons = {
      bluetooth: '🔵',
      wifi: '📡',
      webrtc: '🌐',
      nostr: '🕊️',
      broadcast: '📢'
    };
    return icons[type] || '❓';
  }

  getTransportDescription(type: TransportType): string {
    const descriptions = {
      bluetooth: 'Bluetooth (Direct, ~10m range)',
      wifi: 'WiFi P2P (Same network, ~200m range)',
      webrtc: 'WebRTC (Global, peer-to-peer)',
      nostr: 'Nostr (Global, relay network)',
      broadcast: 'Broadcast (Same browser only)'
    };
    return descriptions[type] || 'Unknown transport';
  }

  // Performance monitoring
  recordTransportSuccess(transport: TransportType, peerPubkey: string, latency: number): void {
    const transportCap = this.transports.get(transport);
    if (transportCap) {
      // Update reliability based on actual performance
      const successRate = latency < 1000 ? 0.1 : -0.05; // Boost for fast, penalize for slow
      transportCap.reliability = Math.max(0.1, Math.min(1.0, (transportCap.reliability || 0.5) + successRate));
    }
  }

  recordTransportFailure(transport: TransportType, peerPubkey: string): void {
    const transportCap = this.transports.get(transport);
    if (transportCap) {
      // Reduce reliability on failure
      transportCap.reliability = Math.max(0.1, (transportCap.reliability || 0.5) - 0.1);
    }
  }

  // Cleanup
  destroy(): void {
    this.routingHistory.clear();
    this.transports.clear();
  }
}

// Export singleton instance - Fixed v2025.01.27.19.05
export const smartRouter = new SmartRouter();
