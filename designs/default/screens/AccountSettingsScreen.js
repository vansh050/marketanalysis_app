/**
 * AccountSettingsScreen — design-system screen presentation (Phase G batch 2, 2026-05-02)
 *
 * Pure presentation. Container owns useTrade, useConfig, Firebase getAuth,
 * APP_VARIANTS lookup, feature-flag conditional logic (hide change manager).
 *
 * Contract:
 *   viewModel = {
 *     userName, userEmail, imageUrl, userInitials,
 *     menuItems,              // array of { id, title, items: [{ icon, label, onPress, isLogout }] }
 *     gradientStart, gradientEnd,
 *     showBackgroundLogo, backgroundLogo,
 *   }
 *   actions = {
 *     onGoBack,
 *     onNavigateNotifications,
 *   }
 */

import React from 'react';
import {
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    View,
    Text,
    TouchableOpacity,
    Image,
} from 'react-native';
import { ChevronLeft, ChevronRight, Bell } from 'lucide-react-native';
import LinearGradient from 'react-native-linear-gradient';

const AccountSettingsScreen = ({ viewModel, actions }) => {
    const {
        userName = '',
        userEmail = '',
        imageUrl = null,
        userInitials = '',
        menuItems = [],
        gradientStart = '#002651',
        gradientEnd = '#0056B7',
        showBackgroundLogo = false,
        backgroundLogo = null,
    } = viewModel || {};
    const {
        onGoBack = () => {},
        onNavigateNotifications = () => {},
    } = actions || {};

    const renderMenuItem = (item, isLast) => (
        <TouchableOpacity
            key={item.label}
            style={[styles.menuItem, isLast && styles.menuItemLast]}
            onPress={item.onPress}
            activeOpacity={0.7}>
            <View style={styles.menuItemLeft}>
                <View
                    style={[
                        styles.iconContainer,
                        item.isLogout && styles.logoutIconContainer,
                    ]}>
                    <item.icon size={18} color={item.isLogout ? '#FF4444' : '#FFFFFF'} />
                </View>
                <Text style={[styles.menuItemText, item.isLogout && styles.logoutText]}>
                    {item.label}
                </Text>
            </View>
            <ChevronRight size={20} color="#FFFFFF" />
        </TouchableOpacity>
    );

    return (
        <LinearGradient
            colors={[gradientStart, gradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.container}>
            <SafeAreaView style={styles.safeArea}>
                <StatusBar barStyle="light-content" backgroundColor={gradientStart} />

                {showBackgroundLogo && backgroundLogo && (
                    <View style={styles.logoContainer} pointerEvents="none">
                        {typeof backgroundLogo === 'string' ? (
                            <Image
                                source={{ uri: backgroundLogo }}
                                style={[styles.logo, { tintColor: '#FFFFFF', opacity: 0.15 }]}
                                resizeMode="contain"
                            />
                        ) : (
                            <Image
                                source={backgroundLogo}
                                style={[styles.logo, { tintColor: '#FFFFFF', opacity: 0.15 }]}
                                resizeMode="contain"
                            />
                        )}
                    </View>
                )}

                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={onGoBack} style={styles.backButton}>
                        <ChevronLeft size={24} color="#FFFFFF" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Account Settings</Text>
                    <View style={styles.headerRight}>
                        <TouchableOpacity
                            onPress={onNavigateNotifications}
                            style={styles.iconButton}>
                            <View style={styles.iconCircle}>
                                <Bell size={18} color="#FFFFFF" />
                                <View style={styles.notificationDot} />
                            </View>
                        </TouchableOpacity>
                    </View>
                </View>

                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}>
                    {/* Profile Section */}
                    <View style={styles.profileSection}>
                        <View style={styles.profileInfo}>
                            <View style={styles.avatarContainer}>
                                {imageUrl ? (
                                    <Image
                                        source={{ uri: imageUrl }}
                                        style={{ width: 50, height: 50, borderRadius: 25 }}
                                    />
                                ) : (
                                    <Text
                                        style={{
                                            color: '#fff',
                                            fontSize: 20,
                                            marginTop: 2,
                                            fontFamily: 'Poppins-Regular',
                                        }}>
                                        {userInitials}
                                    </Text>
                                )}
                            </View>
                            <View style={styles.userInfo}>
                                <Text style={styles.userName}>{userName}</Text>
                                <Text style={styles.userEmailText}>{userEmail}</Text>
                            </View>
                        </View>
                    </View>

                    {/* Menu Sections */}
                    {menuItems.map(section => (
                        <View key={section.id} style={styles.menuSection}>
                            <Text style={styles.sectionTitle}>{section.title}</Text>
                            <View style={styles.menuContainer}>
                                {section.items
                                    .filter(
                                        it => it.label !== 'Settings' && it.label !== 'Log Out',
                                    )
                                    .map((item, index, arr) =>
                                        renderMenuItem(item, index === arr.length - 1),
                                    )}
                            </View>
                        </View>
                    ))}

                    {/* Separate container for Settings (no label) */}
                    {(() => {
                        const settingsItem = menuItems
                            .flatMap(s => s.items)
                            .find(it => it.label === 'Settings');
                        if (!settingsItem) return null;
                        return (
                            <View style={styles.menuSection}>
                                <View style={styles.menuContainer}>
                                    {renderMenuItem(settingsItem, true)}
                                </View>
                            </View>
                        );
                    })()}

                    {/* Separate container for Log Out (no label) */}
                    {(() => {
                        const logoutItem = menuItems
                            .flatMap(s => s.items)
                            .find(it => it.label === 'Log Out');
                        if (!logoutItem) return null;
                        return (
                            <View style={styles.menuSection}>
                                <View style={styles.menuContainer}>
                                    {renderMenuItem(logoutItem, true)}
                                </View>
                            </View>
                        );
                    })()}
                </ScrollView>
            </SafeAreaView>
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    safeArea: {
        flex: 1,
    },
    logoContainer: {
        position: 'absolute',
        top: 20,
        right: 20,
        zIndex: 0,
        opacity: 1,
    },
    logo: {
        width: 220,
        height: 220,
        color: '#FFFFFF',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        zIndex: 1,
    },
    backButton: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#FFFFFF',
        flex: 1,
        marginLeft: 16,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    iconButton: {
        padding: 4,
    },
    iconCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    notificationDot: {
        position: 'absolute',
        top: 4,
        right: 4,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#FF4444',
    },
    scrollView: {
        flex: 1,
        zIndex: 1,
    },
    scrollContent: {
        paddingBottom: 32,
    },
    profileSection: {
        paddingHorizontal: 20,
        paddingVertical: 24,
    },
    profileInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatarContainer: {
        width: 40,
        height: 40,
        borderWidth: 1,
        borderColor: '#c8c8c8',
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 20,
        backgroundColor: 'transparent',
    },
    userInfo: {
        flex: 1,
    },
    userName: {
        fontSize: 18,
        fontWeight: '600',
        color: '#FFFFFF',
        marginBottom: 4,
    },
    userEmailText: {
        fontSize: 13,
        color: 'rgba(255, 255, 255, 0.7)',
    },
    menuSection: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: 'rgba(255, 255, 255, 0.6)',
        paddingHorizontal: 20,
        marginBottom: 12,
    },
    menuContainer: {
        marginHorizontal: 16,
        paddingHorizontal: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 5,
        overflow: 'hidden',
        borderWidth: 0.5,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 0,
        borderBottomWidth: 0.5,
        borderBottomColor: '#FFFFFF',
    },
    menuItemLast: {
        borderBottomWidth: 0,
        borderBottomColor: 'transparent',
    },
    menuItemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    iconContainer: {
        width: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    logoutIconContainer: {},
    menuItemText: {
        fontSize: 14,
        color: '#FFFFFF',
    },
    logoutText: {
        color: '#FFFFFF',
    },
});

export default AccountSettingsScreen;
