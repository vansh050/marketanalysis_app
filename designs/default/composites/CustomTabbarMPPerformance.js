/**
 * CustomTabbarMPPerformance — design-system composite presentation (Phase I, 2026-05-02)
 *
 * Pure presentation (memo component). No hooks, no side-effects, props-only.
 * Container passes the same props that react-native-tab-view's renderTabBar
 * provides, plus an `isSubscriptionActive` flag for the lock icon.
 *
 * Contract:
 *   Props (flat — not viewModel/actions, since this is a memo leaf):
 *     navigationState  — { index, routes: [{ key, title }] }
 *     jumpTo           — (key: string) => void
 *     isSubscriptionActive — boolean — when true, the PORTFOLIO tab is locked (premium gate active = user not subscribed). Keyed by route.key, not index.
 */

import React, { memo } from 'react';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { Lock } from 'lucide-react-native';

const CustomTabBarMPPerformance = memo(({ navigationState, jumpTo, isSubscriptionActive }) => {
  return (
    <View style={tabStyles.tabBarWrapper}>
      {navigationState.routes.map((route, idx) => {
        const isActive = navigationState.index === idx;

        // Lock only the PORTFOLIO tab (premium content) by key when the
        // premium gate is active (user not subscribed). Keyed, not index-based,
        // so the tab order can change (Overview is index 0) without locking the
        // wrong tab. Overview + Research stay visible.
        const isDisabled = route.key === 'portfolio' && isSubscriptionActive;

        return (
          <TouchableOpacity
            key={route.key}
            style={[
              tabStyles.tabItem,
              { backgroundColor: isActive ? '#29A400' : '#F4F4F4' },
              isDisabled && { opacity: 0.5 },
            ]}
            activeOpacity={isDisabled ? 1 : 0.9}
            onPress={() => jumpTo(route.key)}
          >
            <View style={tabStyles.tabContent}>
              {isDisabled && <Lock size={14} color={isActive ? '#FFFFFF' : '#808080'} style={{ marginRight: 5 }} />}
              <Text
                style={[
                  tabStyles.tabLabel,
                  { color: isActive ? '#FFFFFF' : '#808080' },
                ]}
              >
                {route.title}
              </Text>
            </View>
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
    justifyContent: 'center',
  },
  tabItem: {
    flex: 1,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
    height: 38,
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabLabel: {
    fontSize: 12,
    fontFamily: 'Poppins-Medium',
    textAlign: 'center',
  },
});

export default CustomTabBarMPPerformance;
