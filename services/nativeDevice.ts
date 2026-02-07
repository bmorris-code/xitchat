import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Geolocation, Position } from '@capacitor/geolocation';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

export class NativeDeviceService {
  private isNative: boolean;

  constructor() {
    this.isNative = Capacitor.isNativePlatform();
  }

  // Camera functionality
  async takePicture(): Promise<string | null> {
    if (!this.isNative) {
      // Fallback to web camera
      return this.webCameraFallback();
    }

    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: true,
        resultType: CameraResultType.Uri,
        source: CameraSource.Camera
      });
      return image.webPath || null;
    } catch (error) {
      console.error('Camera error:', error);
      return null;
    }
  }

  private async webCameraFallback(): Promise<string | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.capture = 'environment';
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          resolve(URL.createObjectURL(file));
        } else {
          resolve(null);
        }
      };
      input.click();
    });
  }

  // Enhanced geolocation
  async getCurrentPosition(): Promise<Position | null> {
    if (!this.isNative) {
      return this.webGeolocationFallback();
    }

    try {
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000
      });
      return position;
    } catch (error) {
      console.error('Geolocation error:', error);
      return this.webGeolocationFallback();
    }
  }

  private async webGeolocationFallback(): Promise<Position | null> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => resolve(position as Position),
        (error) => {
          console.error('Web geolocation error:', error);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
      );
    });
  }

  // Push notifications (Disabled)
  async initializePushNotifications(): Promise<boolean> {
    return true;
  }

  private handlePushNotification(notification: any) {
    console.log('Push notification received:', notification);
  }

  private handleNotificationAction(notification: any) {
    console.log('Notification action performed:', notification);
  }

  private showInAppNotification(title: string, body: string) {
    // Create a custom in-app notification UI
    const notification = document.createElement('div');
    notification.className = 'fixed top-4 right-4 bg-black border border-green-500 text-green-400 p-4 rounded-lg shadow-lg z-50 animate-pulse';
    notification.innerHTML = `
      <div class="font-bold text-sm">${title}</div>
      <div class="text-xs opacity-80">${body}</div>
    `;

    document.body.appendChild(notification);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 5000);
  }

  // Haptic feedback
  async triggerHaptic(style: ImpactStyle = ImpactStyle.Medium): Promise<void> {
    if (!this.isNative) {
      // Web fallback - could use vibration API if available
      if ('vibrate' in navigator) {
        navigator.vibrate(50);
      }
      return;
    }

    try {
      await Haptics.impact({ style });
    } catch (error) {
      console.error('Haptic error:', error);
    }
  }

  // Device info
  getDeviceInfo() {
    return {
      isNative: this.isNative,
      platform: Capacitor.getPlatform(),
      isAndroid: Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android',
      isIOS: Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios'
    };
  }

  // Enhanced Bluetooth scanning for mesh network
  async scanForMeshNodes(): Promise<string[]> {
    if (!this.isNative) {
      console.log('Bluetooth scanning not available on web');
      return [];
    }

    // This would require a custom Capacitor plugin for Bluetooth LE
    // For now, return mock data
    console.log('Scanning for mesh nodes...');
    await this.triggerHaptic(ImpactStyle.Light);

    // Simulate found nodes
    return [
      'XIT-NODE-48F2',
      'XIT-NODE-A812',
      'XIT-NODE-7B3C'
    ];
  }
}

export const nativeDevice = new NativeDeviceService();
