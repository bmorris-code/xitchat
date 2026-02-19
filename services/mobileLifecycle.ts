// Mobile Lifecycle Management
// Handles app state changes, background/foreground transitions, and mesh connectivity

export type AppState = 'active' | 'inactive' | 'background' | 'terminated';
export type NetworkState = 'online' | 'offline' | 'poor';

export interface LifecycleEvent {
  type: 'state_change' | 'network_change' | 'battery_change' | 'memory_warning';
  timestamp: number;
  data: any;
}

export interface LifecycleConfig {
  enableBackgroundSync: boolean;
  maxBackgroundTime: number; // Maximum time in background before cleanup
  lowBatteryThreshold: number; // Battery level threshold (0-1)
  poorMemoryThreshold: number; // Memory pressure threshold
  heartbeatMultiplier: number; // How much to slow down heartbeat in background
}

class MobileLifecycleManager {
  private currentState: AppState = 'active';
  private networkState: NetworkState = 'online';
  private config: LifecycleConfig;
  private listeners: { [event: string]: ((data: any) => void)[] } = {};
  private backgroundStartTime: number | null = null;
  private heartbeatBaseInterval: number = 15000; // 15 seconds base
  private currentHeartbeatInterval: number = 15000;
  private isMonitoring = false;
  private monitoringIntervals: any[] = [];
  private lastTransitionAt = 0;
  private readonly MIN_TRANSITION_INTERVAL_MS = 1500;

  constructor(config?: Partial<LifecycleConfig>) {
    this.config = {
      enableBackgroundSync: true,
      maxBackgroundTime: 5 * 60 * 1000, // 5 minutes
      lowBatteryThreshold: 0.2,
      poorMemoryThreshold: 0.8,
      heartbeatMultiplier: 4, // 4x slower in background
      ...config
    };

    this.initialize();
  }

  private initialize(): void {
    console.log('📱 Initializing Mobile Lifecycle Manager...');
    
    this.setupAppStateMonitoring();
    this.setupNetworkMonitoring();
    this.setupBatteryMonitoring();
    this.setupMemoryMonitoring();
    this.setupPageLifecycleEvents();
    
    this.isMonitoring = true;
    this.emitEvent('state_change', { state: this.currentState, network: this.networkState });
  }

  private isNativeAndroid(): boolean {
    try {
      const capacitor = (window as any).Capacitor;
      return !!capacitor?.isNativePlatform?.() && capacitor?.getPlatform?.() === 'android';
    } catch {
      return false;
    }
  }

  private setupAppStateMonitoring(): void {
    // Page Visibility API
    document.addEventListener('visibilitychange', () => {
      this.handleVisibilityChange();
    });

    // Page focus/blur events
    window.addEventListener('focus', () => {
      this.handleAppFocus();
    });

    window.addEventListener('blur', () => {
      // Android WebView often fires blur while app is still foreground.
      if (!this.isNativeAndroid()) {
        this.handleAppBlur();
      }
    });

    // Page show/hide for PWA
    window.addEventListener('pageshow', (event) => {
      this.handlePageShow(event);
    });

    window.addEventListener('pagehide', (event) => {
      // On Android this can fire during in-app transitions and cause false backgrounding.
      if (!this.isNativeAndroid()) {
        this.handlePageHide(event);
      }
    });

    // Before unload
    window.addEventListener('beforeunload', () => {
      this.handleAppTermination();
    });
  }

  private setupNetworkMonitoring(): void {
    // Online/offline events
    window.addEventListener('online', () => {
      this.handleNetworkOnline();
    });

    window.addEventListener('offline', () => {
      this.handleNetworkOffline();
    });

    // Network connection API
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      if (connection) {
        connection.addEventListener('change', () => {
          this.handleNetworkChange(connection);
        });

        // Initial network state
        this.handleNetworkChange(connection);
      }
    }
  }

  private setupBatteryMonitoring(): void {
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        // Battery level changes
        battery.addEventListener('levelchange', () => {
          this.handleBatteryLevelChange(battery.level);
        });

        // Charging state changes
        battery.addEventListener('chargingchange', () => {
          this.handleChargingStateChange(battery.charging);
        });

        // Initial battery state
        this.handleBatteryLevelChange(battery.level);
        this.handleChargingStateChange(battery.charging);
      });
    }
  }

  private setupMemoryMonitoring(): void {
    // Memory pressure API (if available)
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      
      // Monitor memory usage periodically
      const memoryInterval = setInterval(() => {
        const usage = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
        if (usage > this.config.poorMemoryThreshold) {
          this.handleMemoryPressure(usage);
        }
      }, 30000); // Check every 30 seconds

      this.monitoringIntervals.push(memoryInterval);
    }

    // Memory pressure events (if available)
    if ('onmemorypressure' in window) {
      window.addEventListener('memorypressure', (event: any) => {
        this.handleMemoryPressure(event.detail?.usage || 0.9);
      });
    }
  }

  private setupPageLifecycleEvents(): void {
    // Service Worker messages for background sync
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'lifecycle') {
          this.handleServiceWorkerMessage(event.data);
        }
      });
    }
  }

  // Event handlers
  private handleVisibilityChange(): void {
    const visibilityState = document.visibilityState;
    
    if (visibilityState === 'visible') {
      this.transitionToState('active');
    } else if (visibilityState === 'hidden') {
      this.transitionToState('background');
    }
  }

  private handleAppFocus(): void {
    if (this.currentState !== 'active') {
      this.transitionToState('active');
    }
  }

  private handleAppBlur(): void {
    // Only go to inactive if not already background
    if (this.currentState === 'active') {
      this.transitionToState('inactive');
    }
  }

  private handlePageShow(event: PageTransitionEvent): void {
    // Handle PWA navigation
    if (!event.persisted) {
      this.transitionToState('active');
    }
  }

  private handlePageHide(event: PageTransitionEvent): void {
    // Handle PWA navigation
    if (!event.persisted) {
      this.transitionToState('background');
    }
  }

  private handleAppTermination(): void {
    this.transitionToState('terminated');
  }

  private handleNetworkOnline(): void {
    this.networkState = 'online';
    this.emitEvent('network_change', { state: 'online' });
  }

  private handleNetworkOffline(): void {
    this.networkState = 'offline';
    this.emitEvent('network_change', { state: 'offline' });
  }

  private handleNetworkChange(connection: any): void {
    const effectiveType = connection.effectiveType;
    const saveData = connection.saveData;
    
    if (saveData || effectiveType === 'slow-2g' || effectiveType === '2g') {
      this.networkState = 'poor';
    } else if (effectiveType === '3g' || effectiveType === '4g') {
      this.networkState = 'online';
    }

    this.emitEvent('network_change', { 
      state: this.networkState, 
      effectiveType, 
      saveData,
      downlink: connection.downlink,
      rtt: connection.rtt
    });
  }

  private handleBatteryLevelChange(level: number): void {
    this.emitEvent('battery_change', { 
      level, 
      low: level < this.config.lowBatteryThreshold 
    });
  }

  private handleChargingStateChange(charging: boolean): void {
    this.emitEvent('battery_change', { charging });
  }

  private handleMemoryPressure(usage: number): void {
    this.emitEvent('memory_warning', { usage });
    
    // Trigger cleanup
    this.requestCleanup();
  }

  private handleServiceWorkerMessage(data: any): void {
    if (data.action === 'wakeup') {
      // App being woken up by background sync
      this.transitionToState('active');
    }
  }

  // State transitions
  private transitionToState(newState: AppState): void {
    const oldState = this.currentState;
    
    if (oldState === newState) return;
    const now = Date.now();
    if (now - this.lastTransitionAt < this.MIN_TRANSITION_INTERVAL_MS) {
      return;
    }
    this.lastTransitionAt = now;

    console.log(`📱 App state transition: ${oldState} → ${newState}`);

    this.currentState = newState;

    // Handle specific transitions
    switch (newState) {
      case 'active':
        this.handleActiveTransition();
        break;
      case 'inactive':
        this.handleInactiveTransition();
        break;
      case 'background':
        this.handleBackgroundTransition();
        break;
      case 'terminated':
        this.handleTerminatedTransition();
        break;
    }

    this.emitEvent('state_change', { 
      oldState, 
      newState, 
      timestamp: Date.now() 
    });
  }

  private handleActiveTransition(): void {
    console.log('📱 App became active - resuming full operations');
    
    // Reset background timer
    this.backgroundStartTime = null;
    
    // Restore normal heartbeat
    this.currentHeartbeatInterval = this.heartbeatBaseInterval;
    
    // Resume mesh connections
    this.resumeMeshConnections();
    
    // Trigger presence update
    this.triggerPresenceUpdate();
  }

  private handleInactiveTransition(): void {
    console.log('📱 App became inactive - reducing activity');
    
    // Slightly reduce heartbeat
    this.currentHeartbeatInterval = this.heartbeatBaseInterval * 2;
  }

  private handleBackgroundTransition(): void {
    console.log('📱 App went to background - entering low-power mode');
    
    // Start background timer
    this.backgroundStartTime = Date.now();
    
    // Slow down heartbeat significantly
    this.currentHeartbeatInterval = this.heartbeatBaseInterval * this.config.heartbeatMultiplier;
    
    // Keep mesh active during background for test reliability (A/B messaging).
    // this.pauseMeshConnections();
    
    // Schedule background cleanup
    if (this.config.maxBackgroundTime > 0) {
      setTimeout(() => {
        this.checkBackgroundTimeout();
      }, this.config.maxBackgroundTime);
    }
  }

  private handleTerminatedTransition(): void {
    console.log('📱 App terminating - cleaning up');
    
    // Clear all connections
    this.cleanupAllConnections();
    
    // Clear presence
    this.clearPresence();
  }

  private checkBackgroundTimeout(): void {
    if (this.currentState === 'background' && this.backgroundStartTime) {
      const backgroundTime = Date.now() - this.backgroundStartTime;
      
      if (backgroundTime > this.config.maxBackgroundTime) {
        console.log('📱 Background timeout exceeded - forcing cleanup');
        this.forceBackgroundCleanup();
      }
    }
  }

  // Mesh connection management
  private resumeMeshConnections(): void {
    console.log('🔗 Resuming mesh connections');
    
    // Emit event for mesh services to resume
    this.emitEvent('state_change', { 
      action: 'resume_mesh',
      state: this.currentState 
    });
  }

  private pauseMeshConnections(): void {
    console.log('⏸️ Pausing mesh connections');
    
    // Emit event for mesh services to pause
    this.emitEvent('state_change', { 
      action: 'pause_mesh',
      state: this.currentState 
    });
  }

  private cleanupAllConnections(): void {
    console.log('🧹 Cleaning up all connections');
    
    // Emit event for cleanup
    this.emitEvent('state_change', { 
      action: 'cleanup_all',
      state: this.currentState 
    });
  }

  private forceBackgroundCleanup(): void {
    console.log('🧹 Forcing background cleanup');
    
    // Emit event for aggressive cleanup
    this.emitEvent('state_change', { 
      action: 'force_cleanup',
      state: this.currentState,
      backgroundTime: this.backgroundStartTime ? Date.now() - this.backgroundStartTime : 0
    });
  }

  private requestCleanup(): void {
    console.log('🧹 Requesting cleanup due to memory pressure');
    
    // Emit event for cleanup
    this.emitEvent('memory_warning', { 
      action: 'request_cleanup',
      state: this.currentState 
    });
  }

  private triggerPresenceUpdate(): void {
    console.log('📡 Triggering presence update');
    
    // Emit event for presence update
    this.emitEvent('state_change', { 
      action: 'update_presence',
      state: this.currentState 
    });
  }

  private clearPresence(): void {
    console.log('🗼 Clearing presence');
    
    // Emit event for presence clearing
    this.emitEvent('state_change', { 
      action: 'clear_presence',
      state: this.currentState 
    });
  }

  // Event system
  private emitEvent(type: string, data: any): void {
    const event: LifecycleEvent = {
      type: type as any,
      timestamp: Date.now(),
      data
    };

    if (this.listeners[type]) {
      this.listeners[type].forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.error('Error in lifecycle event listener:', error);
        }
      });
    }
  }

  // Public API
  getCurrentState(): AppState {
    return this.currentState;
  }

  getNetworkState(): NetworkState {
    return this.networkState;
  }

  getHeartbeatInterval(): number {
    return this.currentHeartbeatInterval;
  }

  isInBackground(): boolean {
    return this.currentState === 'background';
  }

  isActive(): boolean {
    return this.currentState === 'active';
  }

  getBackgroundTime(): number {
    if (!this.backgroundStartTime) return 0;
    return Date.now() - this.backgroundStartTime;
  }

  on(event: string, callback: (data: any) => void): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
    
    return () => {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    };
  }

  // Manual state control (for testing)
  forceState(state: AppState): void {
    this.transitionToState(state);
  }

  // Configuration updates
  updateConfig(config: Partial<LifecycleConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // Cleanup
  destroy(): void {
    console.log('📱 Destroying Mobile Lifecycle Manager');
    
    // Clear all monitoring intervals
    this.monitoringIntervals.forEach(interval => clearInterval(interval));
    this.monitoringIntervals = [];
    
    // Clear all listeners
    this.listeners = {};
    
    this.isMonitoring = false;
  }
}

export const mobileLifecycle = new MobileLifecycleManager();
