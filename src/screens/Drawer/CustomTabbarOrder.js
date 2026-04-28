import React, { memo } from "react";
import { View, TouchableOpacity, StyleSheet, Text } from "react-native";

const CustomTabBarOrder = memo(({ navigationState, jumpTo }) => {
  return (
    <View style={tabStyles.tabBarWrapper}>
      {navigationState.routes.map((route, idx) => {
        const isActive = navigationState.index === idx;
        return (
          <TouchableOpacity
            key={route.key}
            style={[
              tabStyles.tabItem,
              { backgroundColor: isActive ? "#29A400" : "#F4F4F4" },
            ]}
            activeOpacity={0.9}
            onPress={() => jumpTo(route.key)}
          >
            <Text
              style={[
                tabStyles.tabLabel,
                { color: isActive ? "#FFFFFF" : "#808080" },
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
    flexDirection: "row",
    marginVertical: 14,
    marginHorizontal:0,
    justifyContent: "center",
  },
  tabItem: {
    flex: 1,
    paddingVertical: 10,
    justifyContent: "center",
    alignItems: "center",
    height: 38,
  },
  tabLabel: {
    fontSize: 12,
    fontFamily: "Poppins-Medium",
    textAlign: "center",
  },
});

export default CustomTabBarOrder;
