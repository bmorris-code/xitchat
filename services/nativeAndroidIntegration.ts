/**
 * Integration Guide: Native Android Plugins with Existing Services
 * 
 * This file shows how to integrate the new native Android plugins
 * with your existing hybridMesh service for seamless mesh networking.
 */

import { Capacitor } from '@capacitor/core';
import {
    initializeNativeMesh,
    startNativeMesh,
    stopNativeMesh,
    sendNativeMeshMessage,
    setupNativeMeshListeners,
    BluetoothDevice,
    WiFiDirectPeer
} from './nativeAndroidPlugins';

/**
 * Example: Integrate native plugins with hybridMesh service
 * 
 * Add this to your hybridMesh.ts file
 */

// Check if running on native Android
const isNativeAndroid = Capacitor.getPlatform() === 'android' && Capacitor.isNativePlatform();

// Initialize native mesh on Android
export async function initializeNativeAndroidMesh() {
    if (!isNativeAndroid) {
        console.log('Not on native Android, skipping native mesh initialization');
        return false;
    }

    try {
        console.log('🤖 Initializing native Android mesh plugins...');

        const { bluetooth, wifiDirect } = await initializeNativeMesh();

        if (bluetooth || wifiDirect) {
            console.log('✅ Native Android mesh initialized:', { bluetooth, wifiDirect });

            // Start mesh networking
            await startNativeMesh({
                deviceName: 'XitChat-' + Math.random().toString(36).substr(2, 6),
                deviceId: 'device-' + Date.now()
            });

            // Setup event listeners
            const cleanup = setupNativeMeshListeners({
                onDeviceDiscovered: (device) => {
                    console.log('📱 Native device discovered:', device);
                    // Add to your peer list
                    // hybridMesh.addPeer(device);
                },
                onMessageReceived: (message) => {
                    console.log('💬 Native message received:', message);
                    // Handle incoming message
                    // hybridMesh.handleIncomingMessage(message);
                },
                onConnectionChanged: (connected) => {
                    console.log('🔌 Native connection changed:', connected);
                    // Update connection status
                }
            });

            return true;
        }

        return false;
    } catch (error) {
        console.error('❌ Failed to initialize native Android mesh:', error);
        return false;
    }
}

/**
 * Example: Send message via native mesh
 */
export async function sendMessageViaNativeMesh(deviceId: string, message: string) {
    if (!isNativeAndroid) {
        console.log('Not on native Android, using web mesh');
        return false;
    }

    try {
        const success = await sendNativeMeshMessage({ deviceId, message });
        if (success) {
            console.log('✅ Message sent via native mesh');
            return true;
        }
    } catch (error) {
        console.error('❌ Failed to send via native mesh:', error);
    }

    return false;
}

/**
 * Example: Integration with App.tsx
 * 
 * Add this to your App.tsx initialization
 */
export function exampleAppIntegration() {
    // In your useEffect for mesh initialization:

    /*
    useEffect(() => {
      const initializeMesh = async () => {
        try {
          // Initialize web-based mesh (existing)
          const webMeshTypes = await hybridMesh.initialize();
          console.log('Web mesh initialized:', webMeshTypes);
          
          // Initialize native Android mesh (new)
          if (Capacitor.getPlatform() === 'android' && Capacitor.isNativePlatform()) {
            const nativeSuccess = await initializeNativeAndroidMesh();
            if (nativeSuccess) {
              console.log('✅ Native Android mesh active');
            }
          }
          
          // Subscribe to mesh messages (existing)
          hybridMesh.subscribe('messageReceived', (message) => {
            console.log('📨 Mesh message received:', message);
            // Handle message...
          });
          
        } catch (error) {
          console.error('Failed to initialize mesh:', error);
        }
      };
      
      initializeMesh();
    }, []);
    */
}

/**
 * Example: Enhanced message sending with native fallback
 */
export async function sendMessageWithNativeFallback(
    recipientId: string,
    message: string
) {
    // Try web-based mesh first (WebRTC, Nostr, etc.)
    try {
        // Your existing hybridMesh.sendMessage logic
        console.log('Trying web mesh...');
        // await hybridMesh.sendMessage(recipientId, message);
        return true;
    } catch (error) {
        console.warn('Web mesh failed, trying native mesh:', error);
    }

    // Fallback to native Android mesh
    if (isNativeAndroid) {
        try {
            const success = await sendNativeMeshMessage({
                deviceId: recipientId,
                message: message
            });

            if (success) {
                console.log('✅ Message sent via native Android mesh');
                return true;
            }
        } catch (error) {
            console.error('Native mesh also failed:', error);
        }
    }

    return false;
}

/**
 * Example: Unified peer discovery
 */
export async function discoverAllPeers() {
    const allPeers: any[] = [];

    // Get web mesh peers (existing)
    // const webPeers = hybridMesh.getPeers();
    // allPeers.push(...webPeers);

    // Get native Android peers (new)
    if (isNativeAndroid) {
        try {
            const { bluetooth, wifiDirect } = await getAllDiscoveredPeers();

            // Convert to unified format
            const nativePeers = [
                ...bluetooth.map(d => ({
                    id: d.deviceId,
                    name: d.deviceName,
                    type: 'bluetooth-native',
                    rssi: d.rssi
                })),
                ...wifiDirect.map(d => ({
                    id: d.deviceAddress,
                    name: d.deviceName,
                    type: 'wifi-direct-native'
                }))
            ];

            allPeers.push(...nativePeers);
        } catch (error) {
            console.error('Failed to get native peers:', error);
        }
    }

    return allPeers;
}

/**
 * Platform detection helper
 */
export function getPlatformCapabilities() {
    const platform = Capacitor.getPlatform();
    const isNative = Capacitor.isNativePlatform();

    return {
        platform,
        isNative,
        isAndroid: platform === 'android',
        isIOS: platform === 'ios',
        isWeb: platform === 'web',

        // Mesh networking capabilities
        hasNativeBluetooth: platform === 'android' && isNative,
        hasNativeWiFiDirect: platform === 'android' && isNative,
        hasWebRTC: true, // Available on all platforms
        hasNostr: true,  // Available on all platforms

        // Recommended mesh strategy
        recommendedMesh: platform === 'android' && isNative
            ? 'native-first'
            : 'web-only'
    };
}

/**
 * Example: Smart mesh routing
 */
export async function smartSendMessage(recipientId: string, message: string) {
    const capabilities = getPlatformCapabilities();

    if (capabilities.recommendedMesh === 'native-first') {
        // Try native Android mesh first (faster, more reliable)
        const nativeSuccess = await sendMessageViaNativeMesh(recipientId, message);
        if (nativeSuccess) return true;

        // Fallback to web mesh
        console.log('Native failed, trying web mesh...');
        // return await hybridMesh.sendMessage(recipientId, message);
    } else {
        // Web-only platform, use existing mesh
        // return await hybridMesh.sendMessage(recipientId, message);
    }

    return false;
}

/**
 * Example: Cleanup on app close
 */
export async function cleanupNativeMesh() {
    if (isNativeAndroid) {
        try {
            await stopNativeMesh();
            console.log('✅ Native mesh stopped');
        } catch (error) {
            console.error('Failed to stop native mesh:', error);
        }
    }
}

// Export helper to check if native mesh is available
export { isNativeAndroid };

/**
 * INTEGRATION STEPS:
 * 
 * 1. Import this file in your App.tsx:
 *    import { initializeNativeAndroidMesh } from './services/nativeAndroidIntegration';
 * 
 * 2. Call initializeNativeAndroidMesh() in your mesh initialization useEffect
 * 
 * 3. Update your message sending logic to use sendMessageWithNativeFallback()
 * 
 * 4. Add cleanup in your component unmount:
 *    return () => { cleanupNativeMesh(); };
 * 
 * 5. Test on Android device to verify native plugins work
 * 
 * That's it! Your app now has native Android mesh networking! 🚀
 */
