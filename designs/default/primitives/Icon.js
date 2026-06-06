/**
 * Icon — design-system primitive
 *
 * Thin wrapper around a lucide-react-native icon. The caller imports the
 * specific icon component and passes it via the `Component` prop, which keeps
 * Metro tree-shaking working (a wildcard registry would force every lucide
 * icon into the bundle).
 *
 * Default size: 20. Default color: tokens.colors.text.primary.
 *
 * Usage:
 *   import { Search } from 'lucide-react-native';
 *   import Icon from '.../primitives/Icon';
 *   <Icon Component={Search} />
 *
 * To swap the icon set in a custom variant: re-export your own `Icon` from
 * `designs/<variant>/primitives/Icon.js` that takes the same `Component`
 * prop but resolves it through your set's mapping. The signature stays the
 * same so call sites don't change.
 */

import React from 'react';
import useTokens from '../../../src/theme/useTokens';

const Icon = ({ Component, size, color, style, ...rest }) => {
    const tokens = useTokens();
    if (!Component) {
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
            console.warn('[Icon] missing required `Component` prop — pass an icon component (e.g. lucide-react-native\'s `Search`).');
        }
        return null;
    }
    return (
        <Component
            size={size ?? 20}
            color={color ?? tokens.colors.text.primary}
            style={style}
            {...rest}
        />
    );
};

export default Icon;
