// Node Role Detection System
// Automatically assigns node roles at runtime based on device capabilities and stability

export type NodeRole = 'edge' | 'anchor';

export interface NodeCapabilities {
  device: 'mobile' | 'desktop' | 'server';
  hasStableConnection: boolean;
  hasBattery: boolean;
  canRunInBackground: boolean;
  networkType: 'wifi' | 'cellular' | 'ethernet' | 'unknown';
  cpuLevel: 'low' | 'medium' | 'high';
  memoryLevel: 'low' | 'medium' | 'high';
}

export interface NodeInfo {
  pubkey: string;
  role: NodeRole;
  capabilities: NodeCapabilities;
  lastRoleChange: number;
  uptime: number;
}

class NodeRoleService {
  private currentRole: NodeRole = 'edge';
  private capabilities: NodeCapabilities;
  private roleChangeListeners: ((role: NodeRole) => void)[] = [];
  private startTime: number = Date.now();
  private stabilityScore: number = 0;
  private roleEvaluationInterval: any = null;

  constructor() {
    this.capabilities = this.detectCapabilities();
    this.currentRole = this.determineInitialRole();
    this.startRoleEvaluation();
  }

  private detectCapabilities(): NodeCapabilities {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isStableConnection = this.evaluateConnectionStability();
    const hasBattery = !!(navigator as any).getBattery || isMobile;
    const canRunInBackground = !isMobile || ('serviceWorker' in navigator && 'PushManager' in window);
    
    // Detect network type
    let networkType: NodeCapabilities['networkType'] = 'unknown';
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      if (connection) {
        if (connection.type === 'wifi') networkType = 'wifi';
        else if (connection.type === 'cellular') networkType = 'cellular';
        else if (connection.type === 'ethernet') networkType = 'ethernet';
      }
    }

    // Evaluate CPU and memory based on device hints
    let cpuLevel: NodeCapabilities['cpuLevel'] = 'medium';
    let memoryLevel: NodeCapabilities['memoryLevel'] = 'medium';
    
    if (isMobile) {
      cpuLevel = 'low';
      memoryLevel = 'low';
    } else if (navigator.hardwareConcurrency && navigator.hardwareConcurrency >= 8) {
      cpuLevel = 'high';
      if ((navigator as any).deviceMemory && (navigator as any).deviceMemory >= 8) {
        memoryLevel = 'high';
      }
    }

    return {
      device: isMobile ? 'mobile' : 'desktop',
      hasStableConnection: isStableConnection,
      hasBattery,
      canRunInBackground,
      networkType,
      cpuLevel,
      memoryLevel
    };
  }

  private evaluateConnectionStability(): boolean {
    // Consider connection stable if:
    // - Desktop with ethernet/wifi
    // - Mobile with stable wifi
    // - High connection quality
    
    const isMobile = this.capabilities?.device === 'mobile';
    
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      if (connection) {
        // Stable if not on slow cellular
        const isStableType = connection.type === 'wifi' || connection.type === 'ethernet';
        const isGoodQuality = !connection.saveData && 
          ['4g', '5g'].includes(connection.effectiveType);
        
        return isStableType || (isMobile && isGoodQuality);
      }
    }
    
    // Fallback: assume desktop is stable, mobile is not
    return !isMobile;
  }

  private determineInitialRole(): NodeRole {
    // Edge nodes are mobile by default
    // Anchor nodes are desktop/stable devices
    
    const { device, hasStableConnection, cpuLevel, memoryLevel } = this.capabilities;
    
    // Mobile devices are always edge nodes initially
    if (device === 'mobile') {
      return 'edge';
    }
    
    // Desktop devices can be anchors if they have good specs and stable connection
    if (device === 'desktop' && hasStableConnection && 
        (cpuLevel === 'high' || memoryLevel === 'high')) {
      return 'anchor';
    }
    
    // Default to edge for safety
    return 'edge';
  }

  private startRoleEvaluation(): void {
    // Evaluate role every 2 minutes
    this.roleEvaluationInterval = setInterval(() => {
      this.evaluateRoleChange();
    }, 120000);
  }

  private evaluateRoleChange(): void {
    const previousRole = this.currentRole;
    const newRole = this.calculateOptimalRole();
    
    if (newRole !== previousRole) {
      this.changeRole(newRole);
    }
  }

  private calculateOptimalRole(): NodeRole {
    const { device, hasStableConnection, cpuLevel, memoryLevel } = this.capabilities;
    const currentUptime = Date.now() - this.startTime;
    
    // Update stability score based on uptime and connection
    this.updateStabilityScore();
    
    // Mobile devices: only become anchors if exceptionally stable
    if (device === 'mobile') {
      // Mobile anchor promotion requires:
      // - Very high stability score
      // - Excellent connection
      // - Good hardware
      // - Long uptime (> 30 minutes)
      
      if (this.stabilityScore > 0.9 && 
          hasStableConnection && 
          cpuLevel === 'high' && 
          currentUptime > 30 * 60 * 1000) {
        return 'anchor';
      }
      return 'edge';
    }
    
    // Desktop devices: become anchors more readily
    if (device === 'desktop') {
      // Desktop anchor requirements:
      // - Good stability score
      // - Stable connection
      // - Decent hardware
      // - Some uptime (> 5 minutes)
      
      if (this.stabilityScore > 0.7 && 
          hasStableConnection && 
          (cpuLevel === 'high' || memoryLevel === 'high') &&
          currentUptime > 5 * 60 * 1000) {
        return 'anchor';
      }
      return 'edge';
    }
    
    return 'edge';
  }

  private updateStabilityScore(): void {
    // Stability score based on:
    // - Connection consistency
    // - Uptime
    // - Performance metrics
    
    let score = 0.5; // Base score
    
    // Connection stability
    if (this.capabilities.hasStableConnection) {
      score += 0.3;
    }
    
    // Uptime bonus (max 0.2)
    const uptimeHours = (Date.now() - this.startTime) / (1000 * 60 * 60);
    score += Math.min(uptimeHours / 24, 0.2);
    
    // Device capability bonus
    if (this.capabilities.cpuLevel === 'high') score += 0.1;
    if (this.capabilities.memoryLevel === 'high') score += 0.1;
    
    // Network type bonus
    if (this.capabilities.networkType === 'ethernet') score += 0.1;
    else if (this.capabilities.networkType === 'wifi') score += 0.05;
    
    this.stabilityScore = Math.min(score, 1.0);
  }

  private changeRole(newRole: NodeRole): void {
    console.log(`🔄 Node role changing from ${this.currentRole} to ${newRole}`, {
      stabilityScore: this.stabilityScore,
      uptime: Date.now() - this.startTime,
      capabilities: this.capabilities
    });
    
    this.currentRole = newRole;
    
    // Notify listeners
    this.roleChangeListeners.forEach(listener => {
      try {
        listener(newRole);
      } catch (error) {
        console.error('Error in role change listener:', error);
      }
    });
  }

  // Public API
  getCurrentRole(): NodeRole {
    return this.currentRole;
  }

  getCapabilities(): NodeCapabilities {
    return { ...this.capabilities };
  }

  getNodeInfo(): NodeInfo {
    return {
      pubkey: localStorage.getItem('xitchat_pubkey') || 'unknown',
      role: this.currentRole,
      capabilities: { ...this.capabilities },
      lastRoleChange: Date.now(),
      uptime: Date.now() - this.startTime
    };
  }

  getStabilityScore(): number {
    return this.stabilityScore;
  }

  onRoleChange(callback: (role: NodeRole) => void): () => void {
    this.roleChangeListeners.push(callback);
    return () => {
      this.roleChangeListeners = this.roleChangeListeners.filter(cb => cb !== callback);
    };
  }

  canBecomeAnchor(): boolean {
    const { device, cpuLevel, memoryLevel } = this.capabilities;
    return device === 'desktop' || (cpuLevel === 'high' && memoryLevel === 'high');
  }

  shouldPromoteToAnchor(): boolean {
    return this.canBecomeAnchor() && this.stabilityScore > 0.8;
  }

  shouldDemoteToEdge(): boolean {
    return this.stabilityScore < 0.4 || !this.capabilities.hasStableConnection;
  }

  // Force role change (for testing or manual override)
  forceRole(role: NodeRole): void {
    if (role === 'anchor' && !this.canBecomeAnchor()) {
      console.warn('Cannot force anchor role - device not capable');
      return;
    }
    this.changeRole(role);
  }

  // Cleanup
  destroy(): void {
    if (this.roleEvaluationInterval) {
      clearInterval(this.roleEvaluationInterval);
      this.roleEvaluationInterval = null;
    }
    this.roleChangeListeners = [];
  }
}

export const nodeRoleService = new NodeRoleService();
