/**
 * XitChat Native Android Plugins Bridge
 * 
 * This file provides TypeScript interfaces for the native Android plugins:
 * - BluetoothMeshPlugin: For Bluetooth Low Energy mesh networking
 * - WiFiDirectPlugin: For WiFi Direct peer-to-peer connections
 */

import { registerPlugin } from '@capacitor/core';

// ============================================================================
// Bluetooth Mesh Plugin
// ============================================================================

export interface BluetoothMeshPlugin {
    /**
     * Initialize the Bluetooth mesh service
     */
    initialize(): Promise<{ success: boolean; message: string }>;

    /**
     * Start advertising this device as a mesh node
     */
    startAdvertising(options: {
        deviceName: string;
        deviceId: string;
    }): Promise<{ success: boolean; advertising: boolean }>;

    /**
     * Stop advertising
     */
    stopAdvertising(): Promise<{ success: boolean; advertising: boolean }>;

    /**
     * Start scanning for nearby mesh nodes
     */
    startScanning(): Promise<{ success: boolean; scanning: boolean }>;

    /**
     * Stop scanning
     */
    stopScanning(): Promise<{ success: boolean; scanning: boolean }>;

    /**
     * Send a message to a specific device
     */
    sendMessage(options: {
        deviceId: string;
        message: string;
    }): Promise<{ success: boolean }>;

    /**
     * Get list of discovered devices
     */
    getDiscoveredDevices(): Promise<{ devices: number }>;

    /**
     * Add listener for Bluetooth mesh events
     */
    addListener(
        eventName: 'advertisingStarted' | 'advertisingFailed' | 'deviceDiscovered' |
            'scanFailed' | 'deviceConnected' | 'deviceDisconnected' | 'messageReceived',
        listenerFunc: (event: any) => void
    ): Promise<{ remove: () => void }>;
}

export interface BluetoothDevice {
    deviceId: string;
    deviceName: string;
    rssi?: number;
    connected?: boolean;
}

export interface BluetoothMessage {
    deviceId: string;
    message: string;
}

// ============================================================================
// WiFi Direct Plugin
// ============================================================================

export interface WiFiDirectPlugin {
    /**
     * Initialize WiFi Direct service
     */
    initialize(): Promise<{ success: boolean; message: string }>;

    /**
     * Start discovering nearby WiFi Direct peers
     */
    startDiscovery(): Promise<{ success: boolean; discovering: boolean }>;

    /**
     * Stop peer discovery
     */
    stopDiscovery(): Promise<{ success: boolean; discovering: boolean }>;

    /**
     * Connect to a specific peer
     */
    connectToPeer(options: {
        deviceAddress: string;
    }): Promise<{ success: boolean; deviceAddress: string }>;

    /**
     * Send a message to a connected peer
     */
    sendMessage(options: {
        message: string;
        targetAddress?: string;
    }): Promise<{ success: boolean }>;

    /**
     * Start WiFi Direct server to receive connections
     */
    startServer(): Promise<{ success: boolean; port: number }>;

    /**
     * Get list of discovered peers
     */
    getPeers(): Promise<{ peers: WiFiDirectPeer[] }>;

    /**
     * Add listener for WiFi Direct events
     */
    addListener(
        eventName: 'stateChanged' | 'peersChanged' | 'connectionChanged' | 'messageReceived',
        listenerFunc: (event: any) => void
    ): Promise<{ remove: () => void }>;
}

export interface WiFiDirectPeer {
    deviceName: string;
    deviceAddress: string;
    status: number;
}

export interface WiFiDirectConnection {
    connected: boolean;
    isGroupOwner: boolean;
    groupOwnerAddress?: string;
}

export interface WiFiDirectMessage {
    message: string;
    from: string;
}

// ============================================================================
// Register Plugins (lazy initialization to avoid .then() issues)
// ============================================================================

let BluetoothMesh: any = null;
let WiFiDirect: any = null;

// Synchronous getters — MUST NOT be async.
// Capacitor plugin proxies respond to ALL property accesses (including .then)
// via the native bridge. If a plugin proxy is returned from an async function,
// Promise resolution calls .then() on it, triggering
// "BluetoothMesh.then() is not implemented on android".
// registerPlugin() itself is synchronous, so no async is needed here.
function getBluetoothMesh(): BluetoothMeshPlugin {
  if (!BluetoothMesh) {
    BluetoothMesh = registerPlugin<BluetoothMeshPlugin>('BluetoothMesh');
  }
  return BluetoothMesh;
}

function getWiFiDirect(): WiFiDirectPlugin {
  if (!WiFiDirect) {
    WiFiDirect = registerPlugin<WiFiDirectPlugin>('WiFiDirect');
  }
  return WiFiDirect;
}

export { getBluetoothMesh, getWiFiDirect };

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if Bluetooth mesh is available on this device
 */
export async function isBluetoothMeshAvailable(): Promise<boolean> {
    try {
        const result = await getBluetoothMesh().initialize();
        return result.success;
    } catch (error) {
        console.warn('Bluetooth mesh not available:', error);
        return false;
    }
}

/**
 * Check if WiFi Direct is available on this device
 */
export async function isWiFiDirectAvailable(): Promise<boolean> {
    try {
        const result = await getWiFiDirect().initialize();
        return result.success;
    } catch (error) {
        console.warn('WiFi Direct not available:', error);
        return false;
    }
}

/**
 * Initialize all native mesh networking plugins
 */
export async function initializeNativeMesh(): Promise<{
    bluetooth: boolean;
    wifiDirect: boolean;
}> {
    const [bluetooth, wifiDirect] = await Promise.all([
        isBluetoothMeshAvailable(),
        isWiFiDirectAvailable()
    ]);

    console.log('Native mesh initialization:', { bluetooth, wifiDirect });

    return { bluetooth, wifiDirect };
}

/**
 * Start native mesh networking (both Bluetooth and WiFi Direct)
 */
export async function startNativeMesh(options: {
    deviceName: string;
    deviceId: string;
}): Promise<void> {
    const { bluetooth, wifiDirect } = await initializeNativeMesh();

    if (bluetooth) {
        try {
            // Start Bluetooth advertising and scanning
            const bt = getBluetoothMesh();
            await bt.startAdvertising({
                deviceName: options.deviceName,
                deviceId: options.deviceId
            });
            await bt.startScanning();
            console.log('✅ Bluetooth mesh started');
        } catch (error) {
            console.error('Failed to start Bluetooth mesh:', error);
        }
    }

    if (wifiDirect) {
        try {
            // Start WiFi Direct discovery and server
            const wd = getWiFiDirect();
            await wd.startDiscovery();
            await wd.startServer();
            console.log('✅ WiFi Direct started');
        } catch (error) {
            console.error('Failed to start WiFi Direct:', error);
        }
    }
}

/**
 * Stop native mesh networking
 */
export async function stopNativeMesh(): Promise<void> {
    try {
        const bt = getBluetoothMesh();
        await bt.stopAdvertising();
        await bt.stopScanning();
        console.log('✅ Bluetooth mesh stopped');
    } catch (error) {
        console.error('Failed to stop Bluetooth mesh:', error);
    }

    try {
        const wd = getWiFiDirect();
        await wd.stopDiscovery();
        console.log('✅ WiFi Direct stopped');
    } catch (error) {
        console.error('Failed to stop WiFi Direct:', error);
    }
}

/**
 * Send a message via native mesh (tries Bluetooth first, then WiFi Direct)
 */
export async function sendNativeMeshMessage(options: {
    deviceId: string;
    message: string;
}): Promise<boolean> {
    // Try Bluetooth first
    try {
        const result = await getBluetoothMesh().sendMessage({
            deviceId: options.deviceId,
            message: options.message
        });
        if (result.success) {
            console.log('✅ Message sent via Bluetooth');
            return true;
        }
    } catch (error) {
        console.warn('Bluetooth send failed, trying WiFi Direct:', error);
    }

    // Fallback to WiFi Direct
    try {
        const result = await getWiFiDirect().sendMessage({
            message: options.message,
            targetAddress: options.deviceId
        });
        if (result.success) {
            console.log('✅ Message sent via WiFi Direct');
            return true;
        }
    } catch (error) {
        console.error('WiFi Direct send failed:', error);
    }

    return false;
}

/**
 * Get all discovered peers from both Bluetooth and WiFi Direct
 */
export async function getAllDiscoveredPeers(): Promise<{
    bluetooth: BluetoothDevice[];
    wifiDirect: WiFiDirectPeer[];
}> {
    const bluetooth: BluetoothDevice[] = [];
    const wifiDirect: WiFiDirectPeer[] = [];

    try {
        const btResult = await getBluetoothMesh().getDiscoveredDevices();
        // Note: The actual device list would come from event listeners
        console.log('Bluetooth devices discovered:', btResult.devices);
    } catch (error) {
        console.error('Failed to get Bluetooth devices:', error);
    }

    try {
        const wdResult = await getWiFiDirect().getPeers();
        wifiDirect.push(...wdResult.peers);
    } catch (error) {
        console.error('Failed to get WiFi Direct peers:', error);
    }

    return { bluetooth, wifiDirect };
}

// ============================================================================
// Event Listeners Setup
// ============================================================================

/**
 * Setup event listeners for native mesh networking
 */
export function setupNativeMeshListeners(callbacks: {
    onDeviceDiscovered?: (device: BluetoothDevice | WiFiDirectPeer) => void;
    onMessageReceived?: (message: BluetoothMessage | WiFiDirectMessage) => void;
    onConnectionChanged?: (connected: boolean) => void;
}): () => void {
    const listeners: Array<{ remove: () => void }> = [];

    const bt = getBluetoothMesh();
    const wd = getWiFiDirect();

    // Bluetooth listeners
    if (callbacks.onDeviceDiscovered) {
        bt.addListener('deviceDiscovered', (event) => {
            callbacks.onDeviceDiscovered?.(event as BluetoothDevice);
        }).then(listener => listeners.push(listener));
    }

    if (callbacks.onMessageReceived) {
        bt.addListener('messageReceived', (event) => {
            callbacks.onMessageReceived?.(event as BluetoothMessage);
        }).then(listener => listeners.push(listener));
    }

    if (callbacks.onConnectionChanged) {
        bt.addListener('deviceConnected', () => {
            callbacks.onConnectionChanged?.(true);
        }).then(listener => listeners.push(listener));

        bt.addListener('deviceDisconnected', () => {
            callbacks.onConnectionChanged?.(false);
        }).then(listener => listeners.push(listener));
    }

    // WiFi Direct listeners
    if (callbacks.onDeviceDiscovered) {
        wd.addListener('peersChanged', (event) => {
            event.peers?.forEach((peer: WiFiDirectPeer) => {
                callbacks.onDeviceDiscovered?.(peer);
            });
        }).then(listener => listeners.push(listener));
    }

    if (callbacks.onMessageReceived) {
        wd.addListener('messageReceived', (event) => {
            callbacks.onMessageReceived?.(event as WiFiDirectMessage);
        }).then(listener => listeners.push(listener));
    }

    if (callbacks.onConnectionChanged) {
        wd.addListener('connectionChanged', (event) => {
            callbacks.onConnectionChanged?.(event.connected);
        }).then(listener => listeners.push(listener));
    }

    // Return cleanup function
    return () => {
        listeners.forEach(listener => listener.remove());
    };
}
