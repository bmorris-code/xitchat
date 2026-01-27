// Geohash Discovery Engine for XitChat
// Provides location-based peer discovery with multiple precision levels

export interface GeohashZone {
  geohash: string;
  precision: number;
  name: string;
  level: 'global' | 'regional' | 'local' | 'hyperlocal';
  peerCount: number;
  peers: any[];
  centerLat: number;
  centerLng: number;
  radiusKm: number;
}

export interface DiscoveryMode {
  id: string;
  name: string;
  description: string;
  precision: number;
  radiusKm: number;
  icon: string;
}

class GeohashDiscoveryEngine {
  private zones: Map<string, GeohashZone> = new Map();
  private listeners: { [key: string]: ((data: any) => void)[] } = {};
  private currentLocation: { lat: number; lng: number; geohash: string } | null = null;
  private discoveryModes: DiscoveryMode[] = [
    {
      id: 'hyperlocal',
      name: 'Nearby',
      description: 'People within 1km',
      precision: 7, // ~150m precision
      radiusKm: 1,
      icon: 'fa-location-dot'
    },
    {
      id: 'local',
      name: 'Local',
      description: 'People in your area',
      precision: 6, // ~1.2km precision
      radiusKm: 5,
      icon: 'fa-city'
    },
    {
      id: 'regional',
      name: 'Regional',
      description: 'People in your region',
      precision: 5, // ~5km precision
      radiusKm: 50,
      icon: 'fa-map'
    },
    {
      id: 'global',
      name: 'Global',
      description: 'People worldwide',
      precision: 2, // ~1000km precision
      radiusKm: 2000,
      icon: 'fa-globe'
    }
  ];

  constructor() {
    this.setupLocationTracking();
    this.loadFromStorage();
  }

  private setupLocationTracking() {
    // Get initial location
    this.updateCurrentLocation();

    // Update location periodically
    setInterval(() => {
      this.updateCurrentLocation();
    }, 60000); // Update every minute

    // Listen for location changes from other services
    window.addEventListener('locationUpdated', (event: any) => {
      if (event.detail) {
        this.currentLocation = {
          lat: event.detail.lat,
          lng: event.detail.lng,
          geohash: this.encodeGeohash(event.detail.lat, event.detail.lng, 7)
        };
        this.rebuildZones();
      }
    });
  }

  private async updateCurrentLocation() {
    try {
      // Try to get location from browser
      if (navigator.geolocation && window.isSecureContext) {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            timeout: 10000,
            maximumAge: 300000 // 5 minutes cache
          });
        });

        this.currentLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          geohash: this.encodeGeohash(position.coords.latitude, position.coords.longitude, 7)
        };

        console.log(`🗺️ Location updated: ${this.currentLocation.lat}, ${this.currentLocation.lng} (${this.currentLocation.geohash})`);
        this.rebuildZones();
      } else {
        // Fallback to default location (Johannesburg)
        this.currentLocation = {
          lat: -26.2041,
          lng: 28.0473,
          geohash: this.encodeGeohash(-26.2041, 28.0473, 7)
        };
        console.log('🗺️ Using fallback location');
      }
    } catch (error) {
      console.warn('Failed to get location:', error);
      // Use fallback location
      this.currentLocation = {
        lat: -26.2041,
        lng: 28.0473,
        geohash: this.encodeGeohash(-26.2041, 28.0473, 7)
      };
    }
  }

  // Get discovery zones based on current location
  getDiscoveryZones(): GeohashZone[] {
    if (!this.currentLocation) {
      return [];
    }

    const zones: GeohashZone[] = [];

    this.discoveryModes.forEach(mode => {
      const geohash = this.currentLocation!.geohash.substring(0, mode.precision);
      const zone = this.createZone(geohash, mode);
      zones.push(zone);
    });

    return zones.sort((a, b) => a.radiusKm - b.radiusKm); // Smallest to largest
  }

  // Create a discovery zone
  private createZone(geohash: string, mode: DiscoveryMode): GeohashZone {
    const center = this.decodeGeohash(geohash);
    
    return {
      geohash,
      precision: mode.precision,
      name: mode.name,
      level: this.getLevelFromPrecision(mode.precision),
      peerCount: 0,
      peers: [],
      centerLat: center.lat,
      centerLng: center.lng,
      radiusKm: mode.radiusKm
    };
  }

  // Update peers in zones
  updatePeers(peers: any[]): void {
    // Clear existing peers from zones
    this.zones.forEach(zone => {
      zone.peers = [];
      zone.peerCount = 0;
    });

    // Add peers to appropriate zones
    peers.forEach(peer => {
      if (!peer.location?.geohash) return;

      this.discoveryModes.forEach(mode => {
        const zoneGeohash = peer.location.geohash.substring(0, mode.precision);
        const zone = this.zones.get(`${zoneGeohash}_${mode.precision}`);
        
        if (zone) {
          // Check if peer is actually within this zone's radius
          const distance = this.calculateDistance(
            zone.centerLat,
            zone.centerLng,
            peer.location.lat || 0,
            peer.location.lng || 0
          );

          if (distance <= zone.radiusKm) {
            zone.peers.push(peer);
            zone.peerCount++;
          }
        }
      });
    });

    // Notify listeners about updated zones
    this.notifyListeners('zonesUpdated', Array.from(this.zones.values()));
    this.saveToStorage();
  }

  // Rebuild all zones based on current location
  private rebuildZones(): void {
    if (!this.currentLocation) return;

    this.zones.clear();

    this.discoveryModes.forEach(mode => {
      const geohash = this.currentLocation!.geohash.substring(0, mode.precision);
      const zone = this.createZone(geohash, mode);
      this.zones.set(`${geohash}_${mode.precision}`, zone);
    });

    this.notifyListeners('zonesUpdated', Array.from(this.zones.values()));
  }

  // Get peers in a specific discovery mode
  getPeersInMode(modeId: string): any[] {
    const mode = this.discoveryModes.find(m => m.id === modeId);
    if (!mode || !this.currentLocation) return [];

    const geohash = this.currentLocation.geohash.substring(0, mode.precision);
    const zone = this.zones.get(`${geohash}_${mode.precision}`);
    
    return zone?.peers || [];
  }

  // Get nearby peers with optional radius
  getNearbyPeers(radiusKm: number = 5): any[] {
    if (!this.currentLocation) return [];

    return Array.from(this.zones.values())
      .filter(zone => zone.radiusKm <= radiusKm)
      .flatMap(zone => zone.peers)
      .filter((peer, index, array) => array.findIndex(p => p.id === peer.id) === index); // Remove duplicates
  }

  // Calculate distance between two points
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  // Geohash encoding
  private encodeGeohash(lat: number, lng: number, precision: number): string {
    const base32 = '0123456789bcdefghjkmnpqrstuvwxyz';
    let hash = '';
    let latRange = [-90, 90];
    let lngRange = [-180, 180];
    let even = true;
    let bit = 0;
    let ch = 0;

    while (hash.length < precision) {
      let mid;
      if (even) {
        mid = (lngRange[0] + lngRange[1]) / 2;
        if (lng >= mid) { ch = ch * 2 + 1; lngRange[0] = mid; }
        else { ch = ch * 2; lngRange[1] = mid; }
      } else {
        mid = (latRange[0] + latRange[1]) / 2;
        if (lat >= mid) { ch = ch * 2 + 1; latRange[0] = mid; }
        else { ch = ch * 2; latRange[1] = mid; }
      }
      even = !even;
      bit++;
      if (bit === 5) { hash += base32[ch]; bit = 0; ch = 0; }
    }
    return hash;
  }

  // Geohash decoding (simplified)
  private decodeGeohash(geohash: string): { lat: number; lng: number } {
    const base32 = '0123456789bcdefghjkmnpqrstuvwxyz';
    let latRange = [-90, 90];
    let lngRange = [-180, 180];
    let even = true;

    for (let i = 0; i < geohash.length; i++) {
      const cd = base32.indexOf(geohash[i]);
      for (let j = 0; j < 5; j++) {
        const mask = 1 << (4 - j);
        if ((cd & mask) !== 0) {
          if (even) {
            lngRange[0] = (lngRange[0] + lngRange[1]) / 2;
          } else {
            latRange[0] = (latRange[0] + latRange[1]) / 2;
          }
        } else {
          if (even) {
            lngRange[1] = (lngRange[0] + lngRange[1]) / 2;
          } else {
            latRange[1] = (latRange[0] + latRange[1]) / 2;
          }
        }
        even = !even;
      }
    }

    return {
      lat: (latRange[0] + latRange[1]) / 2,
      lng: (lngRange[0] + lngRange[1]) / 2
    };
  }

  // Get level from precision
  private getLevelFromPrecision(precision: number): 'global' | 'regional' | 'local' | 'hyperlocal' {
    if (precision >= 7) return 'hyperlocal';
    if (precision >= 6) return 'local';
    if (precision >= 5) return 'regional';
    return 'global';
  }

  // Get discovery modes
  getDiscoveryModes(): DiscoveryMode[] {
    return this.discoveryModes;
  }

  // Get current location
  getCurrentLocation(): { lat: number; lng: number; geohash: string } | null {
    return this.currentLocation;
  }

  // Storage management
  private saveToStorage(): void {
    try {
      const data = {
        currentLocation: this.currentLocation,
        zones: Array.from(this.zones.entries())
      };
      localStorage.setItem('xitchat_geohash_discovery', JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save geohash discovery data:', error);
    }
  }

  private loadFromStorage(): void {
    try {
      const data = localStorage.getItem('xitchat_geohash_discovery');
      if (data) {
        const parsed = JSON.parse(data);
        this.currentLocation = parsed.currentLocation;
        this.zones = new Map(parsed.zones || []);
        console.log('🗺️ Loaded geohash discovery data from storage');
      }
    } catch (error) {
      console.warn('Failed to load geohash discovery data:', error);
    }
  }

  // Public API
  subscribe(event: string, callback: (data: any) => void): () => void {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
    return () => {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    };
  }

  private notifyListeners(event: string, data: any): void {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(data));
    }
  }

  // Get statistics
  getStatistics(): {
    totalPeers: number;
    zonesCount: number;
    currentLocation: { lat: number; lng: number; geohash: string } | null;
    modeStats: { modeId: string; peerCount: number }[];
  } {
    const totalPeers = Array.from(this.zones.values()).reduce((sum, zone) => sum + zone.peerCount, 0);
    
    const modeStats = this.discoveryModes.map(mode => ({
      modeId: mode.id,
      peerCount: this.getPeersInMode(mode.id).length
    }));

    return {
      totalPeers,
      zonesCount: this.zones.size,
      currentLocation: this.currentLocation,
      modeStats
    };
  }

  // Cleanup
  destroy(): void {
    this.saveToStorage();
    this.zones.clear();
  }
}

export const geohashDiscoveryEngine = new GeohashDiscoveryEngine();
