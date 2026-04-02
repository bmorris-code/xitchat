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

  // ── FIX #1: cache plugin instances — registerPlugin should only be called once ──
  private bluetoothMeshPlugin: any = null;
  private wifiDirectPlugin: any = null;

  constructor() {
    this.isNative = Capacitor.isNativePlatform();
  }

  private isAndroid(): boolean {
    return this.isNative && Capacitor.getPlatform() === 'android';
  }

  // ── FIX #1: lazy-load and cache plugin instances ──
  private async getBluetoothPlugin(): Promise<any> {
    if (!this.bluetoothMeshPlugin) {
      const { registerPlugin } = await import('@capacitor/core');
      this.bluetoothMeshPlugin = registerPlugin<any>('BluetoothMesh');
    }
    return this.bluetoothMeshPlugin;
  }

  private async getWiFiPlugin(): Promise<any> {
    if (!this.wifiDirectPlugin) {
      const { registerPlugin } = await import('@capacitor/core');
      this.wifiDirectPlugin = registerPlugin<any>('WiFiDirect');
    }
    return this.wifiDirectPlugin;
  }

  async requestCameraPermissions(): Promise<PermissionResult> {
    if (!this.isNative) {
      return { granted: true, denied: false, permanentlyDenied: false, canAskAgain: true };
    }

    try {
      const permissions = await Camera.requestPermissions();
      const p = permissions.camera;
      return {
        granted: p === 'granted',
        denied: p === 'denied',
        permanentlyDenied: p === 'denied',
        canAskAgain: p !== 'denied'
      };
    } catch (error) {
      console.error('Camera permission request failed:', error);
      return { granted: false, denied: true, permanentlyDenied: false, canAskAgain: true };
    }
  }

  async requestLocationPermissions(): Promise<PermissionResult> {
    if (!this.isNative) {
      // ── FIX #3: use Permissions API on web instead of triggering GPS ──
      if ('permissions' in navigator) {
        try {
          const result = await navigator.permissions.query({ name: 'geolocation' });
          return {
            granted: result.state === 'granted',
            denied: result.state === 'denied',
            permanentlyDenied: result.state === 'denied',
            canAskAgain: result.state === 'prompt'
          };
        } catch {}
      }
      // Fallback for browsers without Permissions API
      return { granted: true, denied: false, permanentlyDenied: false, canAskAgain: true };
    }

    try {
      // Use checkPermissions first to avoid unnecessary GPS trigger
      const check = await Geolocation.checkPermissions();
      if (check.location === 'granted') {
        return { granted: true, denied: false, permanentlyDenied: false, canAskAgain: true };
      }

      // Only call requestPermissions if not already granted
      const perms = await Geolocation.requestPermissions();
      const p = perms.location;
      return {
        granted: p === 'granted',
        denied: p === 'denied',
        permanentlyDenied: p === 'denied',
        canAskAgain: p !== 'denied'
      };
    } catch (error: any) {
      console.error('Location permission request failed:', error);
      const isPermanentlyDenied =
        error?.message?.includes('PERMANENTLY_DENIED') ||
        error?.message?.includes('permission denied');
      return {
        granted: false,
        denied: true,
        permanentlyDenied: isPermanentlyDenied,
        canAskAgain: !isPermanentlyDenied
      };
    }
  }

  async requestPushPermissions(): Promise<PermissionResult> {
    if (!this.isNative) {
      return { granted: true, denied: false, permanentlyDenied: false, canAskAgain: true };
    }
    // Push notifications disabled in this build
    return { granted: true, denied: false, permanentlyDenied: false, canAskAgain: true };
  }

  async requestBluetoothPermissions(): Promise<PermissionResult> {
    if (!this.isNative) {
      return { granted: true, denied: false, permanentlyDenied: false, canAskAgain: true };
    }

    console.log('📶 Checking Bluetooth/WiFi permissions...');

    const timeout = <T,>(ms: number, fallback: T): Promise<T> =>
      new Promise(resolve => setTimeout(() => resolve(fallback), ms));

    try {
      // ── FIX #1: use cached plugin instances ──
      const BluetoothMesh = await this.getBluetoothPlugin();
      const WiFiDirect = await this.getWiFiPlugin();

      let btGranted = false;
      let wifiGranted = false;

      try {
        const btResult = await Promise.race([
          BluetoothMesh.requestPermissions(),
          timeout(5000, null)
        ]);
        if (btResult) {
          btGranted = btResult.location === 'granted' ||
            btResult.bluetoothScan === 'granted' ||
            btResult.bluetooth === 'granted';
        } else {
          console.warn('BluetoothMesh.requestPermissions timed out');
          const locStatus = await this.requestLocationPermissions();
          btGranted = locStatus.granted;
        }
      } catch (e) {
        console.warn('BluetoothMesh.requestPermissions failed (Android < 12):', e);
        const locStatus = await this.requestLocationPermissions();
        btGranted = locStatus.granted;
      }

      try {
        const wifiResult = await Promise.race([
          WiFiDirect.requestPermissions(),
          timeout(5000, null)
        ]);
        if (wifiResult) {
          wifiGranted = wifiResult.location === 'granted' ||
            wifiResult.nearbyWifiDevices === 'granted' ||
            wifiResult.wifiState === 'granted';
        } else {
          console.warn('WiFiDirect.requestPermissions timed out');
          wifiGranted = btGranted;
        }
      } catch (e) {
        console.warn('WiFiDirect.requestPermissions failed:', e);
        wifiGranted = btGranted;
      }

      return {
        granted: btGranted && wifiGranted,
        denied: !(btGranted && wifiGranted),
        permanentlyDenied: false,
        canAskAgain: true
      };
    } catch (error) {
      console.error('Bluetooth/WiFi permission request failed:', error);
      return { granted: false, denied: true, permanentlyDenied: false, canAskAgain: true };
    }
  }

  async requestAllCriticalPermissions(): Promise<{
    camera: PermissionResult;
    location: PermissionResult;
    bluetooth: PermissionResult;
    push: PermissionResult;
    overallGranted: boolean;
  }> {
    console.log('🔐 Starting comprehensive permission requests...');

    const results = {
      camera: await this.requestCameraPermissions(),
      location: await this.requestLocationPermissions(),
      bluetooth: await this.requestBluetoothPermissions(),
      push: await this.requestPushPermissions(),
      overallGranted: false
    };

    results.overallGranted = results.camera.granted &&
      results.location.granted &&
      results.bluetooth.granted;

    console.log('📸 Camera:', results.camera.granted ? 'granted' : 'denied');
    console.log('📍 Location:', results.location.granted ? 'granted' : 'denied');
    console.log('📶 Bluetooth:', results.bluetooth.granted ? 'granted' : 'denied');
    console.log('✅ Overall:', results.overallGranted);

    try {
      await nativeDevice.triggerHaptic();
    } catch {}

    return results;
  }

  async checkPermissionStatus(): Promise<{ camera: string; location: string; push: string }> {
    if (!this.isNative) {
      return { camera: 'prompt', location: 'prompt', push: 'prompt' };
    }

    try {
      const cameraPerms = await Camera.checkPermissions();

      // ── FIX #2: use checkPermissions() not getCurrentPosition() ──
      let locationStatus = 'prompt';
      try {
        const locPerms = await Geolocation.checkPermissions();
        locationStatus = locPerms.location || 'prompt';
      } catch {
        locationStatus = 'prompt';
      }

      return {
        camera: cameraPerms.camera || 'prompt',
        location: locationStatus,
        push: 'granted'
      };
    } catch (error) {
      console.error('Error checking permission status:', error);
      return { camera: 'prompt', location: 'prompt', push: 'prompt' };
    }
  }

  // ── FIX #4: openAppSettings returns false — not yet implemented ──
  async openAppSettings(): Promise<boolean> {
    if (!this.isNative) return false;
    // TODO: implement via @capacitor/app or a custom plugin
    console.warn('openAppSettings: not yet implemented — direct user to Settings manually');
    return false;
  }

  getPermissionStatusText(result: PermissionResult): string {
    if (result.granted) return 'Granted';
    if (result.permanentlyDenied) return 'Permanently Denied';
    if (result.denied) return 'Denied';
    return 'Not Requested';
  }

  hasPermanentDenials(results: {
    camera: PermissionResult;
    location: PermissionResult;
    push: PermissionResult;
  }): boolean {
    return results.camera.permanentlyDenied ||
      results.location.permanentlyDenied ||
      results.push.permanentlyDenied;
  }
}

export const androidPermissions = new AndroidPermissionsService();
