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
  private status: NetworkStatus = {
    isOnline: this.isOnline,
    overallHealth: 'offline',
    activeServices: [],
    totalPeers: 0,
    lastUpdate: Date.now(),
    services: new Map()
  };

  constructor() {
    this.setupNetworkChangeDetection();
    this.startHealthChecks();
  }

  // Register a network service for monitoring
  registerService(service: NetworkService): void {
    this.services.set(service.name, service);
    this.updateOverallStatus();
    console.log(`📊 Registered network service: ${service.name}`);
  }

  // Unregister a service
  unregisterService(serviceName: string): void {
    this.services.delete(serviceName);
    this.stopReconnectAttempts(serviceName);
    this.updateOverallStatus();
    console.log(`📊 Unregistered network service: ${serviceName}`);
  }

  // Update service connection status
  updateServiceStatus(serviceName: string, isConnected: boolean, isHealthy?: boolean): void {
    const service = this.services.get(serviceName);
    if (!service) return;

    service.isConnected = isConnected;
    if (isHealthy !== undefined) {
      service.isHealthy = isHealthy;
    }
    service.lastCheck = Date.now();

    // Reset reconnect attempts on successful connection
    if (isConnected && isHealthy !== false) {
      service.reconnectAttempts = 0;
      this.stopReconnectAttempts(serviceName);
    }

    this.updateOverallStatus();
    this.emit('serviceStatusChanged', { serviceName, isConnected, isHealthy });
  }

  // Setup browser network change detection
  private setupNetworkChangeDetection(): void {
    const handleOnline = () => {
      console.log('🌐 Network connection restored');
      this.isOnline = true;
      this.attemptAllReconnections();
      this.updateOverallStatus();
      this.emit('networkOnline');
    };

    const handleOffline = () => {
      console.log('📵 Network connection lost');
      this.isOnline = false;
      this.updateOverallStatus();
      this.emit('networkOffline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
  }

  // Start periodic health checks
  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, 10000); // Check every 10 seconds
  }

  // Perform health checks on all services
  private async performHealthChecks(): Promise<void> {
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

  // Attempt to reconnect a specific service
  private async attemptReconnection(serviceName: string): Promise<void> {
    const service = this.services.get(serviceName);
    if (!service || !service.reconnect) return;

    if (service.reconnectAttempts >= service.maxReconnectAttempts) {
      console.error(`Max reconnection attempts reached for ${serviceName}`);
      this.emit('serviceReconnectFailed', { serviceName });
      return;
    }

    service.reconnectAttempts++;
    const delay = Math.min(service.reconnectDelay * Math.pow(2, service.reconnectAttempts - 1), 30000);

    console.log(`🔄 Attempting to reconnect ${serviceName} (attempt ${service.reconnectAttempts}/${service.maxReconnectAttempts}) in ${delay}ms`);

    const timeoutId = setTimeout(async () => {
      try {
        const success = await service.reconnect!();
        if (success) {
          console.log(`✅ Successfully reconnected ${serviceName}`);
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

  // Stop reconnection attempts for a service
  private stopReconnectAttempts(serviceName: string): void {
    const timeoutId = this.reconnectIntervals.get(serviceName);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.reconnectIntervals.delete(serviceName);
    }
  }

  // Attempt to reconnect all services
  private async attemptAllReconnections(): Promise<void> {
    for (const [name, service] of this.services) {
      if (!service.isConnected) {
        service.reconnectAttempts = 0; // Reset attempts when network comes back
        this.attemptReconnection(name);
      }
    }
  }

  // Update overall network status
  private updateOverallStatus(): void {
    const activeServices = Array.from(this.services.values())
      .filter(s => s.isConnected && s.isHealthy)
      .map(s => s.name);

    const totalPeers = this.calculateTotalPeers();
    const overallHealth = this.calculateOverallHealth(activeServices);

    this.status = {
      isOnline: this.isOnline,
      overallHealth,
      activeServices,
      totalPeers,
      lastUpdate: Date.now(),
      services: new Map(this.services)
    };

    this.emit('statusUpdated', this.status);
  }

  // Calculate total peers across all services (placeholder)
  private calculateTotalPeers(): number {
    // This would need to be implemented by querying actual services
    return 0;
  }

  // Calculate overall network health
  private calculateOverallHealth(activeServices: string[]): NetworkStatus['overallHealth'] {
    if (!this.isOnline || activeServices.length === 0) return 'offline';
    if (activeServices.length >= 4) return 'excellent';
    if (activeServices.length >= 3) return 'good';
    if (activeServices.length >= 2) return 'fair';
    return 'poor';
  }

  // Get current network status
  getStatus(): NetworkStatus {
    return { ...this.status };
  }

  // Get service-specific status
  getServiceStatus(serviceName: string): NetworkService | undefined {
    return this.services.get(serviceName);
  }

  // Check if any service is connected
  hasAnyConnection(): boolean {
    return Array.from(this.services.values()).some(s => s.isConnected && s.isHealthy);
  }

  // Check if specific service is healthy
  isServiceHealthy(serviceName: string): boolean {
    const service = this.services.get(serviceName);
    return service?.isHealthy && service?.isConnected || false;
  }

  // Event handling
  on(event: string, callback: (data: any) => void): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);

    return () => {
      const index = this.listeners[event].indexOf(callback);
      if (index > -1) {
        this.listeners[event].splice(index, 1);
      }
    };
  }

  private emit(event: string, data?: any): void {
    const callbacks = this.listeners[event] || [];
    callbacks.forEach(callback => callback(data));
  }

  // Cleanup
  destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    for (const timeoutId of this.reconnectIntervals.values()) {
      clearTimeout(timeoutId);
    }

    this.reconnectIntervals.clear();
    this.services.clear();
    this.listeners = {};
  }
}

// Export singleton instance
export const networkStateManager = new NetworkStateManager();
