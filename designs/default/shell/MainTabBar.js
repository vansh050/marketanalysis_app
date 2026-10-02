import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity} from 'react-native';
import {
  Home,
  User,
  FileText,
  Briefcase,
  Newspaper,
  Clipboard,
  Bookmark,
} from 'lucide-react-native';

// Icon names from the navigation manifest (`tabs[].icon`). Legacy route-name
// keys are kept so a caller that passes no `icon` still resolves.
const ICONS = {
  home: Home,
  more: User,
  orders: FileText,
  portfolio: Briefcase,
  news: Newspaper,
  plans: Clipboard,
  watchlist: Bookmark,
  Home,
  More: User,
  Orders: FileText,
  Portfolio: Briefcase,
  News: Newspaper,
  Plans: Clipboard,
};

const MainTabBar = ({viewModel = {}, actions = {}}) => {
  const {
    items = [],
    activeColor = '#0056B7',
    inactiveColor = 'gray',
    backgroundColor = '#FFFFFF',
    borderTopWidth = 1,
    borderTopColor = '#e9e9e9',
    bottomInset = 0,
    height = 60,
  } = viewModel;
  const {onSelect = () => {}, onLongPress = () => {}} = actions;

  return (
    <View
      style={[
        styles.bar,
        {
          height: height + bottomInset,
          paddingBottom: bottomInset,
          backgroundColor,
          borderTopWidth,
          borderTopColor,
        },
      ]}>
      {items.map(item => {
        const IconComponent = ICONS[item.icon] || ICONS[item.name] || FileText;
        const color = item.focused ? activeColor : inactiveColor;
        return (
          <TouchableOpacity
            key={item.key}
            accessibilityRole="button"
            accessibilityState={item.focused ? {selected: true} : {}}
            accessibilityLabel={item.accessibilityLabel}
            testID={item.testID}
            activeOpacity={0.75}
            style={styles.item}
            onPress={() => onSelect(item)}
            onLongPress={() => onLongPress(item)}>
            <IconComponent size={22} color={color} />
            <Text style={[styles.label, {color}]}>{item.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    zIndex: 99,
    elevation: 99,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 8,
  },
  label: {
    marginTop: 2,
    fontSize: 10,
    textAlign: 'center',
    fontFamily: 'Satoshi-Medium',
  },
});

export default MainTabBar;
