# XitChat ProGuard Rules for Release Build

# Keep Capacitor core classes
-keep class com.getcapacitor.** { *; }
-keepclassmembers class com.getcapacitor.** { *; }

# Keep our custom plugins
-keep class com.xitchat.app.BluetoothMeshPlugin { *; }
-keep class com.xitchat.app.WiFiDirectPlugin { *; }

# Keep Capacitor plugin annotations
-keep @com.getcapacitor.annotation.CapacitorPlugin class * {
    @com.getcapacitor.PluginMethod <methods>;
}

# Keep JavaScript interface methods
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep WebView classes
-keep class android.webkit.** { *; }
-keepclassmembers class android.webkit.** { *; }

# Keep Bluetooth classes
-keep class android.bluetooth.** { *; }
-keepclassmembers class android.bluetooth.** { *; }

# Keep WiFi Direct classes
-keep class android.net.wifi.p2p.** { *; }
-keepclassmembers class android.net.wifi.p2p.** { *; }

# Keep native methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# Keep custom view constructors
-keepclasseswithmembers class * {
    public <init>(android.content.Context, android.util.AttributeSet);
}

# Keep enums
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# Keep Parcelable implementations
-keep class * implements android.os.Parcelable {
    public static final android.os.Parcelable$Creator *;
}

# Keep Serializable classes
-keepclassmembers class * implements java.io.Serializable {
    static final long serialVersionUID;
    private static final java.io.ObjectStreamField[] serialPersistentFields;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
    java.lang.Object writeReplace();
    java.lang.Object readResolve();
}

# Remove logging in release builds
-assumenosideeffects class android.util.Log {
    public static *** d(...);
    public static *** v(...);
    public static *** i(...);
}

# Keep crash reporting
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# Optimization settings
-optimizationpasses 5
-dontusemixedcaseclassnames
-dontskipnonpubliclibraryclasses
-verbose

# Keep annotations
-keepattributes *Annotation*
-keepattributes Signature
-keepattributes Exceptions

# Keep Google Play Services (if used)
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.android.gms.**

# Keep AndroidX
-keep class androidx.** { *; }
-keep interface androidx.** { *; }
-dontwarn androidx.**

# Keep Cordova plugins
-keep class org.apache.cordova.** { *; }
-keepclassmembers class org.apache.cordova.** { *; }

# Keep JSON classes
-keepclassmembers class * {
    @com.google.gson.annotations.SerializedName <fields>;
}

# Keep WebRTC if used
-keep class org.webrtc.** { *; }
-dontwarn org.webrtc.**

# Keep Nostr libraries
-keep class nostr.** { *; }
-dontwarn nostr.**

# Keep cryptography classes
-keep class javax.crypto.** { *; }
-keep class java.security.** { *; }
-dontwarn javax.crypto.**
-dontwarn java.security.**
