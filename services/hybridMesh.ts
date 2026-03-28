// Hybrid Mesh Service - Bluetooth + WebRTC + Broadcast + WiFi P2P + Nostr
// Automatically chooses best available P2P method and combines them

import { workingBluetoothMesh, WorkingMeshNode } from './workingBluetoothMesh';
import { wifiP2P, WiFiPeer } from './wifiP2P';
import { nostrService, NostrPeer } from './nostrService';
import { broadcastMesh, BroadcastPeer } from './broadcastMesh';
import { realtimeRadar } from './realtimeRadar';
import { realTorService } from './realTorService';
import { realPowService } from './realPowService';
import { hybridMeshWebRTC as ablyWebRTC } from './ablyWebRTC';
import { networkStateManager } from './networkStateManager';
import { androidPermissions } from './androidPermissions';
import { presenceBeacon } from './presenceBeacon';
import { identityService } from './identityService';
import { trustStore } from './trustStore';

export type MeshConnectionType = 'bluetooth' | 'webrtc' | 'broadcast' | 'wifi' | 'nostr';

export interface HybridMeshPeer {
  id: string;
  name: string;
  handle: string;
  connectionType: MeshConnectionType;
  isConnected: boolean;
  lastSeen: number;
  signalStrength?: number;
  capabilities: string[];
  serviceId?: string;
}

export interface HybridMeshMessage {
  id: string;
  from: string;
  to: string;
  content: string;
  timestamp: number;
  connectionType: MeshConnectionType;
  encrypted: boolean;
  isBridged?: boolean;
  tor?: boolean;
  pow?: any;
  senderHandle?: string;
  senderName?: string;
  encryptedData?: any;
  sig?: string;
  pk?: string;
  sig2?: string;
  pk2?: string;
  verified?: boolean;
}

class HybridMeshService {
  private activeServices = {
    bluetooth: false,
    webrtc: false,
    wifi: false,
    nostr: false,
    broadcast: false,
    local: false
  };

  private peers: Map<string, HybridMeshPeer> = new Map();
  private isInitialized = false;
  private listeners: { [key: string]: ((data: any) => void)[] } = {};
  private bridgeStats = { bridgedIn: 0, bridgedOut: 0 };
  private isBridgeEnabled = true;

  private fallbackHandle(id?: string): string {
    const source = (id || 'peer').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    return `@${source.slice(0, 8) || 'peer'}`;
  }

  private fallbackName(id?: string): string {
    const source = (id || 'peer').replace(/[^a-zA-Z0-9]/g, '');
    return `Peer ${source.slice(0, 8) || 'peer'}`;
  }

  private isLikelyNostrId(id?: string): boolean {
    if (!id) return false;
    return /^[0-9a-f]{64}$/i.test(id) || id.startsWith('npub');
  }

  private normalizePeerName(name: any, id: string): string {
    const text = typeof name === 'string' ? name.trim() : '';
    if (!text || /^unknown$/i.test(text) || /^null$/i.test(text)) return this.fallbackName(id);
    return text;
  }

  private normalizePeerHandle(handle: any, id: string): string {
    const text = typeof handle === 'string' ? handle.trim() : '';
    if (!text || /^@?unknown$/i.test(text) || /^@?null$/i.test(text)) return this.fallbackHandle(id);
    return text.startsWith('@') ? text : `@${text}`;
  }

  private updatePeerIdentityFromMessage(
    fromId: string,
    serviceId: string | undefined,
    senderHandle?: string,
    senderName?: string
  ): void {
    if (!fromId) return;
    const current = this.peers.get(fromId);
    const normalizedHandle = senderHandle ? this.normalizePeerHandle(senderHandle, fromId) : undefined;
    const normalizedName = senderName ? this.normalizePeerName(senderName, fromId) : undefined;

    if (current) {
      const nextHandle = normalizedHandle || current.handle;
      const nextName = normalizedName || current.name;
      if (nextHandle !== current.handle || nextName !== current.name) {
        this.peers.set(fromId, { ...current, handle: nextHandle, name: nextName, lastSeen: Date.now() });
        this.notifyPeersUpdated();
      }
      return;
    }

    if (!normalizedHandle && !normalizedName) return;
    this.peers.set(fromId, {
      id: fromId,
      name: normalizedName || this.fallbackName(fromId),
      handle: normalizedHandle || this.fallbackHandle(fromId),
      connectionType: 'bluetooth',
      isConnected: true,
      lastSeen: Date.now(),
      capabilities: ['chat'],
      serviceId: serviceId || fromId
    });
    this.notifyPeersUpdated();
  }

  async initialize(): Promise<MeshConnectionType[]> {
    try {
      const isNativeAndroid = (window as any).Capacitor?.isNativePlatform() &&
        (window as any).Capacitor?.getPlatform() === 'android';

      if (isNativeAndroid) await androidPermissions.requestAllCriticalPermissions();

      try {
        const handle = localStorage.getItem('xitchat_handle') || 'anon';
        const name = localStorage.getItem('xitchat_name') || handle || 'Anonymous';
        wifiP2P.setUserInfo(name, handle.startsWith('@') ? handle : `@${handle}`);
      } catch {}

      const initializedTypes: MeshConnectionType[] = [];

      const broadcastSuccess = await this.startBroadcastMesh();
      if (broadcastSuccess) initializedTypes.push('broadcast');

      const nostrSuccess = await this.startNostr();
      if (nostrSuccess) initializedTypes.push('nostr');

      const webrtcSuccess = await this.startWebRTC();
      if (webrtcSuccess) initializedTypes.push('webrtc');

      if (isNativeAndroid) {
        const wifiSuccess = await this.startWiFiP2P();
        if (wifiSuccess) initializedTypes.push('wifi');

        const bluetoothSuccess = await this.startBluetooth();
        if (bluetoothSuccess) initializedTypes.push('bluetooth');
      }

      this.isInitialized = true;
      return initializedTypes;
    } catch (error) {
      console.error('Mesh initialization failed:', error);
      return [];
    }
  }

  private async startBroadcastMesh(): Promise<boolean> {
    try {
      const success = await broadcastMesh.initialize();
      if (success) {
        this.activeServices.broadcast = true;
        broadcastMesh.subscribe('peersUpdated', (peers: BroadcastPeer[]) => this.updatePeers(peers, 'broadcast'));
        broadcastMesh.subscribe('messageReceived', (msg: any) => this.handleMessage('broadcast', msg));
        return true;
      }
      return false;
    } catch { return false; }
  }

  private async startWiFiP2P(): Promise<boolean> {
    try {
      const success = await wifiP2P.initialize();
      if (success) {
        this.activeServices.wifi = true;
        wifiP2P.startDiscovery();
        wifiP2P.subscribe('peerFound', (peer: WiFiPeer) => this.updateSinglePeer(peer, 'wifi'));
        wifiP2P.subscribe('messageReceived', (msg: any) => this.handleMessage('wifi', msg));
        return true;
      }
      return false;
    } catch { return false; }
  }

  private async startNostr(): Promise<boolean> {
    try {
      const success = await Promise.race<boolean>([
        nostrService.initialize(),
        new Promise<boolean>(resolve => setTimeout(() => resolve(false), 8000))
      ]);
      if (success) {
        this.activeServices.nostr = true;
        nostrService.subscribe('peerUpdated', (peer: NostrPeer) => this.updateSinglePeer(peer, 'nostr'));
        nostrService.subscribe('messageReceived', (msg: any) => this.handleMessage('nostr', msg));
        return true;
      }
      return false;
    } catch { return false; }
  }

  private async startBluetooth(): Promise<boolean> {
    try {
      const success = await workingBluetoothMesh.initialize();
      if (success) {
        this.activeServices.bluetooth = true;
        workingBluetoothMesh.subscribe('peersUpdated', (peers: WorkingMeshNode[]) => this.updatePeers(peers, 'bluetooth'));
        workingBluetoothMesh.subscribe('messageReceived', (msg: any) => this.handleMessage('bluetooth', msg));
        workingBluetoothMesh.startScanning().catch(() => {});
        return true;
      }
      return false;
    } catch { return false; }
  }

  private async startWebRTC(): Promise<boolean> {
    try {
      // Use token auth — master key stays server-side, client gets a short-lived token
      const apiBase = import.meta.env.VITE_API_BASE_URL || '';
      const authUrl = `${apiBase}/api/ably-token`;
      const success = await ablyWebRTC.initialize(authUrl);
      if (success) {
        this.activeServices.webrtc = true;
        ablyWebRTC.subscribe('messageReceived', (msg: any) => this.handleMessage('webrtc', msg));
        return true;
      }
      return false;
    } catch { return false; }
  }

  private updatePeers(servicePeers: any[], type: MeshConnectionType) {
    servicePeers.forEach(peer => this.updateSinglePeer(peer, type));
    this.notifyPeersUpdated();
  }

  private updateSinglePeer(peer: any, type: MeshConnectionType) {
    const peerId = peer.id || 'peer';
    const hybridPeer: HybridMeshPeer = {
      id: peerId,
      name: this.normalizePeerName(peer.name, peerId),
      handle: this.normalizePeerHandle(peer.handle, peerId),
      connectionType: type,
      isConnected: peer.isConnected !== undefined ? peer.isConnected : true,
      lastSeen: peer.lastSeen instanceof Date ? peer.lastSeen.getTime() : (peer.lastSeen || Date.now()),
      signalStrength: peer.signalStrength,
      capabilities: peer.capabilities || ['chat'],
      serviceId: peer.id
    };
    this.peers.set(peerId, hybridPeer);
    if (hybridPeer.isConnected) this.addPeerToPresenceBeacon(hybridPeer, type);
  }

  private addPeerToPresenceBeacon(peer: HybridMeshPeer, connectionType: MeshConnectionType): void {
    if (connectionType === 'broadcast') return;
    try {
      presenceBeacon.addExternalPeer({
        pubkey: peer.id,
        device: 'mobile',
        role: 'edge',
        caps: [connectionType] as any,
        rooms: ['global'],
        lastSeen: peer.lastSeen,
        ttl: 45,
        signalStrength: peer.signalStrength,
        geohash: '11001',
        timestamp: Date.now()
      });
    } catch {}
  }

  private async handleChatMessage(
    content: string,
    from: string,
    connectionType: MeshConnectionType,
    metadata?: {
      messageId?: string; timestamp?: number; senderHandle?: string; senderName?: string;
      encryptedData?: any; sig?: string; pk?: string; sig2?: string; pk2?: string; verified?: boolean;
    }
  ) {
    const hybridMessage: HybridMeshMessage = {
      id: metadata?.messageId || Math.random().toString(36).substr(2, 9),
      from,
      to: 'me',
      content,
      timestamp: metadata?.timestamp || Date.now(),
      connectionType,
      encrypted: !!metadata?.encryptedData,
      encryptedData: metadata?.encryptedData,
      isBridged: false,
      senderHandle: metadata?.senderHandle,
      senderName: metadata?.senderName,
      sig: metadata?.sig,
      pk: metadata?.pk,
      sig2: metadata?.sig2,
      pk2: metadata?.pk2,
      verified: metadata?.verified
    };

    this.notifyListeners('messageReceived', hybridMessage);
    if (this.isBridgeEnabled) this.handleBridging(hybridMessage);
  }

  private tryParseJsonWithRecovery(raw: string): any | null {
    const text = (raw || '').trim();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      if (text.startsWith('{') && !text.endsWith('}')) {
        try { return JSON.parse(`${text}}`); } catch { return null; }
      }
      return null;
    }
  }

  private extractWrappedContentFallback(raw: string): { content: string; metadata: any } | null {
    const match = raw.match(/"content":"((?:\\.|[^"\\])*)"/);
    if (!match) return null;
    try {
      const content = JSON.parse(`"${match[1]}"`);
      const metadata: any = {};
      const tsMatch = raw.match(/"timestamp":(\d+)/);
      const idMatch = raw.match(/"messageId":"([^"]+)"/);
      if (tsMatch) metadata.timestamp = Number(tsMatch[1]);
      if (idMatch) metadata.messageId = idMatch[1];
      return { content, metadata };
    } catch { return null; }
  }

  private isTransportControlPayload(content: string): boolean {
    const v = (content || '').trim();
    if (!v) return true;
    return v.startsWith('xitchat-broadcast-v1-') ||
      v.startsWith('xitchat-wifi:') ||
      v.startsWith('xitchat-economy-sync:');
  }

  private async handleMessage(connectionType: MeshConnectionType, message: any) {
    // ── FIX #2: Guard against re-bridged messages at the wire level ──────────
    // Check in-memory flag first (fast path for local messages)
    if (message.isBridged === true) return;
    // Then check if the flag is serialized inside message.content (wire path)
    if (typeof message.content === 'string' && message.content.startsWith('{')) {
      try {
        const quick = JSON.parse(message.content);
        if (quick?.isBridged === true) return;
        // Also check one level deeper — inner wrapped content
        if (typeof quick?.content === 'string' && quick.content.startsWith('{')) {
          try {
            const inner = JSON.parse(quick.content);
            if (inner?.isBridged === true) return;
          } catch {}
        }
      } catch {}
    }
    // ─────────────────────────────────────────────────────────────────────────

    let content = message.content;
    let metadata: any = {};

    try {
      if (typeof content !== 'string') return;
      if (this.isTransportControlPayload(content)) return;

      if (content.startsWith('{')) {
        const parsed = this.tryParseJsonWithRecovery(content);

        if (parsed && parsed.content !== undefined && parsed.timestamp !== undefined) {
          content = parsed.content;
          metadata = {
            tor: parsed.tor,
            pow: parsed.pow,
            timestamp: parsed.timestamp,
            messageId: parsed.messageId,
            encryptedData: parsed.encryptedData,
            sig: parsed.sig,
            pk: parsed.pk,
            sig2: parsed.sig2,
            pk2: parsed.pk2
          };

          if (metadata.sig2 && metadata.pk2) {
            const ok = await identityService.verifyEnvelope({
              content,
              timestamp: metadata.timestamp,
              messageId: metadata.messageId,
              pk: metadata.pk2,
              sig: metadata.sig2
            });
            if (!ok) return;
            metadata.verified = await trustStore.isVerified(metadata.pk2);
          } else if (metadata.sig && metadata.pk) {
            const verified = await (nostrService as any).verifyData(
              content + metadata.timestamp + metadata.messageId,
              metadata.sig,
              metadata.pk,
              Math.floor(metadata.timestamp / 1000)
            );
            if (!verified) return;
          } else {
            return;
          }
        } else if (!parsed) {
          const recovered = this.extractWrappedContentFallback(content);
          if (recovered) {
            content = recovered.content;
            metadata = recovered.metadata;
          }
        }

        if (content.startsWith('{')) {
          const inner = this.tryParseJsonWithRecovery(content);
          if (!inner) return;

          // ── FIX #2 (deep): also catch isBridged on unwrapped inner object ──
          if (inner.isBridged === true) return;

          if (inner.type === 'chat_message') {
            const text = (typeof inner.data === 'string' && inner.data) ||
              (typeof inner.data?.text === 'string' && inner.data.text) || '';
            const senderHandle = inner.data?.senderHandle || inner.senderHandle;
            const senderName = inner.data?.senderName || inner.senderName;

            if (senderHandle || senderName) {
              this.updatePeerIdentityFromMessage(message.from, message.from, senderHandle, senderName);
            }
            if (!text) return;
            this.handleChatMessage(text, message.from, connectionType, { ...metadata, senderHandle, senderName });
            return;
          }

          if (typeof inner.type === 'string') {
            this.notifyListeners('messageReceived', { ...message, ...inner, connectionType });
            return;
          }
          if (!inner.type && !inner.content && !inner.text) return;
        }
      }

      this.handleChatMessage(content, message.from, connectionType, metadata);
    } catch (error) {
      console.error('Failed to parse hybrid mesh message:', error);
    }
  }

  private handleBridging(message: HybridMeshMessage) {
    // ── FIX #2: Must be the very first check — stops the bridge feedback loop ─
    if (message.isBridged === true) return;
    // ─────────────────────────────────────────────────────────────────────────

    const activeCount = Object.values(this.activeServices).filter(v => v).length;
    if (activeCount < 2) return;

    const isLocalSource =
      message.connectionType === 'bluetooth' ||
      message.connectionType === 'wifi';

    // Bridge local → Nostr (ONE broadcast only — duplicate block removed)
    if (isLocalSource && this.activeServices.nostr) {
      console.log(`📡 Bridging message from ${message.from} to Nostr layer`);
      this.bridgeStats.bridgedOut++;
      void nostrService.broadcastMessage(
        JSON.stringify({ ...message, isBridged: true })
      ).catch((error) => {
        console.debug('Bridge to Nostr skipped:', error);
      });
    }

    // Bridge Nostr → local mesh
    if (message.connectionType === 'nostr' && (this.activeServices.bluetooth || this.activeServices.wifi)) {
      this.bridgeStats.bridgedIn++;
      const bridged = JSON.stringify({ ...message, isBridged: true });
      if (this.activeServices.bluetooth) {
        Array.from(this.peers.values())
          .filter(p => p.connectionType === 'bluetooth')
          .forEach(p => workingBluetoothMesh.sendMessage(p.serviceId!, bridged).catch(() => {}));
      }
      if (this.activeServices.wifi) {
        Array.from(this.peers.values())
          .filter(p => p.connectionType === 'wifi' && !!p.serviceId)
          .forEach(p => wifiP2P.sendMessage(p.serviceId!, bridged).catch(() => {}));
      }
    }
  }

  async sendMessage(content: string, targetId?: string, encryptedData?: any, messageId?: string): Promise<boolean> {
    try {
      const timestamp = Date.now();
      const mId = messageId || Math.random().toString(36).substr(2, 9);
      const torStatus = realTorService.getStatus().connected;

      const signed = await identityService.signEnvelope({ content, timestamp, messageId: mId });

      let sig = '';
      let pk = '';
      if (nostrService.isConnected()) {
        try {
          sig = await (nostrService as any).signData(content + timestamp + mId, Math.floor(timestamp / 1000));
          pk = (nostrService as any).getPublicKey();
        } catch {}
      }

      const payload = JSON.stringify({
        content,
        encryptedData,
        tor: torStatus,
        timestamp,
        messageId: mId,
        sig,
        pk,
        sig2: signed.sig,
        pk2: signed.pk
      });

      let sentSuccessfully = false;
      let connectionType: MeshConnectionType | null = null;

      if (targetId) {
        let peer = this.peers.get(targetId);
        if (!peer) {
          peer = Array.from(this.peers.values()).find(p =>
            p.serviceId === targetId || p.handle === targetId || p.id === targetId
          );
        }

        if (!peer && this.isLikelyNostrId(targetId)) {
          try {
            sentSuccessfully = await nostrService.sendDirectMessage(targetId, payload);
            if (sentSuccessfully) {
              this.notifyListeners('messageSent', { messageId: mId, to: targetId, connectionType: 'nostr', timestamp });
              return true;
            }
          } catch {}
        }

        if (peer) {
          connectionType = peer.connectionType;
          try {
            switch (peer.connectionType) {
              case 'bluetooth':
                if (peer.serviceId) { await workingBluetoothMesh.sendMessage(peer.serviceId, payload); sentSuccessfully = true; }
                break;
              case 'wifi':
                if (peer.serviceId) { await wifiP2P.sendMessage(peer.serviceId, payload); sentSuccessfully = true; }
                break;
              case 'nostr':
                const nostrTarget = peer.serviceId || peer.id;
                if (this.isLikelyNostrId(nostrTarget)) {
                  sentSuccessfully = await nostrService.sendDirectMessage(nostrTarget, payload);
                }
                break;
              case 'broadcast':
                if (peer.serviceId) { await broadcastMesh.sendMessage(peer.serviceId, payload); sentSuccessfully = true; }
                break;
              case 'webrtc':
                await ablyWebRTC.sendMessage(payload);
                sentSuccessfully = true;
                break;
            }
            if (sentSuccessfully) {
              this.notifyListeners('messageSent', { messageId: mId, to: targetId, connectionType: peer.connectionType, timestamp });
            }
            return sentSuccessfully;
          } catch {}
        }
      }

      let broadcastSuccess = false;

      if (this.activeServices.bluetooth) {
        for (const p of Array.from(this.peers.values()).filter(p => p.connectionType === 'bluetooth' && p.isConnected)) {
          try { await workingBluetoothMesh.sendMessage(p.serviceId!, payload); broadcastSuccess = true; } catch {}
        }
      }
      if (this.activeServices.wifi) {
        for (const p of Array.from(this.peers.values()).filter(p => p.connectionType === 'wifi' && p.isConnected)) {
          try { await wifiP2P.sendMessage(p.serviceId!, payload); broadcastSuccess = true; } catch {}
        }
      }
      if (this.activeServices.nostr) {
        try { await nostrService.broadcastMessage(payload); broadcastSuccess = true; } catch {}
      }
      if (this.activeServices.broadcast) {
        try { await broadcastMesh.broadcastMessage(payload); broadcastSuccess = true; } catch {}
      }

      if (broadcastSuccess) {
        this.notifyListeners('messageSent', {
          messageId: mId,
          to: targetId || 'broadcast',
          connectionType: connectionType || 'broadcast',
          timestamp
        });
      }

      return broadcastSuccess;
    } catch (error) {
      console.error('Failed to send mesh message:', error);
      return false;
    }
  }

  // ── FIX #3: addExternalPeer — skip notify when nothing meaningful changed ──
  addExternalPeer(peer: any, type: MeshConnectionType) {
    const peerId = peer.id || 'peer';
    const existing = this.peers.get(peerId);

    // Compute what the new entry would look like
    const nextHandle = this.normalizePeerHandle(peer.handle, peerId);
    const nextConnected = peer.isConnected !== undefined ? peer.isConnected : true;

    if (
      existing &&
      existing.isConnected === nextConnected &&
      existing.connectionType === type &&
      existing.handle === nextHandle
    ) {
      // Nothing meaningful changed — silently refresh lastSeen only, no event fired
      this.peers.set(peerId, { ...existing, lastSeen: peer.lastSeen || Date.now() });
      return;
    }

    // Genuinely new or changed peer — update and notify
    this.updateSinglePeer(peer, type);
    this.notifyPeersUpdated();
  }
  // ─────────────────────────────────────────────────────────────────────────

  getConnectionInfo() {
    const active = this.getActiveServices();
    return {
      type: (active[0] as MeshConnectionType) || 'broadcast',
      peerCount: this.peers.size,
      isRealConnection: active.length > 0
    };
  }

  isConnectedToMesh() { return this.getActiveServices().length > 0; }
  getBridgeStats() { return { ...this.bridgeStats }; }

  async refreshLocalMeshConnectivity() {
    if (this.activeServices.bluetooth) await workingBluetoothMesh.startScanning().catch(() => {});
    if (this.activeServices.wifi) wifiP2P.startDiscovery();
  }

  getActiveServices() { return Object.entries(this.activeServices).filter(([_, v]) => v).map(([k]) => k); }
  getPeers() { return Array.from(this.peers.values()); }
  private notifyListeners(event: string, data: any) { (this.listeners[event] || []).forEach(cb => cb(data)); }
  private notifyPeersUpdated() { this.notifyListeners('peersUpdated', this.getPeers()); }
  subscribe(event: string, callback: (data: any) => void) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
    return () => { this.listeners[event] = this.listeners[event].filter(l => l !== callback); };
  }
}

export const hybridMesh = new HybridMeshService();
