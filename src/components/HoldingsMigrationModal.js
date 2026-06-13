/**
 * HoldingsMigrationModal — container (Phase H, 2026-05-02)
 *
 * Owns all data-fetching (migration summary), selection state, and
 * submission logic. Delegates rendering to the design-system
 * presentation resolved as `composites.HoldingsMigrationModal`.
 *
 * Legacy prop signature preserved:
 *   { isOpen, onClose, userEmail, newBroker, onMigrationComplete, configHeaderName }
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Config from 'react-native-config';
import server from '../utils/serverConfig';
import { generateToken } from '../utils/SecurityTokenManager';
import { useComponent } from '../design/useDesign';

const HoldingsMigrationModal = ({
    isOpen,
    onClose,
    userEmail,
    newBroker,
    onMigrationComplete,
    configHeaderName,
}) => {
    const Presentation = useComponent('composites.HoldingsMigrationModal');

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [migrationData, setMigrationData] = useState(null);
    const [selections, setSelections] = useState({});

    const authHeaders = {
        'Content-Type': 'application/json',
        'X-Advisor-Subdomain': configHeaderName || '',
        'aq-encrypted-key': generateToken(
            Config.REACT_APP_AQ_KEYS,
            Config.REACT_APP_AQ_SECRET,
        ),
    };

    useEffect(() => {
        if (isOpen && userEmail && newBroker) {
            fetchMigrationSummary();
        }
    }, [isOpen, userEmail, newBroker]);

    const fetchMigrationSummary = async () => {
        setLoading(true);
        try {
            const response = await axios.get(
                `${server.server.baseUrl}api/model-portfolio-db-update/broker-migration-summary/${encodeURIComponent(userEmail)}`,
                { params: { newBroker }, headers: authHeaders },
            );
            const data = response.data?.data;
            setMigrationData(data);
            const initial = {};
            (data?.modelsWithHoldings || []).forEach((model) => {
                initial[model.model_name] = model.existingNewBrokerRecord?.hasHoldings
                    ? 'empty'
                    : 'migrate';
            });
            setSelections(initial);
        } catch (err) {
            console.error('[HoldingsMigrationModal] fetch failed:', err?.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async () => {
        if (!migrationData) return;
        setSubmitting(true);
        try {
            const migrations = (migrationData.modelsWithHoldings || []).map((model) => ({
                modelName: model.model_name,
                action: selections[model.model_name] || 'empty',
                sourceDocumentId:
                    selections[model.model_name] === 'migrate'
                        ? model.primaryBrokerId
                        : null,
            }));
            await axios.post(
                `${server.server.baseUrl}api/model-portfolio-db-update/handle-broker-migration`,
                { userEmail, newBroker, migrations },
                { headers: authHeaders },
            );
            onMigrationComplete?.();
            onClose();
        } catch (err) {
            console.error('[HoldingsMigrationModal] submit failed:', err?.message);
        } finally {
            setSubmitting(false);
        }
    };

    const models = migrationData?.modelsWithHoldings || [];
    const isReconnection =
        models.length > 0 &&
        models.every((m) => m.existingNewBrokerRecord?.hasHoldings);

    const viewModel = {
        visible: isOpen,
        newBroker,
        loading,
        submitting,
        isReconnection,
        models: models.map((m) => ({
            model_name: m.model_name,
            holdingsCount: m.holdingsCount,
            primaryBroker: m.primaryBroker,
            totalValue: m.totalValue,
        })),
        selections,
    };

    const actions = {
        onClose,
        onSubmit: handleSubmit,
        onSelectMigrate: (modelName) =>
            setSelections((s) => ({ ...s, [modelName]: 'migrate' })),
        onSelectEmpty: (modelName) =>
            setSelections((s) => ({ ...s, [modelName]: 'empty' })),
    };

    return <Presentation viewModel={viewModel} actions={actions} />;
};

export default HoldingsMigrationModal;
