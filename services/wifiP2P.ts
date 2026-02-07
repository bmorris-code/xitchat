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
    // Listen for Nostr signaling messages
    nostrService.subscribe('messageBroadcasted', (event: any) => {
      if (event.content && event.content.startsWith(this.nostrSignalingPrefix)) {
        try {
          const signalData = JSON.parse(event.content.replace(this.nostrSignalingPrefix, ''));
          this.handleIncomingMessage(signalData, 'nostr');
        } catch (error) {
          console.error('Failed to parse Nostr signal:', error);
        }
      }
    });
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
        name: peerData.name || 'Unknown',
        handle: peerData.handle || '@unknown',
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

    // 2. Send via Nostr (cross-device signaling) - only if initialized
    try {
      if (nostrService.isConnected()) {
        await nostrService.broadcastMessage(`${this.nostrSignalingPrefix}${payload}`);
      } else {
        console.debug('Nostr not initialized, skipping Nostr signaling');
      }
    } catch (error) {
      console.debug('Nostr signaling failed:', error);
    }
  }

  async initialize(): Promise<boolean> {
    try {
      // 1. Native Branch (Android WiFi Direct)
      if ((window as any).Capacitor?.isNativePlatform()) {
        console.log('📱 Native environment detected, using Capacitor WiFi Direct...');
        try {
          const { registerPlugin } = await import('@capacitor/core');
          const WiFiDirect = registerPlugin<any>('WiFiDirect');

          await WiFiDirect.initialize();

          // Set up native listeners
          WiFiDirect.addListener('peersChanged', (data: any) => {
            if (data.peers) {
              data.peers.forEach((nativePeer: any) => {
                const peer: WiFiPeer = {
                  id: nativePeer.deviceAddress,
                  name: nativePeer.deviceName || 'Native WiFi Device',
                  handle: `@${(nativePeer.deviceName || 'wifi').replace(/\s+/g, '').toLowerCase()}`,
                  isConnected: nativePeer.status === 0, // 0 = CONNECTED in Android
                  lastSeen: new Date()
                };
                this.peers.set(peer.id, peer);
                this.emit('peerFound', peer);
              });
              this.emit('peersUpdated', Array.from(this.peers.values()));
            }
          });

          WiFiDirect.addListener('messageReceived', (data: any) => {
            this.handleChatMessage({
              id: Math.random().toString(36).substr(2, 9),
              from: data.from,
              to: this.myPeerId,
              content: data.message,
              timestamp: new Date(),
              type: 'chat'
            });
          });

          this.serviceInfo.isConnected = true;
          this.serviceInfo.isHealthy = true;
          networkStateManager.updateServiceStatus('wifiP2P', true, true);
          return true;
        } catch (e) {
          console.error('❌ Native WiFi Direct initialization failed:', e);
        }
      }

      // 2. Web Fallback
      if (!('RTCPeerConnection' in window)) {
        console.warn('WebRTC not supported');
        return false;
      }

      // Register with network state manager
      this.serviceInfo.healthCheck = () => this.performHealthCheck();
      this.serviceInfo.reconnect = () => this.initialize();
      networkStateManager.registerService(this.serviceInfo);

      this.serviceInfo.isConnected = true;
      this.serviceInfo.isHealthy = true;
      networkStateManager.updateServiceStatus('wifiP2P', true, true);

      console.log('✅ WiFi P2P service (with Nostr signaling) initialized');
      return true;
    } catch (error) {
      console.error('WiFi P2P initialization failed:', error);
      return false;
    }
  }

  async startDiscovery(): Promise<void> {
    if (this.isDiscovering) return;

    // 1. Native Branch
    if ((window as any).Capacitor?.isNativePlatform()) {
      try {
        const { registerPlugin } = await import('@capacitor/core');
        const WiFiDirect = registerPlugin<any>('WiFiDirect');
        await WiFiDirect.startDiscovery();
        await WiFiDirect.startServer(); // Start socket server for receiving messages
        this.isDiscovering = true;
        this.emit('discoveryStarted');
        return;
      } catch (e) {
        console.error('❌ Native WiFi discovery failed:', e);
      }
    }

    // 2. Web Fallback
    this.isDiscovering = true;
    console.log('🔍 Starting WiFi P2P discovery...');

    this.announceInterval = window.setInterval(() => {
      this.announcePresence();
    }, 10000);

    this.announcePresence();
    this.emit('discoveryStarted');
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
    if (this.announceInterval) {
      clearInterval(this.announceInterval);
      this.announceInterval = null;
    }
    this.emit('discoveryStopped');
  }

  async sendMessage(peerId: string, content: string): Promise<void> {
    const peer = this.peers.get(peerId);

    // 1. Native Branch
    if ((window as any).Capacitor?.isNativePlatform()) {
      try {
        const { registerPlugin } = await import('@capacitor/core');
        const WiFiDirect = registerPlugin<any>('WiFiDirect');

        // If not already connected, trigger connect in Android
        if (!peer?.isConnected) {
          await WiFiDirect.connectToPeer({ deviceAddress: peerId });
        }

        await WiFiDirect.sendMessage({
          targetAddress: peerId, // In native, ID is the IP or MAC address
          message: content
        });

        this.emit('messageSent', { id: 'native', from: this.myPeerId, to: peerId, content, timestamp: new Date(), type: 'chat' });
        return;
      } catch (e) {
        console.error('❌ Native WiFi send failed:', e);
      }
    }

    // 2. Web Fallback
    const message: WiFiMessage = {
      id: Math.random().toString(36).substr(2, 9),
      from: this.myPeerId,
      to: peerId,
      content,
      timestamp: new Date(),
      type: 'chat'
    };

    // If we have a direct WebRTC connection, use it!
    if (peer && peer.isConnected && peer.dataChannel && peer.dataChannel.readyState === 'open') {
      peer.dataChannel.send(JSON.stringify(message));
      console.log(`📤 Sent via WebRTC to ${peerId}: ${content}`);
    } else {
      // Otherwise, send via signaling channel (fallback/broadcast)
      await this.sendSignal(peerId, 'chat', content);
      console.log(`📤 Sent via Signaling to ${peerId}: ${content}`);
    }

    this.emit('messageSent', message);
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
