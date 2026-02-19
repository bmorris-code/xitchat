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
        if (bluetoothAdapter == null) {
            call.reject("Bluetooth not supported on this device");
            return;
        }
        
        if (!bluetoothAdapter.isEnabled()) {
            call.reject("Bluetooth is not enabled");
            return;
        }
        
        JSObject ret = new JSObject();
        ret.put("success", true);
        ret.put("message", "Bluetooth mesh initialized");
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
        
        AdvertiseData data = new AdvertiseData.Builder()
            .setIncludeDeviceName(true)
            .addServiceUuid(new ParcelUuid(SERVICE_UUID))
            .build();
        
        try {
            bluetoothLeAdvertiser.startAdvertising(settings, data, advertiseCallback);
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
        if (gatt == null) {
            call.reject("Device not connected");
            return;
        }
        
        BluetoothGattService service = gatt.getService(SERVICE_UUID);
        if (service == null) {
            call.reject("Service not found");
            return;
        }
        
        BluetoothGattCharacteristic characteristic = service.getCharacteristic(CHARACTERISTIC_UUID);
        if (characteristic == null) {
            call.reject("Characteristic not found");
            return;
        }
        
        characteristic.setValue(message.getBytes(StandardCharsets.UTF_8));
        boolean success = gatt.writeCharacteristic(characteristic);
        
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
                
                JSObject ret = new JSObject();
                ret.put("deviceId", device.getAddress());
                ret.put("deviceName", device.getName() != null ? device.getName() : "Unknown");
                ret.put("rssi", result.getRssi());
                
                notifyListeners("deviceDiscovered", ret);
                Log.d(TAG, "Discovered device: " + device.getName() + " (" + device.getAddress() + ")");
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

                JSObject ret = new JSObject();
                ret.put("deviceId", deviceId);
                ret.put("deviceName", gatt.getDevice().getName() != null ? gatt.getDevice().getName() : "Unknown");
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
    };

    private final BluetoothGattServerCallback gattServerCallback = new BluetoothGattServerCallback() {
        @Override
        public void onConnectionStateChange(BluetoothDevice device, int status, int newState) {
            if (newState == BluetoothGatt.STATE_CONNECTED) {
                Log.d(TAG, "Device connected: " + device.getAddress());
                
                JSObject ret = new JSObject();
                ret.put("deviceId", device.getAddress());
                ret.put("deviceName", device.getName() != null ? device.getName() : "Unknown");
                ret.put("connected", true);
                notifyListeners("deviceConnected", ret);
            } else if (newState == BluetoothGatt.STATE_DISCONNECTED) {
                Log.d(TAG, "Device disconnected: " + device.getAddress());
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
