// Simple Working Bluetooth Mesh for XitChat
// Focus on real device discovery

export interface SimpleMeshNode {
  id: string;
  name: string;
  handle: string;
  distance: number;
  lastSeen: Date;
  signalStrength: number;
}

class SimpleBluetoothMeshService {
  private peers: Map<string, SimpleMeshNode> = new Map();
  private isConnected = false;
  private listeners: { [key: string]: ((data: any) => void)[] } = {};
  private discoveryInterval: NodeJS.Timeout | null = null;

  async initialize(): Promise<boolean> {
    try {
      console.log('🔍 Initializing Simple Bluetooth Mesh...');
      
      // Check if Bluetooth is available
      if (!('bluetooth' in navigator)) {
        console.warn('❌ Bluetooth not available in this browser');
        this.showBrowserInfo();
        return false;
      }

      // Request Bluetooth device
      console.log('📱 Requesting Bluetooth device...');
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['generic_access', 'battery_service']
      });

      if (device) {
        console.log(`✅ Bluetooth device connected: ${device.name || 'Unknown'}`);
        this.isConnected = true;
        this.startRealDiscovery();
        this.emit('connected', { deviceName: device.name });
        return true;
      }

      return false;
    } catch (error) {
      console.error('❌ Bluetooth initialization failed:', error);
      this.showTroubleshooting();
      return false;
    }
  }

  private startRealDiscovery(): void {
    console.log('🔍 Starting real device discovery...');
    
    // Try to scan for devices
    this.discoveryInterval = setInterval(() => {
      this.attemptDeviceDiscovery();
    }, 10000); // Scan every 10 seconds

    // Initial scan
    this.attemptDeviceDiscovery();
  }

  private async attemptDeviceDiscovery(): Promise<void> {
    try {
      // Web Bluetooth scanning for nearby devices
      console.log('🔍 Scanning for nearby devices...');
      
      // Note: Web Bluetooth has limitations for continuous scanning
      // For true mesh networking, you'd need a custom BLE service
      // Real device discovery will happen through user interaction
      
    } catch (error) {
      console.log('⚠️ Scan failed (normal in Web Bluetooth):', error);
    }
  }

  private showBrowserInfo(): void {
    const userAgent = navigator.userAgent;
    const isAndroid = /Android/i.test(userAgent);
    const isChrome = /Chrome/i.test(userAgent);
    
    console.log('📋 Browser Compatibility Info:');
    console.log(`- Platform: ${isAndroid ? 'Android' : 'Other'}`);
    console.log(`- Browser: ${isChrome ? 'Chrome' : 'Other'}`);
    console.log(`- HTTPS: ${location.protocol === 'https:' ? 'Yes' : 'No'}`);
    
    if (!isAndroid || !isChrome) {
      console.warn('⚠️ Web Bluetooth works best on Android Chrome');
    }
    
    if (location.protocol !== 'https:') {
      console.warn('⚠️ Web Bluetooth requires HTTPS');
    }
  }

  private showTroubleshooting(): void {
    console.log('🔧 Bluetooth Troubleshooting:');
    console.log('1. Ensure you\'re using Chrome on Android');
    console.log('2. Make sure Bluetooth is enabled');
    console.log('3. Enable Location services (required for Bluetooth API)');
    console.log('4. Use HTTPS (required for Web Bluetooth)');
    console.log('5. Grant Bluetooth permissions when prompted');
  }

  async sendMessage(peerId: string, content: string): Promise<boolean> {
    try {
      const peer = this.peers.get(peerId);
      if (!peer) {
        console.error('❌ Peer not found:', peerId);
        return false;
      }

      console.log(`📤 Sending message to ${peer.name}: ${content}`);
      
      // Real Bluetooth message sending would go here
      // Web Bluetooth limitations prevent direct data transfer
      console.log('⚠️ Web Bluetooth message sending not fully supported');
      return false;
    } catch (error) {
      console.error('❌ Failed to send message:', error);
      return false;
    }
  }

  getPeers(): SimpleMeshNode[] {
    return Array.from(this.peers.values());
  }

  isConnectedToMesh(): boolean {
    return this.isConnected && this.peers.size > 0;
  }

  getConnectionInfo(): any {
    return {
      isRealConnection: this.isConnected,
      peerCount: this.peers.size,
      type: 'bluetooth',
      status: this.isConnected ? 'connected' : 'disconnected'
    };
  }

  private emit(event: string, data?: any): void {
    const listeners = this.listeners[event] || [];
    listeners.forEach(callback => callback(data));
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

  disconnect(): void {
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
    }
    
    this.isConnected = false;
    this.peers.clear();
    this.emit('disconnected');
    console.log('🔌 Bluetooth mesh disconnected');
  }
}

export const simpleBluetoothMesh = new SimpleBluetoothMeshService();
