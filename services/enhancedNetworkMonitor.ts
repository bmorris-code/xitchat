// Enhanced Network Monitor with State Manager Integration
// Replaces the basic network-monitor.js with state manager integration

import { networkStateManager } from './networkStateManager';

class EnhancedNetworkMonitor {
  private statusElement: HTMLElement | null = null;
  private updateInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.createStatusDisplay();
    this.startMonitoring();
  }

  private createStatusDisplay(): void {
    // Remove old status display if it exists
    const oldStatus = document.getElementById('xitchat-network-status');
    if (oldStatus) {
      oldStatus.remove();
    }

    // Create enhanced status display
    this.statusElement = document.createElement('div');
    this.statusElement.id = 'xitchat-network-status-enhanced';
    this.statusElement.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: rgba(0, 0, 0, 0.95);
      color: #00ff41;
      padding: 12px;
      border-radius: 8px;
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 11px;
      z-index: 9999;
      max-width: 320px;
      word-wrap: break-word;
      border: 1px solid #333;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
    `;
    document.body.appendChild(this.statusElement);
  }

  private startMonitoring(): void {
    console.log('📊 Starting Enhanced Network Monitor...');
    
    // Subscribe to network state manager events
    networkStateManager.on('statusUpdated', (status) => {
      this.updateDisplay(status);
    });

    networkStateManager.on('networkOnline', () => {
      console.log('🌐 Network connection restored');
      this.showNotification('Network Online', 'success');
    });

    networkStateManager.on('networkOffline', () => {
      console.log('📵 Network connection lost');
      this.showNotification('Network Offline', 'error');
    });

    networkStateManager.on('serviceReconnected', ({ serviceName }) => {
      this.showNotification(`${serviceName} Reconnected`, 'success');
    });

    networkStateManager.on('serviceReconnectFailed', ({ serviceName }) => {
      this.showNotification(`${serviceName} Reconnect Failed`, 'warning');
    });

    // Update display every 3 seconds
    this.updateInterval = setInterval(() => {
      this.updateDisplay(networkStateManager.getStatus());
    }, 3000);
  }

  private updateDisplay(status: any): void {
    if (!this.statusElement) return;

    const healthColor = {
      excellent: '#00ff41',
      good: '#7fff00',
      fair: '#ffff00',
      poor: '#ff8c00',
      offline: '#ff0000'
    };

    const healthIcon = {
      excellent: '🟢',
      good: '🟡',
      fair: '🟠',
      poor: '🔴',
      offline: '⚫'
    };

    const serviceStatus = Array.from(status.services.entries()).map(([name, service]: [string, any]) => {
      const icon = service.isConnected && service.isHealthy ? '✅' : '❌';
      const attempts = service.reconnectAttempts > 0 ? ` (${service.reconnectAttempts})` : '';
      return `${icon} ${name}: ${service.isConnected ? 'UP' : 'DOWN'}${attempts}`;
    }).join('\n      ');

    this.statusElement.innerHTML = `
      🌐 XITCHAT NETWORK STATUS v2
      ════════════════════════════
      Overall: ${healthIcon[status.overallHealth]} ${status.overallHealth.toUpperCase()}
      Network: ${status.isOnline ? '🌐 ONLINE' : '📵 OFFLINE'}
      Services: ${status.activeServices.length}/${status.services.size} Active
      Peers: ${status.totalPeers} Connected
      Last Update: ${new Date(status.lastUpdate).toLocaleTimeString()}
      
      📊 SERVICE STATUS:
      ${serviceStatus}
      ════════════════════════════
    `;

    // Update border color based on health
    this.statusElement.style.borderColor = healthColor[status.overallHealth];
  }

  private showNotification(message: string, type: 'success' | 'error' | 'warning'): void {
    const notification = document.createElement('div');
    const colors = {
      success: '#00ff41',
      error: '#ff0000',
      warning: '#ff8c00'
    };

    notification.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.9);
      color: ${colors[type]};
      padding: 20px;
      border-radius: 8px;
      font-family: monospace;
      font-size: 14px;
      z-index: 10000;
      border: 2px solid ${colors[type]};
      animation: fadeInOut 3s ease-in-out;
    `;

    notification.textContent = message;
    document.body.appendChild(notification);

    // Remove notification after 3 seconds
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }

  // Public methods for manual control
  showDetailedStatus(): void {
    const status = networkStateManager.getStatus();
    console.group('🔍 XitChat Network Status Details');
    console.log('Overall Status:', status);
    console.log('Service Details:', Array.from(status.services.entries()));
    console.log('Has Any Connection:', networkStateManager.hasAnyConnection());
    console.groupEnd();
  }

  forceHealthCheck(): void {
    console.log('🔄 Forcing immediate health check...');
    // This will trigger the health check cycle
    networkStateManager.getStatus();
  }

  destroy(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    if (this.statusElement) {
      this.statusElement.remove();
    }
  }
}

// Add fade animation to page
const style = document.createElement('style');
style.textContent = `
  @keyframes fadeInOut {
    0% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
    20% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    80% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    100% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
  }
`;
document.head.appendChild(style);

// Auto-initialize enhanced monitor
const enhancedNetworkMonitorInstance = new EnhancedNetworkMonitor();
(window as any).enhancedNetworkMonitor = enhancedNetworkMonitorInstance;
console.log('📊 Enhanced Network Monitor Ready');

// Export for manual control
export { EnhancedNetworkMonitor };
