/**
 * CustomTabBarOrder — container (Phase G, 2026-05-02)
 *
 * Transparent adapter from TabView's ({ navigationState, jumpTo }) props
 * to the design-system viewModel/actions contract. Renders presentation
 * resolved as `screens.CustomTabBarOrder`.
 */

import React, { memo } from 'react';
import { useComponent } from '../../design/useDesign';

const CustomTabBarOrder = memo(({ navigationState, jumpTo }) => {
    const Presentation = useComponent('screens.CustomTabBarOrder');

    return (
        <Presentation
            viewModel={{ navigationState }}
            actions={{ jumpTo }}
        />
    );
});

export default CustomTabBarOrder;
