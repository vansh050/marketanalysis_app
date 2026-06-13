/**
 * BrandLogo — variant-aware brand-mark renderer.
 *
 * Renders the active variant's brand logo, resolved from the design-system
 * asset token `useTokens().assets.logoPng`. The DesignProvider picks the
 * variant at mount (DESIGN_VARIANT → APP_VARIANT → default), so:
 *   - default variant → AlphaQuark logo (src/assets/logo.png)
 *   - alphanomy fork  → designs/alphanomy/assets/logo.png
 * No variant name is hardcoded here — adding a tenant is purely a
 * designs/<variant>/tokens/assets.js concern. See
 * docs/DESIGN_SYSTEM_ARCHITECTURE.md § Variant assets and
 * docs/WHITELABEL_RECIPE.md.
 *
 * `source` is an optional fallback used only when the variant ships no
 * `assets.logoPng` (keeps the historical `<Image source={...}>` callsites
 * working). For the default variant the token resolves to the same
 * src/assets/logo.png those callsites passed, so behaviour is unchanged.
 *
 * Usage:
 *   import BrandLogo from '.../BrandLogo';
 *   <BrandLogo size={150} style={...} />            // variant brand mark
 *   <BrandLogo source={LegacyLogo} size={30} />     // explicit fallback
 */

import React from 'react';
import { Image } from 'react-native';
import useTokens from '../theme/useTokens';

const BrandLogo = ({ source, size = 56, style, resizeMode = 'contain' }) => {
    const tokens = useTokens();
    const logoSource = tokens?.assets?.logoPng || source;
    return (
        <Image
            source={logoSource}
            style={[{ width: size, height: size }, style]}
            resizeMode={resizeMode}
        />
    );
};

export default BrandLogo;
