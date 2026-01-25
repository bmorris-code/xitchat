import { hybridMesh, HybridMeshPeer, HybridMeshMessage } from './hybridMesh';
import { meshPermissions } from './meshPermissions';
import { xcEconomy } from './xcEconomy';
import { getXitBotResponse } from './hybridAI';
import { networkStateManager } from './networkStateManager';

// Mesh data types
export interface MeshDataPacket {
  id: string;
  type: 'user_profile' | 'chat_message' | 'marketplace_listing' | 'banking_transaction' | 'node_status' | 'ai_request';
  nodeId: string;
  timestamp: number;
  data: any;
  version: number;
  signature?: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  ttl: number; // Time to live in milliseconds
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
  private dataVersion = 1;

  constructor() {
    this.initializeMeshSync();
    this.startBackgroundSync();
    this.loadLocalData();
  }

  private initializeMeshSync() {
    window.addEventListener('meshDataReceived', (event: any) => {
      this.handleIncomingData(event.detail);
    });

    window.addEventListener('hybridPeersUpdated', (event: any) => {
      this.updateNodeStatuses(event.detail);
    });
  }

  private startBackgroundSync() {
    this.syncInterval = setInterval(() => {
      this.performBackgroundSync();
    }, 30000);

    setInterval(() => {
      this.cleanupExpiredData();
    }, 300000);
  }

  private loadLocalData() {
    try {
      const savedData = localStorage.getItem('mesh_data_store');
      if (savedData) {
        const packets: MeshDataPacket[] = JSON.parse(savedData);
        packets.forEach(packet => {
          this.dataStore.set(packet.id, packet);
        });
      }

      const savedStatuses = localStorage.getItem('mesh_node_statuses');
      if (savedStatuses) {
        const statuses: MeshNodeStatus[] = JSON.parse(savedStatuses);
        statuses.forEach(status => {
          this.nodeStatuses.set(status.nodeId, status);
        });
      }
    } catch (error) {
      console.error('Failed to load mesh data:', error);
    }
  }

  private saveLocalData() {
    try {
      const packets = Array.from(this.dataStore.values());
      localStorage.setItem('mesh_data_store', JSON.stringify(packets));

      const statuses = Array.from(this.nodeStatuses.values());
      localStorage.setItem('mesh_node_statuses', JSON.stringify(statuses));
    } catch (error) {
      console.error('Failed to save mesh data:', error);
    }
  }

  async broadcastData(type: MeshDataPacket['type'], data: any, priority: MeshDataPacket['priority'] = 'normal'): Promise<string> {
    const packet: MeshDataPacket = {
      id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      nodeId: 'me',
      timestamp: Date.now(),
      data,
      version: this.dataVersion++,
      priority,
      ttl: this.getTTLForType(type)
    };

    this.dataStore.set(packet.id, packet);
    this.saveLocalData();
    await this.broadcastPacket(packet);
    this.notifyListeners('dataBroadcasted', packet);
    return packet.id;
  }

  private async broadcastPacket(packet: MeshDataPacket): Promise<void> {
    const peers = hybridMesh.getPeers();
    if (peers.length === 0) {
      this.notifyListeners('dataBroadcasted', packet);
      return;
    }

    await hybridMesh.sendMessage(JSON.stringify({
      type: 'mesh_data',
      payload: packet
    }));
  }

  private handleIncomingData(message: HybridMeshMessage) {
    try {
      const meshData = message.content as any;
      if (meshData.type !== 'mesh_data') return;

      const packet: MeshDataPacket = meshData.payload;

      if (!this.hasPermissionToReceive(packet)) return;
      if (packet.ttl && (Date.now() - packet.timestamp) > packet.ttl) return;

      const existingPacket = this.dataStore.get(packet.id);
      if (existingPacket) {
        const conflict = this.resolveConflict(existingPacket, packet);
        if (conflict) {
          this.conflicts.push(conflict);
          this.notifyListeners('dataConflict', conflict);
        }
      }

      this.dataStore.set(packet.id, packet);
      this.saveLocalData();
      this.notifyListeners('dataReceived', packet);
      this.relayPacket(packet, message.from);

      if (packet.type === 'ai_request') {
        this.handleAIRequest(packet);
      }
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

  private resolveConflict(local: MeshDataPacket, remote: MeshDataPacket): MeshDataConflict | null {
    if (local.version !== remote.version) {
      const resolution = local.version > remote.version ? 'local_wins' : 'remote_wins';
      return { packetId: local.id, localData: local.data, remoteData: remote.data, conflictType: 'version', resolution };
    }
    if (local.timestamp !== remote.timestamp) {
      const resolution = local.timestamp > remote.timestamp ? 'local_wins' : 'remote_wins';
      return { packetId: local.id, localData: local.data, remoteData: remote.data, conflictType: 'timestamp', resolution };
    }
    return null;
  }

  private async relayPacket(packet: MeshDataPacket, sourceNodeId: string) {
    if (packet.nodeId === 'me') return;
    if (packet.ttl && (Date.now() - packet.timestamp) > packet.ttl * 0.8) return;

    xcEconomy.addXC(1, `Mesh Relay Reward: ${packet.type}`, `relay_${packet.id}`);

    const peers = hybridMesh.getPeers().filter(p => p.id !== sourceNodeId);
    if (peers.length > 0) {
      await hybridMesh.sendMessage(JSON.stringify({
        type: 'mesh_data',
        payload: packet,
        isRelayed: true
      }));
    }
  }

  private async handleAIRequest(packet: MeshDataPacket) {
    const nostr = networkStateManager.getStatus().services.get('nostr');
    const webrtc = networkStateManager.getStatus().services.get('ablyWebRTC');
    const hasInternet = (nostr?.isConnected && nostr?.isHealthy) || (webrtc?.isConnected && webrtc?.isHealthy);

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
          nodeId: peer.id, handle: peer.handle, avatar: `https://picsum.photos/seed/${peer.handle}/200`,
          mood: 'Connected to mesh', status: 'online', lastSeen: Date.now(),
          capabilities: ['chat', 'trade', 'banking'], dataVersion: 1
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

  private performBackgroundSync() {
    if (this.isSyncing) return;
    this.isSyncing = true;
    const highPriorityPackets = Array.from(this.dataStore.values())
      .filter(packet => packet.priority === 'high' || packet.priority === 'critical')
      .slice(0, 10);
    highPriorityPackets.forEach(packet => this.broadcastPacket(packet));
    this.requestDataSync();
    this.isSyncing = false;
  }

  private async requestDataSync() {
    const syncRequest = { type: 'sync_request', nodeId: 'me', timestamp: Date.now(), dataVersion: this.dataVersion };
    const peers = hybridMesh.getPeers();
    if (peers.length === 0) return;
    await hybridMesh.sendMessage(JSON.stringify(syncRequest));
  }

  private cleanupExpiredData() {
    const now = Date.now();
    const expiredPackets: string[] = [];
    this.dataStore.forEach((packet, id) => {
      if (packet.ttl && (now - packet.timestamp) > packet.ttl) expiredPackets.push(id);
    });
    expiredPackets.forEach(id => this.dataStore.delete(id));
    if (expiredPackets.length > 0) {
      this.saveLocalData();
      this.notifyListeners('dataCleanedUp', expiredPackets);
    }
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

  async syncUserProfile(profile: any): Promise<string> { return this.broadcastData('user_profile', profile, 'high'); }
  async syncChatMessage(message: any): Promise<string> { return this.broadcastData('chat_message', message, 'normal'); }
  async syncMarketplaceListing(listing: any): Promise<string> { return this.broadcastData('marketplace_listing', listing, 'normal'); }
  async syncBankingTransaction(transaction: any): Promise<string> { return this.broadcastData('banking_transaction', transaction, 'high'); }
  async syncNodeStatus(status: any): Promise<string> { return this.broadcastData('node_status', status, 'low'); }
  async syncAIRequest(text: string): Promise<string> { return this.broadcastData('ai_request', { text }, 'normal'); }

  getUserProfiles(): MeshDataPacket[] { return Array.from(this.dataStore.values()).filter(packet => packet.type === 'user_profile'); }
  getChatMessages(): MeshDataPacket[] { return Array.from(this.dataStore.values()).filter(packet => packet.type === 'chat_message'); }
  getMarketplaceListings(): MeshDataPacket[] { return Array.from(this.dataStore.values()).filter(packet => packet.type === 'marketplace_listing'); }
  getBankingTransactions(): MeshDataPacket[] { return Array.from(this.dataStore.values()).filter(packet => packet.type === 'banking_transaction'); }
  getNodeStatuses(): MeshNodeStatus[] { return Array.from(this.nodeStatuses.values()); }
  getConflicts(): MeshDataConflict[] { return this.conflicts; }

  subscribe(event: string, callback: (data: any) => void): () => void {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
    return () => { this.listeners[event] = this.listeners[event].filter(cb => cb !== callback); };
  }

  private notifyListeners(event: string, data: any) {
    if (this.listeners[event]) this.listeners[event].forEach(callback => callback(data));
  }

  resolveConflictManually(packetId: string, resolution: 'local_wins' | 'remote_wins'): void {
    const conflictIndex = this.conflicts.findIndex(c => c.packetId === packetId);
    if (conflictIndex >= 0) {
      this.conflicts.splice(conflictIndex, 1);
      this.notifyListeners('conflictResolved', { packetId, resolution });
    }
  }

  destroy() { if (this.syncInterval) clearInterval(this.syncInterval); this.saveLocalData(); }
}

export const meshDataSync = new MeshDataSyncService();
