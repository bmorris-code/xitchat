package com.xitchat.app;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCallback;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothGattServer;
import android.bluetooth.BluetoothGattServerCallback;
import android.bluetooth.BluetoothGattService;
import android.bluetooth.BluetoothManager;
import android.bluetooth.le.AdvertiseCallback;
import android.bluetooth.le.AdvertiseData;
import android.bluetooth.le.AdvertiseSettings;
import android.bluetooth.le.BluetoothLeAdvertiser;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanResult;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.ParcelUuid;
import android.util.Log;

import androidx.core.app.ActivityCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.getcapacitor.PermissionState;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@CapacitorPlugin(
    name = "BluetoothMesh",
    permissions = {
        @Permission(strings = {Manifest.permission.BLUETOOTH}, alias = "bluetooth"),
        @Permission(strings = {Manifest.permission.BLUETOOTH_ADMIN}, alias = "bluetoothAdmin"),
        @Permission(strings = {Manifest.permission.BLUETOOTH_SCAN}, alias = "bluetoothScan"),
        @Permission(strings = {Manifest.permission.BLUETOOTH_ADVERTISE}, alias = "bluetoothAdvertise"),
        @Permission(strings = {Manifest.permission.BLUETOOTH_CONNECT}, alias = "bluetoothConnect"),
        @Permission(strings = {Manifest.permission.ACCESS_FINE_LOCATION}, alias = "location")
    }
)
public class BluetoothMeshPlugin extends Plugin {
    private static final String TAG = "BluetoothMeshPlugin";
    
    // XitChat Mesh Service UUID
    private static final UUID SERVICE_UUID = UUID.fromString("0000ffe0-0000-1000-8000-00805f9b34fb");
    private static final UUID CHARACTERISTIC_UUID = UUID.fromString("0000ffe1-0000-1000-8000-00805f9b34fb");
    
    private BluetoothManager bluetoothManager;
    private BluetoothAdapter bluetoothAdapter;
    private BluetoothLeScanner bluetoothLeScanner;
    private BluetoothLeAdvertiser bluetoothLeAdvertiser;
    private BluetoothGattServer gattServer;
    
    private Map<String, BluetoothGatt> connectedDevices = new HashMap<>();
    // Devices that connected TO our GATT server (we didn't initiate the connection)
    private Map<String, BluetoothDevice> serverConnectedDevices = new HashMap<>();
    private List<BluetoothDevice> discoveredDevices = new ArrayList<>();
    private Set<String> connectingDevices = new HashSet<>();
    
    private boolean isScanning = false;
    private boolean isAdvertising = false;

    @Override
    public void load() {
        try {
            bluetoothManager = (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
            if (bluetoothManager != null) {
                bluetoothAdapter = bluetoothManager.getAdapter();
                
                if (bluetoothAdapter != null) {
                    bluetoothLeScanner = bluetoothAdapter.getBluetoothLeScanner();
                    bluetoothLeAdvertiser = bluetoothAdapter.getBluetoothLeAdvertiser();
                }
            }
            
            Log.d(TAG, "BluetoothMeshPlugin loaded successfully");
        } catch (Exception e) {
            Log.e(TAG, "Error loading BluetoothMeshPlugin", e);
            // Don't crash the app, just log the error
        }
    }

    @PluginMethod
    public void initialize(PluginCall call) {
        Log.d(TAG, "initialize() called");
        
        // 1. Ensure we have the Bluetooth Adapter (re-acquire if needed)
        if (bluetoothAdapter == null) {
            Log.d(TAG, "Bluetooth adapter null, attempting to re-acquire...");
            bluetoothManager = (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
            if (bluetoothManager != null) {
                bluetoothAdapter = bluetoothManager.getAdapter();
                if (bluetoothAdapter != null) {
                    Log.d(TAG, "Bluetooth adapter re-acquired successfully");
                }
            }
        }

        // 2. Check for Permissions (Android 12+ requires runtime prompts)
        if (checkPermissions()) {
            Log.d(TAG, "All permissions already granted, checking hardware...");
            checkHardwareAndResolve(call);
        } else {
            Log.d(TAG, "Permissions not granted, requesting...");
            // Request all relevant aliases defined in @CapacitorPlugin
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                // Android 12+: BLUETOOTH_SCAN / CONNECT / ADVERTISE are runtime permissions
                requestPermissionForAliases(
                    new String[]{"bluetoothScan", "bluetoothConnect", "bluetoothAdvertise"},
                    call, "checkHardwareCallback");
            } else {
                // Android < 12: legacy BLUETOOTH / BLUETOOTH_ADMIN + location are runtime permissions
                requestPermissionForAliases(
                    new String[]{"bluetooth", "bluetoothAdmin", "location"},
                    call, "checkHardwareLegacyCallback");
            }
        }
    }

    // Callback for Android 12+ permission dialog
    @PermissionCallback
    private void checkHardwareCallback(PluginCall call) {
        if (getPermissionState("bluetoothScan") == PermissionState.GRANTED &&
            getPermissionState("bluetoothConnect") == PermissionState.GRANTED &&
            getPermissionState("bluetoothAdvertise") == PermissionState.GRANTED) {
            checkHardwareAndResolve(call);
        } else {
            call.reject("Bluetooth permissions are required for Mesh networking");
        }
    }

    // Callback for Android < 12 permission dialog
    @PermissionCallback
    private void checkHardwareLegacyCallback(PluginCall call) {
        if (getPermissionState("bluetooth") == PermissionState.GRANTED &&
            getPermissionState("bluetoothAdmin") == PermissionState.GRANTED &&
            getPermissionState("location") == PermissionState.GRANTED) {
            checkHardwareAndResolve(call);
        } else {
            call.reject("Bluetooth permissions are required for Mesh networking");
        }
    }

    private void checkHardwareAndResolve(PluginCall call) {
        // Final check for Bluetooth adapter
        if (bluetoothAdapter == null) {
            Log.e(TAG, "Bluetooth adapter is null after re-acquisition attempt");
            call.reject("Bluetooth not supported on this device");
            return;
        }

        // Check if Bluetooth is enabled
        if (!bluetoothAdapter.isEnabled()) {
            Log.w(TAG, "Bluetooth is disabled, attempting to enable...");
            // Note: On Android 12+, we cannot programmatically enable Bluetooth
            // User must enable it manually, but we can provide a clear error message
            call.reject("Bluetooth is not enabled. Please turn on Bluetooth in device settings.");
            return;
        }

        // Re-initialize scanner and advertiser if needed
        if (bluetoothLeScanner == null || bluetoothLeAdvertiser == null) {
            Log.d(TAG, "Re-initializing scanner and advertiser...");
            bluetoothLeScanner = bluetoothAdapter.getBluetoothLeScanner();
            bluetoothLeAdvertiser = bluetoothAdapter.getBluetoothLeAdvertiser();
        }

        Log.d(TAG, "Bluetooth hardware check passed");
        JSObject ret = new JSObject();
        ret.put("success", true);
        ret.put("message", "Bluetooth mesh initialized and permissions granted");
        ret.put("bluetoothEnabled", bluetoothAdapter.isEnabled());
        ret.put("hasScanner", bluetoothLeScanner != null);
        ret.put("hasAdvertiser", bluetoothLeAdvertiser != null);
        call.resolve(ret);
    }

    @PluginMethod
    public void startAdvertising(PluginCall call) {
        if (!checkPermissions()) {
            call.reject("Missing Bluetooth permissions");
            return;
        }

        if (isAdvertising) {
            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("advertising", true);
            call.resolve(ret);
            return;
        }

        // Re-check hardware if null
        if (bluetoothLeAdvertiser == null) {
            if (bluetoothAdapter == null) {
                bluetoothManager = (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
                if (bluetoothManager != null) {
                    bluetoothAdapter = bluetoothManager.getAdapter();
                }
            }
            if (bluetoothAdapter != null) {
                bluetoothLeAdvertiser = bluetoothAdapter.getBluetoothLeAdvertiser();
            }
        }
        
        if (bluetoothLeAdvertiser == null) {
            call.reject("BLE advertising not supported or Bluetooth disabled");
            return;
        }
        
        String deviceName = call.getString("deviceName", "XitChat-Node");
        String deviceId = call.getString("deviceId", "unknown");
        
        AdvertiseSettings settings = new AdvertiseSettings.Builder()
            .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
            .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_HIGH)
            .setConnectable(true)
            .build();
        
        // setIncludeDeviceName(true) + 128-bit UUID exceeds the 31-byte BLE advertising limit
        // (ADVERTISE_FAILED_DATA_TOO_LARGE). Keep the primary packet lean — service UUID only.
        AdvertiseData data = new AdvertiseData.Builder()
            .setIncludeDeviceName(false)
            .addServiceUuid(new ParcelUuid(SERVICE_UUID))
            .build();

        // Scan response carries the human-readable name without eating primary packet budget.
        AdvertiseData scanResponse = new AdvertiseData.Builder()
            .setIncludeDeviceName(true)
            .build();
        
        try {
            bluetoothLeAdvertiser.startAdvertising(settings, data, scanResponse, advertiseCallback);
            isAdvertising = true;
            
            // Start GATT server
            startGattServer();
            
            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("advertising", true);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Failed to start advertising", e);
            call.reject("Failed to start advertising: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stopAdvertising(PluginCall call) {
        if (bluetoothLeAdvertiser != null && isAdvertising) {
            bluetoothLeAdvertiser.stopAdvertising(advertiseCallback);
            isAdvertising = false;
        }
        
        if (gattServer != null) {
            gattServer.close();
            gattServer = null;
        }
        
        JSObject ret = new JSObject();
        ret.put("success", true);
        ret.put("advertising", false);
        call.resolve(ret);
    }

    @PluginMethod
    public void startScanning(PluginCall call) {
        if (!checkPermissions()) {
            call.reject("Missing Bluetooth permissions");
            return;
        }

        if (isScanning) {
            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("scanning", true);
            call.resolve(ret);
            return;
        }

        // Re-check hardware if null (e.g. if permissions were granted after load)
        if (bluetoothLeScanner == null || bluetoothLeAdvertiser == null) {
            if (bluetoothAdapter == null) {
                bluetoothManager = (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
                if (bluetoothManager != null) {
                    bluetoothAdapter = bluetoothManager.getAdapter();
                }
            }
            if (bluetoothAdapter != null) {
                bluetoothLeScanner = bluetoothAdapter.getBluetoothLeScanner();
                bluetoothLeAdvertiser = bluetoothAdapter.getBluetoothLeAdvertiser();
            }
        }
        
        if (bluetoothLeScanner == null) {
            call.reject("BLE scanning not supported or Bluetooth disabled");
            return;
        }
        
        discoveredDevices.clear();
        try {
            bluetoothLeScanner.startScan(scanCallback);
            isScanning = true;
            
            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("scanning", true);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Failed to start scan", e);
            call.reject("Failed to start scan: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stopScanning(PluginCall call) {
        if (bluetoothLeScanner != null && isScanning) {
            bluetoothLeScanner.stopScan(scanCallback);
            isScanning = false;
        }
        
        JSObject ret = new JSObject();
        ret.put("success", true);
        ret.put("scanning", false);
        call.resolve(ret);
    }

    private void connectToDiscoveredDevice(BluetoothDevice device) {
        if (device == null) return;
        final String address = device.getAddress();
        if (address == null) return;
        if (connectedDevices.containsKey(address) || connectingDevices.contains(address)) return;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
            ActivityCompat.checkSelfPermission(getContext(), Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) {
            return;
        }

        try {
            connectingDevices.add(address);
            device.connectGatt(getContext(), false, clientGattCallback);
            Log.d(TAG, "Attempting GATT connection to " + address);
        } catch (Exception e) {
            connectingDevices.remove(address);
            Log.e(TAG, "Failed to connect GATT to " + address, e);
        }
    }

    @PluginMethod
    public void sendMessage(PluginCall call) {
        String deviceId = call.getString("deviceId");
        String message = call.getString("message");
        
        if (deviceId == null || message == null) {
            call.reject("Missing deviceId or message");
            return;
        }
        
        BluetoothGatt gatt = connectedDevices.get(deviceId);
        if (gatt != null) {
            // CLIENT path: we initiated the connection — write the characteristic directly.
            BluetoothGattService service = gatt.getService(SERVICE_UUID);
            if (service == null) { call.reject("Service not found"); return; }
            BluetoothGattCharacteristic characteristic = service.getCharacteristic(CHARACTERISTIC_UUID);
            if (characteristic == null) { call.reject("Characteristic not found"); return; }
            characteristic.setValue(message.getBytes(StandardCharsets.UTF_8));
            boolean success = gatt.writeCharacteristic(characteristic);
            JSObject ret = new JSObject();
            ret.put("success", success);
            call.resolve(ret);
            return;
        }

        // SERVER path: the remote device connected to US — use GATT server notification.
        BluetoothDevice serverDevice = serverConnectedDevices.get(deviceId);
        if (serverDevice == null) {
            call.reject("Device not connected");
            return;
        }
        if (gattServer == null) {
            call.reject("GATT server not running");
            return;
        }
        BluetoothGattService serverService = gattServer.getService(SERVICE_UUID);
        if (serverService == null) { call.reject("Server service not found"); return; }
        BluetoothGattCharacteristic serverChar = serverService.getCharacteristic(CHARACTERISTIC_UUID);
        if (serverChar == null) { call.reject("Server characteristic not found"); return; }
        serverChar.setValue(message.getBytes(StandardCharsets.UTF_8));
        boolean success = false;
        try {
            success = gattServer.notifyCharacteristicChanged(serverDevice, serverChar, false);
        } catch (Exception e) {
            Log.e(TAG, "notifyCharacteristicChanged failed", e);
        }
        JSObject ret = new JSObject();
        ret.put("success", success);
        call.resolve(ret);
    }

    @PluginMethod
    public void getDiscoveredDevices(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("devices", discoveredDevices.size());
        call.resolve(ret);
    }

    private void startGattServer() {
        if (bluetoothManager == null) {
            Log.e(TAG, "bluetoothManager is null, cannot start GATT server");
            return;
        }
        gattServer = bluetoothManager.openGattServer(getContext(), gattServerCallback);
        
        BluetoothGattService service = new BluetoothGattService(
            SERVICE_UUID,
            BluetoothGattService.SERVICE_TYPE_PRIMARY
        );
        
        BluetoothGattCharacteristic characteristic = new BluetoothGattCharacteristic(
            CHARACTERISTIC_UUID,
            BluetoothGattCharacteristic.PROPERTY_READ | 
            BluetoothGattCharacteristic.PROPERTY_WRITE |
            BluetoothGattCharacteristic.PROPERTY_NOTIFY,
            BluetoothGattCharacteristic.PERMISSION_READ | 
            BluetoothGattCharacteristic.PERMISSION_WRITE
        );
        
        service.addCharacteristic(characteristic);
        gattServer.addService(service);
    }

    private boolean checkPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            return ActivityCompat.checkSelfPermission(getContext(), Manifest.permission.BLUETOOTH_SCAN) == PackageManager.PERMISSION_GRANTED &&
                   ActivityCompat.checkSelfPermission(getContext(), Manifest.permission.BLUETOOTH_ADVERTISE) == PackageManager.PERMISSION_GRANTED &&
                   ActivityCompat.checkSelfPermission(getContext(), Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED;
        } else {
            return ActivityCompat.checkSelfPermission(getContext(), Manifest.permission.BLUETOOTH) == PackageManager.PERMISSION_GRANTED &&
                   ActivityCompat.checkSelfPermission(getContext(), Manifest.permission.BLUETOOTH_ADMIN) == PackageManager.PERMISSION_GRANTED &&
                   ActivityCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        }
    }

    private final AdvertiseCallback advertiseCallback = new AdvertiseCallback() {
        @Override
        public void onStartSuccess(AdvertiseSettings settingsInEffect) {
            Log.d(TAG, "BLE Advertising started successfully");
            notifyListeners("advertisingStarted", new JSObject());
        }

        @Override
        public void onStartFailure(int errorCode) {
            Log.e(TAG, "BLE Advertising failed: " + errorCode);
            JSObject ret = new JSObject();
            ret.put("errorCode", errorCode);
            notifyListeners("advertisingFailed", ret);
        }
    };

    private final ScanCallback scanCallback = new ScanCallback() {
        @Override
        public void onScanResult(int callbackType, ScanResult result) {
            BluetoothDevice device = result.getDevice();
            
            if (!discoveredDevices.contains(device)) {
                discoveredDevices.add(device);
                
                String deviceName = "Unknown";
                try { deviceName = device.getName() != null ? device.getName() : "Unknown"; } catch (SecurityException ignored) {}

                JSObject ret = new JSObject();
                ret.put("deviceId", device.getAddress());
                ret.put("deviceName", deviceName);
                ret.put("rssi", result.getRssi());

                notifyListeners("deviceDiscovered", ret);
                Log.d(TAG, "Discovered device: " + deviceName + " (" + device.getAddress() + ")");
                connectToDiscoveredDevice(device);
            }
        }

        @Override
        public void onScanFailed(int errorCode) {
            Log.e(TAG, "BLE Scan failed: " + errorCode);
            JSObject ret = new JSObject();
            ret.put("errorCode", errorCode);
            notifyListeners("scanFailed", ret);
        }
    };

    private final BluetoothGattCallback clientGattCallback = new BluetoothGattCallback() {
        @Override
        public void onConnectionStateChange(BluetoothGatt gatt, int status, int newState) {
            if (gatt == null || gatt.getDevice() == null) return;
            String deviceId = gatt.getDevice().getAddress();
            connectingDevices.remove(deviceId);

            if (newState == BluetoothGatt.STATE_CONNECTED) {
                connectedDevices.put(deviceId, gatt);
                try {
                    gatt.discoverServices();
                } catch (Exception ignored) {}

                String deviceName = "Unknown";
                try { deviceName = gatt.getDevice().getName() != null ? gatt.getDevice().getName() : "Unknown"; } catch (SecurityException ignored) {}

                JSObject ret = new JSObject();
                ret.put("deviceId", deviceId);
                ret.put("deviceName", deviceName);
                ret.put("connected", true);
                notifyListeners("deviceConnected", ret);
                Log.d(TAG, "Client GATT connected: " + deviceId);
            } else if (newState == BluetoothGatt.STATE_DISCONNECTED) {
                connectedDevices.remove(deviceId);
                try {
                    gatt.close();
                } catch (Exception ignored) {}

                JSObject ret = new JSObject();
                ret.put("deviceId", deviceId);
                ret.put("connected", false);
                notifyListeners("deviceDisconnected", ret);
                Log.d(TAG, "Client GATT disconnected: " + deviceId);
            }
        }

        @Override
        public void onServicesDiscovered(BluetoothGatt gatt, int status) {
            if (gatt == null || gatt.getDevice() == null) return;
            String deviceId = gatt.getDevice().getAddress();
            if (status == BluetoothGatt.GATT_SUCCESS) {
                Log.d(TAG, "Services discovered for " + deviceId);
                JSObject ret = new JSObject();
                ret.put("deviceId", deviceId);
                notifyListeners("deviceReady", ret);
            } else {
                Log.w(TAG, "Service discovery failed for " + deviceId + " status=" + status);
            }
        }
    };

    private final BluetoothGattServerCallback gattServerCallback = new BluetoothGattServerCallback() {
        @Override
        public void onConnectionStateChange(BluetoothDevice device, int status, int newState) {
            if (newState == BluetoothGatt.STATE_CONNECTED) {
                Log.d(TAG, "Device connected: " + device.getAddress());
                // Track so sendMessage can use notifyCharacteristicChanged for this peer.
                serverConnectedDevices.put(device.getAddress(), device);

                String devName = "Unknown";
                try { devName = device.getName() != null ? device.getName() : "Unknown"; } catch (SecurityException ignored) {}

                JSObject ret = new JSObject();
                ret.put("deviceId", device.getAddress());
                ret.put("deviceName", devName);
                ret.put("connected", true);
                notifyListeners("deviceConnected", ret);
            } else if (newState == BluetoothGatt.STATE_DISCONNECTED) {
                Log.d(TAG, "Device disconnected: " + device.getAddress());
                serverConnectedDevices.remove(device.getAddress());
                connectedDevices.remove(device.getAddress());

                JSObject ret = new JSObject();
                ret.put("deviceId", device.getAddress());
                ret.put("connected", false);
                notifyListeners("deviceDisconnected", ret);
            }
        }

        @Override
        public void onCharacteristicWriteRequest(BluetoothDevice device, int requestId,
                                                 BluetoothGattCharacteristic characteristic,
                                                 boolean preparedWrite, boolean responseNeeded,
                                                 int offset, byte[] value) {
            if (characteristic.getUuid().equals(CHARACTERISTIC_UUID)) {
                String message = new String(value, StandardCharsets.UTF_8);
                Log.d(TAG, "Received message from " + device.getAddress() + ": " + message);
                
                JSObject ret = new JSObject();
                ret.put("deviceId", device.getAddress());
                ret.put("message", message);
                notifyListeners("messageReceived", ret);
                
                if (responseNeeded) {
                    gattServer.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, offset, value);
                }
            }
        }
    };
}
