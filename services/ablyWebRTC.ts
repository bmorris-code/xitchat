// XitChat Hybrid Mesh WebRTC - Production Ready
import * as Ably from 'ably';
import { ICE_SERVERS } from './iceConfig';

export interface AblyWebRTCPeer {
  id: string;
  name: string;
  handle: string;
  connection: RTCPeerConnection;
  dataChannel: RTCDataChannel | null;
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

  // ── FIX #3: queue ICE candidates until remote description is set ──
  private pendingCandidates: Map<string, RTCIceCandidate[]> = new Map();
  // ── FIX #2: store Ably connection handlers for cleanup ──
  private ablyConnectionHandlers: Array<{ event: string; handler: any }> = [];

  async initialize(apiKey?: string): Promise<boolean> {
    if (!('RTCPeerConnection' in window)) {
      console.warn('WebRTC not supported in this browser.');
      return false;
    }

    try {
      this.myPeerId = this.generatePeerId();

      const ablyKey = apiKey;
      if (!ablyKey) {
        console.debug('⚠️ Ably auth not provided - skipping WebRTC mesh');
        return false;
      }

      // ablyKey is an authUrl (token endpoint) — master key stays server-side
      this.ably = new Ably.Realtime({ authUrl: ablyKey });
      this.channel = this.ably.channels.get(this.currentRoom);

      // ── FIX #2: store handlers so disconnect() can remove them ──
      const onFailed = (error: any) => console.debug('⚠️ Ably connection failed:', error);
      const onDisconnected = () => console.debug('⚠️ Ably disconnected');
      this.ably.connection.on('failed', onFailed);
      this.ably.connection.on('disconnected', onDisconnected);
      this.ablyConnectionHandlers.push(
        { event: 'failed', handler: onFailed },
        { event: 'disconnected', handler: onDisconnected }
      );

      await this.channel.subscribe('signal', (msg: any) => this.handleSignalingMessage(msg.data));
      await this.channel.subscribe('peer-joined', (msg: any) => this.handlePeerJoined(msg.data));
      await this.channel.subscribe('peer-left', (msg: any) => this.handlePeerLeft(msg.data));

      await this.channel.publish('peer-joined', { peerId: this.myPeerId });

      // ── FIX #1: removed createLocalPeer() — self must not be in peers map ──

      console.log('✅ Ably WebRTC Hybrid Mesh initialized');
      return true;
    } catch (error) {
      console.debug('⚠️ Ably WebRTC initialization failed:', error);
      return false;
    }
  }

  generatePeerId(): string {
    return 'peer_' + Math.random().toString(36).substring(2, 12);
  }

  generateMessageId(): string {
    return 'msg_' + Math.random().toString(36).substring(2, 12);
  }

  private async handlePeerJoined(data: any) {
    if (data.peerId === this.myPeerId) return;
    this.emit('peerJoined', data);
    await this.connectToPeer(data.peerId);
  }

  private handlePeerLeft(data: any) {
    if (!data.peerId) return;
    this.removePeer(data.peerId);
    this.emit('peerLeft', data);
  }

  private async connectToPeer(peerId: string) {
    if (!this.myPeerId || this.peers.has(peerId)) return;

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
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
      console.debug(`Connection state with ${peerId}:`, pc.connectionState);
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
      pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pc.ondatachannel = (event) => this.setupDataChannel(event.channel, data.fromPeerId);
      pc.onicecandidate = async (event) => {
        if (event.candidate) {
          await this.channel?.publish('signal', {
            type: 'ice-candidate',
            candidate: event.candidate,
            fromPeerId: this.myPeerId,
            toPeerId: data.fromPeerId
          });
        }
      };
      pc.onconnectionstatechange = () =>
        console.debug(`Connection state with ${data.fromPeerId}:`, pc.connectionState);

      peer = {
        id: data.fromPeerId, name: data.fromPeerId,
        handle: `@${data.fromPeerId}`, connection: pc,
        dataChannel: null, isConnected: false, lastSeen: new Date()
      };
      this.peers.set(data.fromPeerId, peer);
    } else {
      peer = this.peers.get(data.fromPeerId)!;
      pc = peer.connection;
    }

    switch (data.type) {
      case 'offer':
        try {
          if (pc.signalingState !== 'stable' && pc.signalingState !== 'have-remote-offer') {
            if (this.myPeerId && this.myPeerId > data.fromPeerId) {
              console.debug(`Ignoring colliding offer from ${data.fromPeerId}`);
              return;
            }
          }
          await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
          // ── FIX #3: flush queued ICE candidates now that remote desc is set ──
          const queuedOffer = this.pendingCandidates.get(data.fromPeerId) || [];
          for (const c of queuedOffer) await pc.addIceCandidate(c).catch(() => {});
          this.pendingCandidates.delete(data.fromPeerId);

          if (pc.signalingState === 'have-remote-offer' || pc.signalingState === 'have-local-pranswer') {
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await this.channel?.publish('signal', {
              type: 'answer', answer,
              fromPeerId: this.myPeerId, toPeerId: data.fromPeerId
            });
          }
        } catch (e) { console.warn('WebRTC offer error:', e); }
        break;

      case 'answer':
        try {
          if (pc.signalingState === 'have-local-offer' || pc.signalingState === 'have-remote-pranswer') {
            await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
            // ── FIX #3: flush queued ICE candidates ──
            const queuedAnswer = this.pendingCandidates.get(data.fromPeerId) || [];
            for (const c of queuedAnswer) await pc.addIceCandidate(c).catch(() => {});
            this.pendingCandidates.delete(data.fromPeerId);
          }
        } catch (e) { console.warn('WebRTC answer error:', e); }
        break;

      case 'ice-candidate':
        if (!data.candidate) break;
        // ── FIX #3: queue if remote description not yet set ──
        if (pc.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(() => {});
        } else {
          const queue = this.pendingCandidates.get(data.fromPeerId) || [];
          queue.push(new RTCIceCandidate(data.candidate));
          this.pendingCandidates.set(data.fromPeerId, queue);
        }
        break;
    }
  }

  private setupDataChannel(channel: RTCDataChannel, peerId: string) {
    channel.onopen = () => {
      const peer = this.peers.get(peerId);
      if (peer) { peer.isConnected = true; peer.dataChannel = channel; }
      this.emit('dataChannelOpen', peerId);
    };

    channel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        // ── FIX #1: guard against receiving own messages ──
        if (message.from === this.myPeerId) return;
        this.emit('messageReceived', message);
      } catch (err) {
        console.error('Failed to parse message:', err);
      }
    };

    channel.onclose = () => {
      const peer = this.peers.get(peerId);
      if (peer) { peer.isConnected = false; peer.dataChannel = null; }
      // ── FIX #5: clean up pending candidates on channel close ──
      this.pendingCandidates.delete(peerId);
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
      if (peer.id !== this.myPeerId && // ── FIX #1: never send to self ──
        peer.dataChannel?.readyState === 'open') {
        peer.dataChannel.send(JSON.stringify(message));
      }
    });
  }

  private addPeer(peerId: string, connection: RTCPeerConnection, dataChannel: RTCDataChannel | null) {
    if (!this.peers.has(peerId)) {
      this.peers.set(peerId, {
        id: peerId, name: peerId, handle: `@${peerId}`,
        connection, dataChannel,
        isConnected: dataChannel?.readyState === 'open' || false,
        lastSeen: new Date()
      });
    }
  }

  // ── FIX #5: close data channel explicitly ──
  private removePeer(peerId: string) {
    const peer = this.peers.get(peerId);
    if (peer) {
      try { peer.dataChannel?.close(); } catch {}
      try { peer.connection.close(); } catch {}
    }
    this.peers.delete(peerId);
    this.pendingCandidates.delete(peerId);
  }

  isConnectedToMesh(): boolean {
    return Array.from(this.peers.values()).some(p => p.isConnected);
  }

  getPeers(): AblyWebRTCPeer[] { return Array.from(this.peers.values()); }

  subscribe(event: string, callback: (data?: any) => void): () => void {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
    return () => { this.listeners[event] = this.listeners[event].filter(cb => cb !== callback); };
  }

  private emit(event: string, data?: any) {
    (this.listeners[event] || []).forEach(cb => cb(data));
  }

  // ── FIX #2 & #4: full cleanup in disconnect() ──
  async disconnect() {
    if (!this.myPeerId) return;
    try { await this.channel?.publish('peer-left', { peerId: this.myPeerId }); } catch {}

    // Remove Ably connection listeners
    this.ablyConnectionHandlers.forEach(({ event, handler }) => {
      this.ably?.connection?.off?.(event, handler);
    });
    this.ablyConnectionHandlers = [];

    this.ably?.close();
    this.peers.forEach(peer => {
      try { peer.dataChannel?.close(); } catch {}
      try { peer.connection.close(); } catch {}
    });
    this.peers.clear();
    this.pendingCandidates.clear();
    this.channel = null;
    this.ably = null;
    this.myPeerId = null;
    this.emit('disconnected');
  }
}

export const hybridMeshWebRTC = new HybridMeshWebRTC();
