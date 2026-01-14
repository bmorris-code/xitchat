// Hybrid Mesh Service - Bluetooth + WebRTC + Broadcast + WiFi P2P + Nostr
// Automatically chooses best available P2P method and combines them

import { workingBluetoothMesh, WorkingMeshNode } from './workingBluetoothMesh';
import { ablyWebRTC, AblyWebRTCPeer } from './ablyWebRTC';
import { wifiP2P, WiFiPeer } from './wifiP2P';
import { nostrService, NostrPeer } from './nostrService';
import { broadcastMesh, BroadcastPeer } from './broadcastMesh';
import { localTestMesh, LocalMeshNode } from './localTestMesh';

export type MeshConnectionType = 'bluetooth' | 'webrtc' | 'broadcast' | 'local' | 'simulation' | 'wifi' | 'nostr';

export interface HybridMeshPeer {
  id: string;
  name: string;
  handle: string;
  connectionType: MeshConnectionType;
  isConnected: boolean;
  lastSeen: number;
  signalStrength?: number;
  capabilities: string[];
  serviceId?: string; // Original ID in the specific service
}

export interface HybridMeshMessage {
  id: string;
  from: string;
  to: string;
  content: string;
  timestamp: number;
  connectionType: MeshConnectionType;
  encrypted: boolean;
}

class HybridMeshService {
  // Track active state of each service
  private activeServices = {
    bluetooth: false,
    webrtc: false,
    wifi: false,
    nostr: false,
    broadcast: false,
    local: false
  };

  private peers: Map<string, HybridMeshPeer> = new Map();
  private isInitialized = false;
  private listeners: { [key: string]: ((data: any) => void)[] } = {};

  async initialize(): Promise<MeshConnectionType[]> {
    try {
      console.log('Initializing hybrid mesh service with 5-layer network...');

      // Check platform
      const isAndroid = /Android/i.test(navigator.userAgent);
      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

      console.log(`Platform detected: ${isAndroid ? 'Android' : isIOS ? 'iOS' : 'Desktop'}`);

      const initializedTypes: MeshConnectionType[] = [];

      // 1. Always start Broadcast Mesh (Foundation Layer)
      console.log('📡 Starting Broadcast Mesh...');
      const broadcastSuccess = await this.startBroadcastMesh();
      if (broadcastSuccess) initializedTypes.push('broadcast');

      // 2. Start WiFi P2P (Local Layer)
      console.log('🏠 Starting WiFi P2P...');
      const wifiSuccess = await this.startWiFiP2P();
      if (wifiSuccess) initializedTypes.push('wifi');

      // 3. Start Nostr (Global Layer)
      console.log('🌍 Starting Nostr Service...');
      const nostrSuccess = await this.startNostr();
      if (nostrSuccess) initializedTypes.push('nostr');

      // 4. Start WebRTC (Regional Layer)
      console.log('🌐 Starting Ably WebRTC...');
      const webRTCSuccess = await this.startWebRTC();
      if (webRTCSuccess) initializedTypes.push('webrtc');

      // 5. Start Bluetooth (Close Range Layer - Android Priority)
      if (isAndroid || 'bluetooth' in navigator) {
        console.log('📱 Starting Bluetooth Mesh...');
        const bluetoothSuccess = await this.startBluetooth();
        if (bluetoothSuccess) initializedTypes.push('bluetooth');
      }

      // If nothing worked, fallback to local test/simulation
      if (initializedTypes.length === 0) {
        console.log('🧪 Falling back to local test mesh...');
        const localSuccess = await this.startLocalTest();
        if (localSuccess) initializedTypes.push('local');
      }

      console.log('✅ Hybrid Mesh Initialized with:', initializedTypes.join(', '));
      this.isInitialized = true;
      return initializedTypes;

    } catch (error) {
      console.error('Hybrid mesh initialization failed:', error);
      return ['local'];
    }
  }

  private async startBroadcastMesh(): Promise<boolean> {
    try {
      const success = await broadcastMesh.initialize();
      if (success) {
        this.activeServices.broadcast = true;

        broadcastMesh.subscribe('peersUpdated', (peers: BroadcastPeer[]) => {
          this.updatePeers(peers, 'broadcast');
        });

        broadcastMesh.subscribe('messageReceived', (msg: any) => {
          this.handleMessage('broadcast', msg);
        });

        return true;
      }
      return false;
    } catch (e) {
      console.error('Broadcast mesh failed:', e);
      return false;
    }
  }

  private async startWiFiP2P(): Promise<boolean> {
    try {
      const success = await wifiP2P.initialize();
      if (success) {
        this.activeServices.wifi = true;
        wifiP2P.startDiscovery();

        wifiP2P.subscribe('peerFound', (peer: WiFiPeer) => {
          this.updateSinglePeer(peer, 'wifi');
        });

        wifiP2P.subscribe('peerConnected', (peer: WiFiPeer) => {
          this.updateSinglePeer(peer, 'wifi');
        });

        wifiP2P.subscribe('messageReceived', (msg: any) => {
          this.handleMessage('wifi', msg);
        });

        return true;
      }
      return false;
    } catch (e) {
      console.error('WiFi P2P failed:', e);
      return false;
    }
  }

  private async startNostr(): Promise<boolean> {
    try {
      const success = await nostrService.initialize();
      if (success) {
        this.activeServices.nostr = true;

        nostrService.subscribe('peerUpdated', (peer: NostrPeer) => {
          this.updateSinglePeer(peer, 'nostr');
        });

        nostrService.subscribe('messageReceived', (msg: any) => {
          this.handleMessage('nostr', msg);
        });

        return true;
      }
      return false;
    } catch (e) {
      console.error('Nostr failed:', e);
      return false;
    }
  }

  private async startWebRTC(): Promise<boolean> {
    try {
      // Use Ably WebRTC implementation
      const keys = ['y_V16g.L7k7_g:h4o_aG0x5r4XqZ5j', 'xitchat-demo-key']; // Demo key, ideally from env
      const success = await ablyWebRTC.initialize(keys[0]);

      if (success) {
        this.activeServices.webrtc = true;

        ablyWebRTC.subscribe('peerJoined', (peer: any) => {
          // Refresh full list slightly inefficient but robust
          this.updatePeers(ablyWebRTC.getPeers(), 'webrtc');
        });

        ablyWebRTC.subscribe('peerLeft', (peer: any) => {
          this.updatePeers(ablyWebRTC.getPeers(), 'webrtc');
        });

        ablyWebRTC.subscribe('messageReceived', (msg: any) => {
          this.handleMessage('webrtc', msg);
        });

        return true;
      }
      return false;
    } catch (e) {
      console.error('WebRTC failed:', e);
      return false;
    }
  }

  private async startBluetooth(): Promise<boolean> {
    try {
      if (!('bluetooth' in navigator)) return false;
      const success = await workingBluetoothMesh.initialize();
      if (success) {
        this.activeServices.bluetooth = true;

        workingBluetoothMesh.subscribe('peersUpdated', (peers: WorkingMeshNode[]) => {
          this.updatePeers(peers, 'bluetooth');
        });

        workingBluetoothMesh.subscribe('messageReceived', (msg: any) => {
          this.handleMessage('bluetooth', msg);
        });

        return true;
      }
      return false;
    } catch (e) {
      console.error('Bluetooth failed:', e);
      return false;
    }
  }

  private async startLocalTest(): Promise<boolean> {
    try {
      const success = await localTestMesh.initialize();
      if (success) {
        this.activeServices.local = true;

        localTestMesh.subscribe('peersUpdated', (peers: LocalMeshNode[]) => {
          this.updatePeers(peers, 'local');
        });

        localTestMesh.subscribe('messageReceived', (msg: any) => {
          this.handleMessage('local', msg);
        });

        return true;
      }
      return false;
    } catch (e) {
      console.error('Local test mesh failed:', e);
      return false;
    }
  }

  private updatePeers(servicePeers: any[], type: MeshConnectionType) {
    servicePeers.forEach(peer => this.updateSinglePeer(peer, type));
    this.notifyPeersUpdated();
  }

  private updateSinglePeer(peer: any, type: MeshConnectionType) {
    // Standardize ID to avoid collision but link to service
    const hybridId = peer.id;

    // Map service specific fields to generic HybridMeshPeer
    let name = peer.name || 'Unknown';
    let handle = peer.handle || '@unknown';
    let lastSeen = peer.lastSeen instanceof Date ? peer.lastSeen.getTime() : (peer.lastSeen || Date.now());
    let isConnected = peer.isConnected !== undefined ? peer.isConnected : true;

    const hybridPeer: HybridMeshPeer = {
      id: hybridId,
      name,
      handle,
      connectionType: type,
      isConnected,
      lastSeen,
      signalStrength: peer.signalStrength,
      capabilities: peer.capabilities || ['chat'],
      serviceId: peer.id
    };

    this.peers.set(hybridId, hybridPeer);
  }

  private handleMessage(connectionType: MeshConnectionType, message: any) {
    const hybridMessage: HybridMeshMessage = {
      id: message.id || Math.random().toString(36),
      from: message.from,
      to: message.to,
      content: message.content,
      timestamp: message.timestamp instanceof Date ? message.timestamp.getTime() : (message.timestamp || Date.now()),
      connectionType,
      encrypted: message.encrypted || false
    };

    this.notifyListeners('messageReceived', hybridMessage);
  }

  async sendMessage(content: string, targetId?: string): Promise<void> {
    try {
      console.log(`📤 Hybrid mesh sending to ${targetId || 'broadcast'}: ${content}`);

      // If target is specified, look up their connection type
      if (targetId) {
        const peer = this.peers.get(targetId);
        if (peer) {
          // Route to specific service
          console.log(`📍 Routing message via ${peer.connectionType}`);
          switch (peer.connectionType) {
            case 'bluetooth': await workingBluetoothMesh.sendMessage(peer.serviceId!, content); break;
            case 'wifi': await wifiP2P.sendMessage(peer.serviceId!, content); break;
            case 'nostr': await nostrService.sendDirectMessage(peer.serviceId!, content); break;
            case 'webrtc': await ablyWebRTC.sendMessage(content); break; // Note: current Ably impl broadcasts to channel mostly, but supports direct if modified. Using broadcast for now as fallback.
            case 'broadcast': await broadcastMesh.sendMessage(peer.serviceId!, content); break;
            case 'local': await localTestMesh.sendMessage(peer.serviceId!, content); break;
          }
          return;
        }
      }

      // If Broadcast or Unknown Peer, send via ALL active channels (Smart Broadcast)
      const promises: Promise<void>[] = [];

      if (this.activeServices.broadcast) promises.push(broadcastMesh.broadcastMessage(content));
      if (this.activeServices.wifi) promises.push(Promise.resolve(wifiP2P.sendMessage('broadcast', content)).then(() => { }));
      if (this.activeServices.nostr) {
        // For nostr, "broadcast" usually means posting to a public channel or kind 1 note.
        // Here we might skip or post to a default channel if implemented.
        // nostrService.publishChannelMessage(...) 
      }
      if (this.activeServices.webrtc) promises.push(Promise.resolve(ablyWebRTC.sendMessage(content)));
      if (this.activeServices.bluetooth) {
        // Bluetooth often requires a target, but we can iterate peers
        Array.from(this.peers.values()).filter(p => p.connectionType === 'bluetooth').forEach(p => {
          promises.push(workingBluetoothMesh.sendMessage(p.serviceId!, content).then(() => { }));
        });
      }
      if (this.activeServices.local) promises.push(localTestMesh.sendMessage(undefined, content).then(() => { }));

      await Promise.allSettled(promises);

    } catch (error) {
      console.error('Failed to send hybrid message:', error);
    }
  }

  // GETTERS
  getPeers(): HybridMeshPeer[] {
    return Array.from(this.peers.values());
  }

  getActiveServices() {
    return this.activeServices;
  }

  getConnectionInfo() {
    return {
      isConnected: Object.values(this.activeServices).some(s => s),
      activeServices: this.activeServices,
      peerCount: this.peers.size,
      initialized: this.isInitialized
    };
  }

  // EVENT LISTENERS
  subscribe(event: string, callback: (data: any) => void): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);

    return () => {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    };
  }

  private notifyPeersUpdated(): void {
    const peers = this.getPeers();
    // Debounce slightly if needed, but for now direct dispatch
    window.dispatchEvent(new CustomEvent('hybridPeersUpdated', {
      detail: peers
    }));
    this.notifyListeners('peersUpdated', peers);
  }

  private notifyListeners(event: string, data: any) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(data));
    }
  }
}

export const hybridMesh = new HybridMeshService();
