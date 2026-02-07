package com.xitchat.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        android.util.Log.d("XitChat", "MainActivity onCreate started");
        
        // Register custom plugins for XitChat mesh networking
        try {
            registerPlugin(BluetoothMeshPlugin.class);
            android.util.Log.d("XitChat", "BluetoothMeshPlugin registered successfully");
        } catch (Exception e) {
            android.util.Log.e("XitChat", "Failed to register BluetoothMeshPlugin", e);
        }

        try {
            registerPlugin(WiFiDirectPlugin.class);
            android.util.Log.d("XitChat", "WiFiDirectPlugin registered successfully");
        } catch (Exception e) {
            android.util.Log.e("XitChat", "Failed to register WiFiDirectPlugin", e);
        }
        
        android.util.Log.d("XitChat", "MainActivity onCreate finished");
    }
}
