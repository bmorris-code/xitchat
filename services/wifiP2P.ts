// WiFi P2P Service with Nostr Signaling - Clean Version
// Fixed version with proper Nostr initialization checks

import { nostrService } from './nostrService';
import { networkStateManager, NetworkService } from './networkStateManager';

export interface WiFiPeer {
  id: string;
  name: string;
  handle: string;
  isConnected: boolean;
  lastSeen: Date;
  connection?: RTCPeerConnection;
  dataChannel?: RTCDataChannel;
}

export interface WiFiMessage {
  id: string;
  from: string;
  to: string;
  content: string;
  timestamp: Date;
  type: 'peer-announce' | 'chat' | 'webrtc-offer' | 'webrtc-answer' | 'ice-candidate';
}

class WiFiP2PService {
  private peers: Map<string, WiFiPeer> = new Map();
  private myPeerId: string;
  private myName: string = 'Anonymous';
  private myHandle: string = '@anon';
  private broadcastChannel: BroadcastChannel;
  private nostrSignalingPrefix = 'xitchat-wifi:';
  private isDiscovering = false;
  private announceInterval: any = null;
  private listeners: { [key: string]: ((data: any) => void)[] } = {};
  private serviceInfo: NetworkService = {
    name: 'wifiP2P',
    isConnected: false,
    isHealthy: false,
    lastCheck: 0,
    reconnectAttempts: 0,
    maxReconnectAttempts: 3,
    reconnectDelay: 3000
  };
  private isInitialized = false;
  private WiFiDirectPlugin: any = null;
  private nativeListenersRegistered = false;
  private nativeConnectAttempts = new Set<string>();

  private fallbackHandle(id: string): string {
    const source = (id || 'peer').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    return `@${(source.slice(0, 8) || 'peer')}`;
  }

  private fallbackName(id: string): string {
    const source = (id || 'peer').replace(/[^a-zA-Z0-9]/g, '');
    return `Peer ${(source.slice(0, 8) || 'peer')}`;
  }

  constructor() {
    this.myPeerId = this.generatePeerId();
    this.broadcastChannel = new BroadcastChannel('xitchat-wifi');

    this.broadcastChannel.onmessage = (event) => {
      try {
        const message: WiFiMessage = JSON.parse(event.data);
        this.handleIncomingMessage(message, 'local');
      } catch (error) {
        console.error('Failed to parse WiFi message:', error);
      }
    };

    this.setupNostrSignaling();
  }

  private generatePeerId(): string {
    return 'wifi-' + Math.random().toString(36).substr(2, 9);
  }

  private setupNostrSignaling(): void {
    // Listen for incoming Nostr channel messages used as signaling bus.
    // Using channel events avoids the global broadcast rate-limit path.
    nostrService.subscribe('channelMessageReceived', (event: any) => {
      if (!event?.content || typeof event.content !== 'string') return;
      if (!event.content.startsWith(this.nostrSignalingPrefix)) return;

      try {
        const signalData = JSON.parse(event.content.replace(this.nostrSignalingPrefix, ''));
        this.handleIncomingMessage(signalData, 'nostr');
      } catch (error) {
        console.error('Failed to parse Nostr channel signal:', error);
      }
    });
  }

  private setupNativeWiFiDirectListeners(WiFiDirect: any): void {
    if (this.nativeListenersRegistered) return;
    this.nativeListenersRegistered = true;

    WiFiDirect.addListener('peersChanged', (event: any) => {
      const peers = Array.isArray(event?.peers) ? event.peers : [];

      peers.forEach((nativePeer: any) => {
        const peerId = nativePeer.deviceAddress || nativePeer.deviceName || `wifi-${Math.random().toString(36).substr(2, 6)}`;
        const existing = this.peers.get(peerId);
        const mappedPeer: WiFiPeer = {
          id: peerId,
          name: nativePeer.deviceName || this.fallbackName(peerId),
          handle: this.fallbackHandle(peerId),
          isConnected: nativePeer.status === 0 || existing?.isConnected || false,
          lastSeen: new Date()
        };

        if (!existing) {
          this.peers.set(peerId, mappedPeer);
          this.emit('peerFound', mappedPeer);
        } else {
          this.peers.set(peerId, { ...existing, ...mappedPeer, isConnected: existing.isConnected });
        }

        if (nativePeer.status === 3 && this.WiFiDirectPlugin && !this.nativeConnectAttempts.has(peerId)) {
          this.nativeConnectAttempts.add(peerId);
          this.WiFiDirectPlugin.connectToPeer({ deviceAddress: peerId }).catch((error: any) => {
            console.debug(`WiFi Direct connect failed for ${peerId}:`, error);
            this.nativeConnectAttempts.delete(peerId);
          });
        }
      });

      this.emit('peersUpdated', Array.from(this.peers.values()));
    }).catch(() => {});

    WiFiDirect.addListener('connectionChanged', (event: any) => {
      const connected = !!event?.connected;
      this.peers.forEach(peer => {
        peer.isConnected = connected;
        peer.lastSeen = new Date();
      });
      this.emit('peersUpdated', Array.from(this.peers.values()));
    }).catch(() => {});

    WiFiDirect.addListener('messageReceived', (event: any) => {
      this.emit('messageReceived', {
        id: Math.random().toString(36).substr(2, 9),
        from: event?.from || 'wifi-direct',
        to: this.myPeerId,
        content: event?.message || '',
        timestamp: new Date()
      });
    }).catch(() => {});
  }

  private handleIncomingMessage(message: WiFiMessage, source: 'local' | 'nostr'): void {
    // Ignore own messages
    if (message.from === this.myPeerId) return;

    // If it's a direct message to us or a broadcast
    if (message.to !== 'broadcast' && message.to !== this.myPeerId) return;

    switch (message.type) {
      case 'peer-announce':
        this.handlePeerAnnouncement(message);
        break;
      case 'chat':
        this.handleChatMessage(message);
        break;
      case 'webrtc-offer':
        this.handleWebRTCOffer(message, source);
        break;
      case 'webrtc-answer':
        this.handleWebRTCAnswer(message);
        break;
      case 'ice-candidate':
        this.handleICECandidate(message);
        break;
    }
  }

  private handlePeerAnnouncement(message: WiFiMessage): void {
    if (this.peers.has(message.from)) return;

    console.log('📡 Received peer announcement from:', message.from);

    try {
      const peerData = JSON.parse(message.content);
      const peer: WiFiPeer = {
        id: message.from,
        name: peerData.name || this.fallbackName(message.from),
        handle: peerData.handle || this.fallbackHandle(message.from),
        isConnected: false,
        lastSeen: new Date()
      };

      this.peers.set(message.from, peer);
      this.emit('peerFound', peer);
      this.emit('peersUpdated', Array.from(this.peers.values()));

      // Automatically try to establish a WebRTC connection if we found a new peer
      this.initiateWebRTCConnection(message.from);
    } catch (error) {
      console.error('Failed to parse peer announcement:', error);
    }
  }

  private handleChatMessage(message: WiFiMessage): void {
    this.emit('messageReceived', {
      id: message.id,
      from: message.from,
      to: message.to,
      content: message.content,
      timestamp: message.timestamp
    });
  }

  private async initiateWebRTCConnection(peerId: string): Promise<void> {
    const peer = this.peers.get(peerId);
    if (!peer || peer.connection) return;

    console.log(`🤝 Initiating WebRTC connection to ${peerId}...`);

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    peer.connection = pc;

    const dc = pc.createDataChannel('chat');
    this.setupDataChannel(dc, peer);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal(peerId, 'ice-candidate', JSON.stringify({ candidate: event.candidate }));
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    this.sendSignal(peerId, 'webrtc-offer', JSON.stringify({ offer }));
  }

  private async handleWebRTCOffer(message: WiFiMessage, source: 'local' | 'nostr'): Promise<void> {
    console.log(`📥 Received WebRTC offer from ${message.from} via ${source}`);

    let peer = this.peers.get(message.from);
    if (!peer) {
      // Create peer entry if not exists
      peer = {
        id: message.from,
        name: 'Remote Peer',
        handle: '@remote',
        isConnected: false,
        lastSeen: new Date()
      };
      this.peers.set(message.from, peer);
    }

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    peer.connection = pc;

    pc.ondatachannel = (event) => {
      this.setupDataChannel(event.channel, peer!);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal(message.from, 'ice-candidate', JSON.stringify({ candidate: event.candidate }));
      }
    };

    const offer = JSON.parse(message.content).offer;
    await pc.setRemoteDescription(new RTCSessionDescription(offer));

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    this.sendSignal(message.from, 'webrtc-answer', JSON.stringify({ answer }));
  }

  private async handleWebRTCAnswer(message: WiFiMessage): Promise<void> {
    const peer = this.peers.get(message.from);
    if (peer && peer.connection) {
      const answer = JSON.parse(message.content).answer;
      await peer.connection.setRemoteDescription(new RTCSessionDescription(answer));
      console.log(`✅ WebRTC answer applied for ${message.from}`);
    }
  }

  private async handleICECandidate(message: WiFiMessage): Promise<void> {
    const peer = this.peers.get(message.from);
    if (peer && peer.connection) {
      const candidate = JSON.parse(message.content).candidate;
      try {
        await peer.connection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn('Failed to add ICE candidate', e);
      }
    }
  }

  private setupDataChannel(dc: RTCDataChannel, peer: WiFiPeer): void {
    peer.dataChannel = dc;

    dc.onopen = () => {
      console.log(`🟢 WebRTC Data Channel OPEN with ${peer.id}`);
      peer.isConnected = true;
      this.emit('peerConnected', peer);
      this.emit('peersUpdated', Array.from(this.peers.values()));
    };

    dc.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleChatMessage(message);
      } catch (e) {
        console.error('Failed to parse DC message', e);
      }
    };

    dc.onclose = () => {
      console.log(`🔴 WebRTC Data Channel CLOSED with ${peer.id}`);
      peer.isConnected = false;
      this.emit('peerDisconnected', peer);
      this.emit('peersUpdated', Array.from(this.peers.values()));
    };
  }

  private async sendSignal(to: string, type: WiFiMessage['type'], content: string): Promise<void> {
    const message: WiFiMessage = {
      id: Math.random().toString(36).substr(2, 9),
      from: this.myPeerId,
      to,
      content,
      timestamp: new Date(),
      type
    };

    const payload = JSON.stringify(message);

    // 1. Send via local BroadcastChannel (same-device)
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage(payload);
    }

    // 2. Send via Nostr channel (cross-device signaling) - only if initialized
    try {
      if (nostrService.isConnected()) {
        await nostrService.publishChannelMessage('xitchat-wifi-signaling', `${this.nostrSignalingPrefix}${payload}`);
      } else {
        console.debug('Nostr not initialized, skipping Nostr signaling');
      }
    } catch (error) {
      console.debug('Nostr signaling failed:', error);
    }
  }

  async initialize(): Promise<boolean> {
    try {
      console.log('� Initializing SERVERLESS WiFi P2P...');

      // ANDROID SERVERLESS: Skip native plugins (they don't exist)
      // Use WebRTC + Nostr signaling for true P2P
      const isNativeAndroid = (window as any).Capacitor?.isNativePlatform() && (window as any).Capacitor?.getPlatform() === 'android';
      
      if (isNativeAndroid) {
        console.log('📱 Android: Using native WiFi Direct plugin for local P2P discovery');
        const { registerPlugin } = await import('@capacitor/core');
        const WiFiDirect = registerPlugin<any>('WiFiDirect');
        this.WiFiDirectPlugin = WiFiDirect;
        await WiFiDirect.initialize();
        this.setupNativeWiFiDirectListeners(WiFiDirect);
      } else {
        console.log('🌐 Web: Using WebRTC + Nostr for WiFi P2P');
      }

      // Web fallback - use WebRTC with Nostr signaling
      if (!isNativeAndroid && !('RTCPeerConnection' in window)) {
        console.warn('WebRTC not supported - WiFi P2P disabled');
        return false;
      }

      // Register with network state manager
      this.serviceInfo.healthCheck = () => this.performHealthCheck();
      this.serviceInfo.reconnect = () => this.initialize();
      networkStateManager.registerService(this.serviceInfo);

      this.serviceInfo.isConnected = true;
      this.serviceInfo.isHealthy = true;
      this.isInitialized = true;
      networkStateManager.updateServiceStatus('wifiP2P', true, true);

      console.log('✅ Serverless WiFi P2P (WebRTC + Nostr signaling) initialized');
      return true;
    } catch (error) {
      console.error('WiFi P2P initialization failed:', error);
      return false;
    }
  }

  async startDiscovery(): Promise<void> {
    if (this.isDiscovering) return;

    const isNativeAndroid = (window as any).Capacitor?.isNativePlatform() && (window as any).Capacitor?.getPlatform() === 'android';
    if (isNativeAndroid && this.WiFiDirectPlugin) {
      console.log('🔍 Starting native WiFi Direct discovery...');
      this.isDiscovering = true;
      const discoveryResult = await this.WiFiDirectPlugin.startDiscovery();
      if (discoveryResult && discoveryResult.success === false) {
        console.warn('WiFi Direct discovery did not start:', discoveryResult);
      }
      try {
        await this.WiFiDirectPlugin.startServer();
      } catch (error) {
        console.debug('WiFi Direct server start skipped:', error);
      }
      this.emit('discoveryStarted');
      return;
    }

    console.log('🔍 Starting serverless WiFi P2P discovery (WebRTC + Nostr)...');
    
    this.isDiscovering = true;

    // Start announcing presence via Nostr signaling
    this.announceInterval = window.setInterval(() => {
      this.announcePresence();
    }, 10000);

    this.announcePresence();
    this.emit('discoveryStarted');
    console.log('📡 Serverless WiFi P2P discovery started');
  }

  private announcePresence(): void {
    this.sendSignal('broadcast', 'peer-announce', JSON.stringify({
      peerId: this.myPeerId,
      name: this.myName,
      handle: this.myHandle
    }));
  }

  stopDiscovery(): void {
    this.isDiscovering = false;
    const isNativeAndroid = (window as any).Capacitor?.isNativePlatform() && (window as any).Capacitor?.getPlatform() === 'android';
    if (isNativeAndroid && this.WiFiDirectPlugin) {
      this.WiFiDirectPlugin.stopDiscovery().catch(() => {});
    }
    if (this.announceInterval) {
      clearInterval(this.announceInterval);
      this.announceInterval = null;
    }
    this.emit('discoveryStopped');
  }

  async sendMessage(peerId: string, content: string): Promise<boolean> {
    const isNativeAndroid = (window as any).Capacitor?.isNativePlatform() && (window as any).Capacitor?.getPlatform() === 'android';

    if (isNativeAndroid && this.WiFiDirectPlugin) {
      try {
        await this.WiFiDirectPlugin.sendMessage({
          message: content,
          targetAddress: peerId
        });
        this.emit('messageSent', {
          id: Math.random().toString(36).substr(2, 9),
          from: this.myPeerId,
          to: peerId,
          content,
          timestamp: new Date(),
          type: 'chat'
        });
        return true;
      } catch (error) {
        console.warn('Native WiFi Direct send failed, falling back to signaling:', error);
      }
    }

    const peer = this.peers.get(peerId);
    if (!peer) {
      console.warn(`Peer ${peerId} not found`);
      return false;
    }

    console.log(`📤 Sending via serverless WiFi P2P to ${peerId}: ${content}`);

    const message: WiFiMessage = {
      id: Math.random().toString(36).substr(2, 9),
      from: this.myPeerId,
      to: peerId,
      content,
      timestamp: new Date(),
      type: 'chat'
    };

    if (peer.isConnected && peer.dataChannel && peer.dataChannel.readyState === 'open') {
      peer.dataChannel.send(JSON.stringify(message));
      console.log(`📤 Sent via WebRTC P2P to ${peerId}: ${content}`);
      this.emit('messageSent', message);
      return true;
    }

    try {
      await this.sendSignal(peerId, 'chat', content);
      console.log(`📤 Sent via Nostr P2P to ${peerId}: ${content}`);
      this.emit('messageSent', message);
      return true;
    } catch (error) {
      console.warn('Failed to send WiFi P2P signal:', error);
      return false;
    }
  }

  setUserInfo(name: string, handle: string): void {
    this.myName = name;
    this.myHandle = handle;
  }

  getPeers(): WiFiPeer[] {
    return Array.from(this.peers.values());
  }

  getConnectedPeers(): WiFiPeer[] {
    return this.getPeers().filter(peer => peer.isConnected);
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

  private emit(event: string, data?: any): void {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(data));
    }
  }

  disconnect(): void {
    this.stopDiscovery();
    this.peers.forEach(peer => {
      if (peer.connection) peer.connection.close();
    });
    this.peers.clear();
    if (this.broadcastChannel) this.broadcastChannel.close();
    this.emit('disconnected');
  }

  getConnectionInfo(): any {
    return {
      peerId: this.myPeerId,
      name: this.myName,
      handle: this.myHandle,
      isDiscovering: this.isDiscovering,
      totalPeers: this.peers.size,
      connectedPeers: this.getConnectedPeers().length,
      type: 'wifi-p2p'
    };
  }

  private async performHealthCheck(): Promise<boolean> {
    // Healthy if we have at least one peer or if Nostr signaling is active
    return this.peers.size > 0 || nostrService.isConnected();
  }
}

export const wifiP2P = new WiFiP2PService();

