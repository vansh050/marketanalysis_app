/**
 * EmptyStateMP — container (Phase I, 2026-05-02)
 *
 * Owns: useConfig (theme colors).
 * Resolves presentation from `composites.EmptyStateMP`.
 */

import React from 'react';
import { useComponent } from '../../design/useDesign';
import { useConfig } from '../../context/ConfigContext';

const EmptyStateInfoMP = ({
  title = 'Premium Access Required',
  subtitle = 'Purchase this plan to view all distributions and unlock advanced insights.',
}) => {
  const config = useConfig();
  const themeColor = config?.themeColor || '#0056B7';
  const mainColor = config?.mainColor || '#002651';

  const Presentation = useComponent('composites.EmptyStateMP');

  return (
    <Presentation
      viewModel={{
        title,
        subtitle,
        themeColor,
        mainColor,
      }}
    />
  );
};

export default EmptyStateInfoMP;
