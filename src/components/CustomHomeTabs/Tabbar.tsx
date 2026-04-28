import React, { FC } from "react";
import {
  View,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Text,
} from "react-native";
import { useTheme } from "@react-navigation/native";

interface TabBarProps {
  tabNames: string[]; // Fixed the type to be an array of strings
  focusedIndex: number;
  onSetIndex: (index: number) => void;
}

const TabBar: FC<TabBarProps> = ({ tabNames, focusedIndex, onSetIndex }) => {
  const { colors } = useTheme();

  return (
    <View
      style={{
        width: "100%",
        backgroundColor: colors.background,
      }}
    >
      <ScrollView
        contentContainerStyle={{
          backgroundColor: colors.background,
          paddingStart: 8,
        }}
        showsHorizontalScrollIndicator={false}
        horizontal
      >
        {tabNames.map((name: string, index: number) => {
          const isFocused = focusedIndex === index;
          const isWatchlist = name === "+ Watchlist";
          const borderColor = isFocused ? colors.text : colors.border;
          const bgColor = isFocused ? colors.card : colors.background;

          return (
            <TouchableOpacity
              key={index}
              activeOpacity={0.6}
              onPress={() => onSetIndex(index)}
              style={[
                styles.btnStyle,
                {
                  borderColor: borderColor,
                  backgroundColor: bgColor,
                },
              ]}
            >
              <Text>
                {name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  btnStyle: {
    marginHorizontal: 6,
    padding: 10,
    marginVertical: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 0.5,
    paddingHorizontal: 15,
  },
});

export default TabBar;
