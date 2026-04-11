// WiFi P2P Service with Nostr Signaling
import { nostrService } from './nostrService';
import { networkStateManager, NetworkService } from './networkStateManager';
import { ICE_SERVERS } from './iceConfig';

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
  private readonly nostrSignalingPrefix = 'xitchat-wifi:';
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
  private pendingCandidates: Map<string, RTCIceCandidate[]> = new Map();

  // ── FIX #3: store Nostr unsub so disconnect() can clean it up ──
  private nostrSignalUnsub: (() => void) | null = null;

  private fallbackHandle(id: string): string {
    return `@${(id || 'peer').replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(0, 8) || 'peer'}`;
  }

  private fallbackName(id: string): string {
    return `Peer ${(id || 'peer').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) || 'peer'}`;
  }

  constructor() {
    this.myPeerId = 'wifi-' + Math.random().toString(36).substr(2, 9);
    if (typeof BroadcastChannel !== 'undefined') {
      this.broadcastChannel = new BroadcastChannel('xitchat-wifi');
      this.broadcastChannel.onmessage = (event) => {
        try {
          const message: WiFiMessage = JSON.parse(event.data);
          this.handleIncomingMessage(message, 'local');
        } catch (error) {
          console.error('Failed to parse WiFi message:', error);
        }
      };
    } else {
      this.broadcastChannel = null as any;
    }

    this.setupNostrSignaling();
  }

  private setupNostrSignaling(): void {
    // ── FIX #3: store unsub and clean up previous before re-subscribing ──
    if (this.nostrSignalUnsub) { this.nostrSignalUnsub(); this.nostrSignalUnsub = null; }

    this.nostrSignalUnsub = nostrService.subscribe('channelMessageReceived', (event: any) => {
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
      this.peers.forEach(peer => { peer.isConnected = connected; peer.lastSeen = new Date(); });
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
    if (message.from === this.myPeerId) return;
    if (message.to !== 'broadcast' && message.to !== this.myPeerId) return;

    switch (message.type) {
      case 'peer-announce': this.handlePeerAnnouncement(message); break;
      case 'chat': this.handleChatMessage(message); break;
      case 'webrtc-offer': this.handleWebRTCOffer(message, source); break;
      case 'webrtc-answer': this.handleWebRTCAnswer(message); break;
      case 'ice-candidate': this.handleICECandidate(message); break;
    }
  }

  private handlePeerAnnouncement(message: WiFiMessage): void {
    if (this.peers.has(message.from)) return;

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

      // ── FIX #2: removed auto-WebRTC initiation — would create a connection
      // storm on busy Nostr relays. WebRTC is initiated on-demand when the
      // user opens a chat (via sendMessage or connectToPeer). ──
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

    // ── FIX #1: use ICE_SERVERS from iceConfig instead of hardcoded STUN ──
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
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
    let peer = this.peers.get(message.from);
    if (!peer) {
      peer = { id: message.from, name: 'Remote Peer', handle: '@remote', isConnected: false, lastSeen: new Date() };
      this.peers.set(message.from, peer);
    }

    // ── FIX #1: use ICE_SERVERS from iceConfig ──
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peer.connection = pc;

    pc.ondatachannel = (event) => { this.setupDataChannel(event.channel, peer!); };
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

    const queued = this.pendingCandidates.get(message.from) || [];
    for (const c of queued) await pc.addIceCandidate(c).catch(() => {});
    this.pendingCandidates.delete(message.from);
  }

  private async handleWebRTCAnswer(message: WiFiMessage): Promise<void> {
    const peer = this.peers.get(message.from);
    if (!peer?.connection) return;
    const answer = JSON.parse(message.content).answer;
    await peer.connection.setRemoteDescription(new RTCSessionDescription(answer));
    const queued = this.pendingCandidates.get(message.from) || [];
    for (const c of queued) await peer.connection.addIceCandidate(c).catch(() => {});
    this.pendingCandidates.delete(message.from);
  }

  private async handleICECandidate(message: WiFiMessage): Promise<void> {
    const peer = this.peers.get(message.from);
    if (!peer) return;
    const candidate = JSON.parse(message.content).candidate;
    if (peer.connection?.remoteDescription) {
      await peer.connection.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
    } else {
      const queue = this.pendingCandidates.get(message.from) || [];
      queue.push(new RTCIceCandidate(candidate));
      this.pendingCandidates.set(message.from, queue);
    }
  }

  private setupDataChannel(dc: RTCDataChannel, peer: WiFiPeer): void {
    peer.dataChannel = dc;

    dc.onopen = () => {
      peer.isConnected = true;
      this.emit('peerConnected', peer);
      this.emit('peersUpdated', Array.from(this.peers.values()));
    };

    dc.onmessage = (event) => {
      try { this.handleChatMessage(JSON.parse(event.data)); }
      catch (e) { console.error('Failed to parse DC message', e); }
    };

    dc.onclose = () => {
      peer.isConnected = false;
      // ── FIX #4: null out connection so peer can reconnect ──
      peer.connection = undefined;
      peer.dataChannel = undefined;
      // ── FIX #5: clean up pending candidates for this peer ──
      this.pendingCandidates.delete(peer.id);
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

    if (this.broadcastChannel) {
      try { this.broadcastChannel.postMessage(payload); } catch {}
    }

    try {
      if (nostrService.isConnected()) {
        await nostrService.publishChannelMessage('xitchat-wifi-signaling', `${this.nostrSignalingPrefix}${payload}`);
      }
    } catch (error) {
      console.debug('Nostr signaling failed:', error);
    }
  }

  async initialize(): Promise<boolean> {
    try {
      const isNativeAndroid =
        (window as any).Capacitor?.isNativePlatform() &&
        (window as any).Capacitor?.getPlatform() === 'android';

      if (isNativeAndroid) {
        try {
          const { registerPlugin } = await import('@capacitor/core');
          const WiFiDirect = registerPlugin<any>('WiFiDirect');
          
          console.log('Calling WiFiDirect.initialize()...');
          const result = await WiFiDirect.initialize();
          console.log('WiFiDirect.initialize() result:', result);
          
          if (result && result.success) {
            this.WiFiDirectPlugin = WiFiDirect;
            this.setupNativeWiFiDirectListeners(WiFiDirect);
            console.log('WiFi Direct initialized successfully');
            console.log('WiFi Direct details:', result);
          } else {
            console.warn('WiFi Direct initialization failed:', result);
            if (result?.message) {
              console.warn('Error message:', result.message);
            }
            this.WiFiDirectPlugin = null;
          }
        } catch (error) {
          console.warn('WiFiDirect plugin missing, falling back to WebRTC + Nostr:', error);
          this.WiFiDirectPlugin = null;
        }
      }

      if (!isNativeAndroid && !('RTCPeerConnection' in window)) return false;

      this.serviceInfo.healthCheck = () => this.performHealthCheck();
      this.serviceInfo.reconnect = () => this.initialize();
      networkStateManager.registerService(this.serviceInfo);

      this.serviceInfo.isConnected = true;
      this.serviceInfo.isHealthy = true;
      this.isInitialized = true;
      networkStateManager.updateServiceStatus('wifiP2P', true, true);
      return true;
    } catch (error) {
      console.error('WiFi P2P initialization failed:', error);
      return false;
    }
  }

  async startDiscovery(): Promise<void> {
    if (this.isDiscovering) return;

    const isNativeAndroid =
      (window as any).Capacitor?.isNativePlatform() &&
      (window as any).Capacitor?.getPlatform() === 'android';

    if (isNativeAndroid && this.WiFiDirectPlugin) {
      this.isDiscovering = true;
      const result = await this.WiFiDirectPlugin.startDiscovery();
      if (result?.success === false) console.warn('WiFi Direct discovery did not start:', result);
      try { await this.WiFiDirectPlugin.startServer(); } catch {}
      this.emit('discoveryStarted');
      return;
    }

    this.isDiscovering = true;
    if (this.announceInterval) clearInterval(this.announceInterval);
    this.announceInterval = window.setInterval(() => this.announcePresence(), 10000);
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
    const isNativeAndroid =
      (window as any).Capacitor?.isNativePlatform() &&
      (window as any).Capacitor?.getPlatform() === 'android';
    if (isNativeAndroid && this.WiFiDirectPlugin) {
      this.WiFiDirectPlugin.stopDiscovery().catch(() => {});
    }
    if (this.announceInterval) { clearInterval(this.announceInterval); this.announceInterval = null; }
    this.emit('discoveryStopped');
  }

  async sendMessage(peerId: string, content: string): Promise<boolean> {
    const isNativeAndroid =
      (window as any).Capacitor?.isNativePlatform() &&
      (window as any).Capacitor?.getPlatform() === 'android';

    if (isNativeAndroid && this.WiFiDirectPlugin) {
      try {
        await this.WiFiDirectPlugin.sendMessage({ message: content, targetAddress: peerId });
        this.emit('messageSent', {
          id: Math.random().toString(36).substr(2, 9),
          from: this.myPeerId, to: peerId, content, timestamp: new Date(), type: 'chat'
        });
        return true;
      } catch (error) {
        console.warn('Native WiFi Direct send failed, falling back to signaling:', error);
      }
    }

    const peer = this.peers.get(peerId);
    if (!peer) return false;

    const message: WiFiMessage = {
      id: Math.random().toString(36).substr(2, 9),
      from: this.myPeerId, to: peerId, content, timestamp: new Date(), type: 'chat'
    };

    // Use WebRTC data channel if open
    if (peer.isConnected && peer.dataChannel?.readyState === 'open') {
      peer.dataChannel.send(JSON.stringify(message));
      this.emit('messageSent', message);
      return true;
    }

    // Initiate WebRTC on first send attempt if not already connected
    if (!peer.connection) {
      this.initiateWebRTCConnection(peerId).catch(() => {});
    }

    // Fall back to Nostr signaling
    try {
      await this.sendSignal(peerId, 'chat', content);
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

  getPeers(): WiFiPeer[] { return Array.from(this.peers.values()); }
  getConnectedPeers(): WiFiPeer[] { return this.getPeers().filter(p => p.isConnected); }

  subscribe(event: string, callback: (data: any) => void): () => void {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
    return () => {
      const idx = this.listeners[event].indexOf(callback);
      if (idx > -1) this.listeners[event].splice(idx, 1);
    };
  }

  private emit(event: string, data?: any): void {
    (this.listeners[event] || []).forEach(cb => cb(data));
  }

  disconnect(): void {
    this.stopDiscovery();
    this.peers.forEach(peer => {
      if (peer.connection) peer.connection.close();
    });
    // ── FIX #5: clear all pending candidates ──
    this.pendingCandidates.clear();
    this.peers.clear();
    if (this.broadcastChannel) this.broadcastChannel.close();
    // ── FIX #3: unsubscribe Nostr listener ──
    if (this.nostrSignalUnsub) { this.nostrSignalUnsub(); this.nostrSignalUnsub = null; }
    this.emit('disconnected');
  }

  getConnectionInfo(): any {
    return {
      peerId: this.myPeerId, name: this.myName, handle: this.myHandle,
      isDiscovering: this.isDiscovering, totalPeers: this.peers.size,
      connectedPeers: this.getConnectedPeers().length, type: 'wifi-p2p'
    };
  }

  private async performHealthCheck(): Promise<boolean> {
    return this.peers.size > 0 || nostrService.isConnected();
  }
}

export const wifiP2P = new WiFiP2PService();
