/**
 * Toast — design-system primitive (imperative API)
 *
 * Wraps `react-native-toast-message`'s `Toast.show` with a semantic-variant
 * surface. Unlike the other primitives this is NOT a React component — it's an
 * imperative `show(message, variant)` function. The actual `<Toast />` host
 * component (from `react-native-toast-message`) is mounted once at app root in
 * App.js — this primitive just calls into it.
 *
 * Variants: info | success | warning | error
 * (defaults: info)
 *
 * Existing call sites that import `src/components/customToast.js` continue to
 * work unchanged. New code SHOULD prefer this primitive (registered in the
 * design registry as `primitives.Toast`).
 */

import RNToast from 'react-native-toast-message';

const VARIANT_TO_RN_TYPE = {
    info: 'info',
    success: 'success',
    warning: 'error',     // react-native-toast-message has no 'warning' type by default; map to 'error'
    error: 'error',
};

const DEFAULT_TITLE_BY_VARIANT = {
    info: 'Info',
    success: 'Success',
    warning: 'Warning',
    error: 'Error',
};

const show = (message, variant = 'info', options = {}) => {
    const rnType = VARIANT_TO_RN_TYPE[variant] || VARIANT_TO_RN_TYPE.info;
    RNToast.show({
        type: rnType,
        text1: options.title || DEFAULT_TITLE_BY_VARIANT[variant] || 'Notification',
        text2: typeof message === 'string' ? message : undefined,
        position: options.position,
        visibilityTime: options.visibilityTime,
        autoHide: options.autoHide,
        onPress: options.onPress,
        onShow: options.onShow,
        onHide: options.onHide,
    });
};

const hide = () => RNToast.hide();

const Toast = { show, hide };

export default Toast;
export { show, hide };
