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

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { getAuth } from '@react-native-firebase/auth';
import Config from 'react-native-config';
import server from '../utils/serverConfig';
import { generateToken } from '../utils/SecurityTokenManager';
import useModalStore from '../GlobalUIModals/modalStore';
import { useTrade } from '../screens/TradeContext';
import { useConfig } from '../context/ConfigContext';
import { getAdvisorSubdomain } from '../utils/variantHelper';
import { registerCallback } from '../utils/brokerAuth';
import { brokerDisplayConfig } from '../config/brokerDisplayConfig';
import { handleSmartReauth, flipPrimaryBroker } from '../utils/reauthHelpers';
import { refreshGrowwSession } from '../utils/growwRefresh';
import eventEmitter from './EventEmitter';
import AngelOneCautionaryWarning from './AngelOneCautionaryWarning';
import { useComponent } from '../design/useDesign';

const BrokerSelectionModal = ({
    showBrokerModal,
    setShowBrokerModal,
    OpenTokenExpireModel,
    setOpenTokenExpireModel,
    handleAcceptRebalanceWithoutBroker,
    handleBrokerConnectedContinue,
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
    const userEmail = user?.email;
    const [loginLoading, setLoginLoading] = useState(false);
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
                    'X-Advisor-Subdomain': getAdvisorSubdomain(),
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
                        'X-Advisor-Subdomain': getAdvisorSubdomain(),
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
                        'X-Advisor-Subdomain': getAdvisorSubdomain(),
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

    const brokerForExpire = userDetails?.user_broker;

    const onClose = () => {
        setShowBrokerModal(false);
        setOpenTokenExpireModel(false);
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
    };

    const actions = {
        onClose,
        // picker
        onBrokerSelect: handleBrokerSelect,
        onPressIn: (key) => setPressedBroker(key),
        onPressOut: () => setPressedBroker(null),
        onContinueWithoutBroker: handleAcceptRebalanceWithoutBroker,
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
