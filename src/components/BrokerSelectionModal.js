/**
 * BrokerSelectionModal — container (Phase H, 2026-05-02)
 *
 * Owns all broker-selection business logic: user details fetch, broker
 * status tracking, smart-reauth routing, Groww silent refresh, Angel One
 * cautionary warning gating, unavailable-broker search + vote, and the
 * broker-connected / token-expire state machine.
 *
 * Delegates rendering to the design-system presentation resolved as
 * `composites.BrokerSelectionModal`.
 *
 * Legacy prop signature preserved:
 *   { showBrokerModal, setShowBrokerModal, OpenTokenExpireModel,
 *     setOpenTokenExpireModel, handleAcceptRebalanceWithoutBroker,
 *     handleBrokerConnectedContinue }
 */

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { getAuth } from '@react-native-firebase/auth';
import Config from 'react-native-config';
import server from '../utils/serverConfig';
import { generateToken } from '../utils/SecurityTokenManager';
import useModalStore from '../GlobalUIModals/modalStore';
import { useTrade } from '../screens/TradeContext';
import { useConfig } from '../context/ConfigContext';
import {getAdvisorSubdomain, getTenantSubdomain} from '../utils/variantHelper';
import { registerCallback } from '../utils/brokerAuth';
import { brokerDisplayConfig } from '../config/brokerDisplayConfig';
import { handleSmartReauth, flipPrimaryBroker } from '../utils/reauthHelpers';
import { refreshGrowwSession } from '../utils/growwRefresh';
import eventEmitter from './EventEmitter';
import AngelOneCautionaryWarning from './AngelOneCautionaryWarning';
import { useComponent } from '../design/useDesign';
import {getAccountEmail} from '../utils/accountEmail';
import {hasDeviceTotp} from '../services/DeviceTotpVault';
import {hasAliceBlueDeviceLogin} from '../services/DeviceBrokerLoginVault';

const DEVICE_TOTP_AUTO_RECONNECT = Object.freeze({
    'Angel One': {broker: 'Angel One', modalKey: 'Angel One'},
    AngelOne: {broker: 'Angel One', modalKey: 'Angel One'},
    Zerodha: {broker: 'Zerodha', modalKey: 'Zerodha'},
    Fyers: {broker: 'Fyers', modalKey: 'Fyers'},
    Motilal: {broker: 'Motilal Oswal', modalKey: 'Motilal'},
    'Motilal Oswal': {broker: 'Motilal Oswal', modalKey: 'Motilal'},
    // Dhan Direct API: DhanConnectModal auto-unlocks a saved PIN+TOTP when
    // the account is on direct_api. AliceBlue keeps its partner-login vault
    // in DeviceBrokerLoginVault, not the TOTP vault (2026-10-02).
    Dhan: {broker: 'Dhan', modalKey: 'Dhan'},
    AliceBlue: {broker: 'AliceBlue', modalKey: 'AliceBlue', vault: 'aliceblue'},
    'Alice Blue': {broker: 'AliceBlue', modalKey: 'AliceBlue', vault: 'aliceblue'},
});

const BrokerSelectionModal = ({
    showBrokerModal,
    setShowBrokerModal,
    OpenTokenExpireModel,
    setOpenTokenExpireModel,
    handleAcceptRebalanceWithoutBroker,
    handleBrokerConnectedContinue,
    onReconnectCancel,
}) => {
    const Presentation = useComponent('composites.BrokerSelectionModal');
    const {
        brokerStatus: globalBrokerStatus,
        configData,
        userDetails: tradeUserDetails,
        fetchBrokerStatusModal,
    } = useTrade();
    const freshConfig = useConfig();
    const openModal = useModalStore((state) => state.openModal);
    const showModalAlert = useModalStore((state) => state.showAlert);

    const brokerConnectRedirectURL =
        freshConfig?.REACT_APP_BROKER_CONNECT_REDIRECT_URL ||
        configData?.config?.REACT_APP_BROKER_CONNECT_REDIRECT_URL ||
        '';

    const brokersmain = brokerDisplayConfig;

    const [pressedBroker, setPressedBroker] = useState(null);
    const [userDetails, setUserDetails] = useState();
    const auth = getAuth();
    const user = auth.currentUser;
    const userEmail = getAccountEmail();
    const [loginLoading, setLoginLoading] = useState(false);
    const [continueWithoutBrokerLoading, setContinueWithoutBrokerLoading] = useState(false);
    const [brokerStatus, setBrokerStatus] = useState(
        userDetails ? userDetails.connect_broker_status : null,
    );
    const [showMessage, setShowMessage] = useState(false);
    const [showLetUsKnow, setShowLetUsKnow] = useState(false);
    const [brokerSearchText, setBrokerSearchText] = useState('');
    const [allBrokers, setAllBrokers] = useState([]);
    const [selectedUnavailableBroker, setSelectedUnavailableBroker] = useState(null);
    const [brokerConnected, setBrokerConnected] = useState(false);
    const [connectingBroker, setConnectingBroker] = useState(false);
    const [pendingAngelOneBroker, setPendingAngelOneBroker] = useState(null);
    const autoReconnectAttemptRef = useRef(null);

    useEffect(() => {
        if (globalBrokerStatus === 'connected' && showBrokerModal) {
            setBrokerConnected(true);
            setConnectingBroker(false);
        }
    }, [globalBrokerStatus, showBrokerModal]);

    const getUserDeatils = () => {
        axios
            .get(`${server.server.baseUrl}api/user/getUser/${userEmail}`, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Advisor-Subdomain': getTenantSubdomain(),
                    'aq-encrypted-key': generateToken(
                        Config.REACT_APP_AQ_KEYS,
                        Config.REACT_APP_AQ_SECRET,
                    ),
                },
            })
            .then((res) => {
                setUserDetails(res.data.User);
                setBrokerStatus(res.data.User.connect_broker_status);
            })
            .catch((err) => console.log(err));
    };

    useEffect(() => {
        if (userEmail) {
            getUserDeatils();
        }
    }, [userEmail]);

    useEffect(() => {
        const dismissVerifiedReconnect = () => {
            setOpenTokenExpireModel(false);
        };
        eventEmitter.on('brokerConnectionVerified', dismissVerifiedReconnect);
        return () => {
            eventEmitter.removeListener(
                'brokerConnectionVerified',
                dismissVerifiedReconnect,
            );
        };
    }, [setOpenTokenExpireModel]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setShowMessage(true);
        }, 1000);
        return () => clearTimeout(timer);
    }, []);

    const fetchAllBrokers = async () => {
        try {
            const response = await axios.get(
                `${server.ccxtServer.baseUrl}comms/all-brokers`,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Advisor-Subdomain': getTenantSubdomain(),
                        'aq-encrypted-key': generateToken(
                            Config.REACT_APP_AQ_KEYS,
                            Config.REACT_APP_AQ_SECRET,
                        ),
                    },
                },
            );
            if (response.data) {
                setAllBrokers(response.data);
            }
        } catch (error) {
            console.log('Error fetching all brokers:', error);
        }
    };

    const handleLetUsKnowPress = () => {
        setShowLetUsKnow(true);
        fetchAllBrokers();
    };

    const handleUnavailableBrokerSelect = async (brokerName) => {
        setSelectedUnavailableBroker(brokerName);
        try {
            await axios.put(
                `${server.ccxtServer.baseUrl}comms/unavailable-broker/save`,
                { email: userEmail, broker: brokerName },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Advisor-Subdomain': getTenantSubdomain(),
                        'aq-encrypted-key': generateToken(
                            Config.REACT_APP_AQ_KEYS,
                            Config.REACT_APP_AQ_SECRET,
                        ),
                    },
                },
            );
        } catch (error) {
            console.log('Error saving unavailable broker:', error);
        }
    };

    const filteredAllBrokers = allBrokers.filter((b) =>
        (b.name || b)
            .toString()
            .toLowerCase()
            .includes(brokerSearchText.toLowerCase()),
    );

    const proceedWithBrokerSelect = async (broker) => {
        const { openModal, closeModal } = useModalStore.getState();
        if (broker?.key) {
            if (broker.key === 'Angel One') {
                await registerCallback('angelone', '/stock-recommendation');
            }
            setShowBrokerModal(false);
            closeModal();
            setTimeout(() => {
                openModal(broker.key);
            }, 100);
        }
    };

    const handleBrokerSelect = async (broker) => {
        if (broker?.key === 'Angel One') {
            setPendingAngelOneBroker(broker);
            return;
        }
        await proceedWithBrokerSelect(broker);
    };

    const USER_BROKER_TO_MODAL_KEY = {
        'ICICI Direct': 'ICICI',
        'Kotak Neo': 'Kotak',
        'Hdfc Securities': 'HDFC',
        'Motilal Oswal': 'Motilal',
        AngelOne: 'Angel One',
    };

    const handleBrokerSelectOpenExpire = async (broker) => {
        const { openModal, closeModal } = useModalStore.getState();
        if (!broker) return;

        const modalKey = USER_BROKER_TO_MODAL_KEY[broker] || broker;
        const detailsForReauth = tradeUserDetails || userDetails;

        if (broker === 'Groww') {
            setLoginLoading(true);
            try {
                await refreshGrowwSession({
                    userId: detailsForReauth?._id,
                    advisorSubdomain: configData?.config?.REACT_APP_HEADER_NAME,
                    showAlert: showModalAlert,
                    onClose: () => {
                        setShowBrokerModal(false);
                        setOpenTokenExpireModel(false);
                    },
                    onSuccess: () => {
                        if (fetchBrokerStatusModal) fetchBrokerStatusModal();
                        eventEmitter.emit('refreshEvent', {
                            source: 'Groww mid-trade refresh',
                        });
                    },
                    onOpenConnectModal: () => {
                        closeModal();
                        setTimeout(() => openModal('Groww'), 100);
                    },
                });
            } finally {
                setLoginLoading(false);
            }
            return;
        }

        setLoginLoading(true);
        try {
            await flipPrimaryBroker(broker, userEmail, configData);
            const result = await handleSmartReauth({
                brokerName: broker,
                userEmail,
                userDetails: detailsForReauth,
                configData,
                brokerConnectRedirectURL,
            });

            setShowBrokerModal(false);
            setOpenTokenExpireModel(false);
            closeModal();

            setTimeout(() => {
                if (result.handled) {
                    openModal(result.modalKey, result.payload);
                } else {
                    openModal(modalKey);
                }
            }, 100);
        } finally {
            setLoginLoading(false);
        }
    };

    const brokerForExpire =
        tradeUserDetails?.user_broker || userDetails?.user_broker;
    const deviceTotpEnabled =
        freshConfig?.deviceTotpEnabled === true ||
        configData?.config?.deviceTotpEnabled === true;
    const aliceBlueDeviceLoginEnabled =
        freshConfig?.aliceBlueDeviceLoginEnabled === true ||
        configData?.config?.aliceBlueDeviceLoginEnabled === true;

    // An Execute tap already expresses the customer's intent to continue.
    // When this phone has an enrolled vault for the expired broker, skip the
    // redundant "Reconnect broker" button and open the broker dispatcher
    // immediately. DeviceTotpReconnectGate then owns the biometric prompt,
    // session refresh, and normal-login fallback. Customers without a local
    // vault keep the existing token-expiry UI unchanged.
    useEffect(() => {
        if (!OpenTokenExpireModel) {
            autoReconnectAttemptRef.current = null;
            return;
        }
        if (showBrokerModal || !userEmail) return;

        const target = DEVICE_TOTP_AUTO_RECONNECT[brokerForExpire];
        if (!target) return;
        const quickReconnectEnabled = target.vault === 'aliceblue'
            ? deviceTotpEnabled || aliceBlueDeviceLoginEnabled
            : deviceTotpEnabled;
        if (!quickReconnectEnabled) return;

        const attemptKey = `${getTenantSubdomain(configData)}:${target.broker}:${userEmail}`;
        if (autoReconnectAttemptRef.current === attemptKey) return;
        autoReconnectAttemptRef.current = attemptKey;

        let active = true;
        const identity = {
            advisor: getTenantSubdomain(configData),
            broker: target.broker,
            userEmail,
        };
        (target.vault === 'aliceblue'
            ? hasAliceBlueDeviceLogin(identity)
            : hasDeviceTotp(identity))
            .then(saved => {
                if (!active || !saved) return;
                const modalStore = useModalStore.getState();
                setLoginLoading(true);
                setShowBrokerModal(false);
                setOpenTokenExpireModel(false);
                modalStore.closeModal();
                setTimeout(() => modalStore.openModal(target.modalKey), 100);
            })
            .catch(error => {
                console.warn(
                    '[BrokerSelection] device reconnect lookup failed:',
                    error?.message,
                );
            })
            .finally(() => {
                if (active) setLoginLoading(false);
            });

        return () => {
            active = false;
        };
    }, [
        OpenTokenExpireModel,
        brokerForExpire,
        configData,
        deviceTotpEnabled,
        aliceBlueDeviceLoginEnabled,
        setOpenTokenExpireModel,
        setShowBrokerModal,
        showBrokerModal,
        userEmail,
    ]);

    const onClose = () => {
        if (continueWithoutBrokerLoading) return;
        if (OpenTokenExpireModel) onReconnectCancel?.();
        setShowBrokerModal(false);
        setOpenTokenExpireModel(false);
    };

    const continueWithoutBroker = async () => {
        if (continueWithoutBrokerLoading || !handleAcceptRebalanceWithoutBroker) return;
        setContinueWithoutBrokerLoading(true);
        try {
            await handleAcceptRebalanceWithoutBroker();
        } finally {
            setContinueWithoutBrokerLoading(false);
        }
    };

    // Create rows of brokers (4 per row)
    const chunkArray = (array, size) => {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    };
    const brokerRows = chunkArray(brokersmain, 4);

    // Determine mode
    const mode = showBrokerModal ? 'picker' : 'tokenExpire';

    const viewModel = {
        visible: showBrokerModal || OpenTokenExpireModel,
        mode,
        // picker
        brokerRows,
        pressedBroker,
        brokerConnected,
        connectingBroker,
        showLetUsKnow,
        filteredAllBrokers,
        selectedUnavailableBroker,
        brokerSearchText,
        // tokenExpire
        broker: brokerForExpire,
        showMessage,
        loginLoading,
        continueWithoutBrokerLoading,
    };

    const actions = {
        onClose,
        // picker
        onBrokerSelect: handleBrokerSelect,
        onPressIn: (key) => setPressedBroker(key),
        onPressOut: () => setPressedBroker(null),
        onContinueWithoutBroker: continueWithoutBroker,
        onBrokerConnectedContinue:
            handleBrokerConnectedContinue || handleAcceptRebalanceWithoutBroker,
        onLetUsKnow: handleLetUsKnowPress,
        onLetUsKnowBack: () => {
            setShowLetUsKnow(false);
            setBrokerSearchText('');
            setSelectedUnavailableBroker(null);
        },
        onBrokerSearchChange: setBrokerSearchText,
        onUnavailableBrokerSelect: handleUnavailableBrokerSelect,
        // tokenExpire
        onBrokerLoginPress: handleBrokerSelectOpenExpire,
        // Angel One sibling
        renderAngelOneWarning: () => (
            <AngelOneCautionaryWarning
                visible={!!pendingAngelOneBroker}
                onAck={async () => {
                    const b = pendingAngelOneBroker;
                    setPendingAngelOneBroker(null);
                    if (b) await proceedWithBrokerSelect(b);
                }}
                onCancel={() => setPendingAngelOneBroker(null)}
            />
        ),
    };

    return <Presentation viewModel={viewModel} actions={actions} />;
};

export default BrokerSelectionModal;
