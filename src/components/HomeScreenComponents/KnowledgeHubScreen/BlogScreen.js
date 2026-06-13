/**
 * BlogScreen — container (Phase G batch 3, 2026-05-02)
 *
 * Thin wrapper. Renders presentation resolved from `screens.BlogScreen`.
 */

import React from 'react';
import { useComponent } from '../../../design/useDesign';

const BlogScreen = ({ navigation, route }) => {
    const Presentation = useComponent('screens.BlogScreen');

    return (
        <Presentation
            viewModel={{ navigation }}
            actions={{}}
        />
    );
};

export default BlogScreen;
