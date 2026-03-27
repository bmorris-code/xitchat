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
  maxBackgroundTime: number;
  lowBatteryThreshold: number;
  poorMemoryThreshold: number;
  heartbeatMultiplier: number;
}

class MobileLifecycleManager {
  private currentState: AppState = 'active';
  private networkState: NetworkState = 'online';
  private config: LifecycleConfig;
  private listeners: { [event: string]: ((data: any) => void)[] } = {};
  private backgroundStartTime: number | null = null;
  private readonly heartbeatBaseInterval: number = 15000;
  private currentHeartbeatInterval: number = 15000;
  private isMonitoring = false;
  private monitoringIntervals: any[] = [];
  private lastTransitionAt = 0;
  private readonly MIN_TRANSITION_INTERVAL_MS = 500; // ── FIX #4: reduced from 1500ms

  // ── FIX #1: store all bound DOM handlers for cleanup ──
  private boundHandlers: Array<{ target: EventTarget; type: string; handler: EventListener }> = [];

  // ── FIX #2: store battery reference for cleanup ──
  private batteryRef: any = null;
  private batteryLevelHandler: (() => void) | null = null;
  private batteryChargingHandler: (() => void) | null = null;

  // ── FIX #3: store background cleanup timer ──
  private backgroundCleanupTimer: any = null;

  // ── FIX #1: store connection reference for cleanup ──
  private connectionChangeHandler: (() => void) | null = null;
  private connectionRef: any = null;

  constructor(config?: Partial<LifecycleConfig>) {
    this.config = {
      enableBackgroundSync: true,
      maxBackgroundTime: 5 * 60 * 1000,
      lowBatteryThreshold: 0.2,
      poorMemoryThreshold: 0.8,
      heartbeatMultiplier: 4,
      ...config
    };
    this.initialize();
  }

  private initialize(): void {
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
      const c = (window as any).Capacitor;
      return !!c?.isNativePlatform?.() && c?.getPlatform?.() === 'android';
    } catch { return false; }
  }

  // ── FIX #1: helper to register + track DOM listeners for cleanup ──
  private addDOMListener(target: EventTarget, type: string, handler: EventListener): void {
    target.addEventListener(type, handler);
    this.boundHandlers.push({ target, type, handler });
  }

  private setupAppStateMonitoring(): void {
    this.addDOMListener(document, 'visibilitychange', () => this.handleVisibilityChange());
    this.addDOMListener(window, 'focus', () => this.handleAppFocus());
    this.addDOMListener(window, 'blur', () => {
      if (!this.isNativeAndroid()) this.handleAppBlur();
    });
    this.addDOMListener(window, 'pageshow', (e) => this.handlePageShow(e as PageTransitionEvent));
    this.addDOMListener(window, 'pagehide', (e) => {
      if (!this.isNativeAndroid()) this.handlePageHide(e as PageTransitionEvent);
    });
    this.addDOMListener(window, 'beforeunload', () => this.handleAppTermination());
  }

  private setupNetworkMonitoring(): void {
    this.addDOMListener(window, 'online', () => this.handleNetworkOnline());
    this.addDOMListener(window, 'offline', () => this.handleNetworkOffline());

    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      if (connection) {
        // ── FIX #1: store connection ref and handler for cleanup ──
        this.connectionRef = connection;
        this.connectionChangeHandler = () => this.handleNetworkChange(connection);
        connection.addEventListener('change', this.connectionChangeHandler);
        this.handleNetworkChange(connection);
      }
    }
  }

  private setupBatteryMonitoring(): void {
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        // ── FIX #2: store battery ref and handlers for cleanup ──
        this.batteryRef = battery;
        this.batteryLevelHandler = () => this.handleBatteryLevelChange(battery.level);
        this.batteryChargingHandler = () => this.handleChargingStateChange(battery.charging);
        battery.addEventListener('levelchange', this.batteryLevelHandler);
        battery.addEventListener('chargingchange', this.batteryChargingHandler);
        this.handleBatteryLevelChange(battery.level);
        this.handleChargingStateChange(battery.charging);
      });
    }
  }

  private setupMemoryMonitoring(): void {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      const memoryInterval = setInterval(() => {
        const usage = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
        if (usage > this.config.poorMemoryThreshold) this.handleMemoryPressure(usage);
      }, 30000);
      this.monitoringIntervals.push(memoryInterval);
    }

    if ('onmemorypressure' in window) {
      this.addDOMListener(window, 'memorypressure', ((e: any) => {
        this.handleMemoryPressure(e.detail?.usage || 0.9);
      }) as EventListener);
    }
  }

  private setupPageLifecycleEvents(): void {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      this.addDOMListener(navigator.serviceWorker, 'message', ((event: any) => {
        if (event.data?.type === 'lifecycle') this.handleServiceWorkerMessage(event.data);
      }) as EventListener);
    }
  }

  // Event handlers
  private handleVisibilityChange(): void {
    if (document.visibilityState === 'visible') this.transitionToState('active');
    else if (document.visibilityState === 'hidden') this.transitionToState('background');
  }

  private handleAppFocus(): void {
    if (this.currentState !== 'active') this.transitionToState('active');
  }

  private handleAppBlur(): void {
    if (this.currentState === 'active') this.transitionToState('inactive');
  }

  private handlePageShow(event: PageTransitionEvent): void {
    if (!event.persisted) this.transitionToState('active');
  }

  private handlePageHide(event: PageTransitionEvent): void {
    if (!event.persisted) this.transitionToState('background');
  }

  private handleAppTermination(): void { this.transitionToState('terminated'); }

  private handleNetworkOnline(): void {
    this.networkState = 'online';
    this.emitEvent('network_change', { state: 'online' });
  }

  private handleNetworkOffline(): void {
    this.networkState = 'offline';
    this.emitEvent('network_change', { state: 'offline' });
  }

  private handleNetworkChange(connection: any): void {
    const { effectiveType, saveData } = connection;
    if (saveData || effectiveType === 'slow-2g' || effectiveType === '2g') {
      this.networkState = 'poor';
    } else {
      this.networkState = 'online';
    }
    this.emitEvent('network_change', {
      state: this.networkState, effectiveType, saveData,
      downlink: connection.downlink, rtt: connection.rtt
    });
  }

  private handleBatteryLevelChange(level: number): void {
    this.emitEvent('battery_change', { level, low: level < this.config.lowBatteryThreshold });
  }

  private handleChargingStateChange(charging: boolean): void {
    this.emitEvent('battery_change', { charging });
  }

  private handleMemoryPressure(usage: number): void {
    this.emitEvent('memory_warning', { usage });
    this.requestCleanup();
  }

  private handleServiceWorkerMessage(data: any): void {
    if (data.action === 'wakeup') this.transitionToState('active');
  }

  // State transitions
  private transitionToState(newState: AppState): void {
    const oldState = this.currentState;
    if (oldState === newState) return;

    const now = Date.now();
    if (now - this.lastTransitionAt < this.MIN_TRANSITION_INTERVAL_MS) return;
    this.lastTransitionAt = now;

    this.currentState = newState;

    switch (newState) {
      case 'active': this.handleActiveTransition(); break;
      case 'inactive': this.handleInactiveTransition(); break;
      case 'background': this.handleBackgroundTransition(); break;
      case 'terminated': this.handleTerminatedTransition(); break;
    }

    this.emitEvent('state_change', { oldState, newState, timestamp: Date.now() });
  }

  private handleActiveTransition(): void {
    this.backgroundStartTime = null;
    this.currentHeartbeatInterval = this.heartbeatBaseInterval;
    // ── FIX #3: cancel background cleanup timer when returning to foreground ──
    if (this.backgroundCleanupTimer) {
      clearTimeout(this.backgroundCleanupTimer);
      this.backgroundCleanupTimer = null;
    }
    this.resumeMeshConnections();
    this.triggerPresenceUpdate();
  }

  private handleInactiveTransition(): void {
    this.currentHeartbeatInterval = this.heartbeatBaseInterval * 2;
  }

  private handleBackgroundTransition(): void {
    this.backgroundStartTime = Date.now();
    this.currentHeartbeatInterval = this.heartbeatBaseInterval * this.config.heartbeatMultiplier;

    // ── FIX #3: store timer so it can be cancelled if app returns to foreground ──
    if (this.backgroundCleanupTimer) clearTimeout(this.backgroundCleanupTimer);
    if (this.config.maxBackgroundTime > 0) {
      this.backgroundCleanupTimer = setTimeout(() => {
        this.backgroundCleanupTimer = null;
        this.checkBackgroundTimeout();
      }, this.config.maxBackgroundTime);
    }
  }

  private handleTerminatedTransition(): void {
    this.cleanupAllConnections();
    this.clearPresence();
  }

  private checkBackgroundTimeout(): void {
    if (this.currentState === 'background' && this.backgroundStartTime) {
      const backgroundTime = Date.now() - this.backgroundStartTime;
      if (backgroundTime > this.config.maxBackgroundTime) {
        this.forceBackgroundCleanup();
      }
    }
  }

  private resumeMeshConnections(): void {
    this.emitEvent('state_change', { action: 'resume_mesh', state: this.currentState });
  }

  private pauseMeshConnections(): void {
    this.emitEvent('state_change', { action: 'pause_mesh', state: this.currentState });
  }

  private cleanupAllConnections(): void {
    this.emitEvent('state_change', { action: 'cleanup_all', state: this.currentState });
  }

  private forceBackgroundCleanup(): void {
    this.emitEvent('state_change', {
      action: 'force_cleanup',
      state: this.currentState,
      backgroundTime: this.backgroundStartTime ? Date.now() - this.backgroundStartTime : 0
    });
  }

  private requestCleanup(): void {
    this.emitEvent('memory_warning', { action: 'request_cleanup', state: this.currentState });
  }

  private triggerPresenceUpdate(): void {
    this.emitEvent('state_change', { action: 'update_presence', state: this.currentState });
  }

  private clearPresence(): void {
    this.emitEvent('state_change', { action: 'clear_presence', state: this.currentState });
  }

  private emitEvent(type: string, data: any): void {
    const event: LifecycleEvent = { type: type as any, timestamp: Date.now(), data };
    (this.listeners[type] || []).forEach(cb => {
      try { cb(event); } catch (error) { console.error('Lifecycle listener error:', error); }
    });
  }

  // Public API
  getCurrentState(): AppState { return this.currentState; }
  getNetworkState(): NetworkState { return this.networkState; }
  getHeartbeatInterval(): number { return this.currentHeartbeatInterval; }
  isInBackground(): boolean { return this.currentState === 'background'; }
  isActive(): boolean { return this.currentState === 'active'; }
  getBackgroundTime(): number {
    return this.backgroundStartTime ? Date.now() - this.backgroundStartTime : 0;
  }

  on(event: string, callback: (data: any) => void): () => void {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
    return () => { this.listeners[event] = this.listeners[event].filter(cb => cb !== callback); };
  }

  forceState(state: AppState): void { this.transitionToState(state); }
  updateConfig(config: Partial<LifecycleConfig>): void { this.config = { ...this.config, ...config }; }

  destroy(): void {
    // ── FIX #1: remove all tracked DOM event listeners ──
    this.boundHandlers.forEach(({ target, type, handler }) => {
      target.removeEventListener(type, handler);
    });
    this.boundHandlers = [];

    // ── FIX #2: remove battery listeners ──
    if (this.batteryRef) {
      if (this.batteryLevelHandler) this.batteryRef.removeEventListener('levelchange', this.batteryLevelHandler);
      if (this.batteryChargingHandler) this.batteryRef.removeEventListener('chargingchange', this.batteryChargingHandler);
      this.batteryRef = null;
      this.batteryLevelHandler = null;
      this.batteryChargingHandler = null;
    }

    // ── FIX #1: remove connection change listener ──
    if (this.connectionRef && this.connectionChangeHandler) {
      this.connectionRef.removeEventListener('change', this.connectionChangeHandler);
      this.connectionRef = null;
      this.connectionChangeHandler = null;
    }

    // ── FIX #3: clear background cleanup timer ──
    if (this.backgroundCleanupTimer) {
      clearTimeout(this.backgroundCleanupTimer);
      this.backgroundCleanupTimer = null;
    }

    this.monitoringIntervals.forEach(i => clearInterval(i));
    this.monitoringIntervals = [];
    this.listeners = {};
    this.isMonitoring = false;
  }
}

export const mobileLifecycle = new MobileLifecycleManager();
