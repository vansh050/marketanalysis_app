/**
 * VideoScreen — container (Phase G batch 3, 2026-05-02)
 *
 * Thin wrapper. Renders presentation resolved from `screens.VideoScreen`.
 */

import React from 'react';
import { useComponent } from '../../../design/useDesign';

const VideoScreen = ({ navigation, route }) => {
    const Presentation = useComponent('screens.VideoScreen');

    return (
        <Presentation
            viewModel={{ navigation }}
            actions={{}}
        />
    );
};

export default VideoScreen;
