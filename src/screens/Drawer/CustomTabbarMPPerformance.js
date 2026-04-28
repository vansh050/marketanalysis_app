import React, { memo } from "react";
import { View, TouchableOpacity, StyleSheet, Text } from "react-native";
import { Lock } from "lucide-react-native"; // Using lucide for lock icon

const CustomTabBarMPPerformance = memo(({ navigationState, jumpTo, isSubscriptionActive }) => {
  return (
    <View style={tabStyles.tabBarWrapper}>
      {navigationState.routes.map((route, idx) => {
        const isActive = navigationState.index === idx;

        // Disable first tab if subscription is active
        const isDisabled = idx === 0 && isSubscriptionActive;

        return (
          <TouchableOpacity
            key={route.key}
            style={[
              tabStyles.tabItem,
              { backgroundColor: isActive ? "#29A400" : "#F4F4F4" },
              isDisabled && { opacity: 0.5 }, // visually indicate disabled
            ]}
            activeOpacity={isDisabled ? 1 : 0.9} // prevent press feedback
             onPress={() => jumpTo(route.key)}
          >
            <View style={tabStyles.tabContent}>
              {isDisabled && <Lock size={14} color={ isActive ? "#FFFFFF" : "#808080"} style={{ marginRight: 5 }} />}
              <Text
                style={[
                  tabStyles.tabLabel,
                  { color: isActive ? "#FFFFFF" : "#808080" },
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
    flexDirection: "row",
    marginVertical: 14,
    justifyContent: "center",
  },
  tabItem: {
    flex: 1,
    paddingVertical: 10,
    justifyContent: "center",
    alignItems: "center",
    height: 38,
  },
  tabContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  tabLabel: {
    fontSize: 12,
    fontFamily: "Poppins-Medium",
    textAlign: "center",
  },
});

export default CustomTabBarMPPerformance;
