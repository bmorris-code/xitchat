// Ably-based WebRTC signaling for XitChat
// Free tier: 6 million messages/month, 200 concurrent connections

import * as Ably from 'ably';

export interface AblyWebRTCPeer {
  id: string;
  name: string;
  handle: string;
  connection: RTCPeerConnection;
  dataChannel: RTCDataChannel;
  isConnected: boolean;
  lastSeen: Date;
}

class AblyWebRTCService {
  private peers: Map<string, AblyWebRTCPeer> = new Map();
  private ably: any = null;
  private channel: any = null;
  private myPeerId: string | null = null;
  private localPeer: RTCPeerConnection | null = null;
  private listeners: { [key: string]: ((data: any) => void)[] } = {};
  private currentRoom: string = 'xitchat-mesh';

  async initialize(apiKey: string): Promise<boolean> {
    try {
      // Check WebRTC support
      if (!('RTCPeerConnection' in window)) {
        console.warn('WebRTC not supported');
        return false;
      }

      // Initialize Ably
      this.ably = new Ably.Realtime(apiKey);
      this.channel = this.ably.channels.get(this.currentRoom);

      // Generate peer ID
      this.myPeerId = this.generatePeerId();

      // Set up Ably message handlers
      await this.channel.subscribe('signal', (message) => {
        this.handleSignalingMessage(message.data);
      });

      await this.channel.subscribe('peer-joined', (message) => {
        console.log('Peer joined:', message.data.peerId);
        this.emit('peerJoined', message.data);
      });

      await this.channel.subscribe('peer-left', (message) => {
        console.log('Peer left:', message.data.peerId);
        this.removePeer(message.data.peerId);
        this.emit('peerLeft', message.data);
      });

      // Announce presence
      await this.channel.publish('peer-joined', { peerId: this.myPeerId });

      // Create local peer connection
      await this.createLocalPeer();

      console.log('✅ Ably WebRTC service initialized');
      return true;

    } catch (error) {
      console.warn('⚠️ Ably WebRTC initialization skipped (Offline Mode):', error);
      return false;
    }
  }

  private async createLocalPeer(): Promise<void> {
    this.localPeer = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    // Create data channel for messaging
    const dataChannel = this.localPeer.createDataChannel('messages', {
      ordered: true
    });

    this.setupDataChannel(dataChannel);

    // Handle ICE candidates
    this.localPeer.onicecandidate = async (event) => {
      if (event.candidate && this.myPeerId) {
        await this.channel?.publish('signal', {
          type: 'ice-candidate',
          candidate: event.candidate,
          fromPeerId: this.myPeerId
        });
      }
    };

    // Handle connection state changes
    this.localPeer.onconnectionstatechange = () => {
      console.log('Connection state:', this.localPeer?.connectionState);
    };
  }

  private setupDataChannel(channel: RTCDataChannel): void {
    channel.onopen = () => {
      console.log('Data channel opened');
      this.emit('dataChannelOpen');
    };

    channel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.emit('messageReceived', message);
      } catch (error) {
        console.error('Failed to parse message:', error);
      }
    };

    channel.onclose = () => {
      console.log('Data channel closed');
      this.emit('dataChannelClose');
    };
  }

  private async handleSignalingMessage(data: any): Promise<void> {
    if (!this.localPeer || data.fromPeerId === this.myPeerId) return;

    switch (data.type) {
      case 'offer':
        await this.handleOffer(data);
        break;
      case 'answer':
        await this.handleAnswer(data);
        break;
      case 'ice-candidate':
        await this.handleIceCandidate(data);
        break;
    }
  }

  private async handleOffer(data: any): Promise<void> {
    if (!this.localPeer) return;

    await this.localPeer.setRemoteDescription(new RTCSessionDescription(data.offer));
    const answer = await this.localPeer.createAnswer();
    await this.localPeer.setLocalDescription(answer);

    await this.channel?.publish('signal', {
      type: 'answer',
      answer: answer,
      fromPeerId: this.myPeerId,
      toPeerId: data.fromPeerId
    });
  }

  private async handleAnswer(data: any): Promise<void> {
    if (!this.localPeer) return;
    await this.localPeer.setRemoteDescription(new RTCSessionDescription(data.answer));
  }

  private async handleIceCandidate(data: any): Promise<void> {
    if (!this.localPeer) return;
    await this.localPeer.addIceCandidate(new RTCIceCandidate(data.candidate));
  }

  async connectToPeer(peerId: string): Promise<void> {
    if (!this.localPeer || !this.myPeerId) return;

    const offer = await this.localPeer.createOffer();
    await this.localPeer.setLocalDescription(offer);

    await this.channel?.publish('signal', {
      type: 'offer',
      offer: offer,
      fromPeerId: this.myPeerId,
      toPeerId: peerId
    });
  }

  sendMessage(content: string): void {
    const peers = Array.from(this.peers.values());
    peers.forEach(peer => {
      if (peer.dataChannel.readyState === 'open') {
        peer.dataChannel.send(JSON.stringify({
          id: this.generateMessageId(),
          from: this.myPeerId,
          to: peer.id,
          content: content,
          timestamp: new Date(),
          type: 'direct'
        }));
      }
    });
  }

  private removePeer(peerId: string): void {
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.connection.close();
      this.peers.delete(peerId);
    }
  }

  private generatePeerId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  private generateMessageId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  private emit(event: string, data?: any): void {
    const listeners = this.listeners[event] || [];
    listeners.forEach(callback => callback(data));
  }

  // GETTERS
  getPeers(): AblyWebRTCPeer[] {
    return Array.from(this.peers.values());
  }

  isConnectedToMesh(): boolean {
    return !!this.localPeer;
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

  async disconnect(): Promise<void> {
    await this.channel?.publish('peer-left', { peerId: this.myPeerId });
    this.ably?.close();
    this.localPeer?.close();
    this.peers.forEach(peer => peer.connection.close());
    this.emit('disconnected');
  }
}

export const ablyWebRTC = new AblyWebRTCService();
