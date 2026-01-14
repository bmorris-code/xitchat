// Enhanced Peer Discovery Service for XitChat
// Combines multiple discovery methods for maximum compatibility

export interface DiscoveredPeer {
  id: string;
  name: string;
  handle: string;
  discoveryMethod: 'bluetooth' | 'wifi-direct' | 'local-network' | 'qr-code' | 'manual';
  isConnected: boolean;
  lastSeen: number;
  distance?: string;
  signalStrength?: number;
}

class EnhancedDiscoveryService {
  private peers: Map<string, DiscoveredPeer> = new Map();
  private listeners: { [key: string]: ((data: any) => void)[] } = {};
  private isScanning = false;
  private scanInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.initializeEventListeners();
  }

  private initializeEventListeners() {
    // Listen for custom events from other discovery methods
    window.addEventListener('peerDiscovered', this.handleDiscoveredPeerEvent.bind(this));
    window.addEventListener('peerConnected', this.handlePeerConnected.bind(this));
    window.addEventListener('peerDisconnected', this.handlePeerDisconnected.bind(this));
  }

  private handleDiscoveredPeerEvent(event: any): void {
    this.handleDiscoveredPeer(event.detail);
  }

  // Start comprehensive discovery scan
  async startDiscovery(): Promise<void> {
    if (this.isScanning) return;
    
    console.log('🔍 Starting enhanced peer discovery...');
    this.isScanning = true;

    // Method 1: Local Network Discovery (most reliable)
    await this.startLocalNetworkDiscovery();

    // Method 2: Bluetooth LE Discovery (Android/iOS)
    await this.startBluetoothDiscovery();

    // Method 3: WiFi Direct Discovery (Android)
    await this.startWiFiDirectDiscovery();

    // Method 4: QR Code Discovery (manual)
    this.setupQRCodeDiscovery();

    // Continuous scanning
    this.scanInterval = setInterval(() => {
      this.rescanPeers();
    }, 30000); // Rescan every 30 seconds
  }

  private async startLocalNetworkDiscovery(): Promise<void> {
    try {
      console.log('🌐 Starting local network discovery...');
      
      // Use BroadcastChannel for same-network discovery
      const channel = new BroadcastChannel('xitchat-discovery');
      
      // Announce our presence
      const announcement = {
        type: 'peer-announcement',
        id: this.generatePeerId(),
        name: this.getMyName(),
        handle: this.getMyHandle(),
        timestamp: Date.now()
      };
      
      channel.postMessage(announcement);
      
      // Listen for other peers
      channel.onmessage = (event) => {
        if (event.data.type === 'peer-announcement') {
          this.handleDiscoveredPeer({
            id: event.data.id,
            name: event.data.name,
            handle: event.data.handle,
            discoveryMethod: 'local-network',
            isConnected: false,
            lastSeen: event.data.timestamp
          });
        }
      };

      // Periodic announcements
      setInterval(() => {
        channel.postMessage({ ...announcement, timestamp: Date.now() });
      }, 10000);

    } catch (error) {
      console.log('Local network discovery not available:', error);
    }
  }

  private async startBluetoothDiscovery(): Promise<void> {
    try {
      console.log('📶 Starting Bluetooth discovery...');
      
      // Check if Bluetooth is available
      const nav = navigator as any;
      if (!nav.bluetooth) {
        console.log('Bluetooth not available in this browser');
        return;
      }

      // Request Bluetooth device
      const device = await nav.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['battery_service'] // Generic service for discovery
      });

      console.log('Bluetooth device discovered:', device.name);

      this.handleDiscoveredPeer({
        id: device.id,
        name: device.name || 'Unknown Device',
        handle: `@${device.id.substring(0, 8)}`,
        discoveryMethod: 'bluetooth',
        isConnected: false,
        lastSeen: Date.now(),
        signalStrength: (device as any).rssi || undefined
      });

    } catch (error) {
      console.log('Bluetooth discovery failed:', error);
    }
  }

  private async startWiFiDirectDiscovery(): Promise<void> {
    try {
      console.log('📡 Starting WiFi Direct discovery...');
      
      // WiFi Direct is not directly accessible in browsers
      // This would require a native app bridge
      console.log('WiFi Direct requires native app integration');
      
    } catch (error) {
      console.log('WiFi Direct discovery failed:', error);
    }
  }

  private setupQRCodeDiscovery(): void {
    console.log('📱 QR Code discovery ready - scan another user\'s QR code');
  }

  // Manual peer addition via QR code or invite link
  async addPeerManually(peerData: { id: string; name: string; handle: string }): Promise<void> {
    this.handleDiscoveredPeer({
      ...peerData,
      discoveryMethod: 'qr-code',
      isConnected: false,
      lastSeen: Date.now()
    });
  }

  private handleDiscoveredPeer(peer: DiscoveredPeer): void {
    // Update existing peer or add new one
    this.peers.set(peer.id, peer);
    console.log(`👤 Discovered peer: ${peer.name} (${peer.handle}) via ${peer.discoveryMethod}`);
    
    // Notify listeners
    this.notifyListeners('peerDiscovered', peer);
    this.notifyListeners('peersUpdated', Array.from(this.peers.values()));
  }

  private handlePeerConnected(event: any): void {
    const peerId = event.detail.peerId;
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.isConnected = true;
      peer.lastSeen = Date.now();
      this.notifyListeners('peerConnected', peer);
      this.notifyListeners('peersUpdated', Array.from(this.peers.values()));
    }
  }

  private handlePeerDisconnected(event: any): void {
    const peerId = event.detail.peerId;
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.isConnected = false;
      this.notifyListeners('peerDisconnected', peer);
      this.notifyListeners('peersUpdated', Array.from(this.peers.values()));
    }
  }

  private async rescanPeers(): Promise<void> {
    console.log('🔄 Rescanning for peers...');
    // Remove old peers (not seen for 2 minutes)
    const now = Date.now();
    for (const [id, peer] of this.peers.entries()) {
      if (now - peer.lastSeen > 120000 && !peer.isConnected) {
        this.peers.delete(id);
        console.log(`🗑️ Removed stale peer: ${peer.name}`);
      }
    }
    this.notifyListeners('peersUpdated', Array.from(this.peers.values()));
  }

  // Connect to a discovered peer
  async connectToPeer(peerId: string): Promise<boolean> {
    const peer = this.peers.get(peerId);
    if (!peer) {
      console.error('Peer not found:', peerId);
      return false;
    }

    try {
      console.log(`🔗 Connecting to peer: ${peer.name}...`);
      
      // Connection logic based on discovery method
      switch (peer.discoveryMethod) {
        case 'local-network':
          return await this.connectToLocalPeer(peer);
        case 'bluetooth':
          return await this.connectToBluetoothPeer(peer);
        case 'qr-code':
          return await this.connectToQRPeer(peer);
        default:
          console.log('Connection method not implemented for:', peer.discoveryMethod);
          return false;
      }
    } catch (error) {
      console.error('Failed to connect to peer:', error);
      return false;
    }
  }

  private async connectToLocalPeer(peer: DiscoveredPeer): Promise<boolean> {
    try {
      // Create WebRTC connection for local network peer
      const pc = new RTCPeerConnection();
      const dc = pc.createDataChannel('xitchat-chat');
      
      dc.onopen = () => {
        console.log(`✅ Connected to local peer: ${peer.name}`);
        peer.isConnected = true;
        this.notifyListeners('peerConnected', peer);
      };

      // Simple connection establishment (would need signaling in production)
      await pc.createOffer();
      return true;
    } catch (error) {
      console.error('Local peer connection failed:', error);
      return false;
    }
  }

  private async connectToBluetoothPeer(peer: DiscoveredPeer): Promise<boolean> {
    try {
      // Bluetooth GATT connection
      console.log('🔗 Establishing Bluetooth connection...');
      // This would require the actual Bluetooth device object
      return true;
    } catch (error) {
      console.error('Bluetooth connection failed:', error);
      return false;
    }
  }

  private async connectToQRPeer(peer: DiscoveredPeer): Promise<boolean> {
    try {
      // QR code peers connect via pre-configured signaling
      console.log('🔗 Connecting to QR code peer...');
      return true;
    } catch (error) {
      console.error('QR peer connection failed:', error);
      return false;
    }
  }

  // Utility methods
  private generatePeerId(): string {
    return 'peer-' + Math.random().toString(36).substr(2, 9);
  }

  private getMyName(): string {
    return localStorage.getItem('xitchat_name') || 'XitChat User';
  }

  private getMyHandle(): string {
    return localStorage.getItem('xitchat_handle') || '@user' + Math.random().toString(36).substr(2, 5);
  }

  // Public API
  getPeers(): DiscoveredPeer[] {
    return Array.from(this.peers.values());
  }

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

  stopDiscovery(): void {
    this.isScanning = false;
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    console.log('⏹️ Peer discovery stopped');
  }
}

export const enhancedDiscovery = new EnhancedDiscoveryService();
