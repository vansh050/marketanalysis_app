package com.aq.marketanalysis

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.load
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.soloader.SoLoader
import com.facebook.react.soloader.OpenSourceMergedSoMapping
import com.oblador.vectoricons.VectorIconsPackage;
import com.microsoft.codepush.react.CodePush

class MainApplication : Application(), ReactApplication {

  private fun clearRetainedOtaAfterBinaryChange() {
    if (BuildConfig.DEBUG) return

    val preferences = getSharedPreferences("aq_native_bundle_baseline", MODE_PRIVATE)
    val currentVersionCode = BuildConfig.VERSION_CODE.toLong()
    val previousVersionCode = preferences.getLong("native_version_code", -1L)
    if (previousVersionCode != currentVersionCode) {
      CodePush.getInstance(
        getString(R.string.CodePushDeploymentKey),
        applicationContext,
        false,
      ).clearUpdates()
      preferences.edit().putLong("native_version_code", currentVersionCode).apply()
    }
  }

  override val reactNativeHost: ReactNativeHost =
      object : DefaultReactNativeHost(this) {
        override fun getPackages(): List<ReactPackage> =
            PackageList(this).packages.apply {
              add(ModalSoftInputPackage())
            }

        override fun getJSMainModuleName(): String = "index"

        override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

        override fun getJSBundleFile(): String? =
            if (BuildConfig.DEBUG) null else CodePush.getJSBundleFile()

        override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
        override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
      }

  override val reactHost: ReactHost
    get() = getDefaultReactHost(applicationContext, reactNativeHost)

  override fun onCreate() {
    super.onCreate()
    clearRetainedOtaAfterBinaryChange()
    SoLoader.init(this, OpenSourceMergedSoMapping)
    if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
      load()
    }
  }
}
