/**
 * PaymentHistoryScreen — container (Phase G batch 2, 2026-05-02)
 *
 * Owns: useTrade, useConfig, Firebase auth, axios invoice fetch,
 * PDF fetch/save/view/download via RNFS + FileViewer + Share.
 * Renders presentation resolved from `screens.PaymentHistoryScreen`.
 *
 * P1 (web-parity, D15): when `config.riaBillingEnabled` AND the customer is on an
 * AUA billing contract, a second "Fee Statements" tab surfaces the RIA AUM-billing
 * invoices (RiaBillingService) alongside the existing transaction invoices, REUSING
 * the same RNFS + FileViewer/Share PDF helper. Default-OFF — no contract / flag off
 * → behaves exactly as before (single transactions list, no tab).
 * See docs/WEB_PARITY_MIGRATION_2026-06.md §5.1.
 */

import React, { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import { decode as atob, encode as btoa } from 'base-64';
import Toast from 'react-native-toast-message';
import { getAuth } from '@react-native-firebase/auth';
import Config from 'react-native-config';
import FileViewer from 'react-native-file-viewer';
import server from '../../utils/serverConfig';
import { generateToken } from '../../utils/SecurityTokenManager';
import { useTrade } from '../TradeContext';
import { useConfig } from '../../context/ConfigContext';
import { useComponent } from '../../design/useDesign';
import { getAdvisorSubdomain } from '../../utils/variantHelper';
import RiaBillingService from '../../FunctionCall/services/RiaBillingService';

// Robustly turn an axios arraybuffer (or already-base64 string) into base64 so the
// existing savePdfToFile (atob → RNFS.writeFile) can consume it unchanged.
const toBase64 = data => {
    if (typeof data === 'string') return data; // some RN adapters hand back base64
    try {
        const bytes = new Uint8Array(data);
        let binary = '';
        const chunk = 0x8000;
        for (let i = 0; i < bytes.length; i += chunk) {
            binary += String.fromCharCode.apply(
                null,
                bytes.subarray(i, i + chunk),
            );
        }
        return btoa(binary);
    } catch (e) {
        return null;
    }
};

// Map a raw RIA invoice into the flat shape the presentation's fee-statement row reads.
// `planName` falls through several backend field names so whichever
// the RIA service exposes wins. The user complaint
// (2026-06-09 screenshot — "plan name is not mentioned here") landed
// here because the previous mapper only kept the billing period
// (e.g. "2026-Q2") and dropped every plan / category descriptor.
const mapRiaInvoice = inv => ({
    // `id` is the canonical key the FlatList renderer uses, and the PDF
    // handler falls back to it when invoice_id is absent. The fallback
    // chain captures every shape we've seen the backend return so a
    // future Mongoose `select` change doesn't silently break
    // Download/View (the 2026-06-09 "buttons not working" report
    // traced here — `inv.invoice_id` was undefined; the handler
    // short-circuited to "Invoice not available yet").
    id: inv.invoice_id || inv._id || inv.id || inv.invoiceId || inv.invoice_number,
    invoice_id: inv.invoice_id || inv._id || inv.id || inv.invoiceId,
    invoice_number: inv.invoice_number,
    period: inv.billing_period_key || inv.period_label || '',
    status: (inv.status || 'issued').toLowerCase(),
    aua: inv.aua_reference?.period_aua ?? null,
    fee: inv.subtotal ?? null,
    gst: inv.total_gst ?? null,
    total: inv.total_amount ?? null,
    // Plan and category are surfaced as TWO separate fields so the card
    // can render both ("<plan> · <category>") when the RIA service
    // exposes them. Either alone is fine — the presentation joins
    // whatever's truthy with " · ".
    planName:
        inv.plan_name ||
        inv.plan_label ||
        inv.fee_plan_name ||
        inv.fee_plan_label ||
        inv.product_name ||
        '',
    category:
        inv.client_category ||
        inv.category ||
        inv.customer_category ||
        '',
});

const PaymentHistoryScreen = () => {
    const { configData } = useTrade();
    const config = useConfig();
    const gradient1 = config?.gradient1 || 'rgba(0, 86, 183, 1)';
    const gradient2 = config?.gradient2 || 'rgba(0, 38, 81, 1)';
    const navigation = useNavigation();
    const [InvoiceData, setInvoiceData] = useState([]);

    // P1 RIA fee-statement state (gated on riaBillingEnabled + AUA contract).
    const [tab, setTab] = useState('transactions'); // 'transactions' | 'fees'
    const [feeStatements, setFeeStatements] = useState([]);
    const [feeContract, setFeeContract] = useState(null);

    const auth = getAuth();
    const user = auth.currentUser;
    const userEmail = user?.email;

    // X-Advisor-Subdomain: prefer the live config value (per-tenant
    // override resolved from the backend), but fall back to the static
    // variant subdomain so the header is NEVER undefined. Without the
    // fallback the Transactions tab silently 4xx'd whenever the
    // ConfigContext hadn't loaded yet — Fee Statements still worked
    // because RiaBillingService uses getAuthedHeaders → getAdvisorSubdomain.
    // 2026-06-09 fix for "invoices not coming".
    const headers = () => ({
        'Content-Type': 'application/json',
        'X-Advisor-Subdomain':
            configData?.config?.REACT_APP_HEADER_NAME || getAdvisorSubdomain(),
        'aq-encrypted-key': generateToken(
            Config.REACT_APP_AQ_KEYS,
            Config.REACT_APP_AQ_SECRET,
        ),
    });

    const getInvoiceDetails = async () => {
        try {
            const response = await axios.get(
                `${server.ccxtServer.baseUrl}comms/get-invoices/${userEmail}`,
                { headers: headers() },
            );
            const invoices = response.data.invoices || [];
            invoices.sort((a, b) => {
                const dateA = a.created_at ? new Date(a.created_at) : new Date(0);
                const dateB = b.created_at ? new Date(b.created_at) : new Date(0);
                return dateB - dateA;
            });
            setInvoiceData(invoices);
        } catch (error) {
            // Surface URL + status so the next "invoices not coming" report
            // includes the diagnostic info instead of just being silent.
            console.error(
                '[PaymentHistory] get-invoices failed',
                error?.response?.status,
                error?.response?.data || error?.message,
            );
        }
    };

    // P1 (D15): RIA fee statements. Never throws into the screen — a failure just
    // leaves the fee tab hidden so the transactions list works exactly as before.
    const getFeeStatements = async () => {
        try {
            const [contractRes, invoiceRes] = await Promise.all([
                RiaBillingService.getMyContract(userEmail).catch(() => null),
                RiaBillingService.getMyInvoices(userEmail).catch(() => null),
            ]);
            const contract = contractRes?.contract || null;
            setFeeContract(contract);
            const list = (invoiceRes?.invoices || []).map(mapRiaInvoice);
            setFeeStatements(list);
        } catch (e) {
            console.warn('[PaymentHistory] RIA fee statements unavailable:', e?.message);
        }
    };

    useEffect(() => {
        if (!userEmail) return;
        getInvoiceDetails();
        if (config?.riaBillingEnabled) getFeeStatements();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userEmail, config?.riaBillingEnabled]);

    // Fee tab shows only for AUA-mode contracts that actually have fee data.
    const showFeeTab =
        !!config?.riaBillingEnabled &&
        (feeContract?.billing_mode === 'AUA' || feeStatements.length > 0);

    const showToast = (message1, type, message2) => {
        Toast.show({
            type: type,
            text2: message2 + ' ' + message1,
            position: 'bottom',
            text1Style: {
                color: 'black',
                fontSize: 11,
                fontWeight: 0,
                fontFamily: 'Poppins-Medium',
            },
            text2Style: {
                color: 'black',
                fontSize: 12,
                fontFamily: 'Poppins-Regular',
            },
        });
    };

    const fetchInvoicePdf = async invoiceIndex => {
        try {
            const response = await axios.get(
                `${server.ccxtServer.baseUrl}comms/get-invoice-pdf/${userEmail}/${invoiceIndex}`,
                { headers: headers() },
            );
            return response.data.pdf_bytes || null;
        } catch (error) {
            console.error('Error fetching invoice PDF:', error);
            return null;
        }
    };

    const savePdfToFile = async (pdfData, fileName) => {
        const path =
            Platform.OS === 'android'
                ? `${RNFS.DownloadDirectoryPath}/${fileName}`
                : `${RNFS.DocumentDirectoryPath}/${fileName}`;

        const binaryData = atob(pdfData);
        await RNFS.writeFile(path, binaryData, 'ascii');
        const fileExists = await RNFS.exists(path);
        if (!fileExists) {
            throw new Error('File not found after saving');
        }
        return path;
    };

    const openPdfPath = async path => {
        try {
            await FileViewer.open(path, { showOpenWithDialog: true });
        } catch (viewerError) {
            console.warn('Error opening file:', viewerError);
            if (Platform.OS === 'ios') {
                await Share.open({
                    url: `file://${path}`,
                    type: 'application/pdf',
                    title: 'Open PDF',
                });
            }
        }
    };

    const handleViewInvoice = async (item, index) => {
        try {
            let pdfData = item.pdf_bytes;
            if (!pdfData) {
                pdfData = await fetchInvoicePdf(index);
            }
            if (!pdfData) {
                showToast('PDF data missing', 'error', '');
                return;
            }
            const fileName = `Invoice_${new Date().getTime()}.pdf`;
            const path = await savePdfToFile(pdfData, fileName);
            await openPdfPath(path);
        } catch (error) {
            console.error('Error viewing PDF:', error);
            showToast('Error opening invoice', 'error', '');
        }
    };

    const handleDownloadInvoice = async (item, index) => {
        try {
            let pdfData = item.pdf_bytes;
            if (!pdfData) {
                pdfData = await fetchInvoicePdf(index);
            }
            if (!pdfData) {
                showToast('PDF data missing', 'error', '');
                return;
            }
            const invoiceNumber =
                item.invoice_data?.invoice_number || new Date().getTime();
            const fileName = `invoice_${invoiceNumber}.pdf`.replace(/\//g, '_');
            await savePdfToFile(pdfData, fileName);
            showToast('Invoice saved to Downloads', 'success', '');
        } catch (error) {
            console.error('Error downloading PDF:', error);
            showToast('Error downloading invoice', 'error', '');
        }
    };

    // P1 (D15): RIA fee-statement PDF — bytes come from the Node RIA endpoint as an
    // arraybuffer; convert to base64 and reuse the same save/open helper.
    const handleRiaPdf = async (item, { download } = {}) => {
        // Resilient id resolution — mapper exposes both `invoice_id`
        // and `id` with the same fallback chain. The handler should
        // never short-circuit when one is present and the other isn't.
        const invoiceId = item?.invoice_id || item?.id;
        try {
            if (!invoiceId) {
                console.warn(
                    '[PaymentHistory] RIA fee statement has no invoice_id — fields seen:',
                    Object.keys(item || {}),
                );
                showToast('Invoice not available yet', 'error', '');
                return;
            }
            const { data } = await RiaBillingService.fetchInvoicePdf(
                invoiceId,
                userEmail,
            );
            const b64 = toBase64(data);
            if (!b64) {
                showToast('PDF data missing', 'error', '');
                return;
            }
            const fileName = `fee_${(item.invoice_number || invoiceId)}`
                .replace(/\//g, '_') + '.pdf';
            const path = await savePdfToFile(b64, fileName);
            if (download) showToast('Statement saved to Downloads', 'success', '');
            else await openPdfPath(path);
        } catch (error) {
            console.error('Error with RIA invoice PDF:', error?.message || error);
            const status = error?.response?.status;
            if (status === 404) showToast('Statement not found on server', 'error', '');
            else if (status === 403) showToast('You are not authorized to view this statement', 'error', '');
            else showToast('Error opening statement', 'error', '');
        }
    };

    const Presentation = useComponent('screens.PaymentHistoryScreen');

    return (
        <Presentation
            viewModel={{
                invoiceData: InvoiceData,
                gradient1,
                gradient2,
                // P1 fee-statement view-model (inert unless showFeeTab)
                showFeeTab,
                tab,
                feeStatements,
                feeContract,
            }}
            actions={{
                onGoBack: () => navigation.goBack(),
                onDownloadInvoice: handleDownloadInvoice,
                onViewInvoice: handleViewInvoice,
                onSelectTab: setTab,
                onViewFee: item => handleRiaPdf(item, { download: false }),
                onDownloadFee: item => handleRiaPdf(item, { download: true }),
            }}
        />
    );
};

export default PaymentHistoryScreen;
