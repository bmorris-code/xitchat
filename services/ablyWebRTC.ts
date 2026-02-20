// XitChat Hybrid Mesh WebRTC - Production Ready
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

export class HybridMeshWebRTC {
  private peers: Map<string, AblyWebRTCPeer> = new Map();
  private ably: any = null;
  private channel: any = null;
  private myPeerId: string | null = null;
  private listeners: { [key: string]: ((data?: any) => void)[] } = {};
  private currentRoom: string = 'xitchat-mesh';

  async initialize(apiKey?: string): Promise<boolean> {
    if (!('RTCPeerConnection' in window)) {
      console.warn('WebRTC not supported in this browser.');
      return false;
    }

    try {
      this.myPeerId = this.generatePeerId();

      // Use API key from parameter or environment variable
      const ablyKey = apiKey || process.env.NEXT_PUBLIC_ABLY_KEY;
      if (!ablyKey) throw new Error('Ably API key not provided.');

      this.ably = new Ably.Realtime(ablyKey);
      this.channel = this.ably.channels.get(this.currentRoom);

      // Subscribe to channels
      await this.channel.subscribe('signal', (msg: any) => this.handleSignalingMessage(msg.data));
      await this.channel.subscribe('peer-joined', (msg: any) => this.handlePeerJoined(msg.data));
      await this.channel.subscribe('peer-left', (msg: any) => this.handlePeerLeft(msg.data));

      // Announce presence
      await this.channel.publish('peer-joined', { peerId: this.myPeerId });

      // Create local peer connection
      await this.createLocalPeer();

      console.log('✅ Ably WebRTC Hybrid Mesh initialized');
      return true;

    } catch (error) {
      console.warn('⚠️ Ably WebRTC initialization skipped (Offline Mode):', error);
      return false;
    }
  }

  // Generate unique peer ID
  generatePeerId(): string {
    return 'peer_' + Math.random().toString(36).substring(2, 12);
  }

  // Generate unique message ID
  generateMessageId(): string {
    return 'msg_' + Math.random().toString(36).substring(2, 12);
  }

  // Create local RTCPeerConnection and data channel
  async createLocalPeer() {
    if (!this.myPeerId) return;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    const dc = pc.createDataChannel('messages', { ordered: true });
    this.setupDataChannel(dc, this.myPeerId);

    pc.onicecandidate = async (event) => {
      if (event.candidate) {
        await this.channel?.publish('signal', {
          type: 'ice-candidate',
          candidate: event.candidate,
          fromPeerId: this.myPeerId
        });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('Local connection state:', pc.connectionState);
    };

    // Add self to peers
    this.addPeer(this.myPeerId, pc, dc);
  }

  private async handlePeerJoined(data: any) {
    if (data.peerId === this.myPeerId) return;
    console.log('Peer joined:', data.peerId);
    this.emit('peerJoined', data);
    await this.connectToPeer(data.peerId);
  }

  private handlePeerLeft(data: any) {
    if (!data.peerId) return;
    console.log('Peer left:', data.peerId);
    this.removePeer(data.peerId);
    this.emit('peerLeft', data);
  }

  private async connectToPeer(peerId: string) {
    if (!this.myPeerId || this.peers.has(peerId)) return;

    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    const dc = pc.createDataChannel('messages', { ordered: true });
    this.setupDataChannel(dc, peerId);

    pc.onicecandidate = async (event) => {
      if (event.candidate) {
        await this.channel?.publish('signal', {
          type: 'ice-candidate',
          candidate: event.candidate,
          fromPeerId: this.myPeerId,
          toPeerId: peerId
        });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`Connection state with ${peerId}:`, pc.connectionState);
    };

    this.addPeer(peerId, pc, dc);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    await this.channel?.publish('signal', {
      type: 'offer',
      offer,
      fromPeerId: this.myPeerId,
      toPeerId: peerId
    });
  }

  private async handleSignalingMessage(data: any) {
    if (!this.myPeerId || data.fromPeerId === this.myPeerId) return;
    if (data.toPeerId && data.toPeerId !== this.myPeerId) return;

    let pc: RTCPeerConnection;
    let peer: AblyWebRTCPeer;

    if (!this.peers.has(data.fromPeerId)) {
      pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      pc.ondatachannel = (event) => this.setupDataChannel(event.channel, data.fromPeerId);

      pc.onicecandidate = async (event) => {
        if (event.candidate) {
          await this.channel.publish('signal', {
            type: 'ice-candidate',
            candidate: event.candidate,
            fromPeerId: this.myPeerId,
            toPeerId: data.fromPeerId
          });
        }
      };

      pc.onconnectionstatechange = () => console.log(`Connection state with ${data.fromPeerId}:`, pc.connectionState);

      peer = { id: data.fromPeerId, name: data.fromPeerId, handle: `@${data.fromPeerId}`, connection: pc, dataChannel: null as any, isConnected: false, lastSeen: new Date() };
      this.peers.set(data.fromPeerId, peer);
    } else {
      peer = this.peers.get(data.fromPeerId)!;
      pc = peer.connection;
    }

    switch (data.type) {
      case 'offer':
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await this.channel.publish('signal', { type: 'answer', answer, fromPeerId: this.myPeerId, toPeerId: data.fromPeerId });
        break;
      case 'answer':
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        break;
      case 'ice-candidate':
        if (data.candidate) await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        break;
    }
  }

  private setupDataChannel(channel: RTCDataChannel, peerId: string) {
    channel.onopen = () => {
      console.log(`Data channel open with ${peerId}`);
      const peer = this.peers.get(peerId);
      if (peer) peer.isConnected = true;
      this.emit('dataChannelOpen', peerId);
    };

    channel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.emit('messageReceived', message);
      } catch (err) {
        console.error('Failed to parse message:', err);
      }
    };

    channel.onclose = () => {
      console.log(`Data channel closed with ${peerId}`);
      const peer = this.peers.get(peerId);
      if (peer) peer.isConnected = false;
      this.emit('dataChannelClose', peerId);
    };
  }

  sendMessage(content: string) {
    const message = { id: this.generateMessageId(), from: this.myPeerId, content, timestamp: new Date(), type: 'direct' };
    this.peers.forEach(peer => {
      if (peer.dataChannel && peer.dataChannel.readyState === 'open') peer.dataChannel.send(JSON.stringify(message));
    });
  }

  private addPeer(peerId: string, connection: RTCPeerConnection, dataChannel: RTCDataChannel) {
    if (!this.peers.has(peerId)) {
      this.peers.set(peerId, { id: peerId, name: peerId, handle: `@${peerId}`, connection, dataChannel, isConnected: dataChannel.readyState === 'open', lastSeen: new Date() });
    }
  }

  private removePeer(peerId: string) {
    const peer = this.peers.get(peerId);
    if (peer) peer.connection.close();
    this.peers.delete(peerId);
  }

  isConnectedToMesh(): boolean {
    return this.peers.size > 0;
  }

  getPeers(): AblyWebRTCPeer[] {
    return Array.from(this.peers.values());
  }

  subscribe(event: string, callback: (data?: any) => void): () => void {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
    return () => { this.listeners[event] = this.listeners[event].filter(cb => cb !== callback); };
  }

  private emit(event: string, data?: any) {
    (this.listeners[event] || []).forEach(cb => cb(data));
  }

  async disconnect() {
    if (!this.myPeerId) return;
    await this.channel?.publish('peer-left', { peerId: this.myPeerId });
    this.ably?.close();
    this.peers.forEach(peer => peer.connection.close());
    this.emit('disconnected');
  }
}

export const hybridMeshWebRTC = new HybridMeshWebRTC();