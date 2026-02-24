import { Capacitor } from '@capacitor/core';

export interface DeviceDiagnostic {
  deviceInfo: {
    userAgent: string;
    platform: string;
    isNative: boolean;
    isAndroid: boolean;
    isCapacitor: boolean;
    model?: string;
    manufacturer?: string;
  };
  networkInfo: {
    connection?: any;
    online: boolean;
    effectiveType?: string;
    type?: string;
    downlink?: number;
    rtt?: number;
  };
  capabilities: {
    bluetooth: boolean;
    wifi: boolean;
    webrtc: boolean;
    geolocation: boolean;
    camera: boolean;
    vibration: boolean;
    notifications: boolean;
  };
  permissions: {
    location: string;
    camera: string;
    bluetooth?: string;
  };
  issues: string[];
  recommendations: string[];
}

export class DeviceDiagnosticService {
  async runFullDiagnostic(): Promise<DeviceDiagnostic> {
    const diagnostic: DeviceDiagnostic = {
      deviceInfo: this.getDeviceInfo(),
      networkInfo: this.getNetworkInfo(),
      capabilities: this.getCapabilities(),
      permissions: await this.getPermissions(),
      issues: [],
      recommendations: []
    };

    // Analyze issues
    this.analyzeIssues(diagnostic);
    this.generateRecommendations(diagnostic);

    return diagnostic;
  }

  private getDeviceInfo() {
    const userAgent = navigator.userAgent;
    const isNative = Capacitor.isNativePlatform();
    const isAndroid = Capacitor.getPlatform() === 'android';
    
    // Extract device model from user agent
    let model, manufacturer;
    if (isAndroid && isNative) {
      // Try to get from Capacitor device info
      try {
        const device = (window as any).Capacitor.getDevice();
        model = device?.model;
        manufacturer = device?.manufacturer;
      } catch (e) {
        console.log('Could not get device info:', e);
      }
    }

    // Fallback to user agent parsing
    if (!model && userAgent.includes('H60')) {
      model = 'H60';
      manufacturer = 'Huawei';
    }

    return {
      userAgent,
      platform: Capacitor.getPlatform(),
      isNative,
      isAndroid,
      isCapacitor: !!(window as any).Capacitor,
      model,
      manufacturer
    };
  }

  private getNetworkInfo() {
    const connection = (navigator as any).connection || 
                      (navigator as any).mozConnection || 
                      (navigator as any).webkitConnection;

    return {
      connection: connection ? {
        type: connection.type,
        effectiveType: connection.effectiveType,
        downlink: connection.downlink,
        rtt: connection.rtt
      } : undefined,
      online: navigator.onLine,
      effectiveType: connection?.effectiveType,
      type: connection?.type,
      downlink: connection?.downlink,
      rtt: connection?.rtt
    };
  }

  private getCapabilities() {
    return {
      bluetooth: 'bluetooth' in navigator,
      wifi: 'connection' in navigator,
      webrtc: 'RTCPeerConnection' in window,
      geolocation: 'geolocation' in navigator,
      camera: 'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices,
      vibration: 'vibrate' in navigator,
      notifications: 'Notification' in window
    };
  }

  private async getPermissions() {
    const permissions = {
      location: 'unknown',
      camera: 'unknown'
    };

    try {
      // Check location permission
      if ('geolocation' in navigator) {
        await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            resolve, 
            reject, 
            { timeout: 1000, maximumAge: 0 }
          );
        });
        permissions.location = 'granted';
      }
    } catch (error: any) {
      if (error.code === 1) {
        permissions.location = 'denied';
      } else if (error.code === 3) {
        permissions.location = 'timeout';
      }
    }

    try {
      // Check camera permission
      if ('mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices) {
        await navigator.mediaDevices.getUserMedia({ video: true });
        permissions.camera = 'granted';
      }
    } catch (error: any) {
      if (error.name === 'NotAllowedError') {
        permissions.camera = 'denied';
      } else if (error.name === 'NotFoundError') {
        permissions.camera = 'no-device';
      }
    }

    return permissions;
  }

  private analyzeIssues(diagnostic: DeviceDiagnostic) {
    const { deviceInfo, networkInfo, capabilities, permissions } = diagnostic;

    // H60 specific issues
    if (deviceInfo.model === 'H60' && deviceInfo.manufacturer === 'Huawei') {
      diagnostic.issues.push('H60 detected - Huawei devices may have restricted Bluetooth/WiFi Direct APIs');
      diagnostic.issues.push('Huawei EMUI may block background services and P2P connections');
    }

    // Android specific issues
    if (deviceInfo.isAndroid) {
      if (!deviceInfo.isNative) {
        diagnostic.issues.push('Running in web browser on Android - limited P2P capabilities');
      }
      
      if (permissions.location !== 'granted') {
        diagnostic.issues.push('Location permission required for Bluetooth/WiFi Direct scanning');
      }
    }

    // Network issues
    if (!networkInfo.online) {
      diagnostic.issues.push('Device appears to be offline');
    }

    if (networkInfo.type === 'cellular' && networkInfo.effectiveType === 'slow-2g') {
      diagnostic.issues.push('Very slow network connection detected');
    }

    // Capability issues
    if (!capabilities.bluetooth) {
      diagnostic.issues.push('Bluetooth API not available');
    }

    if (!capabilities.webrtc) {
      diagnostic.issues.push('WebRTC not supported - P2P connections unavailable');
    }

    if (!capabilities.geolocation) {
      diagnostic.issues.push('Geolocation not available');
    }
  }

  private generateRecommendations(diagnostic: DeviceDiagnostic) {
    const { deviceInfo, issues } = diagnostic;

    // H60 specific recommendations
    if (deviceInfo.model === 'H60') {
      diagnostic.recommendations.push('Enable "Install unknown apps" permission for XitChat');
      diagnostic.recommendations.push('Disable battery optimization for XitChat in Settings');
      diagnostic.recommendations.push('Enable location services and set to "High accuracy"');
      diagnostic.recommendations.push('Grant all requested permissions when prompted');
      diagnostic.recommendations.push('Keep app in foreground during initial connection setup');
    }

    // Android recommendations
    if (deviceInfo.isAndroid) {
      diagnostic.recommendations.push('Ensure all permissions are granted: Location, Camera, Storage');
      diagnostic.recommendations.push('Enable WiFi and Bluetooth');
      diagnostic.recommendations.push('Connect to stable WiFi network for best performance');
    }

    // General recommendations
    if (issues.includes('Location permission required for Bluetooth/WiFi Direct scanning')) {
      diagnostic.recommendations.push('Go to Settings > Apps > XitChat > Permissions > Location > Allow');
    }

    if (issues.includes('WebRTC not supported')) {
      diagnostic.recommendations.push('Try using Chrome browser for best compatibility');
    }
  }

  // Quick check for H60 connectivity
  async checkH60Connectivity(): Promise<{
    canConnect: boolean;
    issues: string[];
    fixes: string[];
  }> {
    const diagnostic = await this.runFullDiagnostic();
    
    const isH60 = diagnostic.deviceInfo.model === 'H60';
    if (!isH60) {
      return {
        canConnect: true,
        issues: [],
        fixes: []
      };
    }

    const issues: string[] = [];
    const fixes: string[] = [];

    // Check for common H60 issues
    if (diagnostic.permissions.location !== 'granted') {
      issues.push('Location permission denied');
      fixes.push('Grant location permission in Settings > Apps > XitChat > Permissions');
    }

    if (!diagnostic.capabilities.bluetooth) {
      issues.push('Bluetooth API unavailable');
      fixes.push('Enable Bluetooth in device settings');
    }

    if (!diagnostic.networkInfo.online) {
      issues.push('No internet connection');
      fixes.push('Connect to WiFi or mobile data');
    }

    // H60 specific fixes
    fixes.push('Disable battery optimization: Settings > Apps > XitChat > Battery > Optimize battery usage > OFF');
    fixes.push('Enable background data: Settings > Data usage > XitChat > Background data > ON');
    fixes.push('Set location to High accuracy: Settings > Location > Mode > High accuracy');

    return {
      canConnect: issues.length === 0,
      issues,
      fixes
    };
  }
}

export const deviceDiagnostic = new DeviceDiagnosticService();
