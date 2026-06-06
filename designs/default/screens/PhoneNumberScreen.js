/**
 * PhoneNumberScreen — design-system screen presentation (Phase F batch 3, 2026-05-01)
 *
 * Pure presentation. Container owns phone validation + axios profile-update
 * + tracking + post-success navigation.
 *
 * Contract:
 *   viewModel = { countryCode, country, phoneNumber, userName,
 *                 showTelegram, userTelegram, isLoading }
 *   actions = { onCountryCodeChange, onCountryChange, onPhoneChange,
 *               onUserNameChange, onTelegramToggle, onTelegramChange,
 *               onProceed }
 */

import React from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import CountryCodeDropdownPicker from 'react-native-dropdown-country-picker';
import LogoSection from '../../../src/components/LogoSection';
import Text from '../primitives/Text';

const PhoneNumberScreen = ({ viewModel, actions }) => {
    const { countryCode = '+91', phoneNumber = '', isLoading = false } = viewModel || {};
    const {
        onCountryCodeChange = () => {},
        onCountryChange = () => {},
        onPhoneChange = () => {},
        onProceed = () => {},
    } = actions || {};

    return (
        <View style={{ flex: 1 }}>
            <View style={styles.container}>
                <LogoSection />
                <CountryCodeDropdownPicker
                    selected={countryCode}
                    setSelected={onCountryCodeChange}
                    setCountryDetails={onCountryChange}
                    phone={phoneNumber}
                    searchTextStyles={{ color: 'black', fontSize: 14 }}
                    phoneStyles={{ padding: 0, color: 'black', fontFamily: 'Satoshi-Medium' }}
                    countryCodeContainerStyles={{ padding: 8 }}
                    setPhone={onPhoneChange}
                    dropdownTextStyles={{ color: 'black', fontFamily: 'Satoshi-Medium' }}
                    countryCodeTextStyles={{ fontSize: 13, fontFamily: 'Satoshi-Medium', color: 'black' }}
                />
                <TouchableOpacity onPress={onProceed} style={styles.button} disabled={isLoading}>
                    {isLoading ? (
                        <ActivityIndicator size="small" color="#fff" />
                    ) : (
                        <Text variant="button" style={styles.buttonText}>Proceed</Text>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', padding: 50, backgroundColor: '#fff' },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'center',
        justifyContent: 'center',
        backgroundColor: '#000',
        padding: 10,
        width: '50%',
        marginTop: 20,
        borderRadius: 5,
        marginBottom: 20,
    },
    buttonText: { color: '#fff', fontSize: 16, marginLeft: 10 },
});

export default PhoneNumberScreen;
