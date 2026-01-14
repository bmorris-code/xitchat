// Real-time Marketplace Service for XitChat
// Integrates with mesh network for live marketplace listings

import { Listing } from '../types';
import { hybridMesh } from './hybridMesh';

export interface MarketplaceListing extends Listing {
  location?: string;
  nodeId?: string;
  meshBroadcast?: boolean;
  expiresAt?: number;
  verified?: boolean;
  contactInfo?: string;
}

export interface MarketplaceStats {
  totalListings: number;
  activeListings: number;
  categories: { [key: string]: number };
  recentActivity: number;
  lastUpdate: number;
}

class RealMarketplaceService {
  private listings: Map<string, MarketplaceListing> = new Map();
  private listeners: { [key: string]: ((data: any) => void)[] } = {};
  private stats: MarketplaceStats = {
    totalListings: 0,
    activeListings: 0,
    categories: {},
    recentActivity: 0,
    lastUpdate: Date.now()
  };
  private isRealTimeEnabled = false;
  private syncInterval: number | null = null;

  constructor() {
    this.loadListings();
    this.startRealTimeSync();
  }

  private loadListings() {
    try {
      const saved = localStorage.getItem('marketplace_listings');
      if (saved) {
        const listings: MarketplaceListing[] = JSON.parse(saved);
        listings.forEach(listing => {
          this.listings.set(listing.id, listing);
        });
        this.updateStats();
      }
    } catch (error) {
      console.error('Failed to load marketplace listings:', error);
    }
  }

  private saveListings() {
    try {
      const listings = Array.from(this.listings.values());
      localStorage.setItem('marketplace_listings', JSON.stringify(listings));
    } catch (error) {
      console.error('Failed to save marketplace listings:', error);
    }
  }

  private startRealTimeSync() {
    this.isRealTimeEnabled = true;
    
    // Sync with mesh network every 30 seconds
    this.syncInterval = window.setInterval(() => {
      this.syncWithMesh();
    }, 30000);

    // Initial sync
    this.syncWithMesh();
  }

  private async syncWithMesh() {
    try {
      // Broadcast our listings to mesh
      await this.broadcastToListings();
      
      // Request listings from mesh peers
      await this.requestMeshListings();
      
      this.stats.lastUpdate = Date.now();
      this.notifyListeners('syncCompleted', this.stats);
    } catch (error) {
      console.error('Mesh sync failed:', error);
    }
  }

  private async broadcastToListings() {
    const ourListings = Array.from(this.listings.values()).filter(
      listing => !listing.meshBroadcast
    );

    for (const listing of ourListings) {
      try {
        // Broadcast listing through mesh network
        const broadcastData = {
          type: 'marketplace_listing',
          data: listing,
          timestamp: Date.now()
        };

        // Send through hybrid mesh
        await hybridMesh.sendMessage(JSON.stringify(broadcastData));
        listing.meshBroadcast = true;
      } catch (error) {
        console.warn('Failed to broadcast listing:', error);
      }
    }
  }

  private async requestMeshListings() {
    try {
      // Request listings from mesh peers
      const requestData = {
        type: 'marketplace_request',
        timestamp: Date.now()
      };

      await hybridMesh.sendMessage(JSON.stringify(requestData));
    } catch (error) {
      console.warn('Failed to request mesh listings:', error);
    }
  }

  // Public API methods
  addListing(listing: Omit<MarketplaceListing, 'id' | 'timestamp' | 'meshBroadcast'>): string {
    const id = `listing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newListing: MarketplaceListing = {
      ...listing,
      id,
      timestamp: Date.now(),
      meshBroadcast: false,
      verified: false,
      expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
    };

    this.listings.set(id, newListing);
    this.updateStats();
    this.saveListings();
    
    // Immediately broadcast new listing
    this.broadcastSingleListing(newListing);
    
    this.notifyListeners('listingAdded', newListing);
    return id;
  }

  private async broadcastSingleListing(listing: MarketplaceListing) {
    try {
      const broadcastData = {
        type: 'marketplace_listing',
        data: listing,
        timestamp: Date.now()
      };

      await hybridMesh.sendMessage(JSON.stringify(broadcastData));
      listing.meshBroadcast = true;
    } catch (error) {
      console.warn('Failed to broadcast new listing:', error);
    }
  }

  removeListing(id: string): boolean {
    const listing = this.listings.get(id);
    if (!listing) return false;

    this.listings.delete(id);
    this.updateStats();
    this.saveListings();
    
    // Broadcast removal
    this.broadcastListingRemoval(id);
    
    this.notifyListeners('listingRemoved', { id, listing });
    return true;
  }

  private async broadcastListingRemoval(id: string) {
    try {
      const broadcastData = {
        type: 'marketplace_listing_removed',
        data: { id },
        timestamp: Date.now()
      };

      await hybridMesh.sendMessage(JSON.stringify(broadcastData));
    } catch (error) {
      console.warn('Failed to broadcast listing removal:', error);
    }
  }

  updateListing(id: string, updates: Partial<MarketplaceListing>): boolean {
    const listing = this.listings.get(id);
    if (!listing) return false;

    const updatedListing = { ...listing, ...updates };
    this.listings.set(id, updatedListing);
    this.updateStats();
    this.saveListings();
    
    // Broadcast update
    this.broadcastListingUpdate(updatedListing);
    
    this.notifyListeners('listingUpdated', updatedListing);
    return true;
  }

  private async broadcastListingUpdate(listing: MarketplaceListing) {
    try {
      const broadcastData = {
        type: 'marketplace_listing_updated',
        data: listing,
        timestamp: Date.now()
      };

      await hybridMesh.sendMessage(JSON.stringify(broadcastData));
    } catch (error) {
      console.warn('Failed to broadcast listing update:', error);
    }
  }

  // Handle incoming mesh messages
  handleMeshMessage(message: any) {
    try {
      const data = JSON.parse(message);
      
      switch (data.type) {
        case 'marketplace_listing':
          this.handleIncomingListing(data.data);
          break;
        case 'marketplace_listing_updated':
          this.handleIncomingListingUpdate(data.data);
          break;
        case 'marketplace_listing_removed':
          this.handleIncomingListingRemoval(data.data.id);
          break;
        case 'marketplace_request':
          this.handleListingRequest();
          break;
      }
    } catch (error) {
      console.warn('Failed to handle mesh marketplace message:', error);
    }
  }

  private handleIncomingListing(listing: MarketplaceListing) {
    // Don't add our own listings
    if (listing.nodeId === 'me') return;

    // Update existing or add new
    const existing = this.listings.get(listing.id);
    if (!existing || listing.timestamp > existing.timestamp) {
      this.listings.set(listing.id, listing);
      this.updateStats();
      this.saveListings();
      this.notifyListeners('listingReceived', listing);
      this.stats.recentActivity++;
    }
  }

  private handleIncomingListingUpdate(listing: MarketplaceListing) {
    const existing = this.listings.get(listing.id);
    if (existing && listing.timestamp > existing.timestamp) {
      this.listings.set(listing.id, listing);
      this.updateStats();
      this.saveListings();
      this.notifyListeners('listingUpdated', listing);
      this.stats.recentActivity++;
    }
  }

  private handleIncomingListingRemoval(id: string) {
    if (this.listings.has(id)) {
      const listing = this.listings.get(id)!;
      this.listings.delete(id);
      this.updateStats();
      this.saveListings();
      this.notifyListeners('listingRemoved', { id, listing });
      this.stats.recentActivity++;
    }
  }

  private async handleListingRequest() {
    // Send our listings to the requesting peer
    const ourListings = Array.from(this.listings.values()).filter(
      listing => listing.nodeId === 'me'
    );

    for (const listing of ourListings) {
      const broadcastData = {
        type: 'marketplace_listing',
        data: listing,
        timestamp: Date.now()
      };

      await hybridMesh.sendMessage(JSON.stringify(broadcastData));
    }
  }

  private updateStats() {
    const listings = Array.from(this.listings.values());
    const now = Date.now();
    const activeListings = listings.filter(l => !l.expiresAt || l.expiresAt > now);

    this.stats.totalListings = listings.length;
    this.stats.activeListings = activeListings.length;
    this.stats.categories = {};

    activeListings.forEach(listing => {
      const category = listing.category || 'OTHER';
      this.stats.categories[category] = (this.stats.categories[category] || 0) + 1;
    });
  }

  // Getters
  getListings(filter?: 'ALL' | 'HAVE' | 'WANT' | 'SERVICE' | 'EVENT'): MarketplaceListing[] {
    const listings = Array.from(this.listings.values());
    const now = Date.now();
    
    // Filter out expired listings
    const activeListings = listings.filter(l => !l.expiresAt || l.expiresAt > now);
    
    // Sort by timestamp (newest first)
    activeListings.sort((a, b) => b.timestamp - a.timestamp);

    if (!filter || filter === 'ALL') {
      return activeListings;
    }

    return activeListings.filter(listing => listing.category === filter);
  }

  getStats(): MarketplaceStats {
    return { ...this.stats };
  }

  getListing(id: string): MarketplaceListing | undefined {
    return this.listings.get(id);
  }

  searchListings(query: string): MarketplaceListing[] {
    const listings = this.getListings();
    const lowercaseQuery = query.toLowerCase();
    
    return listings.filter(listing => 
      listing.title.toLowerCase().includes(lowercaseQuery) ||
      listing.description.toLowerCase().includes(lowercaseQuery) ||
      listing.senderHandle.toLowerCase().includes(lowercaseQuery)
    );
  }

  // Event listeners
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

  // Cleanup
  destroy() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    this.saveListings();
  }
}

export const realMarketplaceService = new RealMarketplaceService();
