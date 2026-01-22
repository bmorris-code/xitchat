// WiFi P2P Mesh Service for XitChat
// Real P2P discovery using Broadcast Channel API and WebRTC

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
  sendMessage(arg0: string, content: string) {
    throw new Error('Method not implemented.');
  }
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

  constructor() {
    this.myPeerId = this.generatePeerId();
    
    // Initialize Broadcast Channel for local network discovery
    try {
      this.broadcastChannel = new BroadcastChannel('xitchat-wifi-p2p');
      this.setupBroadcastChannel();
    } catch (error) {
      console.log('Broadcast Channel not available - real P2P discovery limited');
    }
  }

  private generatePeerId(): string {
    return 'wifi_' + Math.random().toString(36).substr(2, 9);
  }

  private setupBroadcastChannel(): void {
    if (!this.broadcastChannel) return;

    this.broadcastChannel.onmessage = (event) => {
      try {
        const message: WiFiMessage = JSON.parse(event.data);
        this.handleBroadcastMessage(message);
      } catch (error) {
        console.error('Failed to parse broadcast message:', error);
      }
    };
  }

  private handleBroadcastMessage(message: WiFiMessage): void {
    switch (message.type) {
      case 'peer-announce':
        this.handlePeerAnnouncement(message);
        break;
      case 'webrtc-offer':
        this.handleWebRTCOffer(message);
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
    if (message.from === this.myPeerId) return;

    console.log('📡 Received peer announcement from:', message.from);

    const peer: WiFiPeer = {
      id: message.from,
      name: JSON.parse(message.content).name,
      handle: JSON.parse(message.content).handle,
      isConnected: false,
      lastSeen: new Date()
    };

    this.peers.set(message.from, peer);
    console.log('👥 Updated peers list:', this.peers.size, 'peers found');
    this.emit('peersUpdated', Array.from(this.peers.values()));
  }

  private async handleWebRTCOffer(message: WiFiMessage): Promise<void> {
    const peer = this.peers.get(message.from);
    if (!peer || !this.localPeer) return;

    // Parse offer from content
    const offer = JSON.parse(message.content).offer;

    // Set remote description
    await this.localPeer.setRemoteDescription({
      type: offer.type,
      sdp: offer.sdp
    });

    // Create answer
    const answer = await this.localPeer.createAnswer();
    await this.localPeer.setLocalDescription(answer);

    // Send answer
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({
        id: Math.random().toString(36).substr(2, 9),
        from: this.myPeerId,
        to: message.from,
        content: JSON.stringify({
          answer: {
            type: answer.type,
            sdp: answer.sdp
          }
        }),
        timestamp: new Date(),
        type: 'webrtc-answer'
      });
    }
  }

  private async handleWebRTCAnswer(message: WiFiMessage): Promise<void> {
    const peer = this.peers.get(message.from);
    if (peer && peer.connection) {
      const answer = JSON.parse(message.content).answer;
      await peer.connection.setRemoteDescription({
        type: answer.type,
        sdp: answer.sdp
      });
    }
  }

  private async handleICECandidate(message: WiFiMessage): Promise<void> {
    const peer = this.peers.get(message.from);
    if (peer && peer.connection) {
      const candidate = JSON.parse(message.content).candidate;
      const iceCandidate = new RTCIceCandidate({
        candidate: candidate.candidate,
        sdpMid: candidate.sdpMid,
        sdpMLineIndex: candidate.sdpMLineIndex,
        usernameFragment: candidate.usernameFragment
      });
      await peer.connection.addIceCandidate(iceCandidate);
    }
  }

  async initialize(): Promise<boolean> {
    try {
      if (!('RTCPeerConnection' in window)) {
        console.warn('WebRTC not supported');
        return false;
      }

      this.localPeer = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });

      this.setupLocalPeer();
      console.log('✅ WiFi P2P service initialized');
      return true;
    } catch (error) {
      console.error('WiFi P2P initialization failed:', error);
      return false;
    }
  }

  private setupLocalPeer(): void {
    if (!this.localPeer) return;

    this.localPeer.onicecandidate = (event) => {
      if (event.candidate && this.broadcastChannel) {
        this.broadcastChannel.postMessage({
          id: Math.random().toString(36).substr(2, 9),
          from: this.myPeerId,
          to: 'broadcast',
          content: JSON.stringify({
            candidate: event.candidate
          }),
          timestamp: new Date(),
          type: 'ice-candidate'
        });
      }
    };

    this.localPeer.onconnectionstatechange = () => {
      console.log('🔗 Connection state:', this.localPeer?.connectionState);
    };
  }

  startDiscovery(): void {
    if (this.isDiscovering) return;

    this.isDiscovering = true;
    console.log('🔍 Starting WiFi P2P discovery...');

    if (this.broadcastChannel) {
      this.announceInterval = window.setInterval(() => {
        this.broadcastChannel!.postMessage({
          id: Math.random().toString(36).substr(2, 9),
          from: this.myPeerId,
          to: 'broadcast',
          content: JSON.stringify({
            peerId: this.myPeerId,
            name: this.myName,
            handle: this.myHandle
          }),
          timestamp: new Date(),
          type: 'peer-announce'
        });
      }, 5000);

      // Send initial announcement
      this.broadcastChannel.postMessage({
        id: Math.random().toString(36).substr(2, 9),
        from: this.myPeerId,
        to: 'broadcast',
        content: JSON.stringify({
          peerId: this.myPeerId,
          name: this.myName,
          handle: this.myHandle
        }),
        timestamp: new Date(),
        type: 'peer-announce'
      });

      console.log('📡 Broadcasting presence on local network');
    } else {
      console.log('⚠️ Real P2P discovery requires Broadcast Channel API');
      throw new Error('Real P2P discovery not available without Broadcast Channel');
    }

    this.emit('discoveryStarted');
  }

  stopDiscovery(): void {
    this.isDiscovering = false;

    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
      this.discoveryInterval = null;
    }

    if (this.announceInterval) {
      clearInterval(this.announceInterval);
      this.announceInterval = null;
    }

    this.emit('discoveryStopped');
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
      if (peer.connection) {
        peer.connection.close();
      }
    });

    this.peers.clear();

    if (this.localPeer) {
      this.localPeer.close();
      this.localPeer = null;
    }

    if (this.broadcastChannel) {
      this.broadcastChannel.close();
      this.broadcastChannel = null;
    }

    console.log('🔌 WiFi P2P service disconnected');
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
}

export const wifiP2P = new WiFiP2PService();