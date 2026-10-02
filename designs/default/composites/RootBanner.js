import React from 'react';

/**
 * Default no-op for the app-root `composites.RootBanner` slot. Forks that
 * need a persistent banner (e.g. a regulatory strip) override this composite
 * in their design variant. Registered in designs/default/index.js so that
 * `useComponent('composites.RootBanner')` in App.js never throws.
 */
const RootBanner = () => null;

export default RootBanner;