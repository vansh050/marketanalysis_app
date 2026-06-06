/**
 * LogOutScreen — design-system screen presentation (Phase F, 2026-05-01)
 *
 * Pure presentation. The container handles the Firebase + GoogleSignin +
 * AsyncStorage + context-state-reset orchestration; this just renders the
 * "Logging out..." spinner.
 *
 * Contract:
 *   viewModel = { gradient: { start, end } }
 *   actions   = {}  (no user-triggered actions; logout fires on mount in container)
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import useTokens from '../../../src/theme/useTokens';
import Text from '../primitives/Text';
import Spinner from '../primitives/Spinner';

const LogOutScreen = ({ viewModel }) => {
    const tokens = useTokens();
    const gradient = viewModel?.gradient || {};
    return (
        <LinearGradient
            colors={[
                gradient.start || tokens.colors.brand.gradientStart,
                gradient.end || tokens.colors.brand.gradientEnd,
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.container}
        >
            <View style={styles.content}>
                <Text
                    variant="subtitle"
                    style={{ color: tokens.colors.text.inverse, marginRight: tokens.spacing.xl }}
                >
                    Logging out...
                </Text>
                <Spinner size="large" color={tokens.colors.text.inverse} />
            </View>
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    content: { flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center' },
});

export default LogOutScreen;
