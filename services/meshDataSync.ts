import { bluetoothMesh, MeshNode, MeshMessage } from './bluetoothMesh';
import { meshPermissions } from './meshPermissions';

// Mesh data types
export interface MeshDataPacket {
  id: string;
  type: 'user_profile' | 'chat_message' | 'marketplace_listing' | 'banking_transaction' | 'node_status';
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
  private syncQueue: MeshDataPacket[] = [];
  private listeners: { [key: string]: ((data: any) => void)[] } = {};
  private isSyncing = false;
  private syncInterval: number;
  private dataVersion = 1;

  constructor() {
    this.initializeMeshSync();
    this.startBackgroundSync();
    this.loadLocalData();
  }

  private initializeMeshSync() {
    // Listen for incoming mesh data packets
    window.addEventListener('meshDataReceived', (event: CustomEvent) => {
      this.handleIncomingData(event.detail);
    });

    // Listen for node status updates
    window.addEventListener('meshPeersUpdated', (event: CustomEvent) => {
      this.updateNodeStatuses(event.detail);
    });
  }

  private startBackgroundSync() {
    // Sync data every 30 seconds
    this.syncInterval = window.setInterval(() => {
      this.performBackgroundSync();
    }, 30000);

    // Cleanup expired data every 5 minutes
    window.setInterval(() => {
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

  // DATA SYNCHRONIZATION METHODS
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

    // Store locally
    this.dataStore.set(packet.id, packet);
    this.saveLocalData();

    // Broadcast to mesh
    await this.broadcastPacket(packet);
    this.notifyListeners('dataBroadcasted', packet);

    return packet.id;
  }

  private async broadcastPacket(packet: MeshDataPacket): Promise<void> {
    const message: MeshMessage = {
      id: `data_${packet.id}`,
      from: 'me',
      to: 'broadcast',
      content: JSON.stringify({
        type: 'mesh_data',
        payload: packet
      }),
      timestamp: new Date(),
      type: 'broadcast',
      hops: 0,
      encrypted: true
    };

    // For broadcast messages, send to all available peers
    const peers = bluetoothMesh.getPeers();
    if (peers.length === 0) {
      console.log('📡 No peers available for mesh data broadcast - storing locally');
      this.notifyListeners('dataBroadcasted', packet);
      return;
    }

    for (const peer of peers) {
      await bluetoothMesh.sendMessage(peer.id, message.content);
    }
  }

  private handleIncomingData(message: MeshMessage) {
    try {
      const meshData = JSON.parse(message.content);
      if (meshData.type !== 'mesh_data') return;

      const packet: MeshDataPacket = meshData.payload;
      
      // CHECK PERMISSIONS BEFORE PROCESSING DATA
      if (!this.hasPermissionToReceive(packet)) {
        console.log(`Permission denied for packet ${packet.id} from ${packet.nodeId}`);
        return;
      }
      
      // Check if packet is expired
      if (packet.ttl && (Date.now() - packet.timestamp) > packet.ttl) {
        return;
      }

      // Handle data conflict resolution
      const existingPacket = this.dataStore.get(packet.id);
      if (existingPacket) {
        const conflict = this.resolveConflict(existingPacket, packet);
        if (conflict) {
          this.conflicts.push(conflict);
          this.notifyListeners('dataConflict', conflict);
        }
      }

      // Store the packet
      this.dataStore.set(packet.id, packet);
      this.saveLocalData();
      this.notifyListeners('dataReceived', packet);

    } catch (error) {
      console.error('Failed to handle incoming mesh data:', error);
    }
  }

  private hasPermissionToReceive(packet: MeshDataPacket): boolean {
    // Always allow your own data
    if (packet.nodeId === 'me') return true;

    // Check permissions based on data type
    switch (packet.type) {
      case 'user_profile':
        return meshPermissions.canViewProfile(packet.nodeId);
      case 'chat_message':
        return meshPermissions.canChatWith(packet.nodeId);
      case 'marketplace_listing':
        return meshPermissions.canViewMarketplace(packet.nodeId);
      case 'banking_transaction':
        // NEVER sync banking data to other users - only your own
        return false;
      case 'node_status':
        return meshPermissions.canViewNodeStatus(packet.nodeId);
      default:
        return false; // Deny unknown data types
    }
  }

  private resolveConflict(local: MeshDataPacket, remote: MeshDataPacket): MeshDataConflict | null {
    // Version-based conflict resolution
    if (local.version !== remote.version) {
      const winner = local.version > remote.version ? local : remote;
      const resolution = local.version > remote.version ? 'local_wins' : 'remote_wins';
      
      return {
        packetId: local.id,
        localData: local.data,
        remoteData: remote.data,
        conflictType: 'version',
        resolution
      };
    }

    // Timestamp-based conflict resolution
    if (local.timestamp !== remote.timestamp) {
      const winner = local.timestamp > remote.timestamp ? local : remote;
      const resolution = local.timestamp > remote.timestamp ? 'local_wins' : 'remote_wins';
      
      return {
        packetId: local.id,
        localData: local.data,
        remoteData: remote.data,
        conflictType: 'timestamp',
        resolution
      };
    }

    return null;
  }

  private updateNodeStatuses(peers: MeshNode[]) {
    peers.forEach(peer => {
      let status = this.nodeStatuses.get(peer.id);
      
      if (!status) {
        status = {
          nodeId: peer.id,
          handle: peer.handle,
          avatar: `https://picsum.photos/seed/${peer.handle}/200`,
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

    // Mark offline nodes
    const now = Date.now();
    this.nodeStatuses.forEach((status, nodeId) => {
      if (nodeId !== 'me' && !peers.find(p => p.id === nodeId)) {
        if (now - status.lastSeen > 60000) { // 1 minute timeout
          status.status = 'offline';
        }
      }
    });

    this.saveLocalData();
    this.notifyListeners('nodeStatusesUpdated', Array.from(this.nodeStatuses.values()));
  }

  private performBackgroundSync() {
    if (this.isSyncing) return;

    this.isSyncing = true;

    // Sync high-priority data first
    const highPriorityPackets = Array.from(this.dataStore.values())
      .filter(packet => packet.priority === 'high' || packet.priority === 'critical')
      .slice(0, 10); // Limit to prevent flooding

    highPriorityPackets.forEach(packet => {
      this.broadcastPacket(packet);
    });

    // Request data sync from nearby nodes
    this.requestDataSync();

    this.isSyncing = false;
  }

  private async requestDataSync() {
    const syncRequest = {
      type: 'sync_request',
      nodeId: 'me',
      timestamp: Date.now(),
      dataVersion: this.dataVersion
    };

    // Send sync request to all available peers
    const peers = bluetoothMesh.getPeers();
    if (peers.length === 0) {
      console.log('📡 No peers available for sync request - skipping');
      return;
    }

    for (const peer of peers) {
      await bluetoothMesh.sendMessage(peer.id, JSON.stringify(syncRequest));
    }
  }

  private cleanupExpiredData() {
    const now = Date.now();
    const expiredPackets: string[] = [];

    this.dataStore.forEach((packet, id) => {
      if (packet.ttl && (now - packet.timestamp) > packet.ttl) {
        expiredPackets.push(id);
      }
    });

    expiredPackets.forEach(id => {
      this.dataStore.delete(id);
    });

    if (expiredPackets.length > 0) {
      this.saveLocalData();
      this.notifyListeners('dataCleanedUp', expiredPackets);
    }
  }

  private getTTLForType(type: MeshDataPacket['type']): number {
    switch (type) {
      case 'chat_message': return 7 * 24 * 60 * 60 * 1000; // 7 days
      case 'marketplace_listing': return 30 * 24 * 60 * 60 * 1000; // 30 days
      case 'user_profile': return 24 * 60 * 60 * 1000; // 24 hours
      case 'banking_transaction': return 365 * 24 * 60 * 60 * 1000; // 1 year
      case 'node_status': return 60 * 60 * 1000; // 1 hour
      default: return 24 * 60 * 60 * 1000; // 24 hours default
    }
  }

  // PUBLIC API METHODS
  async syncUserProfile(profile: any): Promise<string> {
    return this.broadcastData('user_profile', profile, 'high');
  }

  async syncChatMessage(message: any): Promise<string> {
    return this.broadcastData('chat_message', message, 'normal');
  }

  async syncMarketplaceListing(listing: any): Promise<string> {
    return this.broadcastData('marketplace_listing', listing, 'normal');
  }

  async syncBankingTransaction(transaction: any): Promise<string> {
    return this.broadcastData('banking_transaction', transaction, 'high');
  }

  async syncNodeStatus(status: any): Promise<string> {
    return this.broadcastData('node_status', status, 'low');
  }

  // DATA RETRIEVAL METHODS
  getUserProfiles(): MeshDataPacket[] {
    return Array.from(this.dataStore.values()).filter(packet => packet.type === 'user_profile');
  }

  getChatMessages(): MeshDataPacket[] {
    return Array.from(this.dataStore.values()).filter(packet => packet.type === 'chat_message');
  }

  getMarketplaceListings(): MeshDataPacket[] {
    return Array.from(this.dataStore.values()).filter(packet => packet.type === 'marketplace_listing');
  }

  getBankingTransactions(): MeshDataPacket[] {
    return Array.from(this.dataStore.values()).filter(packet => packet.type === 'banking_transaction');
  }

  getNodeStatuses(): MeshNodeStatus[] {
    return Array.from(this.nodeStatuses.values());
  }

  getConflicts(): MeshDataConflict[] {
    return this.conflicts;
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

  private notifyListeners(event: string, data: any) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(data));
    }
  }

  // CONFLICT RESOLUTION
  resolveConflictManually(packetId: string, resolution: 'local_wins' | 'remote_wins'): void {
    const conflictIndex = this.conflicts.findIndex(c => c.packetId === packetId);
    if (conflictIndex >= 0) {
      this.conflicts.splice(conflictIndex, 1);
      this.notifyListeners('conflictResolved', { packetId, resolution });
    }
  }

  // CLEANUP
  destroy() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    this.saveLocalData();
  }
}

export const meshDataSync = new MeshDataSyncService();
