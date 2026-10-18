# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Preserve JavascriptInterface for WebView bridges (such as AndroidPrinter)
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Preserve Capacitor Bridge, Cordova and Plugins
-keep class com.getcapacitor.** { *; }
-keep interface com.getcapacitor.** { *; }
-keep public class * extends com.getcapacitor.Plugin
-keep public class * extends com.getcapacitor.BridgeActivity
-keep public class * extends org.apache.cordova.CordovaPlugin

-keepattributes *Annotation*
-keepattributes JavascriptInterface
-dontwarn com.getcapacitor.**
-dontwarn org.apache.cordova.**
