// Hybrid Mesh Service - Bluetooth + WebRTC + Broadcast + WiFi P2P + Nostr
// Automatically chooses best available P2P method and combines them

import { workingBluetoothMesh, WorkingMeshNode } from './workingBluetoothMesh';
import { wifiP2P, WiFiPeer } from './wifiP2P';
import { nostrService, NostrPeer } from './nostrService';
import { broadcastMesh, BroadcastPeer } from './broadcastMesh';
import { localTestMesh, LocalMeshNode } from './localTestMesh';
import { realtimeRadar } from './realtimeRadar';
import { realTorService } from './realTorService';
import { realPowService } from './realPowService';
import { ablyWebRTC } from './ablyWebRTC';
import { networkStateManager } from './networkStateManager';

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
  isBridged?: boolean;
  tor?: boolean;
  pow?: any;
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
  private bridgeStats = { bridgedIn: 0, bridgedOut: 0 };
  private isBridgeEnabled = true;
  getDeviceCompatibility: any;

  async initialize(): Promise<MeshConnectionType[]> {
    try {
      console.log('Initializing hybrid mesh service with 5-layer network...');

      const initializedTypes: MeshConnectionType[] = [];

      // 1. Start Nostr (so it's ready for Broadcast Mesh)
      const nostrSuccess = await this.startNostr();
      if (nostrSuccess) initializedTypes.push('nostr');

      // 2. Start Broadcast Mesh
      const broadcastSuccess = await this.startBroadcastMesh();
      if (broadcastSuccess) initializedTypes.push('broadcast');

      // 3. Start WiFi P2P
      const wifiSuccess = await this.startWiFiP2P();
      if (wifiSuccess) initializedTypes.push('wifi');

      // 4. Start Bluetooth
      const bluetoothSuccess = await this.startBluetooth();
      if (bluetoothSuccess) initializedTypes.push('bluetooth');

      // 5. Start WebRTC (Ably)
      const webrtcSuccess = await this.startWebRTC();
      if (webrtcSuccess) initializedTypes.push('webrtc');

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
        broadcastMesh.subscribe('peersUpdated', (peers: BroadcastPeer[]) => this.updatePeers(peers, 'broadcast'));
        broadcastMesh.subscribe('messageReceived', (msg: any) => this.handleMessage('broadcast', msg));

        // Register with network state manager
        networkStateManager.registerService({
          name: 'broadcast',
          isConnected: true,
          isHealthy: true,
          lastCheck: Date.now(),
          reconnectAttempts: 0,
          maxReconnectAttempts: 1,
          reconnectDelay: 1000
        });

        return true;
      }
      return false;
    } catch (e) { return false; }
  }

  private async startWiFiP2P(): Promise<boolean> {
    try {
      const success = await wifiP2P.initialize();
      if (success) {
        this.activeServices.wifi = true;
        wifiP2P.startDiscovery();
        wifiP2P.subscribe('peerFound', (peer: WiFiPeer) => this.updateSinglePeer(peer, 'wifi'));
        wifiP2P.subscribe('messageReceived', (msg: any) => this.handleMessage('wifi', msg));
        return true;
      }
      return false;
    } catch (e) { return false; }
  }

  private async startNostr(): Promise<boolean> {
    try {
      const success = await nostrService.initialize();
      if (success) {
        this.activeServices.nostr = true;
        nostrService.subscribe('peerUpdated', (peer: NostrPeer) => this.updateSinglePeer(peer, 'nostr'));
        nostrService.subscribe('messageReceived', (msg: any) => this.handleMessage('nostr', msg));
        return true;
      }
      return false;
    } catch (e) { return false; }
  }

  private async startBluetooth(): Promise<boolean> {
    try {
      const success = await workingBluetoothMesh.initialize();
      if (success) {
        this.activeServices.bluetooth = true;
        workingBluetoothMesh.subscribe('peersUpdated', (peers: WorkingMeshNode[]) => this.updatePeers(peers, 'bluetooth'));
        workingBluetoothMesh.subscribe('messageReceived', (msg: any) => this.handleMessage('bluetooth', msg));
        return true;
      }
      return false;
    } catch (e) { return false; }
  }

  private async startWebRTC(): Promise<boolean> {
    try {
      const apiKey = import.meta.env.VITE_ABLY_API_KEY;
      if (!apiKey) {
        console.warn('⚠️ VITE_ABLY_API_KEY not found, WebRTC layer skipped');
        return false;
      }
      const success = await ablyWebRTC.initialize(apiKey);
      if (success) {
        this.activeServices.webrtc = true;
        ablyWebRTC.subscribe('messageReceived', (msg: any) => this.handleMessage('webrtc', msg));
        // Note: ablyWebRTC manages its own peers, but we could sync them here if needed
        return true;
      }
      return false;
    } catch (e) { return false; }
  }

  private updatePeers(servicePeers: any[], type: MeshConnectionType) {
    servicePeers.forEach(peer => this.updateSinglePeer(peer, type));
    this.notifyPeersUpdated();
  }

  private updateSinglePeer(peer: any, type: MeshConnectionType) {
    const hybridPeer: HybridMeshPeer = {
      id: peer.id,
      name: peer.name || 'Unknown',
      handle: peer.handle || '@unknown',
      connectionType: type,
      isConnected: peer.isConnected !== undefined ? peer.isConnected : true,
      lastSeen: peer.lastSeen instanceof Date ? peer.lastSeen.getTime() : (peer.lastSeen || Date.now()),
      signalStrength: peer.signalStrength,
      capabilities: peer.capabilities || ['chat'],
      serviceId: peer.id
    };
    this.peers.set(peer.id, hybridPeer);
  }

  private handleMessage(connectionType: MeshConnectionType, message: any) {
    let content = message.content;
    let metadata: any = {};

    try {
      if (content.startsWith('{')) {
        const parsed = JSON.parse(content);

        // Check if this is a wrapped payload from sendMessage
        if (parsed.content !== undefined && parsed.timestamp !== undefined) {
          content = parsed.content;
          metadata = {
            tor: parsed.tor,
            pow: parsed.pow,
            timestamp: parsed.timestamp
          };

          // Re-parse the inner content if it's JSON
          if (content.startsWith('{')) {
            const inner = JSON.parse(content);

            if (inner.type === 'mesh_data') {
              window.dispatchEvent(new CustomEvent('meshDataReceived', {
                detail: { ...message, content: inner }
              }));
              return;
            }

            if (inner.type === 'location_update') {
              realtimeRadar.handleMeshLocationUpdate(inner.data);
              return;
            }
            if (inner.type === 'ai_request') {
              window.dispatchEvent(new CustomEvent('meshAIRequest', { detail: { ...inner.data, fromNode: message.from } }));
              return;
            }
            if (inner.type === 'ai_response') {
              window.dispatchEvent(new CustomEvent('meshAIResponse', { detail: inner.data }));
              return;
            }
            if (inner.type === 'payment_request') {
              window.dispatchEvent(new CustomEvent('meshPaymentRequest', { detail: { ...inner.data, fromNode: message.from } }));
              return;
            }
            if (inner.type === 'payment_response') {
              window.dispatchEvent(new CustomEvent('meshPaymentResponse', { detail: inner.data }));
              return;
            }
            if (inner.type === 'marketplace_listing') {
              window.dispatchEvent(new CustomEvent('meshMarketplaceListing', { detail: inner.data }));
              return;
            }
            if (inner.type === 'trade_request') {
              window.dispatchEvent(new CustomEvent('meshTradeRequest', { detail: inner.data }));
              return;
            }
          }
        }
      }
    } catch (e) { }

    const hybridMessage: HybridMeshMessage = {
      id: message.id || Math.random().toString(36),
      from: message.from,
      to: message.to,
      content,
      timestamp: metadata.timestamp || (message.timestamp instanceof Date ? message.timestamp.getTime() : (message.timestamp || Date.now())),
      connectionType,
      encrypted: message.encrypted || false,
      isBridged: message.isBridged || false,
      tor: metadata.tor,
      pow: metadata.pow
    };

    if (this.isBridgeEnabled) {
      this.handleBridging(hybridMessage);
    }

    this.notifyListeners('messageReceived', hybridMessage);
  }

  private handleBridging(message: HybridMeshMessage) {
    const activeCount = Object.values(this.activeServices).filter(v => v).length;
    if (activeCount < 2 || message.isBridged) return;

    const isLocalSource = message.connectionType === 'bluetooth' || message.connectionType === 'wifi';

    if (isLocalSource && this.activeServices.nostr) {
      console.log(`📡 Bridging message from ${message.from} to Nostr layer`);
      this.bridgeStats.bridgedOut++;
      nostrService.broadcastMessage(JSON.stringify({ ...message, isBridged: true }));
    }

    if (message.connectionType === 'nostr' && (this.activeServices.bluetooth || this.activeServices.wifi)) {
      console.log(`📡 Bridging message from Nostr to local mesh`);
      this.bridgeStats.bridgedIn++;
      const bridged = JSON.stringify({ ...message, isBridged: true });
      if (this.activeServices.bluetooth) {
        Array.from(this.peers.values())
          .filter(p => p.connectionType === 'bluetooth')
          .forEach(p => workingBluetoothMesh.sendMessage(p.serviceId!, bridged).catch(() => { }));
      }
      if (this.activeServices.wifi) {
        wifiP2P.sendMessage('broadcast', bridged).catch(() => { });
      }
    }
  }

  async sendMessage(content: string, targetId?: string, encryptedData?: any): Promise<void> {
    try {
      let torEnabled = realTorService.getStatus().connected;
      let powSolution = undefined;

      const payload = JSON.stringify({
        content,
        encryptedData,
        tor: torEnabled,
        pow: powSolution,
        timestamp: Date.now()
      });

      if (targetId) {
        const peer = this.peers.get(targetId);
        if (peer) {
          switch (peer.connectionType) {
            case 'bluetooth': await workingBluetoothMesh.sendMessage(peer.serviceId!, payload); break;
            case 'wifi': await wifiP2P.sendMessage(peer.serviceId!, payload); break;
            case 'nostr': await nostrService.sendDirectMessage(peer.serviceId!, payload); break;
            case 'broadcast': await broadcastMesh.sendMessage(peer.serviceId!, payload); break;
            case 'webrtc': await ablyWebRTC.sendMessage(payload); break;
          }
          return;
        }
      }

      // Broadcast to all active services
      if (this.activeServices.broadcast) broadcastMesh.broadcastMessage(payload).catch(() => { });
      if (this.activeServices.wifi) wifiP2P.sendMessage('broadcast', payload).catch(() => { });
      if (this.activeServices.nostr) nostrService.broadcastMessage(payload).catch(() => { });
      if (this.activeServices.bluetooth) {
        Array.from(this.peers.values())
          .filter(p => p.connectionType === 'bluetooth')
          .forEach(p => workingBluetoothMesh.sendMessage(p.serviceId!, payload).catch(() => { }));
      }
      if (this.activeServices.webrtc) ablyWebRTC.sendMessage(payload);
    } catch (error) {
      console.error('Failed to send hybrid message:', error);
    }
  }

  getPeers(): HybridMeshPeer[] { return Array.from(this.peers.values()); }
  getActiveServices() { return this.activeServices; }
  getConnectionInfo() {
    const status = networkStateManager.getStatus();
    return {
      isConnected: status.isOnline || status.activeServices.length > 0,
      activeServices: this.activeServices,
      peerCount: this.peers.size,
      initialized: this.isInitialized,
      overallHealth: status.overallHealth
    };
  }
  getBridgeStats() { return this.bridgeStats; }
  setBridgeEnabled(enabled: boolean) { this.isBridgeEnabled = enabled; }
  isConnectedToMesh() {
    return networkStateManager.hasAnyConnection() || Object.values(this.activeServices).some(s => s);
  }

  subscribe(event: string, callback: (data: any) => void): () => void {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
    return () => { this.listeners[event] = this.listeners[event].filter(cb => cb !== callback); };
  }

  private notifyPeersUpdated(): void {
    const peers = this.getPeers();
    window.dispatchEvent(new CustomEvent('hybridPeersUpdated', { detail: peers }));
    this.notifyListeners('peersUpdated', peers);
  }

  private notifyListeners(event: string, data: any) {
    if (this.listeners[event]) this.listeners[event].forEach(callback => callback(data));
  }
}

export const hybridMesh = new HybridMeshService();
