import { hybridMesh, HybridMeshPeer, HybridMeshMessage } from './hybridMesh';
import { meshPermissions } from './meshPermissions';
import { xcEconomy } from './xcEconomy';
import { getXitBotResponse } from './hybridAI';
import { networkStateManager } from './networkStateManager';

export interface MeshDataPacket {
  id: string;
  type: 'user_profile' | 'chat_message' | 'marketplace_listing' | 'banking_transaction' | 'node_status' | 'ai_request';
  nodeId: string;
  timestamp: number;
  data: any;
  version: number;
  signature?: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  ttl: number;
}

export interface MeshDataConflict {
  packetId: string;
  localData: any;
  remoteData: any;
  conflictType: 'version' | 'timestamp' | 'data';
  resolution: 'local_wins' | 'remote_wins' | 'merge' | 'manual';
}

export interface MeshNodeStatus {
  nodeId: string;
  handle: string;
  avatar: string;
  mood: string;
  location?: { lat: number; lng: number };
  status: 'online' | 'away' | 'offline';
  lastSeen: number;
  capabilities: string[];
  dataVersion: number;
}

class MeshDataSyncService {
  private dataStore: Map<string, MeshDataPacket> = new Map();
  private nodeStatuses: Map<string, MeshNodeStatus> = new Map();
  private conflicts: MeshDataConflict[] = [];
  private listeners: { [key: string]: ((data: any) => void)[] } = {};
  private isSyncing = false;
  private syncInterval: any = null;
  // ── FIX #4: store cleanup interval so destroy() can clear it ──
  private cleanupInterval: any = null;
  private dataVersion = 1;
  private readonly PROFILE_PACKET_ID = 'user_profile_me';

  // ── FIX #5: store bound handlers so destroy() can remove them ──
  private onMeshData = (e: any) => this.handleIncomingData(e.detail);
  private onPeersUpdated = (e: any) => this.updateNodeStatuses(e.detail);

  constructor() {
    this.initializeMeshSync();
    this.startBackgroundSync();
    this.loadLocalData();
  }

  private initializeMeshSync() {
    // ── FIX #5: use stored bound handlers ──
    window.addEventListener('meshDataReceived', this.onMeshData);
    window.addEventListener('hybridPeersUpdated', this.onPeersUpdated);
  }

  private startBackgroundSync() {
    this.syncInterval = setInterval(() => this.performBackgroundSync(), 30000);
    // ── FIX #4: store cleanup interval ──
    this.cleanupInterval = setInterval(() => this.cleanupExpiredData(), 300000);
  }

  private loadLocalData() {
    try {
      const savedData = localStorage.getItem('mesh_data_store');
      if (savedData) {
        const packets: MeshDataPacket[] = JSON.parse(savedData);
        packets.forEach(packet => this.dataStore.set(packet.id, packet));
        this.pruneStoredPackets();
      }
      const savedStatuses = localStorage.getItem('mesh_node_statuses');
      if (savedStatuses) {
        const statuses: MeshNodeStatus[] = JSON.parse(savedStatuses);
        statuses.forEach(status => this.nodeStatuses.set(status.nodeId, status));
      }
    } catch (error) {
      console.error('Failed to load mesh data:', error);
    }
  }

  private saveLocalData() {
    try {
      localStorage.setItem('mesh_data_store', JSON.stringify(Array.from(this.dataStore.values())));
      localStorage.setItem('mesh_node_statuses', JSON.stringify(Array.from(this.nodeStatuses.values())));
    } catch (error) {
      console.error('Failed to save mesh data:', error);
    }
  }

  async broadcastData(
    type: MeshDataPacket['type'],
    data: any,
    priority: MeshDataPacket['priority'] = 'normal'
  ): Promise<string> {
    const isProfile = type === 'user_profile';
    const packetId = isProfile
      ? this.PROFILE_PACKET_ID
      : `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const existing = isProfile ? this.dataStore.get(packetId) : undefined;

    const packet: MeshDataPacket = {
      id: packetId,
      type,
      nodeId: 'me',
      timestamp: Date.now(),
      data,
      version: existing ? existing.version + 1 : this.dataVersion++,
      priority,
      ttl: this.getTTLForType(type)
    };

    this.dataStore.set(packet.id, packet);
    this.saveLocalData();
    await this.broadcastPacket(packet);
    // ── FIX #1: notify ONCE here only (removed duplicate from broadcastPacket) ──
    this.notifyListeners('dataBroadcasted', packet);
    return packet.id;
  }

  private async broadcastPacket(packet: MeshDataPacket): Promise<void> {
    const peers = hybridMesh.getPeers();
    // ── FIX #1: removed notifyListeners call that was here (was firing twice) ──
    if (peers.length === 0) return;

    await hybridMesh.sendMessage(JSON.stringify({
      type: 'mesh_data',
      payload: packet
    }));
  }

  private handleIncomingData(message: HybridMeshMessage) {
    try {
      const meshData = message.content as any;
      if (meshData?.type !== 'mesh_data') return;

      // ── FIX #3: validate packet before using it ──
      const packet: MeshDataPacket = meshData?.payload;
      if (!packet?.id || !packet?.type || !packet?.nodeId) return;

      if (!this.hasPermissionToReceive(packet)) return;
      if (packet.ttl && (Date.now() - packet.timestamp) > packet.ttl) return;

      const existingPacket = this.dataStore.get(packet.id);
      if (existingPacket) {
        const conflict = this.detectConflict(existingPacket, packet);
        if (conflict) {
          this.conflicts.push(conflict);
          this.notifyListeners('dataConflict', conflict);
        }
      }

      this.dataStore.set(packet.id, packet);
      this.saveLocalData();
      this.notifyListeners('dataReceived', packet);
      this.relayPacket(packet, message.from);

      if (packet.type === 'ai_request') this.handleAIRequest(packet);
    } catch (error) {
      console.error('Failed to handle incoming mesh data:', error);
    }
  }

  private hasPermissionToReceive(packet: MeshDataPacket): boolean {
    if (packet.nodeId === 'me') return true;
    switch (packet.type) {
      case 'user_profile': return meshPermissions.canViewProfile(packet.nodeId);
      case 'chat_message': return meshPermissions.canChatWith(packet.nodeId);
      case 'marketplace_listing': return meshPermissions.canViewMarketplace(packet.nodeId);
      case 'banking_transaction': return false;
      case 'node_status': return meshPermissions.canViewNodeStatus(packet.nodeId);
      case 'ai_request': return true;
      default: return false;
    }
  }

  // ── FIX #6: renamed from resolveConflict to detectConflict (avoids name collision with public method) ──
  private detectConflict(local: MeshDataPacket, remote: MeshDataPacket): MeshDataConflict | null {
    if (local.version !== remote.version) {
      return {
        packetId: local.id,
        localData: local.data,
        remoteData: remote.data,
        conflictType: 'version',
        resolution: local.version > remote.version ? 'local_wins' : 'remote_wins'
      };
    }
    if (local.timestamp !== remote.timestamp) {
      return {
        packetId: local.id,
        localData: local.data,
        remoteData: remote.data,
        conflictType: 'timestamp',
        resolution: local.timestamp > remote.timestamp ? 'local_wins' : 'remote_wins'
      };
    }
    return null;
  }

  private async relayPacket(packet: MeshDataPacket, sourceNodeId: string) {
    if (packet.nodeId === 'me') return;
    if (packet.ttl && (Date.now() - packet.timestamp) > packet.ttl * 0.8) return;

    // ── FIX #2: check peers FIRST, only reward XC if actually relaying ──
    const peers = hybridMesh.getPeers().filter(p => p.id !== sourceNodeId && p.isConnected);
    if (peers.length === 0) return;

    xcEconomy.addXC(1, `Mesh Relay Reward: ${packet.type}`, `relay_${packet.id}`);

    // ── FIX #2: send to each peer individually (not a blind broadcast back to source) ──
    for (const peer of peers) {
      await hybridMesh.sendMessage(
        JSON.stringify({ type: 'mesh_data', payload: packet, isRelayed: true }),
        peer.id
      );
    }
  }

  private async handleAIRequest(packet: MeshDataPacket) {
    const nostr = networkStateManager.getStatus().services.get('nostr');
    const webrtc = networkStateManager.getStatus().services.get('ablyWebRTC');
    const hasInternet =
      (nostr?.isConnected && nostr?.isHealthy) ||
      (webrtc?.isConnected && webrtc?.isHealthy);

    if (!hasInternet) return;

    try {
      const response = await getXitBotResponse(packet.data.text);
      await this.broadcastData('chat_message', {
        id: `ai_resp_${packet.id}`,
        text: response,
        senderId: 'xit-bot',
        replyTo: packet.id,
        timestamp: Date.now()
      }, 'normal');
    } catch (error) {
      console.error('❌ Uplink AI Bridge failed:', error);
    }
  }

  private updateNodeStatuses(peers: HybridMeshPeer[]) {
    peers.forEach(peer => {
      let status = this.nodeStatuses.get(peer.id);
      if (!status) {
        status = {
          nodeId: peer.id,
          handle: peer.handle,
          avatar: `/icon-192.png`,
          mood: 'Connected to mesh',
          status: 'online',
          lastSeen: Date.now(),
          capabilities: ['chat', 'trade', 'banking'],
          dataVersion: 1
        };
      } else {
        status.lastSeen = Date.now();
        status.status = 'online';
      }
      this.nodeStatuses.set(peer.id, status);
    });

    const now = Date.now();
    this.nodeStatuses.forEach((status, nodeId) => {
      if (nodeId !== 'me' && !peers.find(p => p.id === nodeId)) {
        if (now - status.lastSeen > 60000) status.status = 'offline';
      }
    });

    this.saveLocalData();
    this.notifyListeners('nodeStatusesUpdated', Array.from(this.nodeStatuses.values()));
  }

  private async performBackgroundSync() {
    if (this.isSyncing) return;
    this.isSyncing = true;
    try {
      const peers = hybridMesh.getPeers().filter(peer => peer.isConnected);
      if (peers.length === 0) return;

      const now = Date.now();
      const recentHighPriorityPacket = Array.from(this.dataStore.values())
        .filter(p => (p.priority === 'high' || p.priority === 'critical') && now - p.timestamp < 120000)
        .sort((a, b) => b.timestamp - a.timestamp)[0];

      if (recentHighPriorityPacket) await this.broadcastPacket(recentHighPriorityPacket);
      await this.requestDataSync();
    } finally {
      this.isSyncing = false;
    }
  }

  private async requestDataSync() {
    const peers = hybridMesh.getPeers();
    if (peers.length === 0) return;
    await hybridMesh.sendMessage(JSON.stringify({
      type: 'sync_request',
      nodeId: 'me',
      timestamp: Date.now(),
      dataVersion: this.dataVersion
    }));
  }

  private cleanupExpiredData() {
    const now = Date.now();
    const expired: string[] = [];
    this.dataStore.forEach((packet, id) => {
      if (packet.ttl && now - packet.timestamp > packet.ttl) expired.push(id);
    });
    expired.forEach(id => this.dataStore.delete(id));
    if (expired.length > 0) {
      this.saveLocalData();
      this.notifyListeners('dataCleanedUp', expired);
    }
  }

  private pruneStoredPackets(): void {
    const now = Date.now();
    const packets = Array.from(this.dataStore.values());
    const latestProfile = packets
      .filter(p => p.type === 'user_profile')
      .sort((a, b) => b.timestamp - a.timestamp)[0];

    const pruned = packets.filter(packet => {
      if (packet.ttl && now - packet.timestamp > packet.ttl) return false;
      if (packet.type === 'user_profile' && latestProfile) return packet.id === latestProfile.id;
      return true;
    });

    this.dataStore = new Map(pruned.map(p => [p.id, p]));
    this.saveLocalData();
  }

  private getTTLForType(type: MeshDataPacket['type']): number {
    switch (type) {
      case 'chat_message': return 7 * 24 * 60 * 60 * 1000;
      case 'marketplace_listing': return 30 * 24 * 60 * 60 * 1000;
      case 'user_profile': return 24 * 60 * 60 * 1000;
      case 'banking_transaction': return 365 * 24 * 60 * 60 * 1000;
      case 'node_status': return 60 * 60 * 1000;
      case 'ai_request': return 24 * 60 * 60 * 1000;
      default: return 24 * 60 * 60 * 1000;
    }
  }

  async syncUserProfile(profile: any) { return this.broadcastData('user_profile', profile, 'high'); }
  async syncChatMessage(message: any) { return this.broadcastData('chat_message', message, 'normal'); }
  async syncMarketplaceListing(listing: any) { return this.broadcastData('marketplace_listing', listing, 'normal'); }
  async syncBankingTransaction(transaction: any) { return this.broadcastData('banking_transaction', transaction, 'high'); }
  async syncNodeStatus(status: any) { return this.broadcastData('node_status', status, 'low'); }
  async syncAIRequest(text: string) { return this.broadcastData('ai_request', { text }, 'normal'); }

  getUserProfiles() { return Array.from(this.dataStore.values()).filter(p => p.type === 'user_profile'); }
  getChatMessages() { return Array.from(this.dataStore.values()).filter(p => p.type === 'chat_message'); }
  getMarketplaceListings() { return Array.from(this.dataStore.values()).filter(p => p.type === 'marketplace_listing'); }
  getBankingTransactions() { return Array.from(this.dataStore.values()).filter(p => p.type === 'banking_transaction'); }
  getNodeStatuses() { return Array.from(this.nodeStatuses.values()); }
  getConflicts() { return this.conflicts; }

  subscribe(event: string, callback: (data: any) => void): () => void {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
    return () => { this.listeners[event] = this.listeners[event].filter(cb => cb !== callback); };
  }

  private notifyListeners(event: string, data: any) {
    (this.listeners[event] || []).forEach(cb => cb(data));
  }

  resolveConflictManually(packetId: string, resolution: 'local_wins' | 'remote_wins'): void {
    const idx = this.conflicts.findIndex(c => c.packetId === packetId);
    if (idx >= 0) {
      this.conflicts.splice(idx, 1);
      this.notifyListeners('conflictResolved', { packetId, resolution });
    }
  }

  destroy() {
    if (this.syncInterval) clearInterval(this.syncInterval);
    // ── FIX #4: clear cleanup interval ──
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
    // ── FIX #5: remove window listeners ──
    window.removeEventListener('meshDataReceived', this.onMeshData);
    window.removeEventListener('hybridPeersUpdated', this.onPeersUpdated);
    this.saveLocalData();
  }
}

export const meshDataSync = new MeshDataSyncService();

