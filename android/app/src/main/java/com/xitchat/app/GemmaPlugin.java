package com.xitchat.app;

import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * GemmaPlugin — stub implementation.
 *
 * The real implementation uses com.google.mediapipe:tasks-genai which is
 * compiled with Java 21 (class file version 65), but this project currently
 * targets Java 17 (class file version 61).  Until the project is upgraded to
 * Java 21, all methods return a clear "not available" response so the
 * TypeScript layer (services/gemma-local.ts) can fall back to cloud AI.
 *
 * To re-enable:
 *   1. Set sourceCompatibility / targetCompatibility to JavaVersion.VERSION_21
 *   2. Update JAVA_VERSION in ci-cd.yml to 21
 *   3. Uncomment the dependency in build.gradle
 *   4. Replace this stub with the full implementation from GemmaPlugin.java.bak
 */
@CapacitorPlugin(name = "GemmaLocal")
public class GemmaPlugin extends Plugin {

    private static final String TAG = "GemmaPlugin";
    private static final String NOT_AVAILABLE =
        "Gemma not available in this build (requires Java 21 toolchain)";

    @PluginMethod
    public void initialize(PluginCall call) {
        Log.i(TAG, "initialize() called — stub returning not-available");
        JSObject result = new JSObject();
        result.put("success", false);
        result.put("error", NOT_AVAILABLE);
        call.resolve(result);
    }

    @PluginMethod
    public void generate(PluginCall call) {
        call.reject(NOT_AVAILABLE);
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject result = new JSObject();
        result.put("isReady", false);
        result.put("isInitializing", false);
        result.put("modelPath", (String) null);
        result.put("modelExists", false);
        result.put("defaultModelPath", "");
        call.resolve(result);
    }

    @PluginMethod
    public void downloadModel(PluginCall call) {
        call.reject(NOT_AVAILABLE);
    }
}
