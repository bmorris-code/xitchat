package com.xitchat.app;

import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.net.wifi.p2p.WifiP2pConfig;
import android.net.wifi.p2p.WifiP2pDevice;
import android.net.wifi.p2p.WifiP2pDeviceList;
import android.net.wifi.p2p.WifiP2pInfo;
import android.net.wifi.p2p.WifiP2pManager;
import android.os.Build;
import android.util.Log;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

@CapacitorPlugin(
    name = "WiFiDirect",
    permissions = {
        @Permission(strings = {Manifest.permission.ACCESS_WIFI_STATE}, alias = "wifiState"),
        @Permission(strings = {Manifest.permission.CHANGE_WIFI_STATE}, alias = "changeWifiState"),
        @Permission(strings = {Manifest.permission.ACCESS_FINE_LOCATION}, alias = "location"),
        @Permission(strings = {Manifest.permission.NEARBY_WIFI_DEVICES}, alias = "nearbyWifiDevices")
    }
)
public class WiFiDirectPlugin extends Plugin {
    private static final String TAG = "WiFiDirectPlugin";
    private static final int SERVER_PORT = 8888;
    
    private WifiP2pManager wifiP2pManager;
    private WifiP2pManager.Channel channel;
    private BroadcastReceiver receiver;
    private IntentFilter intentFilter;
    
    private List<WifiP2pDevice> peers = new ArrayList<>();
    private boolean isDiscovering = false;
    private ServerSocket serverSocket;
    private Socket clientSocket;

    @Override
    public void load() {
        try {
            wifiP2pManager = (WifiP2pManager) getContext().getSystemService(Context.WIFI_P2P_SERVICE);
            if (wifiP2pManager != null) {
                channel = wifiP2pManager.initialize(getContext(), getContext().getMainLooper(), null);
            }
            
            intentFilter = new IntentFilter();
            intentFilter.addAction(WifiP2pManager.WIFI_P2P_STATE_CHANGED_ACTION);
            intentFilter.addAction(WifiP2pManager.WIFI_P2P_PEERS_CHANGED_ACTION);
            intentFilter.addAction(WifiP2pManager.WIFI_P2P_CONNECTION_CHANGED_ACTION);
            intentFilter.addAction(WifiP2pManager.WIFI_P2P_THIS_DEVICE_CHANGED_ACTION);
            
            receiver = new WiFiDirectBroadcastReceiver();
            
            Log.d(TAG, "WiFiDirectPlugin loaded successfully");
        } catch (Exception e) {
            Log.e(TAG, "Error loading WiFiDirectPlugin", e);
            // Don't crash the app, just log the error
        }
    }

    @PluginMethod
    public void initialize(PluginCall call) {
        if (wifiP2pManager == null) {
            call.reject("WiFi Direct not supported on this device");
            return;
        }
        
        getContext().registerReceiver(receiver, intentFilter);
        
        JSObject ret = new JSObject();
        ret.put("success", true);
        ret.put("message", "WiFi Direct initialized");
        call.resolve(ret);
    }

    @PluginMethod
    public void startDiscovery(PluginCall call) {
        if (wifiP2pManager == null || channel == null) {
            call.reject("WiFi Direct not initialized");
            return;
        }
        
        wifiP2pManager.discoverPeers(channel, new WifiP2pManager.ActionListener() {
            @Override
            public void onSuccess() {
                isDiscovering = true;
                Log.d(TAG, "Peer discovery started");
                
                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("discovering", true);
                call.resolve(ret);
            }

            @Override
            public void onFailure(int reasonCode) {
                Log.e(TAG, "Peer discovery failed: " + reasonCode);
                call.reject("Discovery failed with code: " + reasonCode);
            }
        });
    }

    @PluginMethod
    public void stopDiscovery(PluginCall call) {
        if (wifiP2pManager == null || channel == null) {
            call.reject("WiFi Direct not initialized");
            return;
        }
        
        wifiP2pManager.stopPeerDiscovery(channel, new WifiP2pManager.ActionListener() {
            @Override
            public void onSuccess() {
                isDiscovering = false;
                Log.d(TAG, "Peer discovery stopped");
                
                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("discovering", false);
                call.resolve(ret);
            }

            @Override
            public void onFailure(int reasonCode) {
                Log.e(TAG, "Stop discovery failed: " + reasonCode);
                call.reject("Stop discovery failed with code: " + reasonCode);
            }
        });
    }

    @PluginMethod
    public void connectToPeer(PluginCall call) {
        String deviceAddress = call.getString("deviceAddress");
        
        if (deviceAddress == null) {
            call.reject("Missing deviceAddress");
            return;
        }
        
        WifiP2pConfig config = new WifiP2pConfig();
        config.deviceAddress = deviceAddress;
        
        wifiP2pManager.connect(channel, config, new WifiP2pManager.ActionListener() {
            @Override
            public void onSuccess() {
                Log.d(TAG, "Connection initiated to " + deviceAddress);
                
                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("deviceAddress", deviceAddress);
                call.resolve(ret);
            }

            @Override
            public void onFailure(int reasonCode) {
                Log.e(TAG, "Connection failed: " + reasonCode);
                call.reject("Connection failed with code: " + reasonCode);
            }
        });
    }

    @PluginMethod
    public void sendMessage(PluginCall call) {
        String message = call.getString("message");
        String targetAddress = call.getString("targetAddress");
        
        if (message == null) {
            call.reject("Missing message");
            return;
        }
        
        new Thread(() -> {
            try {
                if (clientSocket == null || !clientSocket.isConnected()) {
                    // Connect to peer
                    clientSocket = new Socket();
                    clientSocket.connect(new InetSocketAddress(targetAddress, SERVER_PORT), 5000);
                }
                
                OutputStream outputStream = clientSocket.getOutputStream();
                outputStream.write(message.getBytes(StandardCharsets.UTF_8));
                outputStream.flush();
                
                JSObject ret = new JSObject();
                ret.put("success", true);
                call.resolve(ret);
                
            } catch (IOException e) {
                Log.e(TAG, "Failed to send message", e);
                call.reject("Failed to send message: " + e.getMessage());
            }
        }).start();
    }

    @PluginMethod
    public void startServer(PluginCall call) {
        new Thread(() -> {
            try {
                serverSocket = new ServerSocket(SERVER_PORT);
                Log.d(TAG, "Server started on port " + SERVER_PORT);
                
                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("port", SERVER_PORT);
                call.resolve(ret);
                
                while (!serverSocket.isClosed()) {
                    Socket client = serverSocket.accept();
                    handleClient(client);
                }
                
            } catch (IOException e) {
                Log.e(TAG, "Server error", e);
                call.reject("Server error: " + e.getMessage());
            }
        }).start();
    }

    @PluginMethod
    public void getPeers(PluginCall call) {
        JSArray peersArray = new JSArray();
        
        for (WifiP2pDevice device : peers) {
            JSObject peerObj = new JSObject();
            peerObj.put("deviceName", device.deviceName);
            peerObj.put("deviceAddress", device.deviceAddress);
            peerObj.put("status", device.status);
            peersArray.put(peerObj);
        }
        
        JSObject ret = new JSObject();
        ret.put("peers", peersArray);
        call.resolve(ret);
    }

    private void handleClient(Socket client) {
        new Thread(() -> {
            try {
                InputStream inputStream = client.getInputStream();
                byte[] buffer = new byte[1024];
                int bytesRead;
                
                while ((bytesRead = inputStream.read(buffer)) != -1) {
                    String message = new String(buffer, 0, bytesRead, StandardCharsets.UTF_8);
                    
                    JSObject ret = new JSObject();
                    ret.put("message", message);
                    ret.put("from", client.getInetAddress().getHostAddress());
                    notifyListeners("messageReceived", ret);
                    
                    Log.d(TAG, "Received message: " + message);
                }
                
            } catch (IOException e) {
                Log.e(TAG, "Error handling client", e);
            }
        }).start();
    }

    private class WiFiDirectBroadcastReceiver extends BroadcastReceiver {
        @Override
        public void onReceive(Context context, Intent intent) {
            String action = intent.getAction();
            
            if (WifiP2pManager.WIFI_P2P_STATE_CHANGED_ACTION.equals(action)) {
                int state = intent.getIntExtra(WifiP2pManager.EXTRA_WIFI_STATE, -1);
                boolean enabled = state == WifiP2pManager.WIFI_P2P_STATE_ENABLED;
                
                JSObject ret = new JSObject();
                ret.put("enabled", enabled);
                notifyListeners("stateChanged", ret);
                
            } else if (WifiP2pManager.WIFI_P2P_PEERS_CHANGED_ACTION.equals(action)) {
                wifiP2pManager.requestPeers(channel, peerList -> {
                    peers.clear();
                    peers.addAll(peerList.getDeviceList());
                    
                    JSArray peersArray = new JSArray();
                    for (WifiP2pDevice device : peers) {
                        JSObject peerObj = new JSObject();
                        peerObj.put("deviceName", device.deviceName);
                        peerObj.put("deviceAddress", device.deviceAddress);
                        peerObj.put("status", device.status);
                        peersArray.put(peerObj);
                    }
                    
                    JSObject ret = new JSObject();
                    ret.put("peers", peersArray);
                    notifyListeners("peersChanged", ret);
                    
                    Log.d(TAG, "Peers updated: " + peers.size() + " devices found");
                });
                
            } else if (WifiP2pManager.WIFI_P2P_CONNECTION_CHANGED_ACTION.equals(action)) {
                wifiP2pManager.requestConnectionInfo(channel, info -> {
                    if (info.groupFormed) {
                        JSObject ret = new JSObject();
                        ret.put("connected", true);
                        ret.put("isGroupOwner", info.isGroupOwner);
                        ret.put("groupOwnerAddress", info.groupOwnerAddress != null ? 
                                info.groupOwnerAddress.getHostAddress() : null);
                        notifyListeners("connectionChanged", ret);
                        
                        Log.d(TAG, "Connection established. Group owner: " + info.isGroupOwner);
                    }
                });
            }
        }
    }

    @Override
    protected void handleOnDestroy() {
        if (receiver != null) {
            try {
                getContext().unregisterReceiver(receiver);
            } catch (Exception e) {
                Log.e(TAG, "Error unregistering receiver", e);
            }
        }
        
        if (serverSocket != null && !serverSocket.isClosed()) {
            try {
                serverSocket.close();
            } catch (IOException e) {
                Log.e(TAG, "Error closing server socket", e);
            }
        }
        
        if (clientSocket != null && !clientSocket.isClosed()) {
            try {
                clientSocket.close();
            } catch (IOException e) {
                Log.e(TAG, "Error closing client socket", e);
            }
        }
    }
}
