# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:
-keep class com.lugg.ReactNativeConfig.** { *; }

# R8 is on for release builds (escape hatch -PenableR8=false). Most libraries
# ship their own consumer rules; these cover the payment SDKs and other code
# loaded by reflection, and silence desktop-JVM references in Jackson/jjwt.
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod
-keep class com.razorpay.** { *; }
-dontwarn com.razorpay.**
-keepclasseswithmembers class * { public void onPayment*(...); }
-optimizations !method/inlining/*
-keep class com.cashfree.** { *; }
-dontwarn com.cashfree.**
-keep class com.facebook.hermes.unicode.** { *; }
-keep class com.facebook.jni.** { *; }
-keep class com.microsoft.codepush.react.** { *; }
-keep class com.aq.marketanalysis.** { *; }
-dontwarn java.beans.**
-dontwarn javax.xml.bind.**
-dontwarn org.w3c.dom.bootstrap.**
-keep class com.fasterxml.jackson.** { *; }
-keep class io.jsonwebtoken.** { *; }
-keep class com.android.installreferrer.** { *; }
-keep class com.swmansion.worklets.** { *; }
