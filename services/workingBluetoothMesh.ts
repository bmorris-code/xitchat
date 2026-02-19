// Working Bluetooth Mesh Implementation for XitChat
// Real hardware transport only (no simulation paths)
import { networkStateManager, NetworkService } from './networkStateManager';

interface BluetoothDevice {
  id: string;
  name?: string;
  gatt?: BluetoothRemoteGATTServer;
  addEventListener(type: string, listener: (event: any) => void): void;
  removeEventListener(type: string, listener: (event: any) => void): void;
}

interface BluetoothRemoteGATTServer {
  connected: boolean;
  connect(): Promise<BluetoothRemoteGATTServer>;
  disconnect(): void;
}

interface NavigatorBluetooth {
  bluetooth: {
    requestDevice(options: any): Promise<BluetoothDevice>;
    getAvailability(): Promise<boolean>;
  };
}

declare global {
  interface Navigator extends NavigatorBluetooth {}
}

export interface WorkingMeshNode {
  id: string;
  name: string;
  handle: string;
  device: BluetoothDevice | null;
  distance: number;
  lastSeen: number;
  signalStrength: number;
}

class WorkingBluetoothMeshService {
  private peers: Map<string, WorkingMeshNode> = new Map();
  private isConnected = false;
  private listeners: { [key: string]: ((data: any) => void)[] } = {};
  private myDevice: BluetoothDevice | null = null;
  private scanTimer: any = null;
  private serviceInfo: NetworkService = {
    name: 'bluetoothMesh',
    isConnected: false,
    isHealthy: false,
    lastCheck: 0,
    reconnectAttempts: 0,
    maxReconnectAttempts: 3,
    reconnectDelay: 5000
  };
  private nativeListenersRegistered = false;
  private nativeBluetoothPlugin: any = null;
  private nativeTransportStarted = false;

  private registerWithNetworkManager(): void {
    this.serviceInfo.healthCheck = () => this.performHealthCheck();
    this.serviceInfo.reconnect = () => this.initialize();
    networkStateManager.registerService(this.serviceInfo);
  }

  private setupNativePluginListeners(BluetoothMesh: any): void {
    if (this.nativeListenersRegistered) return;
    this.nativeListenersRegistered = true;

    BluetoothMesh.addListener('deviceDiscovered', (event: any) => {
      this.handleNativeDiscoveredDevice(event);
    }).catch(() => {});

    BluetoothMesh.addListener('messageReceived', (event: any) => {
      this.emit('messageReceived', {
        id: `bt-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        from: event.deviceId,
        to: 'me',
        content: event.message,
        timestamp: Date.now()
      });
    }).catch(() => {});
  }

  private failUnavailable(context: string): boolean {
    console.warn(`Bluetooth unavailable (${context}) - real hardware required`);
    this.peers.clear();
    this.isConnected = false;
    this.serviceInfo.isConnected = false;
    this.serviceInfo.isHealthy = false;
    networkStateManager.updateServiceStatus('bluetoothMesh', false, false);
    return false;
  }

  async initialize(): Promise<boolean> {
    try {
      this.registerWithNetworkManager();
      console.log('Initializing Bluetooth mesh (real transport only)...');

      const isNativeAndroid = (window as any).Capacitor?.isNativePlatform() && (window as any).Capacitor?.getPlatform() === 'android';

      if (isNativeAndroid) {
        try {
          const { registerPlugin } = await import('@capacitor/core');
          const BluetoothMesh = registerPlugin<any>('BluetoothMesh');
          this.nativeBluetoothPlugin = BluetoothMesh;
          this.setupNativePluginListeners(BluetoothMesh);
          await BluetoothMesh.initialize();

          this.isConnected = true;
          this.serviceInfo.isConnected = true;
          this.serviceInfo.isHealthy = true;
          networkStateManager.updateServiceStatus('bluetoothMesh', true, true);
          return true;
        } catch (error) {
          console.warn('Native Bluetooth plugin unavailable on Android:', error);
          return this.failUnavailable('android-native-plugin-unavailable');
        }
      }

      if (typeof navigator === 'undefined' || !navigator.bluetooth) {
        return this.failUnavailable('web-no-bluetooth-api');
      }

      const available = await navigator.bluetooth.getAvailability();
      if (!available) {
        return this.failUnavailable('web-bluetooth-unavailable');
      }

      this.isConnected = true;
      this.serviceInfo.isConnected = true;
      this.serviceInfo.isHealthy = true;
      networkStateManager.updateServiceStatus('bluetoothMesh', true, true);
      return true;
    } catch (error) {
      console.warn('Bluetooth initialization failed:', error);
      return this.failUnavailable('initialize-error');
    }
  }

  private handleNativeDiscoveredDevice(device: any): void {
    const deviceId = device.deviceId;
    const existingPeer = this.peers.get(deviceId);

    const distance = device.rssi ? this.calculateDistance(device.rssi) : 5;
    const signal = device.rssi ? this.calculateSignalStrength(device.rssi) : 50;

    if (!existingPeer) {
      const peer: WorkingMeshNode = {
        id: deviceId,
        name: device.deviceName || `Device ${deviceId.substring(0, 4)}`,
        handle: `@${(device.deviceName || 'node').replace(/\s+/g, '').toLowerCase()}`,
        device: null,
        distance,
        lastSeen: Date.now(),
        signalStrength: signal
      };

      this.peers.set(deviceId, peer);
      this.emit('peersUpdated', Array.from(this.peers.values()));
    } else {
      existingPeer.lastSeen = Date.now();
      existingPeer.distance = distance;
      existingPeer.signalStrength = signal;
      this.emit('peersUpdated', Array.from(this.peers.values()));
    }
  }

  async startScanning(): Promise<boolean> {
    if ((window as any).Capacitor?.isNativePlatform() && this.nativeTransportStarted) {
      return true;
    }

    if ((window as any).Capacitor?.isNativePlatform()) {
      try {
        const { registerPlugin } = await import('@capacitor/core');
        const BluetoothMesh = registerPlugin<any>('BluetoothMesh');
        this.nativeBluetoothPlugin = BluetoothMesh;
        this.setupNativePluginListeners(BluetoothMesh);

        await BluetoothMesh.startScanning();
        await BluetoothMesh.startAdvertising({
          deviceName: 'XitChat-' + Math.random().toString(36).substr(2, 4),
          deviceId: this.myDevice ? (this.myDevice as any).id : 'anon'
        });

        this.nativeTransportStarted = true;
        console.log('Native Bluetooth scan/advertise started');
        return true;
      } catch (e) {
        console.error('Failed to start native Bluetooth scan:', e);
        this.nativeTransportStarted = false;
        return false;
      }
    }

    if (!navigator.bluetooth) {
      console.debug('Bluetooth not available - scanning disabled');
      return false;
    }

    try {
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['battery_service', 'device_information']
      });

      if (device) {
        this.handleConnection(device);
        return true;
      }
      return false;
    } catch (error: any) {
      if (error.name === 'NotFoundError' || error.message.includes('cancelled')) {
        console.log('Bluetooth scan cancelled by user');
        return false;
      }
      console.debug('Bluetooth scan failed:', error);
      return false;
    }
  }

  private handleConnection(device: BluetoothDevice): void {
    this.myDevice = device;
    this.isConnected = true;

    device.addEventListener('gattserverdisconnected', () => {
      this.isConnected = false;
      this.emit('disconnected', {});
    });

    this.handleDiscoveredDevice(device, -50);
    this.emit('connected', { deviceName: device.name });
  }

  private handleDiscoveredDevice(device: BluetoothDevice, rssi: number): void {
    if (!device) return;

    const deviceId = device.id;
    const existingPeer = this.peers.get(deviceId);

    const distance = this.calculateDistance(rssi);
    const signal = this.calculateSignalStrength(rssi);

    if (!existingPeer) {
      const peer: WorkingMeshNode = {
        id: deviceId,
        name: device.name || `Unknown Device ${this.peers.size + 1}`,
        handle: `@${(device.name || 'user').replace(/\s+/g, '').toLowerCase().substring(0, 8)}`,
        device,
        distance,
        lastSeen: Date.now(),
        signalStrength: signal
      };

      this.peers.set(deviceId, peer);
      this.emit('peersUpdated', Array.from(this.peers.values()));
    } else {
      existingPeer.lastSeen = Date.now();
      existingPeer.distance = distance;
      existingPeer.signalStrength = signal;
      this.emit('peersUpdated', Array.from(this.peers.values()));
    }
  }

  private calculateDistance(rssi: number): number {
    if (rssi >= -50) return 1;
    if (rssi >= -60) return 3;
    if (rssi >= -70) return 5;
    if (rssi >= -80) return 10;
    return 15;
  }

  private calculateSignalStrength(rssi: number): number {
    if (rssi >= -50) return 100;
    if (rssi >= -60) return 80;
    if (rssi >= -70) return 60;
    if (rssi >= -80) return 40;
    if (rssi >= -90) return 20;
    return 10;
  }

  async sendMessage(peerId: string, content: string): Promise<boolean> {
    const peer = this.peers.get(peerId);
    if (!peer) return false;

    if ((window as any).Capacitor?.isNativePlatform()) {
      try {
        const BluetoothMesh = this.nativeBluetoothPlugin || (await import('@capacitor/core')).registerPlugin<any>('BluetoothMesh');
        this.nativeBluetoothPlugin = BluetoothMesh;

        await BluetoothMesh.sendMessage({
          deviceId: peerId,
          message: content
        });

        return true;
      } catch (e) {
        console.debug('Bluetooth native plugin send failed:', e);
        return false;
      }
    }

    if (!peer.device || !peer.device.gatt) {
      return false;
    }

    try {
      if (peer.device.gatt.connected) {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  getPeers(): WorkingMeshNode[] {
    return Array.from(this.peers.values());
  }

  isConnectedToMesh(): boolean {
    return this.isConnected && this.peers.size > 0;
  }

  private emit(event: string, data?: any): void {
    const listeners = this.listeners[event] || [];
    listeners.forEach(callback => callback(data));
  }

  subscribe(event: string, callback: (data: any) => void): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);

    return () => {
      const listeners = this.listeners[event];
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }

  disconnect(): void {
    if (this.scanTimer) clearInterval(this.scanTimer);

    if (this.myDevice && this.myDevice.gatt?.connected) {
      this.myDevice.gatt.disconnect();
    }

    this.isConnected = false;
    this.nativeTransportStarted = false;
    this.peers.clear();
    this.emit('disconnected', {});
    networkStateManager.updateServiceStatus('bluetoothMesh', false, false);
  }

  private async performHealthCheck(): Promise<boolean> {
    return this.isConnected || this.peers.size > 0;
  }
}

export const workingBluetoothMesh = new WorkingBluetoothMeshService();
