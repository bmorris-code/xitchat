// Hybrid Mesh Service - Bluetooth + WebRTC + Broadcast + WiFi P2P + Nostr
// Automatically chooses best available P2P method and combines them

import { workingBluetoothMesh, WorkingMeshNode } from './workingBluetoothMesh';
import { wifiP2P, WiFiPeer } from './wifiP2P';
import { nostrService, NostrPeer } from './nostrService';
import { broadcastMesh, BroadcastPeer } from './broadcastMesh';
import { realtimeRadar } from './realtimeRadar';
import { realTorService } from './realTorService';
import { realPowService } from './realPowService';
import { ablyWebRTC } from './ablyWebRTC';
import { networkStateManager } from './networkStateManager';
import { androidPermissions } from './androidPermissions';
import { presenceBeacon } from './presenceBeacon';

export type MeshConnectionType = 'bluetooth' | 'webrtc' | 'broadcast' | 'wifi' | 'nostr';

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
  senderHandle?: string;
  senderName?: string;
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

  private fallbackHandle(id?: string): string {
    const source = (id || 'peer').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const shortId = source.slice(0, 8) || 'peer';
    return `@${shortId}`;
  }

  private fallbackName(id?: string): string {
    const source = (id || 'peer').replace(/[^a-zA-Z0-9]/g, '');
    const shortId = source.slice(0, 8) || 'peer';
    return `Peer ${shortId}`;
  }

  private isLikelyNostrId(id?: string): boolean {
    if (!id) return false;
    return /^[0-9a-f]{64}$/i.test(id) || id.startsWith('npub');
  }

  private isLikelyLocalNetworkAddress(id?: string): boolean {
    if (!id) return false;
    const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/;
    const mac = /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/i;
    return ipv4.test(id) || mac.test(id);
  }

  private getConnectedWifiServiceIds(): string[] {
    return Array.from(this.peers.values())
      .filter(p => p.connectionType === 'wifi' && p.isConnected && !!p.serviceId)
      .map(p => p.serviceId!);
  }

  private normalizePeerName(name: any, id: string): string {
    const text = typeof name === 'string' ? name.trim() : '';
    if (!text || /^unknown$/i.test(text) || /^null$/i.test(text)) {
      return this.fallbackName(id);
    }
    return text;
  }

  private normalizePeerHandle(handle: any, id: string): string {
    const text = typeof handle === 'string' ? handle.trim() : '';
    if (!text || /^@?unknown$/i.test(text) || /^@?null$/i.test(text)) {
      return this.fallbackHandle(id);
    }
    return text.startsWith('@') ? text : `@${text}`;
  }

  private updatePeerIdentityFromMessage(
    fromId: string,
    serviceId: string | undefined,
    senderHandle?: string,
    senderName?: string
  ): void {
    if (!fromId) return;
    const current = this.peers.get(fromId);
    const normalizedHandle = senderHandle ? this.normalizePeerHandle(senderHandle, fromId) : undefined;
    const normalizedName = senderName ? this.normalizePeerName(senderName, fromId) : undefined;

    if (current) {
      const nextHandle = normalizedHandle || current.handle;
      const nextName = normalizedName || current.name;
      if (nextHandle !== current.handle || nextName !== current.name) {
        this.peers.set(fromId, { ...current, handle: nextHandle, name: nextName, lastSeen: Date.now() });
        this.notifyPeersUpdated();
      }
      return;
    }

    if (!normalizedHandle && !normalizedName) return;
    this.peers.set(fromId, {
      id: fromId,
      name: normalizedName || this.fallbackName(fromId),
      handle: normalizedHandle || this.fallbackHandle(fromId),
      connectionType: 'bluetooth',
      isConnected: true,
      lastSeen: Date.now(),
      capabilities: ['chat'],
      serviceId: serviceId || fromId
    });
    this.notifyPeersUpdated();
  }

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
        console.log('🌐 Web: Using real mesh transports available in browser + Nostr');
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
        // Web-only: Use WebRTC if configured
        console.log('🌐 Web: Using WebRTC when configured...');
        const webrtcSuccess = await this.startWebRTC();
        if (webrtcSuccess) initializedTypes.push('webrtc');
      }

      this.isInitialized = true;
      console.log('🔥 SERVERLESS MESH INITIALIZATION COMPLETE ---', initializedTypes);
      console.log('📡 Active networks:', initializedTypes.join(', '));
      return initializedTypes;
    } catch (error) {
      console.error('Serverless mesh initialization failed:', error);
      return [];
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
    const peerId = peer.id || 'peer';
    const hybridPeer: HybridMeshPeer = {
      id: peerId,
      name: this.normalizePeerName(peer.name, peerId),
      handle: this.normalizePeerHandle(peer.handle, peerId),
      connectionType: type,
      isConnected: peer.isConnected !== undefined ? peer.isConnected : true,
      lastSeen: peer.lastSeen instanceof Date ? peer.lastSeen.getTime() : (peer.lastSeen || Date.now()),
      signalStrength: peer.signalStrength,
      capabilities: peer.capabilities || ['chat'],
      serviceId: peer.id
    };
    this.peers.set(peerId, hybridPeer);

    // CRITICAL: Add discovered peer to presence beacon for radar visibility
    this.addPeerToPresenceBeacon(hybridPeer, type);
  }

  private addPeerToPresenceBeacon(peer: HybridMeshPeer, connectionType: MeshConnectionType): void {
    try {
      // Convert hybrid mesh peer to presence beacon format
      const presencePeer = {
        pubkey: peer.id,
        device: 'mobile' as const,
        role: 'edge' as const,
        caps: [...(connectionType === 'bluetooth' ? ['bluetooth'] as const : 
              connectionType === 'wifi' ? ['wifi'] as const :
              connectionType === 'nostr' ? ['nostr'] as const :
              ['broadcast'] as const)],
        rooms: ['global'],
        lastSeen: peer.lastSeen,
        ttl: 45, // 45 seconds TTL for mobile peers
        signalStrength: peer.signalStrength,
        geohash: '11001', // Default geohash for testing
        timestamp: Date.now()
      };

      // Add to presence beacon - this will trigger radar updates
      presenceBeacon.addExternalPeer(presencePeer);
      console.log(`🔗 Added ${peer.handle} to presence beacon via ${connectionType}`);
    } catch (error) {
      console.debug('Failed to add peer to presence beacon:', error);
    }
  }

  // Public method to add external peers (from radar, etc.)
  public addExternalPeer(peer: Partial<HybridMeshPeer>, connectionType: MeshConnectionType) {
    const peerId = peer.id || 'peer';
    const hybridPeer: HybridMeshPeer = {
      id: peerId,
      name: this.normalizePeerName(peer.name, peerId),
      handle: this.normalizePeerHandle(peer.handle, peerId),
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

  private handleChatMessage(
    content: string,
    from: string,
    connectionType: MeshConnectionType,
    metadata?: { messageId?: string; timestamp?: number; senderHandle?: string; senderName?: string }
  ) {
    const hybridMessage: HybridMeshMessage = {
      id: metadata?.messageId || Math.random().toString(36).substr(2, 9),
      from: from,
      to: 'me',
      content: content,
      timestamp: metadata?.timestamp || Date.now(),
      connectionType: connectionType,
      encrypted: false,
      isBridged: false,
      senderHandle: metadata?.senderHandle,
      senderName: metadata?.senderName
    };

    // Emit message for chat system to handle
    this.notifyListeners('messageReceived', hybridMessage);

    // CRITICAL: Handle bridging to relay this message to other network layers
    if (this.isBridgeEnabled) {
      this.handleBridging(hybridMessage);
    }

    console.log(`💬 Chat message received from ${from} via ${connectionType}: ${content.substring(0, 50)}...`);
  }

  private tryParseJsonWithRecovery(raw: string): any | null {
    const text = (raw || '').trim();
    if (!text) return null;

    try {
      return JSON.parse(text);
    } catch {
      // Some BLE packets arrive missing a trailing brace.
      if (text.startsWith('{') && !text.endsWith('}')) {
        try {
          return JSON.parse(`${text}}`);
        } catch {
          return null;
        }
      }
      return null;
    }
  }

  private extractWrappedContentFallback(raw: string): { content: string; metadata: any } | null {
    const match = raw.match(/"content":"((?:\\.|[^"\\])*)"/);
    if (!match) return null;

    try {
      const content = JSON.parse(`"${match[1]}"`);
      const metadata: any = {};
      const tsMatch = raw.match(/"timestamp":(\d+)/);
      const idMatch = raw.match(/"messageId":"([^"]+)"/);
      if (tsMatch) metadata.timestamp = Number(tsMatch[1]);
      if (idMatch) metadata.messageId = idMatch[1];
      return { content, metadata };
    } catch {
      return null;
    }
  }

  private handleMessage(connectionType: MeshConnectionType, message: any) {
    let content = message.content;
    let metadata: any = {};

    try {
      if (content.startsWith('{')) {
        const parsed = this.tryParseJsonWithRecovery(content);

        if (parsed && parsed.content !== undefined && parsed.timestamp !== undefined) {
          content = parsed.content;
          metadata = {
            tor: parsed.tor,
            pow: parsed.pow,
            timestamp: parsed.timestamp,
            messageId: parsed.messageId
          };
        } else if (!parsed) {
          const recovered = this.extractWrappedContentFallback(content);
          if (recovered) {
            content = recovered.content;
            metadata = recovered.metadata;
          }
        }

        // Re-parse the inner content if it's JSON
        if (content.startsWith('{')) {
          const inner = this.tryParseJsonWithRecovery(content);
          if (!inner) throw new Error('Invalid inner mesh JSON payload');

          if (inner.type === 'mesh_data') {
            const payload = inner.payload;
            const meshType = payload?.type;
            const chatData = payload?.data;
            const chatMessage = chatData?.message ?? chatData;
            const senderHandle = chatMessage?.senderHandle || chatData?.participant?.handle;
            const senderName = chatData?.participant?.name;

            if (meshType === 'chat_message') {
              if (senderHandle || senderName) {
                this.updatePeerIdentityFromMessage(message.from, message.from, senderHandle, senderName);
              }

              const chatText =
                (typeof chatMessage?.text === 'string' && chatMessage.text) ||
                (typeof chatData?.text === 'string' && chatData.text) ||
                '';

              if (chatText) {
                this.handleChatMessage(chatText, message.from, connectionType, {
                  messageId: chatMessage?.id || payload?.id || metadata?.messageId,
                  timestamp: chatMessage?.timestamp || payload?.timestamp || metadata?.timestamp || Date.now(),
                  senderHandle,
                  senderName
                });
              }
            }

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
            const text =
              (typeof inner.data === 'string' && inner.data) ||
              (typeof inner.data?.text === 'string' && inner.data.text) ||
              '';
            const senderHandle =
              (typeof inner.data?.senderHandle === 'string' && inner.data.senderHandle) ||
              (typeof inner.senderHandle === 'string' && inner.senderHandle) ||
              undefined;
            const senderName =
              (typeof inner.data?.senderName === 'string' && inner.data.senderName) ||
              (typeof inner.senderName === 'string' && inner.senderName) ||
              undefined;

            if (senderHandle || senderName) {
              this.updatePeerIdentityFromMessage(message.from, message.from, senderHandle, senderName);
            }

            if (!text) return;
            this.handleChatMessage(text, message.from, connectionType, {
              ...metadata,
              senderHandle,
              senderName
            });
            return;
          }
          if (inner.type === 'ack' && inner.messageId) {
            this.notifyListeners('ackReceived', {
              messageId: inner.messageId,
              from: message.from,
              timestamp: inner.timestamp || Date.now(),
              connectionType
            });
            return;
          }
          if (typeof inner.type === 'string') {
            // Do not treat control packets as user chat messages.
            return;
          }
        }
      }

      // Handle regular chat messages
      this.handleChatMessage(content, message.from, connectionType, metadata);

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
      void nostrService.broadcastMessage(JSON.stringify({ ...message, isBridged: true })).catch((error) => {
        console.debug('Bridge to Nostr skipped:', error);
      });
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
        Array.from(this.peers.values())
          .filter(p => p.connectionType === 'wifi' && !!p.serviceId)
          .forEach(p => wifiP2P.sendMessage(p.serviceId!, bridged).catch(() => { }));
      }
    }
  }

  async sendMessage(content: string, targetId?: string, encryptedData?: any, messageId?: string): Promise<void> {
    try {
      const torEnabled = realTorService.getStatus().connected;
      const powSolution = undefined;

      const payload = JSON.stringify({
        content,
        encryptedData,
        tor: torEnabled,
        pow: powSolution,
        timestamp: Date.now(),
        messageId: messageId || Math.random().toString(36).substr(2, 9)
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
              success = peer.serviceId
                ? await workingBluetoothMesh.sendMessage(peer.serviceId, payload).then(() => true).catch(() => false)
                : false;
              if (success) console.log(`✅ Message sent via Bluetooth to ${peer.handle}`);
              break;
            case 'wifi':
              success = peer.serviceId
                ? await wifiP2P.sendMessage(peer.serviceId, payload).then(() => true).catch(() => false)
                : false;
              if (success) console.log(`✅ Message sent via WiFi P2P to ${peer.handle}`);
              break;
            case 'nostr':
              success = peer.serviceId
                ? await nostrService.sendDirectMessage(peer.serviceId, payload).then(() => true).catch(() => false)
                : false;
              if (success) console.log(`✅ Message sent via Nostr to ${peer.handle}`);
              break;
            case 'broadcast':
              success = peer.serviceId
                ? await broadcastMesh.sendMessage(peer.serviceId, payload).then(() => true).catch(() => false)
                : false;
              if (success) console.log(`✅ Message sent via Broadcast to ${peer.handle}`);
              break;
            case 'webrtc':
              try {
                await ablyWebRTC.sendMessage(payload);
                success = true;
                console.log(`✅ Message sent via WebRTC to ${peer.handle}`);
              } catch (e) {
                success = false;
              }
              break;
          }

          // If primary network fails, try fallback networks
          if (!success) {
            console.log(`⚠️ Primary network ${peer.connectionType} failed for ${peer.handle}, trying fallback networks...`);

            if (this.activeServices.wifi && peer.connectionType !== 'wifi') {
              const wifiTargets = new Set<string>();
              if (peer.serviceId) wifiTargets.add(peer.serviceId);
              if (targetId && this.isLikelyLocalNetworkAddress(targetId)) wifiTargets.add(targetId);
              this.getConnectedWifiServiceIds().forEach(id => wifiTargets.add(id));

              for (const wifiTarget of wifiTargets) {
                const wifiSuccess = await wifiP2P.sendMessage(wifiTarget, payload).then(() => true).catch(() => false);
                if (wifiSuccess) {
                  success = true;
                  console.log(`Message sent via WiFi fallback to ${peer.handle} (${wifiTarget})`);
                  break;
                }
              }
            }

            // Try Nostr as universal fallback
            if (!success && this.activeServices.nostr && peer.connectionType !== 'nostr' && this.isLikelyNostrId(peer.serviceId || peer.id || targetId)) {
              console.log('🔄 Trying Nostr fallback...');
              const nostrTarget = peer.serviceId || peer.id || targetId!;
              const nostrSuccess = await nostrService.sendDirectMessage(nostrTarget, payload).catch(() => false);
              if (nostrSuccess) {
                success = true;
                console.log(`✅ Message sent via Nostr fallback to ${peer.handle}`);
              }
            }

            // Try Broadcast as another fallback
            if (!success && this.activeServices.broadcast && peer.connectionType !== 'broadcast' && !!peer.serviceId) {
              console.log('🔄 Trying Broadcast fallback...');
              const broadcastSuccess = await broadcastMesh.sendMessage(peer.serviceId!, payload).catch(() => false);
              if (broadcastSuccess) {
                success = true;
                console.log(`✅ Message sent via Broadcast fallback to ${peer.handle}`);
              }
            }

            if (!success) {
              console.warn(`Targeted send failed for ${peer.handle}; using best-effort broadcast fallback`);
              const finalFallbackPromises: Promise<any>[] = [];

              if (this.activeServices.wifi) {
                const wifiPeers = Array.from(this.peers.values())
                  .filter(p => p.connectionType === 'wifi' && p.isConnected && !!p.serviceId);
                wifiPeers.forEach(p => finalFallbackPromises.push(wifiP2P.sendMessage(p.serviceId!, payload).catch(() => false)));
              }
              if (this.activeServices.bluetooth) {
                const btPeers = Array.from(this.peers.values())
                  .filter(p => p.connectionType === 'bluetooth' && p.isConnected && !!p.serviceId);
                btPeers.forEach(p => finalFallbackPromises.push(workingBluetoothMesh.sendMessage(p.serviceId!, payload).catch(() => false)));
              }
              if (this.activeServices.nostr) {
                finalFallbackPromises.push(nostrService.broadcastMessage(payload).catch(() => false));
              }

              if (finalFallbackPromises.length) {
                await Promise.allSettled(finalFallbackPromises);
              }
            }
          }
          return;
        } else {
          if (this.activeServices.wifi && this.isLikelyLocalNetworkAddress(targetId)) {
            const wifiDirectSuccess = await wifiP2P.sendMessage(targetId, payload).then(() => true).catch(() => false);
            if (wifiDirectSuccess) {
              console.log(`✅ Direct WiFi send succeeded for ${targetId}`);
              return;
            }
          }

          // Fallback: If peer not found in mesh map, but looks like a valid ID and Nostr is active, try Nostr
          if (this.activeServices.nostr && this.isLikelyNostrId(targetId)) {
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
        const wifiPeers = Array.from(this.peers.values())
          .filter(p => p.connectionType === 'wifi' && p.isConnected && !!p.serviceId);
        wifiPeers.forEach(p => {
          broadcastPromises.push(wifiP2P.sendMessage(p.serviceId!, payload).catch(e => console.log('WiFi P2P failed:', e)));
        });
      }
      if (this.activeServices.nostr) {
        broadcastPromises.push(nostrService.broadcastMessage(payload).catch(e => console.log('Nostr broadcast failed:', e)));
      }
      if (this.activeServices.bluetooth) {
        const bluetoothPeers = Array.from(this.peers.values())
          .filter(p => p.connectionType === 'bluetooth' && p.isConnected && !!p.serviceId);
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

  async refreshLocalMeshConnectivity(): Promise<void> {
    try {
      if (this.activeServices.wifi) {
        await wifiP2P.startDiscovery();
      }
    } catch (error) {
      console.debug('WiFi refresh skipped:', error);
    }

    try {
      if (this.activeServices.bluetooth) {
        await workingBluetoothMesh.startScanning();
      }
    } catch (error) {
      console.debug('Bluetooth refresh skipped:', error);
    }
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
