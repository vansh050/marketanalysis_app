import React from 'react';

/**
 * Default no-op for the Home-screen `composites.HomeFooter` slot. Forks that
 * need a custom Home footer (e.g. brand + regulatory disclosures) override
 * this composite in their design variant. Registered in designs/default/
 * index.js so that `useComponent('composites.HomeFooter')` in the design
 * HomeScreen never throws.
 */
const HomeFooter = () => null;

export default HomeFooter;