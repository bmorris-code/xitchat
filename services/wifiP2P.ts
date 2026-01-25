// WiFi P2P Mesh Service for XitChat
// Real P2P discovery using Nostr for signaling and WebRTC for data
import { nostrService } from './nostrService';
import { networkStateManager, NetworkService } from './networkStateManager';

export interface WiFiPeer {
  id: string;
  name: string;
  handle: string;
  connection?: RTCPeerConnection;
  dataChannel?: RTCDataChannel;
  isConnected: boolean;
  lastSeen: Date;
}

export interface WiFiMessage {
  id: string;
  from: string;
  to: string;
  content: string;
  timestamp: Date;
  type: 'chat' | 'presence' | 'discovery' | 'peer-announce' | 'webrtc-offer' | 'webrtc-answer' | 'ice-candidate';
}

class WiFiP2PService {
  private peers: Map<string, WiFiPeer> = new Map();
  private localPeer: RTCPeerConnection | null = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private myPeerId: string = '';
  private myName: string = 'Anonymous';
  private myHandle: string = '@anon';
  private isDiscovering = false;
  private discoveryInterval: number | null = null;
  private announceInterval: number | null = null;
  private listeners: { [key: string]: ((data: any) => void)[] } = {};
  private nostrSignalingPrefix = 'xitchat-p2p-signal-';
  private serviceInfo: NetworkService = {
    name: 'wifiP2P',
    isConnected: false,
    isHealthy: false,
    lastCheck: 0,
    reconnectAttempts: 0,
    maxReconnectAttempts: 5,
    reconnectDelay: 2000
  };
  on: any;
  connectToPeer: any;

  constructor() {
    this.myPeerId = this.generatePeerId();

    // Initialize Broadcast Channel for local network discovery (same-device)
    try {
      this.broadcastChannel = new BroadcastChannel('xitchat-wifi-p2p');
      this.setupBroadcastChannel();
    } catch (error) {
      console.log('Broadcast Channel not available - same-device discovery limited');
    }
  }

  private generatePeerId(): string {
    // We use a shorter ID for display but keep it unique
    return 'wifi_' + Math.random().toString(36).substr(2, 9);
  }

  private setupBroadcastChannel(): void {
    if (!this.broadcastChannel) return;

    this.broadcastChannel.onmessage = (event) => {
      try {
        const message: WiFiMessage = JSON.parse(event.data);
        this.handleIncomingMessage(message, 'local');
      } catch (error) {
        console.error('Failed to parse broadcast message:', error);
      }
    };
  }

  private setupNostrSignaling(): void {
    // Listen for WebRTC signals via Nostr (this enables cross-device!)
    nostrService.subscribe('messageReceived', (message) => {
      if (message.content && message.content.startsWith(this.nostrSignalingPrefix)) {
        try {
          const signalData = JSON.parse(message.content.replace(this.nostrSignalingPrefix, ''));
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

    // 2. Send via Nostr (cross-device signaling)
    try {
      await nostrService.broadcastMessage(`${this.nostrSignalingPrefix}${payload}`);
    } catch (error) {
      console.warn('Nostr signaling failed', error);
    }
  }

  async initialize(): Promise<boolean> {
    try {
      if (!('RTCPeerConnection' in window)) {
        console.warn('WebRTC not supported');
        return false;
      }

      this.setupNostrSignaling();

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

  startDiscovery(): void {
    if (this.isDiscovering) return;

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