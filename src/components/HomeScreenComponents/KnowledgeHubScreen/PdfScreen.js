/**
 * PdfScreen — container (Phase G batch 3, 2026-05-02)
 *
 * Thin wrapper. Renders presentation resolved from `screens.PdfScreen`.
 */

import React from 'react';
import { useComponent } from '../../../design/useDesign';

const PdfScreen = ({ navigation, route }) => {
    const Presentation = useComponent('screens.PdfScreen');

    return (
        <Presentation
            viewModel={{ navigation }}
            actions={{}}
        />
    );
};

export default PdfScreen;
