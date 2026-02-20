// XitChat Ably WebRTC Hybrid Mesh Service
// Full production-ready WebRTC peer-to-peer mesh core

import * as Ably from 'ably';
import { networkStateManager, NetworkService } from './networkStateManager';

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

  async initialize(): Promise<boolean> {
    if (!('RTCPeerConnection' in window)) {
      console.warn('WebRTC not supported in this browser.');
      return false;
    }

    try {
      this.myPeerId = this.generatePeerId();
      this.ably = new Ably.Realtime(this.apiKey);

      this.channel = this.ably.channels.get(this.currentRoom);

      // Subscribe to signaling channel
      await this.channel.subscribe('signal', (msg: any) => this.handleSignalingMessage(msg.data));
      await this.channel.subscribe('peer-joined', (msg: any) => this.handlePeerJoined(msg.data));
      await this.channel.subscribe('peer-left', (msg: any) => this.handlePeerLeft(msg.data));

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

  private async handlePeerJoined(data: any) {
    if (data.peerId === this.myPeerId) return;
    console.log('Peer joined:', data.peerId);
    this.emit('peerJoined', data);

    // Automatically attempt connection to new peer
    await this.connectToPeer(data.peerId);
  }

  private handlePeerLeft(data: any) {
    if (!data.peerId) return;
    console.log('Peer left:', data.peerId);
    this.removePeer(data.peerId);
    this.emit('peerLeft', data);
  }

  private async connectToPeer(peerId: string) {
    if (!this.myPeerId) return;
    if (this.peers.has(peerId)) return; // Already connected

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    const dc = pc.createDataChannel('messages', { ordered: true });
    this.setupDataChannel(dc, peerId);

    pc.onicecandidate = async (event) => {
      if (event.candidate) {
        await this.channel.publish('signal', {
          type: 'ice-candidate',
          candidate: event.candidate,
          fromPeerId: this.myPeerId,
          toPeerId: peerId
        });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`Connection state with ${peerId}:`, pc.connectionState);
      if (pc.connectionState === 'failed') {
        console.warn(`Connection failed with ${peerId}, retrying...`);
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          setTimeout(() => this.connectToPeer(peerId), 2000);
        }
      }
    };

    this.addPeer(peerId, pc, dc);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    await this.channel.publish('signal', {
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
      pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });

      pc.ondatachannel = (event) => {
        this.setupDataChannel(event.channel, data.fromPeerId);
        this.addPeer(data.fromPeerId, pc, event.channel);
      };

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

      pc.onconnectionstatechange = () => {
        console.log(`Connection state with ${data.fromPeerId}:`, pc.connectionState);
      };

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

        await this.channel.publish('signal', {
          type: 'answer',
          answer,
          fromPeerId: this.myPeerId,
          toPeerId: data.fromPeerId
        });
        break;

      case 'answer':
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        break;

      case 'ice-candidate':
        if (data.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
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
      } catch (error) {
        console.error('Failed to parse message:', error);
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
    const message = {
      id: this.generateMessageId(),
      from: this.myPeerId,
      content,
      timestamp: new Date(),
      type: 'direct'
    };

    this.peers.forEach(peer => {
      if (peer.dataChannel && peer.dataChannel.readyState === 'open') {
        peer.dataChannel.send(JSON.stringify(message));
      }
    });
  }

  private addPeer(peerId: string, connection: RTCPeerConnection, dataChannel: RTCDataChannel) {
    if (!this.peers.has(peerId)) {
      this.peers.set(peerId, {
        id: peerId,
        name: peerId,
        handle: `@${peerId}`,
        connection,
        dataChannel,
        isConnected: dataChannel.readyState === 'open',
        lastSeen: new Date()
      });
    }
  }

  private removePeer(peerId: string) {
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.connection.close();
      this.peers.delete(peerId);
    }
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

    return () => {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    };
  }

  private emit(event: string, data?: any) {
    const listeners = this.listeners[event] || [];
    listeners.forEach(cb => cb(data));
  }

  async disconnect() {
    if (!this.myPeerId) return;

    await this.channel.publish('peer-left', { peerId: this.myPeerId });
    this.ably?.close();
    this.peers.forEach(peer => peer.connection.close());
    this.emit('disconnected');
  }
}

export const hybridMeshWebRTC = new HybridMeshWebRTC('<YOUR_ABLY_API_KEY>');