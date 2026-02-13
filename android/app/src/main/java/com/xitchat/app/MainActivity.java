package com.xitchat.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register custom plugins BEFORE super.onCreate so they are available to the bridge
        try {
            registerPlugin(BluetoothMeshPlugin.class);
            android.util.Log.d("XitChat", "BluetoothMeshPlugin registered");
        } catch (Exception e) {
            android.util.Log.e("XitChat", "Failed to register BluetoothMeshPlugin", e);
        }

        try {
            registerPlugin(WiFiDirectPlugin.class);
            android.util.Log.d("XitChat", "WiFiDirectPlugin registered");
        } catch (Exception e) {
            android.util.Log.e("XitChat", "Failed to register WiFiDirectPlugin", e);
        }

        super.onCreate(savedInstanceState);
        android.util.Log.d("XitChat", "MainActivity onCreate finished");
    }
}
