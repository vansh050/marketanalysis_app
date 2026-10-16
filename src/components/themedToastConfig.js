/**
 * Toast config for the root <Toast />.
 *
 * Same layout as react-native-toast-message's built-in success/error/info
 * toasts. Colours are named design tokens (toast.*) whose default values are
 * the library's own (#FFF panel, #000 / #979797 text, #69C779 / #FE6301 /
 * #87CEFA accents), so the default design renders the library default; a
 * dark design (Kyzen) sets its own values in designs/<variant>/tokens/
 * hostTokens.json.
 */
import React from 'react';
import { BaseToast } from 'react-native-toast-message';
import { designToken } from '../design/literalTokens';

const themed = accent => props => (
    <BaseToast
        {...props}
        style={{ borderLeftColor: accent, backgroundColor: designToken('toast.background') }}
        text1Style={{ color: designToken('toast.text') }}
        text2Style={{ color: designToken('toast.subtext') }}
    />
);

const themedToastConfig = {
    success: themed(designToken('toast.success')),
    error: themed(designToken('toast.error')),
    info: themed(designToken('toast.info')),
};

export default themedToastConfig;
