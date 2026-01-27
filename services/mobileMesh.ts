// Mobile Mesh Integration Layer
// Coordinates all mobile mesh services and provides unified API

import { nodeRoleService, NodeRole } from './nodeRoles';
import { presenceBeacon, PresenceBeaconPeer } from './presenceBeacon';
import { smartRouter, RoutingDecision } from './smartRouter';
import { mobileLifecycle, AppState, NetworkState } from './mobileLifecycle';
import { realtimeRadar, RadarPeer } from './realtimeRadar';

export interface MobileMeshConfig {
  enablePresenceBeacon: boolean;
  enableSmartRouting: boolean;
  enableLifecycleManagement: boolean;
  enableRadar: boolean;
  autoStart: boolean;
}

export interface MobileMeshStatus {
  isInitialized: boolean;
  isRunning: boolean;
  currentRole: NodeRole;
  appState: AppState;
  networkState: NetworkState;
  peerCount: number;
  presenceConnected: boolean;
  radarActive: boolean;
}

export interface MobilePeer extends RadarPeer {
  routingDecision?: RoutingDecision;
  bestTransport?: string;
  connectionConfidence?: number;
}

class MobileMeshService {
  private config: MobileMeshConfig;
  private isInitialized = false;
  private isRunning = false;
  private status: MobileMeshStatus;
  private listeners: { [key: string]: ((data: any) => void)[] } = {};

  constructor(config?: Partial<MobileMeshConfig>) {
    this.config = {
      enablePresenceBeacon: true,
      enableSmartRouting: true,
      enableLifecycleManagement: true,
      enableRadar: true,
      autoStart: true,
      ...config
    };

    this.status = {
      isInitialized: false,
      isRunning: false,
      currentRole: 'edge',
      appState: 'active',
      networkState: 'online',
      peerCount: 0,
      presenceConnected: false,
      radarActive: false
    };

    this.setupServiceIntegration();
  }

  private setupServiceIntegration(): void {
    // Listen to node role changes
    nodeRoleService.onRoleChange((role) => {
      this.status.currentRole = role;
      this.notifyStatusChange();
      console.log(`🔄 Mobile Mesh: Node role changed to ${role}`);
    });

    // Listen to presence beacon updates
    presenceBeacon.subscribe('peersUpdated', (peers) => {
      this.status.peerCount = peers.length;
      this.status.presenceConnected = presenceBeacon.isConnected();
      this.notifyStatusChange();
    });

    // Listen to lifecycle events
    mobileLifecycle.on('state_change', (event) => {
      this.status.appState = mobileLifecycle.getCurrentState();
      this.notifyStatusChange();
    });

    mobileLifecycle.on('network_change', (event) => {
      this.status.networkState = mobileLifecycle.getNetworkState();
      this.notifyStatusChange();
    });

    // Listen to radar updates
    realtimeRadar.subscribe('peersUpdated', (peers) => {
      this.status.radarActive = true;
      this.notifyStatusChange();
    });
  }

  private notifyStatusChange(): void {
    this.notifyListeners('statusChange', this.getStatus());
  }

  async initialize(userInfo?: { name?: string; handle?: string }): Promise<boolean> {
    try {
      console.log('🚀 Initializing Mobile Mesh Service...');

      // Initialize node role service
      console.log('👥 Initializing node role detection...');
      // Node role service auto-initializes in constructor

      // Initialize presence beacon
      if (this.config.enablePresenceBeacon) {
        console.log('🗼 Initializing presence beacon...');
        const presenceInitialized = await presenceBeacon.initialize(userInfo);
        if (!presenceInitialized) {
          console.warn('⚠️ Presence beacon initialization failed');
        }
      }

      // Initialize radar
      if (this.config.enableRadar) {
        console.log('📡 Initializing radar...');
        const radarInitialized = await realtimeRadar.initialize();
        if (!radarInitialized) {
          console.warn('⚠️ Radar initialization failed');
        }
      }

      // Lifecycle management is auto-initialized in constructor
      if (this.config.enableLifecycleManagement) {
        console.log('📱 Lifecycle management initialized');
      }

      // Smart router is auto-initialized in constructor
      if (this.config.enableSmartRouting) {
        console.log('🧭 Smart router initialized');
      }

      this.isInitialized = true;
      this.status.isInitialized = true;
      this.status.currentRole = nodeRoleService.getCurrentRole();
      this.status.appState = mobileLifecycle.getCurrentState();
      this.status.networkState = mobileLifecycle.getNetworkState();

      console.log('✅ Mobile Mesh Service initialized successfully');
      this.notifyStatusChange();

      // Auto-start if configured
      if (this.config.autoStart) {
        await this.start();
      }

      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Mobile Mesh Service:', error);
      return false;
    }
  }

  async start(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Mobile Mesh Service must be initialized first');
    }

    if (this.isRunning) {
      console.log('Mobile Mesh Service already running');
      return;
    }

    console.log('🚀 Starting Mobile Mesh Service...');

    try {
      // Start presence beacon
      if (this.config.enablePresenceBeacon) {
        await presenceBeacon.start();
        console.log('🗼 Presence beacon started');
      }

      // Radar is started in initialize, just ensure it's active
      if (this.config.enableRadar) {
        console.log('📡 Radar is active');
      }

      this.isRunning = true;
      this.status.isRunning = true;
      this.status.presenceConnected = presenceBeacon.isConnected();

      console.log('✅ Mobile Mesh Service started successfully');
      this.notifyStatusChange();
    } catch (error) {
      console.error('❌ Failed to start Mobile Mesh Service:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.log('Mobile Mesh Service already stopped');
      return;
    }

    console.log('🛑 Stopping Mobile Mesh Service...');

    try {
      // Stop presence beacon
      if (this.config.enablePresenceBeacon) {
        await presenceBeacon.stop();
        console.log('🗼 Presence beacon stopped');
      }

      // Radar doesn't have explicit stop, just clear peers
      if (this.config.enableRadar) {
        realtimeRadar.destroy();
        console.log('📡 Radar stopped');
      }

      this.isRunning = false;
      this.status.isRunning = false;
      this.status.presenceConnected = false;
      this.status.radarActive = false;
      this.status.peerCount = 0;

      console.log('✅ Mobile Mesh Service stopped successfully');
      this.notifyStatusChange();
    } catch (error) {
      console.error('❌ Failed to stop Mobile Mesh Service:', error);
      throw error;
    }
  }

  // Peer management
  getPeers(): MobilePeer[] {
    const radarPeers = realtimeRadar.getPeers();
    
    return radarPeers.map(peer => ({
      ...peer,
      // Add routing information if available
      bestTransport: peer.transportPriority?.[0],
      connectionConfidence: peer.confidence
    }));
  }

  async getRoutingDecision(pubkey: string): Promise<RoutingDecision | null> {
    const presencePeers = presenceBeacon.getPeers();
    const presencePeer = presencePeers.find(p => p.pubkey === pubkey);
    
    if (!presencePeer) {
      return null;
    }

    try {
      return await smartRouter.selectBestTransport(presencePeer);
    } catch (error) {
      console.error('Failed to get routing decision:', error);
      return null;
    }
  }

  // Room management
  async joinRoom(roomId: string): Promise<void> {
    if (this.config.enablePresenceBeacon) {
      await presenceBeacon.joinRoom(roomId);
    }
  }

  async leaveRoom(roomId: string): Promise<void> {
    if (this.config.enablePresenceBeacon) {
      await presenceBeacon.leaveRoom(roomId);
    }
  }

  // Status and configuration
  getStatus(): MobileMeshStatus {
    return { ...this.status };
  }

  getCurrentRole(): NodeRole {
    return nodeRoleService.getCurrentRole();
  }

  getCapabilities(): string[] {
    const myPresence = presenceBeacon.getMyPresence();
    return myPresence?.caps || [];
  }

  canBecomeAnchor(): boolean {
    return nodeRoleService.canBecomeAnchor();
  }

  shouldPromoteToAnchor(): boolean {
    return nodeRoleService.shouldPromoteToAnchor();
  }

  // Network and connection info
  getNetworkState(): NetworkState {
    return mobileLifecycle.getNetworkState();
  }

  getAppState(): AppState {
    return mobileLifecycle.getCurrentState();
  }

  getHeartbeatInterval(): number {
    return mobileLifecycle.getHeartbeatInterval();
  }

  isInBackground(): boolean {
    return mobileLifecycle.isInBackground();
  }

  isActive(): boolean {
    return mobileLifecycle.isActive();
  }

  // Transport information
  getAvailableTransports() {
    return smartRouter.getAvailableTransports();
  }

  getTransportIcon(type: string): string {
    return smartRouter.getTransportIcon(type as any);
  }

  getTransportDescription(type: string): string {
    return smartRouter.getTransportDescription(type as any);
  }

  // Event handling
  subscribe(event: string, callback: (data: any) => void): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
    
    return () => {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    };
  }

  private notifyListeners(event: string, data: any): void {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in Mobile Mesh event listener:', error);
        }
      });
    }
  }

  // Debug and diagnostics
  getDiagnostics(): any {
    return {
      status: this.getStatus(),
      nodeRole: nodeRoleService.getNodeInfo(),
      presenceBeacon: {
        connected: presenceBeacon.isConnected(),
        myPresence: presenceBeacon.getMyPresence(),
        peerCount: presenceBeacon.getPeers().length
      },
      radar: {
        peerCount: realtimeRadar.getPeers().length,
        zones: realtimeRadar.getGeohashZones().length
      },
      smartRouter: {
        availableTransports: smartRouter.getAvailableTransports().length,
        connectionContext: smartRouter.getConnectionContext()
      },
      mobileLifecycle: {
        appState: mobileLifecycle.getCurrentState(),
        networkState: mobileLifecycle.getNetworkState(),
        heartbeatInterval: mobileLifecycle.getHeartbeatInterval(),
        backgroundTime: mobileLifecycle.getBackgroundTime()
      }
    };
  }

  // Manual role control (for testing)
  forceRole(role: NodeRole): void {
    nodeRoleService.forceRole(role);
  }

  // Cleanup
  destroy(): void {
    console.log('🧹 Destroying Mobile Mesh Service...');
    
    // Stop all services
    if (this.isRunning) {
      this.stop();
    }

    // Destroy individual services
    if (this.config.enableRadar) {
      realtimeRadar.destroy();
    }
    
    if (this.config.enableLifecycleManagement) {
      mobileLifecycle.destroy();
    }
    
    if (this.config.enableSmartRouting) {
      smartRouter.destroy();
    }

    // Clear listeners
    this.listeners = {};
    
    this.isInitialized = false;
    this.isRunning = false;
    
    console.log('✅ Mobile Mesh Service destroyed');
  }
}

// Export singleton instance
export const mobileMesh = new MobileMeshService();

// Also export class for custom instances
export { MobileMeshService };
