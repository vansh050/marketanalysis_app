/**
 * CustomTabBarOrder — design-system screen presentation (Phase G, 2026-05-02)
 *
 * Pure stateless tab bar. Container is a transparent passthrough that resolves
 * this via the registry.
 *
 * Contract:
 *   viewModel = { navigationState }
 *   actions   = { jumpTo }
 */

import React, { memo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import Text from '../primitives/Text';

const CustomTabBarOrder = memo(({ viewModel, actions }) => {
    const { navigationState } = viewModel || {};
    const { jumpTo = () => {} } = actions || {};

    if (!navigationState) return null;

    return (
        <View style={tabStyles.tabBarWrapper}>
            {navigationState.routes.map((route, idx) => {
                const isActive = navigationState.index === idx;
                return (
                    <TouchableOpacity
                        key={route.key}
                        style={[
                            tabStyles.tabItem,
                            { backgroundColor: isActive ? '#29A400' : '#F4F4F4' },
                        ]}
                        activeOpacity={0.9}
                        onPress={() => jumpTo(route.key)}
                    >
                        <Text
                            variant="body"
                            style={[
                                tabStyles.tabLabel,
                                { color: isActive ? '#FFFFFF' : '#808080' },
                            ]}
                        >
                            {route.title}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
});

const tabStyles = StyleSheet.create({
    tabBarWrapper: {
        flexDirection: 'row',
        marginVertical: 14,
        marginHorizontal: 0,
        justifyContent: 'center',
    },
    tabItem: {
        flex: 1,
        paddingVertical: 10,
        justifyContent: 'center',
        alignItems: 'center',
        height: 38,
    },
    tabLabel: {
        fontSize: 12,
        fontFamily: 'Poppins-Medium',
        textAlign: 'center',
    },
});

export default CustomTabBarOrder;
