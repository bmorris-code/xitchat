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
import { androidPermissions } from './androidPermissions';

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
    console.log('--- HYBRID MESH INITIALIZE CALLED ---');
    try {
      console.log('🔥 Initializing SERVERLESS mesh messaging...');

      // ANDROID SERVERLESS: Focus on direct P2P connections only
      const isNativeAndroid = (window as any).Capacitor?.isNativePlatform() && (window as any).Capacitor?.getPlatform() === 'android';
      
      if (isNativeAndroid) {
        console.log('📱 Android: Starting TRUE serverless mesh (Bluetooth + WiFi Direct + Nostr)');
        // Request critical permissions for direct P2P
        console.log('🔐 Requesting Android hardware permissions for direct P2P...');
        await androidPermissions.requestAllCriticalPermissions();
      } else {
        console.log('🌐 Web: Using mesh simulation + Nostr');
      }

      const initializedTypes: MeshConnectionType[] = [];

      // 1. Start Nostr (global serverless mesh - works everywhere)
      const nostrSuccess = await this.startNostr();
      if (nostrSuccess) initializedTypes.push('nostr');

      // 2. Start Broadcast Mesh (local same-device - works everywhere)
      const broadcastSuccess = await this.startBroadcastMesh();
      if (broadcastSuccess) initializedTypes.push('broadcast');

      // ANDROID SERVERLESS: Only use direct P2P on Android
      if (isNativeAndroid) {
        // 3. Start WiFi Direct (direct P2P - no server)
        console.log('📡 Starting WiFi Direct (serverless P2P)...');
        const wifiSuccess = await this.startWiFiP2P();
        console.log('✅ WiFi Direct P2P initialized:', wifiSuccess);
        if (wifiSuccess) initializedTypes.push('wifi');

        // 4. Start Bluetooth Mesh (direct P2P - no server)  
        console.log('🔵 Starting Bluetooth Mesh (serverless P2P)...');
        const bluetoothSuccess = await this.startBluetooth();
        console.log('✅ Bluetooth Mesh P2P initialized:', bluetoothSuccess);
        if (bluetoothSuccess) initializedTypes.push('bluetooth');

        // NO WEBRTC ON ANDROID - It requires servers
        console.log('� Skipping WebRTC on Android (requires server - using true P2P instead)');
      } else {
        // Web-only: Use WebRTC simulation
        console.log('🌐 Web: Using WebRTC simulation...');
        const webrtcSuccess = await this.startWebRTC();
        if (webrtcSuccess) initializedTypes.push('webrtc');
      }

      this.isInitialized = true;
      console.log('🔥 SERVERLESS MESH INITIALIZATION COMPLETE ---', initializedTypes);
      console.log('📡 Active networks:', initializedTypes.join(', '));
      return initializedTypes;
    } catch (error) {
      console.error('Serverless mesh initialization failed:', error);
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

        // Auto-start scanning if possible (on native platforms)
        workingBluetoothMesh.startScanning().catch(e => console.log('Bluetooth auto-scan skipped:', e));

        return true;
      }
      return false;
    } catch (e) { return false; }
  }

  private async startWebRTC(): Promise<boolean> {
    try {
      const apiKey = import.meta.env.VITE_ABLY_API_KEY;
      if (!apiKey) {
        console.debug('ℹ️ VITE_ABLY_API_KEY not found, WebRTC layer skipped (add to .env.local to enable)');
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

  // Public method to add external peers (from radar, etc.)
  public addExternalPeer(peer: Partial<HybridMeshPeer>, connectionType: MeshConnectionType) {
    const hybridPeer: HybridMeshPeer = {
      id: peer.id || 'unknown',
      name: peer.name || 'Unknown',
      handle: peer.handle || '@unknown',
      connectionType: connectionType,
      isConnected: peer.isConnected !== undefined ? peer.isConnected : true,
      lastSeen: peer.lastSeen || Date.now(),
      signalStrength: peer.signalStrength,
      capabilities: peer.capabilities || ['chat'],
      serviceId: peer.serviceId || peer.id
    };
    this.peers.set(hybridPeer.id, hybridPeer);
    this.notifyPeersUpdated();
    console.log(`🔗 External peer added to hybrid mesh: ${hybridPeer.handle} via ${connectionType}`);
  }

  private handleChatMessage(content: string, from: string, connectionType: MeshConnectionType) {
    const hybridMessage: HybridMeshMessage = {
      id: Math.random().toString(36).substr(2, 9),
      from: from,
      to: 'me',
      content: content,
      timestamp: Date.now(),
      connectionType: connectionType,
      encrypted: false,
      isBridged: false
    };

    // Emit message for chat system to handle
    this.notifyListeners('messageReceived', hybridMessage);

    // CRITICAL: Handle bridging to relay this message to other network layers
    if (this.isBridgeEnabled) {
      this.handleBridging(hybridMessage);
    }

    console.log(`💬 Chat message received from ${from} via ${connectionType}: ${content.substring(0, 50)}...`);
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
            timestamp: parsed.timestamp,
            messageId: parsed.messageId
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
              window.dispatchEvent(new CustomEvent('meshTradeRequest', { detail: { ...inner.data, fromNode: message.from } }));
              return;
            }
            if (inner.type === 'trade_response') {
              window.dispatchEvent(new CustomEvent('meshTradeResponse', { detail: inner.data }));
              return;
            }
            if (inner.type === 'chat_message') {
              // Handle chat messages from radar peers
              this.handleChatMessage(inner.data, message.from, connectionType);
              return;
            }
          }
        }
      }

      // Handle regular chat messages
      this.handleChatMessage(content, message.from, connectionType);

    } catch (error) {
      console.error('Failed to parse hybrid mesh message:', error, content);
    }
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
        timestamp: Date.now(),
        messageId: Math.random().toString(36).substr(2, 9)
      });

      console.log('📨 Sending message:', { targetId, content: content.substring(0, 50), networks: this.getActiveServices() });

      if (targetId) {
        const peer = this.peers.get(targetId);
        if (peer) {
          console.log(`🎯 Targeted message to ${targetId} via ${peer.connectionType}`);

          // Try primary network first
          let success = false;
          switch (peer.connectionType) {
            case 'bluetooth':
              success = await workingBluetoothMesh.sendMessage(peer.serviceId!, payload).then(() => true).catch(e => false);
              break;
            case 'wifi':
              success = await wifiP2P.sendMessage(peer.serviceId!, payload).then(() => true).catch(e => false);
              break;
            case 'nostr':
              success = await nostrService.sendDirectMessage(peer.serviceId!, payload).then(() => true).catch(e => false);
              break;
            case 'broadcast':
              success = await broadcastMesh.sendMessage(peer.serviceId!, payload).then(() => true).catch(e => false);
              break;
            case 'webrtc':
              try {
                await ablyWebRTC.sendMessage(payload);
                success = true;
              } catch (e) {
                success = false;
              }
              break;
          }

          // If primary network fails, try fallback networks
          if (!success) {
            console.log(`⚠️ Primary network ${peer.connectionType} failed, trying fallback networks...`);

            // Try Nostr as universal fallback
            if (this.activeServices.nostr && peer.connectionType !== 'nostr') {
              console.log('🔄 Trying Nostr fallback...');
              await nostrService.sendDirectMessage(peer.serviceId!, payload).catch(() => { });
            }

            // Try Broadcast as another fallback
            if (this.activeServices.broadcast && peer.connectionType !== 'broadcast') {
              console.log('🔄 Trying Broadcast fallback...');
              await broadcastMesh.sendMessage(peer.serviceId!, payload).catch(() => { });
            }
          }
          return;
        } else {
          // Fallback: If peer not found in mesh map, but looks like a valid ID and Nostr is active, try Nostr
          if (this.activeServices.nostr) {
            console.log(`⚠️ Peer ${targetId} not found in mesh map, falling back to direct Nostr send`);
            nostrService.sendDirectMessage(targetId, payload).catch(e => console.error('Fallback Nostr send failed:', e));
            return;
          }
          console.warn(`⚠️ Peer ${targetId} not found in hybrid mesh and no fallback available`);
        }
      }

      // Broadcast to all active services with enhanced reliability
      const broadcastPromises = [];

      if (this.activeServices.broadcast) {
        broadcastPromises.push(broadcastMesh.broadcastMessage(payload).catch(e => console.log('Broadcast failed:', e)));
      }
      if (this.activeServices.wifi) {
        broadcastPromises.push(wifiP2P.sendMessage('broadcast', payload).catch(e => console.log('WiFi P2P failed:', e)));
      }
      if (this.activeServices.nostr) {
        broadcastPromises.push(nostrService.broadcastMessage(payload).catch(e => console.log('Nostr broadcast failed:', e)));
      }
      if (this.activeServices.bluetooth) {
        const bluetoothPeers = Array.from(this.peers.values())
          .filter(p => p.connectionType === 'bluetooth');
        bluetoothPeers.forEach(p => {
          broadcastPromises.push(workingBluetoothMesh.sendMessage(p.serviceId!, payload).catch(e => console.log('Bluetooth failed:', e)));
        });
      }
      if (this.activeServices.webrtc) {
        try {
          await ablyWebRTC.sendMessage(payload);
          broadcastPromises.push(Promise.resolve());
        } catch (e) {
          broadcastPromises.push(Promise.reject(e));
          console.log('WebRTC failed:', e);
        }
      }

      // Wait for all broadcasts with timeout
      await Promise.allSettled(broadcastPromises);
      console.log('📡 Message broadcasted to all active networks');

    } catch (error) {
      console.error('❌ Failed to send hybrid message:', error);
      throw error;
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
