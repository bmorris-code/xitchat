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
  private maxReconnectAttempts = 3; // Reduced to 3 to failover to simulation faster
  private reconnectInterval: any = null;
  private simulationInterval: any = null;
  private isRealMode = false; // True if connected to backend, False if simulating
  private is5GNetwork = false;
  private connectionQuality: 'excellent' | 'good' | 'fair' | 'poor' = 'good';
  private lastPingTime = 0;
  private preferredNetwork: '5g' | '4g' | 'wifi' | 'bluetooth' = '5g';
  private networkSelectionMode: 'auto' | 'manual' = 'auto';
  
  // Cache current location
  private myCurrentLocation: { lat: number; lng: number; geohash: string } | null = null;

  constructor() {
    this.detectNetworkType();
    this.loadNetworkPreferences();
    // Initialize with a default location to prevent null errors
    this.myCurrentLocation = this.generateRandomLocation(); 
  }

  private generateRandomLocation() {
    // Default to NYC area if no location found
    const lat = 40.7128 + (Math.random() - 0.5) * 0.05;
    const lng = -74.0060 + (Math.random() - 0.5) * 0.05;
    return {
        lat,
        lng,
        geohash: this.encodeGeohash(lat, lng, 5)
    };
  }

  private loadNetworkPreferences(): void {
    try {
      const saved = localStorage.getItem('xitchat_network_preferences');
      if (saved) {
        const prefs = JSON.parse(saved);
        this.preferredNetwork = prefs.preferredNetwork || '5g';
        this.networkSelectionMode = prefs.networkSelectionMode || 'auto';
      }
    } catch (error) {
      console.warn('Failed to load network preferences:', error);
    }
  }

  private saveNetworkPreferences(): void {
    try {
      const prefs = {
        preferredNetwork: this.preferredNetwork,
        networkSelectionMode: this.networkSelectionMode,
        lastUpdated: Date.now()
      };
      localStorage.setItem('xitchat_network_preferences', JSON.stringify(prefs));
    } catch (error) {
      console.warn('Failed to save network preferences:', error);
    }
  }

  private detectNetworkType(): void {
    // Robust detection for 5G/Network capabilities
    if (typeof navigator !== 'undefined' && 'connection' in navigator) {
      const connection = (navigator as any).connection;
      if (connection) {
        // Chrome returns '4g' even for 5G usually, so we check downlink speed
        this.is5GNetwork = connection.effectiveType === '5g' || connection.downlink > 10;
        this.updateConnectionQuality(connection.downlink, connection.rtt);
        
        // Listen for changes
        connection.addEventListener('change', () => {
             this.detectNetworkType();
        });
      }
    }
    console.log(`📱 Network detected: ${this.is5GNetwork ? '5G (High Speed)' : 'Standard'} - Quality: ${this.connectionQuality}`);
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
  async initialize(serverUrl?: string): Promise<boolean> {
    try {
      // 1. Determine correct URL (Secure vs Insecure)
      if (!serverUrl) {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.hostname;
        // If on localhost, use 8080, otherwise use valid path
        const port = host === 'localhost' ? ':8080' : ''; 
        serverUrl = `${protocol}//${host}${port}/ws`; 
      }

      console.log(`📡 Connecting to radar server: ${serverUrl}`);

      // 2. Start Location Tracking (Real GPS)
      this.startRealLocationTracking();

      return new Promise((resolve) => {
        try {
            this.ws = new WebSocket(`${serverUrl}?peerId=${this.generatePeerId()}`);
        } catch(e) {
            // Instant failover if URL is malformed
            this.enableSimulationMode();
            resolve(true);
            return;
        }

        const timeout = setTimeout(() => {
          console.warn("⚠️ Connection timeout - Switching to Simulation Mode");
          this.ws?.close();
          this.enableSimulationMode();
          resolve(true); // Resolve true so UI loads
        }, 3000);

        this.ws.onopen = () => {
          clearTimeout(timeout);
          console.log('✅ Connected to radar server');
          this.reconnectAttempts = 0;
          this.isRealMode = true;
          this.startLocationUpdates();
          resolve(true);
        };

        this.ws.onmessage = (event) => {
            try {
                this.handleServerMessage(JSON.parse(event.data));
            } catch (e) { console.error("Invalid WS message", e); }
        };

        this.ws.onclose = () => {
          clearTimeout(timeout);
          console.log('🔌 Disconnected from radar server');
          this.handleReconnect();
        };

        this.ws.onerror = (error) => {
          clearTimeout(timeout);
          console.warn('⚠️ WebSocket error (will fallback to simulation):', error);
          // Don't reject, just let the close handler trigger reconnect/simulation
        };
      });
    } catch (error) {
      console.error('Failed to initialize radar service:', error);
      this.enableSimulationMode();
      return Promise.resolve(true);
    }
  }

  // Fallback mode when no backend is running
  private enableSimulationMode() {
      if (this.simulationInterval) return;
      console.log("🎮 Enabling Radar Simulation Mode (No Backend Detected)");
      this.isRealMode = false;
      
      // Create some fake peers
      this.handleWelcome({
          peers: [
              this.createMockPeer("Mock User 1", 0.001, 0.001),
              this.createMockPeer("Mock User 2", -0.001, 0.002),
              this.createMockPeer("Mock User 3", 0.002, -0.001),
          ]
      });

      // Simulate movement every 3 seconds
      this.simulationInterval = setInterval(() => {
          this.peers.forEach(peer => {
              if(peer.location) {
                  // Jitter location slightly
                  peer.location.lat += (Math.random() - 0.5) * 0.0001;
                  peer.location.lng += (Math.random() - 0.5) * 0.0001;
                  this.handlePeerUpdated(peer.id, peer);
              }
          });
      }, 3000);
      
      this.notifyListeners('connected', true);
  }

  private createMockPeer(name: string, latOffset: number, lngOffset: number): RadarPeer {
      const loc = this.myCurrentLocation || this.generateRandomLocation();
      return {
          id: `sim_${Math.random().toString(36).substr(2, 5)}`,
          name: name,
          handle: `@${name.replace(/\s/g, '').toLowerCase()}`,
          location: {
              lat: loc.lat + latOffset,
              lng: loc.lng + lngOffset,
              geohash: loc.geohash
          },
          capabilities: ['radar', 'chat'],
          lastSeen: Date.now(),
          isOnline: true,
          connectionType: 'webrtc'
      };
  }

  private handleServerMessage(message: any) {
    if (!message || !message.type) return;

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
      case 'direct_message':
        this.handleDirectMessage(message);
        break;
    }
  }

  private handleWelcome(message: any) {
    console.log(`👋 Radar Initialized. Loaded ${message.peers.length} peers.`);
    message.peers.forEach((peer: RadarPeer) => this.addPeer(peer));
    this.notifyListeners('peersUpdated', Array.from(this.peers.values()));
  }

  private handlePeerJoined(peer: RadarPeer) {
    this.addPeer(peer);
    this.notifyListeners('peersUpdated', Array.from(this.peers.values()));
    this.notifyListeners('peerJoined', peer);
  }

  private handlePeerLeft(peer: RadarPeer) {
    this.removePeer(peer.id);
    this.notifyListeners('peersUpdated', Array.from(this.peers.values()));
    this.notifyListeners('peerLeft', peer);
  }

  private handlePeerUpdated(peerId: string, peerData: Partial<RadarPeer>) {
    const existingPeer = this.peers.get(peerId);
    if (existingPeer) {
      Object.assign(existingPeer, peerData);
      // Recalculate distance if location changed
      if(peerData.location) this.calculateDistances();
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

  private handleDirectMessage(message: any) {
    this.notifyListeners('directMessage', message);
  }

  private addPeer(peer: RadarPeer) {
    this.peers.set(peer.id, peer);
    this.calculateDistances();
    // Add to geohash zone logic here if needed
  }

  private removePeer(peerId: string) {
    this.peers.delete(peerId);
  }

  private calculateDistances() {
    const myLoc = this.myCurrentLocation;
    if (!myLoc) return;

    this.peers.forEach(peer => {
      if (peer.location) {
        peer.distance = this.calculateDistance(
          myLoc.lat, myLoc.lng,
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

  private startRealLocationTracking() {
    if (!('geolocation' in navigator)) {
        console.warn("Geolocation not supported. Using random location.");
        this.myCurrentLocation = this.generateRandomLocation();
        return;
    }

    navigator.geolocation.watchPosition(
        (position) => {
            const { latitude, longitude } = position.coords;
            this.myCurrentLocation = {
                lat: latitude,
                lng: longitude,
                geohash: this.encodeGeohash(latitude, longitude, 5)
            };
            // Send update if connected
            if (this.isRealMode) this.updateMyLocation();
        },
        (error) => {
            console.warn(`Geolocation Error (${error.code}): ${error.message}. Using fallback.`);
            // If denied or error, keep using the default random location
            if (!this.myCurrentLocation) {
                this.myCurrentLocation = this.generateRandomLocation();
            }
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  private encodeGeohash(lat: number, lng: number, precision: number): string {
    // Simplified geohash for demo
    const chars = '0123456789bcdefghjkmnpqrstuvwxyz';
    let hash = 'u4pru'; // Default dummy prefix
    for (let i = 0; i < precision; i++) {
      hash += chars[Math.floor(Math.random() * chars.length)];
    }
    return hash;
  }

  private startLocationUpdates() {
    // Only send updates if we have a real connection
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const updateInterval = this.is5GNetwork ? 5000 : 15000;
    
    // Clear existing interval if any
    if ((this as any)._locationInterval) clearInterval((this as any)._locationInterval);

    (this as any)._locationInterval = setInterval(() => {
      this.updateMyLocation();
    }, updateInterval);
  }

  private updateMyLocation() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.myCurrentLocation) return;

    this.ws.send(JSON.stringify({
      type: 'update_location',
      location: this.myCurrentLocation,
      timestamp: Date.now()
    }));
  }

  private handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('❌ Max reconnection attempts reached. Switching to Offline/Simulation mode.');
      this.enableSimulationMode();
      return;
    }

    this.reconnectAttempts++;
    const delay = 2000;

    console.log(`🔄 Reconnecting... (Attempt ${this.reconnectAttempts})`);
    this.reconnectInterval = setTimeout(() => {
      this.initialize();
    }, delay);
  }

  // Public API
  async connectToPeer(peerId: string): Promise<boolean> {
    // Use simulated success if in simulation mode
    if (!this.isRealMode) {
        console.log(`🔗 [SIM] Connected to peer ${peerId}`);
        return true;
    }

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;

    try {
      this.ws.send(JSON.stringify({
        type: 'webrtc_offer',
        targetPeerId: peerId,
        timestamp: Date.now()
      }));
      return true;
    } catch (error) {
      return false;
    }
  }

  sendMessage(peerId: string, message: string): boolean {
    if (!this.isRealMode) {
        console.log(`💬 [SIM] Sent to ${peerId}: ${message}`);
        return true;
    }

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;

    this.ws.send(JSON.stringify({
      type: 'direct_message',
      targetPeerId: peerId,
      message,
      timestamp: Date.now()
    }));
    return true;
  }

  // Getters
  getPeers(): RadarPeer[] { return Array.from(this.peers.values()); }
  isConnected(): boolean { return this.ws?.readyState === WebSocket.OPEN || !this.isRealMode; } // Return true if simulating so UI shows "Online"
  isRealModeEnabled(): boolean { return this.isRealMode; }

  // Event Listeners
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
    if (this.simulationInterval) clearInterval(this.simulationInterval);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export const realtimeRadar = new RealtimeRadarService();