/**
 * useNavigationLayout — resolves the active variant's navigation manifest.
 *
 * Reads the merged manifest from the design bundle (resolveDesign merges a
 * variant's navigation keys over designs/default), resolves it against the
 * screen catalog with runtime show/hide flags, and reports manifest warnings
 * once per app session as a `nav_manifest_warning` frontend anomaly.
 *
 * Design: docs/CONFIGURABLE_NAVIGATION_DESIGN.md §4.3.
 */

import {useMemo} from 'react';
import {useDesign} from '../design/useDesign';
import {VARIANTS, DEFAULT_VARIANT_NAME} from '../../designs/registry';
import {resolveNavigation} from './resolveNavigation';
import {logFrontendAnomaly} from '../utils/Logging';

const reported = new Set();

const flagsKey = flags =>
    Object.keys(flags || {})
        .sort()
        .map(key => `${key}:${flags[key] ? 1 : 0}`)
        .join('|');

export function useNavigationLayout(flags = {}) {
    const {navigation: manifest, variant} = useDesign();
    const key = flagsKey(flags);
    return useMemo(() => {
        const layout = resolveNavigation(manifest, {
            defaultManifest: VARIANTS[DEFAULT_VARIANT_NAME]?.navigation || {},
            flags,
        });
        const fresh = layout.warnings.filter(w => !reported.has(`${variant}:${w}`));
        if (fresh.length) {
            fresh.forEach(w => reported.add(`${variant}:${w}`));
            console.warn('[navigation] manifest warnings:', fresh);
            logFrontendAnomaly('nav_manifest_warning', 'warning', {variant, warnings: fresh});
        }
        return layout;
        // flags are compared by value via `key`
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [manifest, variant, key]);
}

export default useNavigationLayout;
