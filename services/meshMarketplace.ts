import { bluetoothMesh, MeshNode, MeshMessage } from './bluetoothMesh';
import { meshDataSync } from './meshDataSync';
import { Listing } from '../types';

export interface MeshListing extends Listing {
  nodeId: string;
  nodeHandle: string;
  distance?: number;
  isProximity: boolean;
  location?: string;
  images?: string[];
}

export interface TradeRequest {
  id: string;
  listingId: string;
  fromNode: string;
  toNode: string;
  message: string;
  timestamp: number;
  status: 'pending' | 'accepted' | 'declined' | 'completed';
}

class MeshMarketplaceService {
  private localListings: MeshListing[] = [];
  private tradeRequests: TradeRequest[] = [];
  private nearbyNodes: Map<string, MeshNode> = new Map();
  private listeners: { [key: string]: ((data: any) => void)[] } = {};

  constructor() {
    this.initializeMeshIntegration();
  }

  private initializeMeshIntegration() {
    // Listen for mesh peer updates
    window.addEventListener('meshPeersUpdated', (event: CustomEvent) => {
      this.nearbyNodes.clear();
      event.detail.forEach((node: MeshNode) => {
        this.nearbyNodes.set(node.id, node);
      });
      this.notifyListeners('nearbyNodes', this.getNearbyNodes());
    });

    // Listen for incoming mesh messages
    window.addEventListener('meshMessageReceived', (event: CustomEvent) => {
      this.handleMeshMessage(event.detail);
    });
  }

  private handleMeshMessage(message: MeshMessage) {
    try {
      const data = JSON.parse(message.content);
      
      if (data.type === 'listing_broadcast') {
        this.handleIncomingListing(data.payload);
      } else if (data.type === 'trade_request') {
        this.handleTradeRequest(data.payload);
      } else if (data.type === 'listing_update') {
        this.handleListingUpdate(data.payload);
      }
    } catch (error) {
      console.error('Failed to parse mesh message:', error);
    }
  }

  private handleIncomingListing(listing: MeshListing) {
    // Add distance info from nearby nodes
    const node = this.nearbyNodes.get(listing.nodeId);
    if (node) {
      listing.distance = node.distance;
      listing.isProximity = true;
    }

    // Check if listing already exists
    const existingIndex = this.localListings.findIndex(l => l.id === listing.id);
    if (existingIndex >= 0) {
      this.localListings[existingIndex] = listing;
    } else {
      this.localListings.push(listing);
    }

    this.notifyListeners('listings', this.getAllListings());
  }

  private handleTradeRequest(request: TradeRequest) {
    this.tradeRequests.push(request);
    this.notifyListeners('tradeRequest', request);
  }

  private handleListingUpdate(payload: { listingId: string; status: string; nodeId: string }) {
    const listing = this.localListings.find(l => l.id === payload.listingId);
    if (listing) {
      // In a real implementation, this would update the listing status
      console.log(`Listing ${payload.listingId} updated to ${payload.status} by ${payload.nodeId}`);
      this.notifyListeners('listings', this.getAllListings());
    }
  }

  async broadcastListing(listing: Omit<MeshListing, 'nodeId' | 'nodeHandle' | 'isProximity'>): Promise<void> {
    const meshListing: MeshListing = {
      ...listing,
      nodeId: 'me',
      nodeHandle: '@symbolic', // Current user handle
      isProximity: false
    };

    // Add to local listings
    this.localListings.push(meshListing);

    // Broadcast to mesh network using data sync
    await meshDataSync.syncMarketplaceListing(meshListing);
    
    // Also send via traditional mesh message for backward compatibility
    const broadcastMessage = {
      type: 'listing_broadcast',
      payload: meshListing,
      timestamp: Date.now()
    };

    // Broadcast to all available peers
    const peers = bluetoothMesh.getPeers();
    for (const peer of peers) {
      await bluetoothMesh.sendMessage(peer.id, JSON.stringify(broadcastMessage));
    }
    this.notifyListeners('listings', this.getAllListings());
  }

  async sendTradeRequest(listingId: string, message: string): Promise<void> {
    const listing = this.localListings.find(l => l.id === listingId);
    if (!listing) return;

    const tradeRequest: TradeRequest = {
      id: `trade_${Date.now()}`,
      listingId,
      fromNode: 'me',
      toNode: listing.nodeId,
      message,
      timestamp: Date.now(),
      status: 'pending'
    };

    // Send direct message to listing node
    const directMessage = {
      type: 'trade_request',
      payload: tradeRequest
    };

    await bluetoothMesh.sendMessage(listing.nodeId, JSON.stringify(directMessage));
    this.tradeRequests.push(tradeRequest);
    this.notifyListeners('tradeRequests', this.tradeRequests);
  }

  async respondToTradeRequest(requestId: string, accept: boolean): Promise<void> {
    const request = this.tradeRequests.find(r => r.id === requestId);
    if (!request) return;

    request.status = accept ? 'accepted' : 'declined';

    const response = {
      type: 'trade_response',
      payload: {
        requestId: request.id,
        accepted: accept,
        fromNode: 'me'
      }
    };

    await bluetoothMesh.sendMessage(request.fromNode, JSON.stringify(response));
    this.notifyListeners('tradeRequests', this.tradeRequests);
  }

  async updateListingStatus(listingId: string, status: 'active' | 'sold' | 'removed'): Promise<void> {
    const listing = this.localListings.find(l => l.id === listingId);
    if (!listing) return;

    const update = {
      type: 'listing_update',
      payload: {
        listingId,
        status,
        nodeId: 'me'
      }
    };

    // Broadcast update to all peers
    const peers = bluetoothMesh.getPeers();
    for (const peer of peers) {
      await bluetoothMesh.sendMessage(peer.id, JSON.stringify(update));
    }
    this.notifyListeners('listings', this.getAllListings());
  }

  getAllListings(): MeshListing[] {
    return this.localListings.sort((a, b) => {
      // Prioritize proximity listings
      if (a.isProximity && !b.isProximity) return -1;
      if (!a.isProximity && b.isProximity) return 1;
      
      // Then by timestamp (newest first)
      return b.timestamp - a.timestamp;
    });
  }

  getProximityListings(maxDistance: number = 50): MeshListing[] {
    return this.localListings.filter(listing => 
      listing.isProximity && listing.distance && listing.distance <= maxDistance
    );
  }

  getNearbyNodes(): Array<MeshNode & { hasListings: boolean }> {
    return Array.from(this.nearbyNodes.values()).map(node => ({
      ...node,
      hasListings: this.localListings.some(l => l.nodeId === node.id)
    }));
  }

  getTradeRequests(): TradeRequest[] {
    return this.tradeRequests;
  }

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

  // Initialize Bluetooth mesh connection
  async initialize(): Promise<boolean> {
    try {
      // Initialize Bluetooth mesh
      const meshConnected = await bluetoothMesh.initialize();
      
      // Add some demo listings if none exist
      if (this.localListings.length === 0) {
        this.addDemoListings();
      }
      
      return meshConnected;
    } catch (error) {
      console.error('Failed to initialize mesh marketplace:', error);
      return false;
    }
  }

  private addDemoListings(): void {
    // Simulate nearby users broadcasting listings
    const mockListings = [
      {
        id: 'mesh_1',
        title: 'Bluetooth Speaker',
        price: '200 XC',
        senderHandle: '@tech_guru',
        timestamp: Date.now() - 300000,
        category: 'HAVE' as const,
        description: 'Portable speaker, great condition. Looking for quick trade.',
        location: 'Sector 428F - Zone A'
      },
      {
        id: 'mesh_2', 
        title: 'Need Phone Charger',
        price: '50 XC',
        senderHandle: '@battery_low',
        timestamp: Date.now() - 600000,
        category: 'WANT' as const,
        description: 'USB-C charger needed urgently. Can pay extra for delivery.',
        location: 'Sector 428F - Zone B'
      }
    ];

    mockListings.forEach((listing, index) => {
      setTimeout(() => {
        this.handleIncomingListing({
          ...listing,
          nodeId: `peer_${index + 1}`,
          nodeHandle: listing.senderHandle,
          isProximity: true,
          distance: Math.random() * 30 + 5 // 5-35 meters away
        });
      }, index * 1000);
    });
  }
}

export const meshMarketplace = new MeshMarketplaceService();
