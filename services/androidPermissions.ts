import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { Camera } from '@capacitor/camera';
import { nativeDevice } from './nativeDevice';

export interface PermissionResult {
  granted: boolean;
  denied: boolean;
  permanentlyDenied: boolean;
  canAskAgain: boolean;
}

export class AndroidPermissionsService {
  private isNative: boolean;

  constructor() {
    this.isNative = Capacitor.isNativePlatform();
  }

  // Check if running on Android
  private isAndroid(): boolean {
    return this.isNative && Capacitor.getPlatform() === 'android';
  }

  // Request Camera Permissions
  async requestCameraPermissions(): Promise<PermissionResult> {
    if (!this.isNative) {
      // Web fallback - always grant for web demo
      return { granted: true, denied: false, permanentlyDenied: false, canAskAgain: true };
    }

    try {
      const permissions = await Camera.requestPermissions();
      const cameraPermission = permissions.camera;

      return {
        granted: cameraPermission === 'granted',
        denied: cameraPermission === 'denied',
        permanentlyDenied: cameraPermission === 'denied',
        canAskAgain: cameraPermission !== 'denied'
      };
    } catch (error) {
      console.error('Camera permission request failed:', error);
      return { granted: false, denied: true, permanentlyDenied: false, canAskAgain: true };
    }
  }

  // Request Location Permissions
  async requestLocationPermissions(): Promise<PermissionResult> {
    if (!this.isNative) {
      // Web fallback
      try {
        await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        });
        return { granted: true, denied: false, permanentlyDenied: false, canAskAgain: true };
      } catch (error) {
        return { granted: false, denied: true, permanentlyDenied: false, canAskAgain: true };
      }
    }

    try {
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000
      });

      return { granted: true, denied: false, permanentlyDenied: false, canAskAgain: true };
    } catch (error: any) {
      console.error('Location permission request failed:', error);

      // Check if it's a permanent denial
      const isPermanentlyDenied = error?.message?.includes('PERMANENTLY_DENIED') ||
        error?.message?.includes('permission denied');

      return {
        granted: false,
        denied: true,
        permanentlyDenied: isPermanentlyDenied,
        canAskAgain: !isPermanentlyDenied
      };
    }
  }

  // Request Push Notification Permissions
  async requestPushPermissions(): Promise<PermissionResult> {
    if (!this.isNative) {
      // Web fallback
      return { granted: true, denied: false, permanentlyDenied: false, canAskAgain: true };
    }

    try {
      // Push notifications are disabled in this build
      return { granted: true, denied: false, permanentlyDenied: false, canAskAgain: true };
    } catch (error) {
      console.error('Push notification permission request failed:', error);
      return { granted: false, denied: true, permanentlyDenied: false, canAskAgain: true };
    }
  }

  // Request all critical permissions for the app
  async requestAllCriticalPermissions(): Promise<{
    camera: PermissionResult;
    location: PermissionResult;
    push: PermissionResult;
    overallGranted: boolean;
  }> {
    console.log('🔐 Starting comprehensive permission requests...');

    const results = {
      camera: await this.requestCameraPermissions(),
      location: await this.requestLocationPermissions(),
      push: await this.requestPushPermissions(),
      overallGranted: false
    };

    // Calculate overall success
    results.overallGranted = results.camera.granted && results.location.granted;

    // Log results
    console.log('📸 Camera Permission:', results.camera);
    console.log('📍 Location Permission:', results.location);
    console.log('🔔 Push Permission:', results.push);
    console.log('✅ Overall Success:', results.overallGranted);

    // Trigger haptic feedback on completion
    try {
      await nativeDevice.triggerHaptic();
    } catch (error) {
      console.log('Haptic feedback not available');
    }

    return results;
  }

  // Check current permission status without requesting
  async checkPermissionStatus(): Promise<{
    camera: string;
    location: string;
    push: string;
  }> {
    if (!this.isNative) {
      return {
        camera: 'prompt', // Web always prompts
        location: 'prompt',
        push: 'prompt'
      };
    }

    try {
      const cameraPerms = await Camera.checkPermissions();

      // For location, we need to try getting position to check
      let locationStatus = 'prompt';
      try {
        await Geolocation.getCurrentPosition({ timeout: 1000 });
        locationStatus = 'granted';
      } catch (error) {
        locationStatus = 'denied';
      }

      return {
        camera: cameraPerms.camera || 'prompt',
        location: locationStatus,
        push: 'granted'
      };
    } catch (error) {
      console.error('Error checking permission status:', error);
      return {
        camera: 'prompt',
        location: 'prompt',
        push: 'prompt'
      };
    }
  }

  // Open app settings for manual permission grant
  async openAppSettings(): Promise<boolean> {
    if (!this.isNative) {
      console.log('App settings not available on web');
      return false;
    }

    try {
      // This would require a custom Capacitor plugin or using the App Launcher
      // For now, we'll just log it
      console.log('Please manually enable permissions in app settings');
      return true;
    } catch (error) {
      console.error('Failed to open app settings:', error);
      return false;
    }
  }

  // Get user-friendly permission status text
  getPermissionStatusText(result: PermissionResult): string {
    if (result.granted) return 'Granted';
    if (result.permanentlyDenied) return 'Permanently Denied';
    if (result.denied) return 'Denied';
    return 'Not Requested';
  }

  // Check if any permissions are permanently denied
  hasPermanentDenials(results: { camera: PermissionResult; location: PermissionResult; push: PermissionResult }): boolean {
    return results.camera.permanentlyDenied ||
      results.location.permanentlyDenied ||
      results.push.permanentlyDenied;
  }
}

export const androidPermissions = new AndroidPermissionsService();
