package com.aq.marketanalysis

import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.views.modal.ReactModalHostView

/** Applies a keyboard mode to one identified React Native Modal dialog. */
class ModalSoftInputModule(
    reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "ModalSoftInput"

  @ReactMethod
  fun setAdjustPan(testId: String, promise: Promise) {
    val activity = currentActivity
    if (activity == null) {
      promise.resolve(false)
      return
    }
    activity.runOnUiThread {
      val modalWindow = findModal(activity.window.decorView, testId)?.dialog?.window
      if (modalWindow == null) {
        promise.resolve(false)
      } else {
        modalWindow.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_PAN)
        promise.resolve(true)
      }
    }
  }

  /** Configure the exact React Native Modal host under Fabric. */
  @ReactMethod
  fun setAdjustPanForTag(reactTag: Int, promise: Promise) {
    val activity = currentActivity
    if (activity == null) {
      promise.resolve(false)
      return
    }
    activity.runOnUiThread {
      val modal = try {
        UIManagerHelper
            .getUIManagerForReactTag(reactApplicationContext, reactTag)
            ?.resolveView(reactTag) as? ReactModalHostView
      } catch (_: Exception) {
        null
      }
      val modalWindow = modal?.dialog?.window
      if (modalWindow == null) {
        promise.resolve(false)
      } else {
        modalWindow.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_PAN)
        promise.resolve(true)
      }
    }
  }

  private fun findModal(view: View, testId: String): ReactModalHostView? {
    if (
        view is ReactModalHostView &&
            view.getTag(com.facebook.react.R.id.react_test_id) == testId
    ) {
      return view
    }
    if (view !is ViewGroup) return null

    for (index in 0 until view.childCount) {
      findModal(view.getChildAt(index), testId)?.let { return it }
    }
    return null
  }
}
