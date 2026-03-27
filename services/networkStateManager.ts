// Unified Network State Manager for XitChat
// Centralized connection monitoring and health checks

export interface NetworkService {
  name: string;
  isConnected: boolean;
  isHealthy: boolean;
  lastCheck: number;
  reconnectAttempts: number;
  maxReconnectAttempts: number;
  reconnectDelay: number;
  healthCheck?: () => Promise<boolean>;
  reconnect?: () => Promise<boolean>;
}

export interface NetworkStatus {
  isOnline: boolean;
  overallHealth: 'excellent' | 'good' | 'fair' | 'poor' | 'offline';
  activeServices: string[];
  totalPeers: number;
  lastUpdate: number;
  services: Map<string, NetworkService>;
}

class NetworkStateManager {
  private services: Map<string, NetworkService> = new Map();
  private listeners: { [key: string]: ((data: any) => void)[] } = {};
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private reconnectIntervals: Map<string, NodeJS.Timeout> = new Map();
  private isOnline = navigator.onLine;

  // ── FIX #1: store bound handlers for cleanup ──
  private onlineHandler: () => void;
  private offlineHandler: () => void;

  private status: NetworkStatus = {
    isOnline: this.isOnline,
    overallHealth: 'offline',
    activeServices: [],
    totalPeers: 0,
    lastUpdate: Date.now(),
    services: new Map()
  };

  constructor() {
    this.onlineHandler = () => {
      this.isOnline = true;
      this.attemptAllReconnections();
      this.updateOverallStatus();
      this.emit('networkOnline');
    };
    this.offlineHandler = () => {
      this.isOnline = false;
      this.updateOverallStatus();
      this.emit('networkOffline');
    };
    this.setupNetworkChangeDetection();
    this.startHealthChecks();
  }

  registerService(service: NetworkService): void {
    this.services.set(service.name, service);
    this.updateOverallStatus();
  }

  unregisterService(serviceName: string): void {
    this.services.delete(serviceName);
    this.stopReconnectAttempts(serviceName);
    this.updateOverallStatus();
  }

  updateServiceStatus(serviceName: string, isConnected: boolean, isHealthy?: boolean): void {
    const service = this.services.get(serviceName);
    if (!service) return;

    service.isConnected = isConnected;
    if (isHealthy !== undefined) service.isHealthy = isHealthy;
    service.lastCheck = Date.now();

    if (isConnected && isHealthy !== false) {
      service.reconnectAttempts = 0;
      this.stopReconnectAttempts(serviceName);
    }

    this.updateOverallStatus();
    this.emit('serviceStatusChanged', { serviceName, isConnected, isHealthy });
  }

  // ── FIX #1: use stored bound handlers ──
  private setupNetworkChangeDetection(): void {
    window.addEventListener('online', this.onlineHandler);
    window.addEventListener('offline', this.offlineHandler);
  }

  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, 10000);
  }

  // ── FIX #4: skip health checks when offline ──
  private async performHealthChecks(): Promise<void> {
    if (!this.isOnline) return;

    for (const [name, service] of this.services) {
      if (service.healthCheck && service.isConnected) {
        try {
          const isHealthy = await service.healthCheck();
          this.updateServiceStatus(name, service.isConnected, isHealthy);
        } catch (error) {
          console.warn(`Health check failed for ${name}:`, error);
          this.updateServiceStatus(name, false, false);
          this.attemptReconnection(name);
        }
      }
    }
  }

  // ── FIX #2: cancel existing timer before creating new one ──
  private async attemptReconnection(serviceName: string): Promise<void> {
    const service = this.services.get(serviceName);
    if (!service || !service.reconnect) return;

    if (service.reconnectAttempts >= service.maxReconnectAttempts) {
      this.emit('serviceReconnectFailed', { serviceName });
      return;
    }

    // Cancel any in-flight timer for this service before scheduling a new one
    this.stopReconnectAttempts(serviceName);

    service.reconnectAttempts++;
    const delay = Math.min(
      service.reconnectDelay * Math.pow(2, service.reconnectAttempts - 1),
      30000
    );

    const timeoutId = setTimeout(async () => {
      this.reconnectIntervals.delete(serviceName);
      try {
        const success = await service.reconnect!();
        if (success) {
          this.updateServiceStatus(serviceName, true, true);
          this.emit('serviceReconnected', { serviceName });
        } else {
          this.attemptReconnection(serviceName);
        }
      } catch (error) {
        console.error(`Reconnection failed for ${serviceName}:`, error);
        this.attemptReconnection(serviceName);
      }
    }, delay);

    this.reconnectIntervals.set(serviceName, timeoutId);
  }

  private stopReconnectAttempts(serviceName: string): void {
    const timeoutId = this.reconnectIntervals.get(serviceName);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.reconnectIntervals.delete(serviceName);
    }
  }

  private async attemptAllReconnections(): Promise<void> {
    for (const [name, service] of this.services) {
      if (!service.isConnected) {
        service.reconnectAttempts = 0;
        this.attemptReconnection(name);
      }
    }
  }

  private updateOverallStatus(): void {
    const activeServices = Array.from(this.services.values())
      .filter(s => s.isConnected && s.isHealthy)
      .map(s => s.name);

    this.status = {
      isOnline: this.isOnline,
      overallHealth: this.calculateOverallHealth(activeServices),
      activeServices,
      totalPeers: this.status.totalPeers, // preserved from updatePeerCount()
      lastUpdate: Date.now(),
      services: new Map(this.services)
    };

    this.emit('statusUpdated', this.status);
  }

  // ── FIX #3: allow callers to inject real peer count ──
  updatePeerCount(count: number): void {
    this.status.totalPeers = count;
    this.emit('statusUpdated', this.status);
  }

  private calculateOverallHealth(activeServices: string[]): NetworkStatus['overallHealth'] {
    if (!this.isOnline || activeServices.length === 0) return 'offline';
    if (activeServices.length >= 4) return 'excellent';
    if (activeServices.length >= 3) return 'good';
    if (activeServices.length >= 2) return 'fair';
    return 'poor';
  }

  getStatus(): NetworkStatus { return { ...this.status }; }
  getServiceStatus(serviceName: string): NetworkService | undefined { return this.services.get(serviceName); }
  hasAnyConnection(): boolean { return Array.from(this.services.values()).some(s => s.isConnected && s.isHealthy); }
  isServiceHealthy(serviceName: string): boolean {
    const s = this.services.get(serviceName);
    return !!(s?.isHealthy && s?.isConnected);
  }

  on(event: string, callback: (data: any) => void): () => void {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
    return () => {
      const idx = this.listeners[event].indexOf(callback);
      if (idx > -1) this.listeners[event].splice(idx, 1);
    };
  }

  private emit(event: string, data?: any): void {
    (this.listeners[event] || []).forEach(cb => cb(data));
  }

  // ── FIX #1: remove window listeners in destroy() ──
  destroy(): void {
    if (this.healthCheckInterval) { clearInterval(this.healthCheckInterval); this.healthCheckInterval = null; }
    for (const timeoutId of this.reconnectIntervals.values()) clearTimeout(timeoutId);
    this.reconnectIntervals.clear();
    this.services.clear();
    this.listeners = {};
    window.removeEventListener('online', this.onlineHandler);
    window.removeEventListener('offline', this.offlineHandler);
  }
}

export const networkStateManager = new NetworkStateManager();
