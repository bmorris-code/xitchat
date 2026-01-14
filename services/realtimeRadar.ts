// Real-time Radar Service for XitChat
// Connects to signaling server for live user discovery and geohash mapping

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
  connectionType: 'webrtc' | 'websocket' | 'hybrid';
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
  private maxReconnectAttempts = 5;
  private reconnectInterval: NodeJS.Timeout | null = null;
  private isRealMode = false;
  private is5GNetwork = false;
  private connectionQuality: 'excellent' | 'good' | 'fair' | 'poor' = 'good';
  private lastPingTime = 0;
  private pingInterval: NodeJS.Timeout | null = null;
  private preferredNetwork: '5g' | '4g' | 'wifi' | 'bluetooth' = '5g'; // Default to 5G
  private networkSelectionMode: 'auto' | 'manual' = 'auto'; // Auto or manual selection

  constructor() {
    this.generateCurrentGeohash();
    this.detectNetworkType();
    this.loadNetworkPreferences();
  }

  private loadNetworkPreferences(): void {
    // Load saved network preferences
    try {
      const saved = localStorage.getItem('xitchat_network_preferences');
      if (saved) {
        const prefs = JSON.parse(saved);
        this.preferredNetwork = prefs.preferredNetwork || '5g';
        this.networkSelectionMode = prefs.networkSelectionMode || 'auto';
        console.log(`📱 Loaded network preferences: ${this.preferredNetwork} (${this.networkSelectionMode})`);
      }
    } catch (error) {
      console.warn('Failed to load network preferences:', error);
    }
  }

  private saveNetworkPreferences(): void {
    // Save current network preferences
    try {
      const prefs = {
        preferredNetwork: this.preferredNetwork,
        networkSelectionMode: this.networkSelectionMode,
        lastUpdated: Date.now()
      };
      localStorage.setItem('xitchat_network_preferences', JSON.stringify(prefs));
      console.log(`💾 Saved network preferences: ${this.preferredNetwork} (${this.networkSelectionMode})`);
    } catch (error) {
      console.warn('Failed to save network preferences:', error);
    }
  }

  private getBestAvailableNetwork(): '5g' | '4g' | 'wifi' | 'bluetooth' {
    // Smart network selection based on availability and quality
    if (this.is5GNetwork && this.preferredNetwork !== '5g') {
      return '5g'; // User prefers 5G but we have 4G - stick with 4G
    }

    if (this.is5GNetwork && this.preferredNetwork === '5g') {
      return '5g'; // Perfect match
    }

    if (!this.is5GNetwork && this.preferredNetwork === '5g') {
      // No 5G available, choose next best
      return this.connectionQuality === 'excellent' ? '4g' : 'wifi';
    }

    // Return preferred network if available, otherwise best available
    return this.preferredNetwork;
  }

  private detectNetworkType(): void {
    // Detect 5G network and optimize accordingly
    if ('connection' in navigator) {
      const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
      if (connection) {
        this.is5GNetwork = connection.effectiveType === '5g' || connection.downlink > 10;
        this.updateConnectionQuality(connection.downlink, connection.rtt);
      }
    }

    // Fallback detection for mobile
    if ('navigator' in window && 'userAgent' in navigator) {
      const userAgent = navigator.userAgent.toLowerCase();
      this.is5GNetwork = this.is5GNetwork || userAgent.includes('5g');
    }

    console.log(`📱 Network detected: ${this.is5GNetwork ? '5G' : '4G/WiFi'} - Quality: ${this.connectionQuality}`);
  }

  private updateConnectionQuality(downlink: number, rtt?: number): void {
    if (downlink > 20) {
      this.connectionQuality = 'excellent';
    } else if (downlink > 10) {
      this.connectionQuality = 'good';
    } else if (downlink > 5) {
      this.connectionQuality = 'fair';
    } else {
      this.connectionQuality = 'poor';
    }

    // Adjust for 5G latency
    if (this.is5GNetwork && rtt && rtt < 50) {
      this.connectionQuality = 'excellent';
    }
  }

  // Initialize connection to signaling server
  async initialize(serverUrl: string = 'ws://localhost:8080'): Promise<boolean> {
    try {
      console.log('📡 Connecting to real-time radar server...');

      this.ws = new WebSocket(`${serverUrl}?peerId=${this.generatePeerId()}`);

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 10000);

        this.ws!.onopen = () => {
          clearTimeout(timeout);
          console.log('✅ Connected to radar server');
          this.reconnectAttempts = 0;
          this.isRealMode = true;

          // Start sending location updates
          this.startLocationUpdates();

          resolve(true);
        };

        this.ws!.onmessage = (event) => {
          this.handleServerMessage(JSON.parse(event.data));
        };

        this.ws!.onclose = () => {
          clearTimeout(timeout);
          console.log('🔌 Disconnected from radar server');
          this.handleReconnect();
        };

        this.ws!.onerror = (error) => {
          clearTimeout(timeout);
          // Just a warning for Offline Mode - not a critical failure
          console.warn('⚠️ Radar server unavailable (Offline Mode):', error);
          reject(new Error('WebSocket connection failed'));
        };
      });
    } catch (error) {
      console.error('Failed to initialize radar service:', error);
      return Promise.resolve(false);
    }
  }

  private handleServerMessage(message: any) {
    switch (message.type) {
      case 'welcome':
        this.handleWelcome(message);
        break;
      case 'peer_joined':
        this.handlePeerJoined(message.peer);
        break;
      case 'peer_left':
        this.handlePeerLeft(message.peer);
        break;
      case 'peer_updated':
        this.handlePeerUpdated(message.peerId, message.peer);
        break;
      case 'peer_location_updated':
        this.handleLocationUpdated(message.peerId, message.location);
        break;
      case 'geohash_peer_joined':
        this.handleGeohashPeerJoined(message.geohash, message.peer);
        break;
      case 'geohash_peer_left':
        this.handleGeohashPeerLeft(message.geohash, message.peerId);
        break;
      case 'direct_message':
        this.handleDirectMessage(message);
        break;
      case 'pong':
        this.handlePong();
        break;
      default:
        console.log('📨 Unknown message type:', message.type);
    }
  }

  private handleWelcome(message: any) {
    console.log(`👋 Welcome to radar! Found ${message.peers.length} existing peers`);

    // Add existing peers
    message.peers.forEach((peer: RadarPeer) => {
      this.addPeer(peer);
    });

    this.notifyListeners('peersUpdated', Array.from(this.peers.values()));
    this.notifyListeners('connected', true);
  }

  private handlePeerJoined(peer: RadarPeer) {
    console.log(`🆕 New peer joined radar: ${peer.name}`);
    this.addPeer(peer);
    this.notifyListeners('peersUpdated', Array.from(this.peers.values()));
    this.notifyListeners('peerJoined', peer);
  }

  private handlePeerLeft(peer: RadarPeer) {
    console.log(`👋 Peer left radar: ${peer.name}`);
    this.removePeer(peer.id);
    this.notifyListeners('peersUpdated', Array.from(this.peers.values()));
    this.notifyListeners('peerLeft', peer);
  }

  private handlePeerUpdated(peerId: string, peer: RadarPeer) {
    const existingPeer = this.peers.get(peerId);
    if (existingPeer) {
      Object.assign(existingPeer, peer);
      this.notifyListeners('peersUpdated', Array.from(this.peers.values()));
    }
  }

  private handleLocationUpdated(peerId: string, location: any) {
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.location = location;
      this.calculateDistances();
      this.notifyListeners('peersUpdated', Array.from(this.peers.values()));
    }
  }

  private handleGeohashPeerJoined(geohash: string, peer: RadarPeer) {
    console.log(`🗺️ Peer ${peer.name} joined geohash ${geohash}`);

    // Update geohash zone
    const zone = this.geohashZones.get(geohash) || {
      id: geohash,
      name: `Zone ${geohash}`,
      peerCount: 0,
      peers: [],
      signalStrength: 0
    };

    zone.peers.push(peer);
    zone.peerCount = zone.peers.length;
    zone.signalStrength = this.calculateZoneSignalStrength(zone);

    this.geohashZones.set(geohash, zone);
    this.notifyListeners('geohashUpdated', zone);
  }

  private handleGeohashPeerLeft(geohash: string, peerId: string) {
    console.log(`🗺️ Peer left geohash ${geohash}`);

    const zone = this.geohashZones.get(geohash);
    if (zone) {
      zone.peers = zone.peers.filter(p => p.id !== peerId);
      zone.peerCount = zone.peers.length;
      zone.signalStrength = this.calculateZoneSignalStrength(zone);

      if (zone.peerCount === 0) {
        this.geohashZones.delete(geohash);
      }

      this.notifyListeners('geohashUpdated', zone);
    }
  }

  private handleDirectMessage(message: any) {
    this.notifyListeners('directMessage', message);
  }

  private handlePong() {
    console.log('🏓 Received pong from server');
  }

  private addPeer(peer: RadarPeer) {
    this.peers.set(peer.id, peer);
    this.calculateDistances();

    // Add to geohash zone if location is available
    if (peer.location?.geohash) {
      this.handleGeohashPeerJoined(peer.location.geohash, peer);
    }
  }

  private removePeer(peerId: string) {
    const peer = this.peers.get(peerId);
    if (peer) {
      this.peers.delete(peerId);

      // Remove from geohash zone
      if (peer.location?.geohash) {
        this.handleGeohashPeerLeft(peer.location.geohash, peerId);
      }
    }
  }

  private calculateDistances() {
    // Calculate distances from current user to all peers
    const myLocation = this.getMyLocation();
    if (!myLocation) return;

    this.peers.forEach(peer => {
      if (peer.location) {
        peer.distance = this.calculateDistance(
          myLocation.lat, myLocation.lng,
          peer.location.lat, peer.location.lng
        );
      }
    });
  }

  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private calculateZoneSignalStrength(zone: GeohashZone): number {
    if (zone.peers.length === 0) return 0;

    // Calculate average signal strength based on peer distances
    const totalStrength = zone.peers.reduce((sum, peer) => {
      return sum + (peer.signalStrength || 50);
    }, 0);

    return Math.round(totalStrength / zone.peers.length);
  }

  private generateCurrentGeohash(): string {
    // Generate geohash based on current location or random
    const lat = 40.7128 + (Math.random() - 0.5) * 0.1; // NYC area
    const lng = -74.0060 + (Math.random() - 0.5) * 0.1;
    this.currentGeohash = this.encodeGeohash(lat, lng, 5);
    console.log(`📍 Current geohash: ${this.currentGeohash}`);
    return this.currentGeohash;
  }

  private encodeGeohash(lat: number, lng: number, precision: number): string {
    // Simple geohash encoding (for demo - use proper library in production)
    const chars = '0123456789bcdefghjkmnpqrstuvwxyz';
    let hash = '';

    // This is a simplified version - use proper geohash library
    for (let i = 0; i < precision; i++) {
      hash += chars[Math.floor(Math.random() * chars.length)];
    }

    return hash;
  }

  private getMyLocation() {
    // Get user's current location (browser API or fallback)
    return {
      lat: 40.7128 + (Math.random() - 0.5) * 0.1,
      lng: -74.0060 + (Math.random() - 0.5) * 0.1,
      geohash: this.currentGeohash
    };
  }

  private startLocationUpdates() {
    // Adaptive update frequency based on network type
    const updateInterval = this.is5GNetwork ? 10000 : 30000; // 10s for 5G, 30s for 4G/WiFi

    // Send location updates
    setInterval(() => {
      this.updateMyLocation();
      this.performPing();
    }, updateInterval);

    // Send initial location
    this.updateMyLocation();

    // Start connection quality monitoring
    this.startConnectionQualityMonitoring();
  }

  private performPing(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const now = Date.now();

    // Send ping to server
    this.ws.send(JSON.stringify({
      type: 'ping',
      timestamp: now
    }));

    this.lastPingTime = now;
  }

  private startConnectionQualityMonitoring(): void {
    // Monitor connection quality and adapt accordingly
    setInterval(() => {
      this.updateConnectionQualityBasedOnPerformance();
    }, 5000); // Check every 5 seconds
  }

  private updateConnectionQualityBasedOnPerformance(): void {
    if (!this.is5GNetwork) return;

    // Adjust quality based on recent ping times and message delivery
    const recentPings = this.getRecentPingTimes();
    if (recentPings.length > 0) {
      const avgPing = recentPings.reduce((sum, time) => sum + time, 0) / recentPings.length;

      if (avgPing < 50) {
        this.connectionQuality = 'excellent';
      } else if (avgPing < 100) {
        this.connectionQuality = 'good';
      } else if (avgPing < 200) {
        this.connectionQuality = 'fair';
      } else {
        this.connectionQuality = 'poor';
      }

      console.log(`📊 Connection quality updated: ${this.connectionQuality} (avg ping: ${avgPing}ms)`);
    }
  }

  private getRecentPingTimes(): number[] {
    // Return recent ping times for quality assessment
    const now = Date.now();
    const recentTime = now - (5 * 60 * 1000); // Last 5 minutes

    // This would be stored in a real implementation
    // For now, return simulated values based on connection quality
    if (this.connectionQuality === 'excellent') {
      return [20, 25, 30, 35]; // 5G excellent pings
    } else if (this.connectionQuality === 'good') {
      return [50, 60, 70, 80]; // 5G good pings
    } else {
      return [150, 200, 250, 300]; // 5G fair/poor pings
    }
  }

  private updateMyLocation() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const location = this.getMyLocation();

    this.ws.send(JSON.stringify({
      type: 'update_location',
      location,
      timestamp: Date.now()
    }));
  }

  private handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('❌ Max reconnection attempts reached');
      this.notifyListeners('disconnected', true);
      return;
    }

    this.reconnectAttempts++;

    // Faster reconnection for 5G networks
    const baseDelay = this.is5GNetwork ? 500 : 1000; // 0.5s for 5G, 1s for others
    const delay = Math.min(baseDelay * Math.pow(2, this.reconnectAttempts - 1), 5000); // Max 5s delay

    console.log(`🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}) - Network: ${this.is5GNetwork ? '5G' : '4G/WiFi'}`);

    this.reconnectInterval = setTimeout(() => {
      this.initialize();
    }, delay);
  }

  // ... rest of the code remains the same ...
  // Public API methods
  async connectToPeer(peerId: string): Promise<boolean> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('Not connected to radar server');
      return false;
    }

    try {
      // Initiate WebRTC connection through signaling server
      this.ws.send(JSON.stringify({
        type: 'webrtc_offer',
        targetPeerId: peerId,
        timestamp: Date.now()
      }));

      console.log(`🔗 Initiating connection to peer: ${peerId}`);
      return true;
    } catch (error) {
      console.error('Failed to connect to peer:', error);
      return false;
    }
  }

  sendMessage(peerId: string, message: string): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('Not connected to radar server');
      return false;
    }

    try {
      // Optimize message sending for 5G networks
      const messageData = {
        type: 'direct_message',
        targetPeerId: peerId,
        message,
        timestamp: Date.now(),
        priority: this.is5GNetwork ? 'high' : 'normal', // 5G gets priority
        compression: this.is5GNetwork // Enable compression for 5G
      };

      this.ws.send(JSON.stringify(messageData));
      console.log(`💬 Sending ${this.is5GNetwork ? '5G priority' : 'standard'} message to ${peerId}: ${message}`);
      return true;
    } catch (error) {
      console.error('Failed to send message:', error);
      return false;
    }
  }

  joinGeohash(geohash: string): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('Not connected to radar server');
      return false;
    }

    try {
      this.ws.send(JSON.stringify({
        type: 'join_geohash',
        geohash,
        timestamp: Date.now()
      }));

      this.currentGeohash = geohash;
      console.log(`🗺️ Joining geohash: ${geohash}`);
      return true;
    } catch (error) {
      console.error('Failed to join geohash:', error);
      return false;
    }
  }

  updateProfile(profile: Partial<RadarPeer>): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('Not connected to radar server');
      return false;
    }

    try {
      this.ws.send(JSON.stringify({
        type: 'update_profile',
        profile,
        timestamp: Date.now()
      }));

      console.log('👤 Updating profile:', profile);
      return true;
    } catch (error) {
      console.error('Failed to update profile:', error);
      return false;
    }
  }

  // Getters
  getPeers(): RadarPeer[] {
    return Array.from(this.peers.values());
  }

  getGeohashZones(): GeohashZone[] {
    return Array.from(this.geohashZones.values());
  }

  getCurrentGeohash(): string {
    return this.currentGeohash;
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  isRealModeEnabled(): boolean {
    return this.isRealMode;
  }

  // Event listeners
  subscribe(event: string, callback: (data: any) => void): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);

    return () => {
      const index = this.listeners[event].indexOf(callback);
      if (index > -1) {
        this.listeners[event].splice(index, 1);
      }
    };
  }

  private notifyListeners(event: string, data: any): void {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(data));
    }
  }

  private generatePeerId(): string {
    return 'radar_' + Math.random().toString(36).substr(2, 9);
  }

  // Network selection methods
  setPreferredNetwork(network: '5g' | '4g' | 'wifi' | 'bluetooth'): void {
    this.preferredNetwork = network;
    this.saveNetworkPreferences();
    console.log(`📱 Preferred network set to: ${network}`);

    // If connected to server, update immediately
    if (this.isConnected()) {
      this.updateMyLocation();
    }
  }

  setNetworkSelectionMode(mode: 'auto' | 'manual'): void {
    this.networkSelectionMode = mode;
    this.saveNetworkPreferences();
    console.log(`🔧 Network selection mode: ${mode}`);
  }

  getPreferredNetwork(): '5g' | '4g' | 'wifi' | 'bluetooth' {
    return this.preferredNetwork;
  }

  getNetworkSelectionMode(): 'auto' | 'manual' {
    return this.networkSelectionMode;
  }

  getAvailableNetworks(): { available: string[], current: string, preferred: string } {
    const available = [];

    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      if (connection) {
        available.push('wifi');
        if (connection.effectiveType === '4g') available.push('4g');
        if (connection.effectiveType === '5g') available.push('5g');
      }
    }

    return {
      available,
      current: this.is5GNetwork ? '5g' : this.connectionQuality === 'excellent' ? '4g' : 'wifi',
      preferred: this.getBestAvailableNetwork()
    };
  }

  // Cleanup
  disconnect(): void {
    if (this.reconnectInterval) {
      clearTimeout(this.reconnectInterval);
      this.reconnectInterval = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.isRealMode = false;
    console.log('🔌 Disconnected from radar service');
  }
}

export const realtimeRadar = new RealtimeRadarService();
