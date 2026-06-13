/**
 * CustomTabbarMPPerformance — container (Phase I, 2026-05-02)
 *
 * Thin pass-through: resolves presentation from
 * `composites.CustomTabbarMPPerformance` and forwards props.
 * This component is a pure memo leaf with no hooks, so the
 * container simply re-exports the design-system version.
 */

import React from 'react';
import { useComponent } from '../../design/useDesign';

export default function CustomTabBarMPPerformanceContainer(props) {
  const Presentation = useComponent('composites.CustomTabbarMPPerformance');
  return <Presentation {...props} />;
}
