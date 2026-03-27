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
  isConnected: boolean;
}

class WorkingBluetoothMeshService {
  private peers: Map<string, WorkingMeshNode> = new Map();
  private nativeConnectedDeviceIds: Set<string> = new Set();
  private macToPubkey: Map<string, string> = new Map();
  private isConnected = false;
  private listeners: { [key: string]: ((data: any) => void)[] } = {};
  private myDevice: BluetoothDevice | null = null;
  // ── FIX #3: scanTimer was declared but never used — removed ──
  private myPubkey: string = '';
  private myHandle: string = '';
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

  // ── FIX #2: store gatt disconnect handler so it can be removed ──
  private gattDisconnectHandler: (() => void) | null = null;

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

    BluetoothMesh.addListener('deviceConnected', (event: any) => {
      this.handleNativeConnectionState(event, true);
    }).catch(() => {});

    BluetoothMesh.addListener('deviceDisconnected', (event: any) => {
      this.handleNativeConnectionState(event, false);
    }).catch(() => {});

    BluetoothMesh.addListener('deviceReady', (event: any) => {
      this.sendIdentity(event.deviceId);
    }).catch(() => {});

    BluetoothMesh.addListener('messageReceived', (event: any) => {
      try {
        const parsed = JSON.parse(event.message);
        if (parsed?.type === 'ble_identity' && parsed.pubkey) {
          const mac = event.deviceId;
          this.macToPubkey.set(mac, parsed.pubkey);
          const peer = this.peers.get(mac);
          if (peer) {
            const handle = parsed.handle || `@${parsed.pubkey.substring(0, 8)}`;
            this.peers.set(mac, { ...peer, name: handle, handle });
            this.emit('peersUpdated', Array.from(this.peers.values()));
          }
          return;
        }
      } catch {
        // Not JSON — treat as plain message
      }

      const fromId = this.macToPubkey.get(event.deviceId) || event.deviceId;
      this.emit('messageReceived', {
        id: `bt-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        from: fromId,
        to: 'me',
        content: event.message,
        timestamp: Date.now()
      });
    }).catch(() => {});
  }

  private async sendIdentity(deviceId: string): Promise<void> {
    if (!this.myPubkey || !this.nativeBluetoothPlugin) return;
    try {
      await this.nativeBluetoothPlugin.sendMessage({
        deviceId,
        message: JSON.stringify({ type: 'ble_identity', pubkey: this.myPubkey, handle: this.myHandle })
      });
    } catch {}
  }

  private failUnavailable(context: string): boolean {
    console.warn(`Bluetooth unavailable (${context})`);
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

      try {
        this.myPubkey = localStorage.getItem('xitchat_pubkey') || localStorage.getItem('nostr_pubkey') || '';
        this.myHandle = localStorage.getItem('xitchat_handle') || '';
        if (this.myHandle && !this.myHandle.startsWith('@')) this.myHandle = `@${this.myHandle}`;
      } catch {}

      const isNativeAndroid =
        (window as any).Capacitor?.isNativePlatform() &&
        (window as any).Capacitor?.getPlatform() === 'android';

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
          console.warn('Native Bluetooth plugin unavailable:', error);
          return this.failUnavailable('android-native-plugin-unavailable');
        }
      }

      if (typeof navigator === 'undefined' || !navigator.bluetooth) {
        return this.failUnavailable('web-no-bluetooth-api');
      }

      const available = await navigator.bluetooth.getAvailability();
      if (!available) return this.failUnavailable('web-bluetooth-unavailable');

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
    const distance = device.rssi ? this.calculateDistance(device.rssi) : 5;
    const signal = device.rssi ? this.calculateSignalStrength(device.rssi) : 50;
    const existing = this.peers.get(deviceId);

    if (!existing) {
      this.peers.set(deviceId, {
        id: deviceId,
        name: device.deviceName || `Device ${deviceId.substring(0, 4)}`,
        handle: `@${(device.deviceName || 'node').replace(/\s+/g, '').toLowerCase()}`,
        device: null,
        distance,
        lastSeen: Date.now(),
        signalStrength: signal,
        isConnected: this.nativeConnectedDeviceIds.has(deviceId)
      });
    } else {
      existing.lastSeen = Date.now();
      existing.distance = distance;
      existing.signalStrength = signal;
      existing.isConnected = this.nativeConnectedDeviceIds.has(deviceId);
    }
    this.emit('peersUpdated', Array.from(this.peers.values()));
  }

  private handleNativeConnectionState(event: any, connected: boolean): void {
    const deviceId = event?.deviceId;
    if (!deviceId) return;

    if (connected) this.nativeConnectedDeviceIds.add(deviceId);
    else this.nativeConnectedDeviceIds.delete(deviceId);

    const existing = this.peers.get(deviceId);
    if (existing) {
      existing.isConnected = connected;
      existing.lastSeen = Date.now();
    } else {
      const name = event.deviceName || `Device ${deviceId.substring(0, 4)}`;
      this.peers.set(deviceId, {
        id: deviceId, name,
        handle: `@${name.replace(/\s+/g, '').toLowerCase()}`,
        device: null, distance: 5, lastSeen: Date.now(),
        signalStrength: 50, isConnected: connected
      });
    }
    this.emit('peersUpdated', Array.from(this.peers.values()));
  }

  async startScanning(): Promise<boolean> {
    if ((window as any).Capacitor?.isNativePlatform() && this.nativeTransportStarted) return true;

    if ((window as any).Capacitor?.isNativePlatform()) {
      try {
        // ── FIX #1: reuse existing plugin instance instead of creating a new one ──
        if (!this.nativeBluetoothPlugin) {
          const { registerPlugin } = await import('@capacitor/core');
          this.nativeBluetoothPlugin = registerPlugin<any>('BluetoothMesh');
        }
        const BluetoothMesh = this.nativeBluetoothPlugin;
        // Only register listeners if not already done
        if (!this.nativeListenersRegistered) this.setupNativePluginListeners(BluetoothMesh);

        await BluetoothMesh.startScanning();
        const nameId = this.myPubkey ? this.myPubkey.substring(0, 8) : Math.random().toString(36).substring(2, 6);
        await BluetoothMesh.startAdvertising({
          deviceName: `XitChat-${nameId}`,
          deviceId: this.myPubkey || 'anon'
        });

        this.nativeTransportStarted = true;
        return true;
      } catch (e) {
        console.error('Failed to start native Bluetooth scan:', e);
        this.nativeTransportStarted = false;
        return false;
      }
    }

    if (!navigator.bluetooth) return false;

    try {
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['battery_service', 'device_information']
      });
      if (device) { this.handleConnection(device); return true; }
      return false;
    } catch (error: any) {
      if (error.name === 'NotFoundError' || error.message?.includes('cancelled')) return false;
      console.debug('Bluetooth scan failed:', error);
      return false;
    }
  }

  private handleConnection(device: BluetoothDevice): void {
    this.myDevice = device;
    this.isConnected = true;

    // ── FIX #2: store handler so disconnect() can remove it ──
    this.gattDisconnectHandler = () => {
      this.isConnected = false;
      this.emit('disconnected', {});
    };
    device.addEventListener('gattserverdisconnected', this.gattDisconnectHandler);

    this.handleDiscoveredDevice(device, -50);
    this.emit('connected', { deviceName: device.name });
  }

  private handleDiscoveredDevice(device: BluetoothDevice, rssi: number): void {
    if (!device) return;
    const deviceId = device.id;
    const distance = this.calculateDistance(rssi);
    const signal = this.calculateSignalStrength(rssi);
    const existing = this.peers.get(deviceId);

    if (!existing) {
      this.peers.set(deviceId, {
        id: deviceId,
        name: device.name || `Unknown Device ${this.peers.size + 1}`,
        handle: `@${(device.name || 'user').replace(/\s+/g, '').toLowerCase().substring(0, 8)}`,
        device,
        distance,
        lastSeen: Date.now(),
        signalStrength: signal,
        isConnected: !!device.gatt?.connected
      });
    } else {
      existing.lastSeen = Date.now();
      existing.distance = distance;
      existing.signalStrength = signal;
      existing.isConnected = !!device.gatt?.connected;
    }
    this.emit('peersUpdated', Array.from(this.peers.values()));
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
      if (!peer.isConnected) return false;
      try {
        const BluetoothMesh = this.nativeBluetoothPlugin ||
          (await import('@capacitor/core')).registerPlugin<any>('BluetoothMesh');
        this.nativeBluetoothPlugin = BluetoothMesh;
        await BluetoothMesh.sendMessage({ deviceId: peerId, message: content });
        return true;
      } catch (e) {
        console.debug('Bluetooth native send failed:', e);
        return false;
      }
    }

    if (!peer.device || !peer.device.gatt) return false;
    console.debug('Web Bluetooth send not supported; using mesh fallback');
    return false;
  }

  getPeers(): WorkingMeshNode[] { return Array.from(this.peers.values()); }
  isConnectedToMesh(): boolean {
    return this.isConnected && Array.from(this.peers.values()).some(p => p.isConnected);
  }

  private emit(event: string, data?: any): void {
    (this.listeners[event] || []).forEach(cb => cb(data));
  }

  subscribe(event: string, callback: (data: any) => void): () => void {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
    return () => {
      const idx = this.listeners[event].indexOf(callback);
      if (idx > -1) this.listeners[event].splice(idx, 1);
    };
  }

  disconnect(): void {
    // ── FIX #2: remove gatt disconnect handler ──
    if (this.myDevice && this.gattDisconnectHandler) {
      this.myDevice.removeEventListener('gattserverdisconnected', this.gattDisconnectHandler);
      this.gattDisconnectHandler = null;
    }

    if (this.myDevice?.gatt?.connected) this.myDevice.gatt.disconnect();

    this.isConnected = false;
    this.nativeTransportStarted = false;
    this.nativeConnectedDeviceIds.clear();
    this.peers.clear();
    this.emit('disconnected', {});
    networkStateManager.updateServiceStatus('bluetoothMesh', false, false);
  }

  private async performHealthCheck(): Promise<boolean> {
    return this.isConnected || this.peers.size > 0;
  }
}

export const workingBluetoothMesh = new WorkingBluetoothMeshService();
