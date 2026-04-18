import { hybridMesh, HybridMeshPeer, HybridMeshMessage } from './hybridMesh';
import { meshDataSync } from './meshDataSync';
import { Listing } from '../types';
import { xcEconomy } from './xcEconomy';

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
  paymentStatus?: 'none' | 'pending' | 'paid';
  price?: number;
}

export interface PaymentRequest {
  id: string;
  requestId: string; // Trade request ID
  listingId: string;
  amount: number;
  fromNode: string;
  toNode: string;
  timestamp: number;
}

export interface PaymentResponse {
  id: string;
  paymentId: string;
  success: boolean;
  message: string;
  timestamp: number;
}

class MeshMarketplaceService {
  private localListings: MeshListing[] = [];
  private tradeRequests: TradeRequest[] = [];
  private nearbyNodes: Map<string, HybridMeshPeer> = new Map();
  private listeners: { [key: string]: ((data: any) => void)[] } = {};

  constructor() {
    this.initializeMeshIntegration();
  }

  private initializeMeshIntegration() {
    // Listen for hybrid mesh peer updates
    hybridMesh.subscribe('peersUpdated', (peers: HybridMeshPeer[]) => {
      this.nearbyNodes.clear();
      peers.forEach((node: HybridMeshPeer) => {
        this.nearbyNodes.set(node.id, node);
      });
      this.notifyListeners('nearbyNodes', this.getNearbyNodes());
    });

    // Listen for incoming hybrid mesh messages
    hybridMesh.subscribe('messageReceived', (message: HybridMeshMessage) => {
      this.handleMeshMessage(message);
    });

    // Listen for specific marketplace events from hybridMesh
    window.addEventListener('meshMarketplaceListing', (event: any) => {
      this.handleIncomingListing(event.detail);
    });

    window.addEventListener('meshTradeRequest', (event: any) => {
      this.handleTradeRequest(event.detail);
    });

    window.addEventListener('meshPaymentRequest', (event: any) => {
      this.handleIncomingPayment(event.detail);
    });

    window.addEventListener('meshPaymentResponse', (event: any) => {
      this.handlePaymentResponse(event.detail);
    });
  }

  private handleMeshMessage(message: HybridMeshMessage) {
    try {
      // If content is already parsed by hybridMesh, use it
      const data = typeof message.content === 'string' && message.content.startsWith('{')
        ? JSON.parse(message.content)
        : message.content;

      const payload = data.payload || data;
      const type = data.type || (data.listingId ? 'listing_update' : '');

      if (type === 'listing_broadcast') {
        this.handleIncomingListing(payload);
      } else if (type === 'trade_request') {
        this.handleTradeRequest(payload);
      } else if (type === 'listing_update') {
        this.handleListingUpdate(payload);
      }
    } catch (error) {
      console.error('Failed to parse mesh message:', error);
    }
  }

  private handleIncomingListing(listing: MeshListing) {
    // Add distance info from nearby nodes
    const node = this.nearbyNodes.get(listing.nodeId);
    if (node) {
      listing.distance = node.signalStrength ? (100 - node.signalStrength) / 2 : 10;
      listing.isProximity = node.connectionType === 'bluetooth' || node.connectionType === 'wifi';
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

    // Broadcast via unified hybrid mesh
    await hybridMesh.sendMessage(JSON.stringify({
      type: 'marketplace_listing',
      data: meshListing
    }));

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

    // Send via hybrid mesh
    await hybridMesh.sendMessage(JSON.stringify({
      type: 'trade_request',
      data: tradeRequest
    }), listing.nodeId);

    this.tradeRequests.push(tradeRequest);
    this.notifyListeners('tradeRequests', this.tradeRequests);
  }

  async respondToTradeRequest(requestId: string, accept: boolean): Promise<void> {
    const request = this.tradeRequests.find(r => r.id === requestId);
    if (!request) return;

    request.status = accept ? 'accepted' : 'declined';

    await hybridMesh.sendMessage(JSON.stringify({
      type: 'trade_response',
      data: {
        requestId: request.id,
        accepted: accept,
        fromNode: 'me'
      }
    }), request.fromNode);

    this.notifyListeners('tradeRequests', this.tradeRequests);
  }

  async payForListing(requestId: string): Promise<boolean> {
    const request = this.tradeRequests.find(r => r.id === requestId);
    if (!request || request.status !== 'accepted') return false;

    const listing = this.localListings.find(l => l.id === request.listingId);
    if (!listing) return false;

    // Parse price (e.g., "200 XC" -> 200)
    const amount = parseInt(listing.price.replace(/[^0-9]/g, ''));
    if (isNaN(amount)) return false;

    // Check balance
    if (xcEconomy.getBalance() < amount) {
      alert('Insufficient XC balance!');
      return false;
    }

    // Spend XC
    const spent = xcEconomy.spendXC(amount, `Payment for ${listing.title}`, 'marketplace');
    if (!spent) return false;

    const paymentId = `pay_${Date.now()}`;
    const paymentRequest: PaymentRequest = {
      id: paymentId,
      requestId,
      listingId: listing.id,
      amount,
      fromNode: 'me',
      toNode: listing.nodeId,
      timestamp: Date.now()
    };

    // Send via hybrid mesh
    await hybridMesh.sendMessage(JSON.stringify({
      type: 'payment_request',
      data: paymentRequest
    }), listing.nodeId);

    request.paymentStatus = 'pending';
    this.notifyListeners('tradeRequests', this.tradeRequests);
    return true;
  }

  private async handleIncomingPayment(payment: PaymentRequest) {
    console.log(`💰 Received payment request for ${payment.amount} XC from ${payment.fromNode}`);

    // Add XC to balance
    const listing = this.localListings.find(l => l.id === payment.listingId);
    const description = listing ? `Sold: ${listing.title}` : 'Marketplace Sale';

    xcEconomy.addXC(payment.amount, description, 'marketplace_sale');

    // Update trade request status if we have it
    const request = this.tradeRequests.find(r => r.id === payment.requestId);
    if (request) {
      request.paymentStatus = 'paid';
      request.status = 'completed';
    }

    // Send response
    const response: PaymentResponse = {
      id: `pay_resp_${Date.now()}`,
      paymentId: payment.id,
      success: true,
      message: 'Payment received and processed!',
      timestamp: Date.now()
    };

    await hybridMesh.sendMessage(JSON.stringify({
      type: 'payment_response',
      data: response
    }), payment.fromNode);

    this.notifyListeners('tradeRequests', this.tradeRequests);
  }

  private handlePaymentResponse(response: PaymentResponse) {
    console.log(`💰 Payment response received: ${response.success ? 'Success' : 'Failed'}`);

    // Find the request that matches this payment
    // In a real app we'd track payment IDs, but for now we'll update any pending
    const request = this.tradeRequests.find(r => r.paymentStatus === 'pending');
    if (request && response.success) {
      request.paymentStatus = 'paid';
      request.status = 'completed';
      this.notifyListeners('tradeRequests', this.tradeRequests);
    }
  }

  async updateListingStatus(listingId: string, status: 'active' | 'sold' | 'removed'): Promise<void> {
    const listing = this.localListings.find(l => l.id === listingId);
    if (!listing) return;

    // Broadcast update via hybrid mesh
    await hybridMesh.sendMessage(JSON.stringify({
      type: 'listing_update',
      data: {
        listingId,
        status,
        nodeId: 'me'
      }
    }));

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

  getNearbyNodes(): Array<HybridMeshPeer & { hasListings: boolean }> {
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

  // Initialize Hybrid mesh connection
  async initialize(): Promise<boolean> {
    try {
      // Ensure hybrid mesh is initialized
      const meshInfo = hybridMesh.getConnectionInfo();
      // Real-time only: do not inject demo/mock marketplace listings.
      return !!meshInfo.isConnected;
    } catch (error) {
      console.error('Failed to initialize mesh marketplace:', error);
      return false;
    }
  }
}

export const meshMarketplace = new MeshMarketplaceService();
