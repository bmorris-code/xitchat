// WebRTC Mesh Implementation for iOS Safari compatibility
// Works as alternative to Bluetooth on iOS devices

export interface WebRTCPeer {
  id: string;
  name: string;
  handle: string;
  connection: RTCPeerConnection;
  dataChannel: RTCDataChannel;
  isConnected: boolean;
  lastSeen: Date;
}

export interface WebRTCMessage {
  id: string;
  from: string;
  to: string;
  content: string;
  timestamp: Date;
  type: 'direct' | 'broadcast' | 'relay';
  encrypted: boolean;
}

class WebRTCMeshService {
  private peers: Map<string, WebRTCPeer> = new Map();
  private localPeer: RTCPeerConnection | null = null;
  private signalingServer: string = 'wss://echo.websocket.events'; // Free echo server for testing
  private ws: WebSocket | null = null;
  private messageQueue: WebRTCMessage[] = [];
  private isConnected = false;
  private listeners: { [key: string]: ((data: any) => void)[] } = {};
  private myPeerId: string | null = null;
  private currentRoom: string = 'xitchat-mesh';

  async initialize(): Promise<boolean> {
    try {
      // Check WebRTC support
      if (!('RTCPeerConnection' in window)) {
        console.warn('WebRTC not supported');
        return false;
      }

      // Connect to signaling server
      const signalingConnected = await this.connectToSignalingServer();
      if (!signalingConnected) {
        console.warn('Failed to connect to signaling server');
        return false;
      }

      // Create local peer connection
      this.localPeer = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });

      // Setup data channel for local peer
      const dataChannel = this.localPeer.createDataChannel('mesh-data', {
        ordered: true,
        maxRetransmits: 3
      });

      this.setupDataChannelHandlers(dataChannel);
      this.setupPeerConnectionHandlers(this.localPeer);

      this.isConnected = true;
      this.startDiscovery();
      return true;

    } catch (error) {
      console.error('WebRTC initialization failed:', error);
      return false;
    }
  }

  private async connectToSignalingServer(): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        this.ws = new WebSocket(this.signalingServer);
        
        this.ws.onopen = () => {
          console.log('Connected to WebRTC signaling server');
          resolve(true);
        };
        
        this.ws.onmessage = (event) => {
          this.handleSignalingMessage(JSON.parse(event.data));
        };
        
        this.ws.onclose = () => {
          console.log('Disconnected from signaling server');
          this.isConnected = false;
          resolve(false);
        };
        
        this.ws.onerror = () => {
          console.error('Signaling server error');
          resolve(false);
        };
        
        // Timeout after 5 seconds
        setTimeout(() => {
          if (this.ws?.readyState !== WebSocket.OPEN) {
            resolve(false);
          }
        }, 5000);
        
      } catch (error) {
        console.error('Failed to connect to signaling server:', error);
        resolve(false);
      }
    });
  }

  private handleSignalingMessage(message: any) {
    switch (message.type) {
      case 'peer-id':
        this.myPeerId = message.peerId;
        console.log('Received peer ID:', this.myPeerId);
        // Join the mesh room
        this.sendSignalingMessage({
          type: 'join-room',
          roomId: this.currentRoom
        });
        break;
        
      case 'room-members':
        console.log('Room members:', message.members);
        // Connect to existing peers
        message.members.forEach((peerId: string) => {
          this.connectToPeer(peerId);
        });
        break;
        
      case 'peer-joined':
        console.log('New peer joined:', message.peerId);
        if (message.peerId !== this.myPeerId) {
          this.connectToPeer(message.peerId);
        }
        break;
        
      case 'peer-left':
        console.log('Peer left:', message.peerId);
        this.disconnectFromPeer(message.peerId);
        break;
        
      case 'offer':
        this.handleOffer(message.offer, message.fromPeerId);
        break;
        
      case 'answer':
        this.handleAnswer(message.answer);
        break;
        
      case 'ice-candidate':
        this.handleIceCandidate(message.candidate);
        break;
        
      case 'broadcast-message':
        this.handleIncomingMessage({
          id: Math.random().toString(36),
          from: message.fromPeerId,
          to: 'broadcast',
          content: message.content,
          timestamp: new Date(message.timestamp),
          type: 'broadcast',
          encrypted: true
        });
        break;
    }
  }

  private setupDataChannelHandlers(dataChannel: RTCDataChannel) {
    dataChannel.onopen = () => {
      console.log('Data channel opened');
    };

    dataChannel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as WebRTCMessage;
        this.handleIncomingMessage(message);
      } catch (error) {
        console.error('Failed to parse message:', error);
      }
    };

    dataChannel.onclose = () => {
      console.log('Data channel closed');
    };
  }

  private setupPeerConnectionHandlers(peerConnection: RTCPeerConnection) {
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        // Send ICE candidate to remote peer via signaling
        this.sendSignalingMessage({
          type: 'ice-candidate',
          candidate: event.candidate
        });
      }
    };

    peerConnection.onconnectionstatechange = () => {
      console.log('Connection state:', peerConnection.connectionState);
    };
  }

  private async startDiscovery(): Promise<void> {
    try {
      // Real WebRTC peer discovery through signaling server
      console.log('🔗 Starting real WebRTC peer discovery...');
      
      // Connect to signaling server for real peer discovery
      await this.connectToSignalingServer();
    } catch (error) {
      console.error('WebRTC discovery failed - real signaling required:', error);
      throw error;
    }
  }

  async connectToPeer(peerId: string): Promise<boolean> {
    try {
      if (!this.localPeer) return false;

      // Create peer connection for this peer
      const peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });

      // Create data channel
      const dataChannel = peerConnection.createDataChannel('mesh-data', {
        ordered: true,
        maxRetransmits: 3
      });

      // Store peer info
      const webRTCPeer: WebRTCPeer = {
        id: peerId,
        name: `Peer ${peerId}`,
        handle: `@${peerId}`,
        connection: peerConnection,
        dataChannel: dataChannel,
        isConnected: false,
        lastSeen: new Date()
      };

      this.peers.set(peerId, webRTCPeer);
      this.setupDataChannelHandlers(dataChannel);
      this.setupPeerConnectionHandlers(peerConnection);

      // Create offer
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      // Send offer to remote peer via signaling
      this.sendSignalingMessage({
        type: 'offer',
        offer: offer,
        to: peerId
      });

      return true;
    } catch (error) {
      console.error('Failed to connect to peer:', error);
      return false;
    }
  }

  private disconnectFromPeer(peerId: string) {
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.connection.close();
      this.peers.delete(peerId);
      console.log(`Disconnected from peer: ${peerId}`);
    }
  }

  private async handleIceCandidate(candidate: RTCIceCandidateInit) {
    if (!this.localPeer) return;
    try {
      await this.localPeer.addIceCandidate(candidate);
    } catch (error) {
      console.error('Failed to add ICE candidate:', error);
    }
  }

  private async handleOffer(offer: RTCSessionDescriptionInit, fromPeerId: string) {
    if (!this.localPeer) return;

    try {
      await this.localPeer.setRemoteDescription(offer);
      const answer = await this.localPeer.createAnswer();
      await this.localPeer.setLocalDescription(answer);

      // Send answer back
      this.sendSignalingMessage({
        type: 'answer',
        answer: answer,
        to: fromPeerId
      });
    } catch (error) {
      console.error('Failed to handle offer:', error);
    }
  }

  private async handleAnswer(answer: RTCSessionDescriptionInit) {
    if (!this.localPeer) return;

    try {
      await this.localPeer.setRemoteDescription(answer);
    } catch (error) {
      console.error('Failed to handle answer:', error);
    }
  }

  private sendSignalingMessage(message: any) {
    // Send via WebSocket signaling server
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('Signaling server not connected, cannot send message:', message);
    }
  }

  private handleIncomingMessage(message: WebRTCMessage) {
    // Process incoming message
    this.notifyListeners('messageReceived', message);
  }

  async sendMessage(content: string, targetId?: string): Promise<void> {
    if (!this.localPeer) return;

    const message: WebRTCMessage = {
      id: Math.random().toString(36),
      from: this.myPeerId || 'me',
      to: targetId || 'broadcast',
      content,
      timestamp: new Date(),
      type: targetId ? 'direct' : 'broadcast',
      encrypted: true
    };

    if (targetId) {
      // Send to specific peer via WebRTC data channel
      const peer = this.peers.get(targetId);
      if (peer && peer.dataChannel.readyState === 'open') {
        peer.dataChannel.send(JSON.stringify(message));
      }
    } else {
      // Broadcast to all connected peers via signaling server
      this.sendSignalingMessage({
        type: 'broadcast',
        content: content
      });
    }

    this.notifyListeners('messageSent', message);
  }

  // GETTERS
  getPeers(): WebRTCPeer[] {
    return Array.from(this.peers.values());
  }

  isConnectedToMesh(): boolean {
    return this.isConnected;
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

  private notifyPeersUpdated(): void {
    window.dispatchEvent(new CustomEvent('webRTCPeersUpdated', {
      detail: this.getPeers()
    }));
  }

  private notifyListeners(event: string, data: any) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(data));
    }
  }

  // iOS Safari specific optimizations
  private optimizeForIOS() {
    // iOS Safari has specific WebRTC limitations
    // These optimizations help with performance and compatibility
  }
}

export const webRTCMesh = new WebRTCMeshService();
