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

  // ── FIX #2: store announcement interval so it can be cleared ──
  private announcementInterval: NodeJS.Timeout | null = null;
  // ── FIX #3: store channel reference so it can be closed ──
  private discoveryChannel: BroadcastChannel | null = null;

  // ── FIX #1 & #6: stable ID generated once, bound handlers stored for cleanup ──
  private myId: string = 'peer-' + Math.random().toString(36).substr(2, 9);
  private boundHandleDiscoveredPeerEvent = this.handleDiscoveredPeerEvent.bind(this);
  private boundHandlePeerConnected = this.handlePeerConnected.bind(this);
  private boundHandlePeerDisconnected = this.handlePeerDisconnected.bind(this);

  constructor() {
    this.initializeEventListeners();
  }

  private initializeEventListeners() {
    window.addEventListener('peerDiscovered', this.boundHandleDiscoveredPeerEvent);
    window.addEventListener('peerConnected', this.boundHandlePeerConnected);
    window.addEventListener('peerDisconnected', this.boundHandlePeerDisconnected);
  }

  private handleDiscoveredPeerEvent(event: any): void {
    this.handleDiscoveredPeer(event.detail);
  }

  async startDiscovery(): Promise<void> {
    if (this.isScanning) return;
    this.isScanning = true;

    await this.startLocalNetworkDiscovery();
    // ── FIX #4: Bluetooth discovery removed from auto-scan ──
    // requestDevice() shows a browser permission dialog — only call on explicit user action
    await this.startWiFiDirectDiscovery();
    this.setupQRCodeDiscovery();

    this.scanInterval = setInterval(() => this.rescanPeers(), 30000);
  }

  private async startLocalNetworkDiscovery(): Promise<void> {
    try {
      // ── FIX #3: store channel reference ──
      if (this.discoveryChannel) {
        this.discoveryChannel.close();
        this.discoveryChannel = null;
      }
      this.discoveryChannel = new BroadcastChannel('xitchat-discovery');

      const announcement = {
        type: 'peer-announcement',
        // ── FIX #6: use stable myId, not generatePeerId() ──
        id: this.myId,
        name: this.getMyName(),
        handle: this.getMyHandle(),
        timestamp: Date.now()
      };

      this.discoveryChannel.postMessage(announcement);

      this.discoveryChannel.onmessage = (event) => {
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

      // ── FIX #2: store interval so stopDiscovery() can clear it ──
      if (this.announcementInterval) clearInterval(this.announcementInterval);
      this.announcementInterval = setInterval(() => {
        if (this.discoveryChannel) {
          this.discoveryChannel.postMessage({ ...announcement, timestamp: Date.now() });
        }
      }, 10000);

    } catch (error) {
      console.log('Local network discovery not available:', error);
    }
  }

  // ── FIX #4: Bluetooth discovery is now manual-only, not called on auto-scan ──
  async requestBluetoothDiscovery(): Promise<void> {
    try {
      const nav = navigator as any;
      if (!nav.bluetooth) {
        console.log('Bluetooth not available in this browser');
        return;
      }

      // This is called explicitly by the user (e.g. tapping "Scan Bluetooth")
      const device = await nav.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['battery_service']
      });

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
      console.log('Bluetooth discovery failed or cancelled:', error);
    }
  }

  private async startWiFiDirectDiscovery(): Promise<void> {
    // WiFi Direct requires native app bridge — no-op in web context
  }

  private setupQRCodeDiscovery(): void {
    // QR code discovery is handled by QRDiscovery component
  }

  async addPeerManually(peerData: { id: string; name: string; handle: string }): Promise<void> {
    this.handleDiscoveredPeer({
      ...peerData,
      discoveryMethod: 'qr-code',
      isConnected: false,
      lastSeen: Date.now()
    });
  }

  private handleDiscoveredPeer(peer: DiscoveredPeer): void {
    this.peers.set(peer.id, peer);
    this.notifyListeners('peerDiscovered', peer);
    this.notifyListeners('peersUpdated', Array.from(this.peers.values()));
  }

  private handlePeerConnected(event: any): void {
    const peerId = event.detail?.peerId;
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.isConnected = true;
      peer.lastSeen = Date.now();
      this.notifyListeners('peerConnected', peer);
      this.notifyListeners('peersUpdated', Array.from(this.peers.values()));
    }
  }

  private handlePeerDisconnected(event: any): void {
    const peerId = event.detail?.peerId;
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.isConnected = false;
      this.notifyListeners('peerDisconnected', peer);
      this.notifyListeners('peersUpdated', Array.from(this.peers.values()));
    }
  }

  private async rescanPeers(): Promise<void> {
    const now = Date.now();
    for (const [id, peer] of this.peers.entries()) {
      if (now - peer.lastSeen > 120000 && !peer.isConnected) {
        this.peers.delete(id);
      }
    }
    this.notifyListeners('peersUpdated', Array.from(this.peers.values()));
  }

  async connectToPeer(peerId: string): Promise<boolean> {
    const peer = this.peers.get(peerId);
    if (!peer) return false;

    try {
      switch (peer.discoveryMethod) {
        case 'local-network':
          return await this.connectToLocalPeer(peer);
        case 'bluetooth':
          return await this.connectToBluetoothPeer(peer);
        case 'qr-code':
          return await this.connectToQRPeer(peer);
        default:
          return false;
      }
    } catch (error) {
      console.error('Failed to connect to peer:', error);
      return false;
    }
  }

  // ── FIX #5: stub returns false cleanly instead of leaking RTCPeerConnection ──
  private async connectToLocalPeer(_peer: DiscoveredPeer): Promise<boolean> {
    // WebRTC local-peer connection requires signaling — delegated to wifiP2P service
    console.warn('connectToLocalPeer: use wifiP2P service for WebRTC connections');
    return false;
  }

  private async connectToBluetoothPeer(_peer: DiscoveredPeer): Promise<boolean> {
    console.log('🔗 Bluetooth connection requires native plugin');
    return false;
  }

  private async connectToQRPeer(_peer: DiscoveredPeer): Promise<boolean> {
    console.log('🔗 QR peer connection via pre-configured signaling');
    return true;
  }

  private getMyName(): string {
    return localStorage.getItem('xitchat_name') || 'XitChat User';
  }

  private getMyHandle(): string {
    return localStorage.getItem('xitchat_handle') || '@user' + Math.random().toString(36).substr(2, 5);
  }

  getPeers(): DiscoveredPeer[] {
    return Array.from(this.peers.values());
  }

  subscribe(event: string, callback: (data: any) => void): () => void {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
    return () => {
      const idx = this.listeners[event].indexOf(callback);
      if (idx > -1) this.listeners[event].splice(idx, 1);
    };
  }

  private notifyListeners(event: string, data: any): void {
    (this.listeners[event] || []).forEach(cb => cb(data));
  }

  stopDiscovery(): void {
    this.isScanning = false;

    if (this.scanInterval) { clearInterval(this.scanInterval); this.scanInterval = null; }
    // ── FIX #2: clear announcement interval ──
    if (this.announcementInterval) { clearInterval(this.announcementInterval); this.announcementInterval = null; }
    // ── FIX #3: close discovery channel ──
    if (this.discoveryChannel) { this.discoveryChannel.close(); this.discoveryChannel = null; }
    // ── FIX #1: remove window listeners ──
    window.removeEventListener('peerDiscovered', this.boundHandleDiscoveredPeerEvent);
    window.removeEventListener('peerConnected', this.boundHandlePeerConnected);
    window.removeEventListener('peerDisconnected', this.boundHandlePeerDisconnected);
  }
}

export const enhancedDiscovery = new EnhancedDiscoveryService();
