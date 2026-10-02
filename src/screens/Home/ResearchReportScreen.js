import React, { useState, useEffect, useMemo } from 'react';
import {Platform} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import RNFS from 'react-native-fs';
import Toast from 'react-native-toast-message';
import server from '../../utils/serverConfig';
import { generateToken } from '../../utils/SecurityTokenManager';
import Config from 'react-native-config';
import { getAuth } from '@react-native-firebase/auth';
import { useTrade } from '../TradeContext';
import { useConfig } from '../../context/ConfigContext';
import {getAccountEmail} from '../../utils/accountEmail';
import useLTPStore from '../../components/AdviceScreenComponents/DynamicText/useLtpStore';
import WebSocketManager from '../../components/AdviceScreenComponents/DynamicText/WebSocketManager';
import {getTenantSubdomain} from '../../utils/variantHelper';
import {
  firstReportUrl,
  formatReportDateTime,
  isPdfBase64,
  mergeReportsById,
  normalizePdfBase64,
} from '../../utils/researchReportUtils';

import {designColor, designFont} from '../../design/literalTokens';
import {useComponent} from '../../design/useDesign';

const ResearchReportScreen = () => {
  const {configData}=useTrade();

  // Get dynamic colors from config
  const config = useConfig();
  const gradient1 = config?.gradient1 || 'rgba(0, 38, 81, 1)';
  const gradient2 = config?.gradient2 || 'rgba(0, 86, 183, 1)';
  const mainColor = config?.mainColor || designColor('045dff');
  const navigation = useNavigation();
  const [availableSymbols, setAvailableSymbols] = useState([]);
  const [symbolsWithLTP, setSymbolsWithLTP] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingRowIndex, setLoadingRowIndex] = useState(null);
  const reportSymbols = useMemo(
    () => [...new Set(symbolsWithLTP.map(report => report.symbol).filter(Boolean))],
    [symbolsWithLTP],
  );
  // Use the app's shared quote store. Navigation does not mount a
  // MarketDataProvider, so the context-based hook throws on opening this screen.
  const livePrices = useLTPStore(state => state.ltps);
  useEffect(() => {
    if (!reportSymbols.length) return;
    WebSocketManager.getInstance()
      .subscribeToAllSymbols(reportSymbols.map(symbol => ({symbol})))
      .catch(() => {}); // Reports remain readable if live quotes are unavailable.
  }, [reportSymbols]);

  // Date filter states
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isDateFilterOpen, setIsDateFilterOpen] = useState(false);
  const [filteredSymbols, setFilteredSymbols] = useState([]);

  // Sort states
  const [sortOrder, setSortOrder] = useState('latest');
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);

  const auth = getAuth();
  const user = auth.currentUser;
  const userEmail = getAccountEmail();

  useEffect(() => {
    if (userEmail) {
      fetchAvailableResearchReports();
    }
  }, [userEmail]);

  useEffect(() => {
    applyFilters();
  }, [searchQuery, startDate, endDate, symbolsWithLTP, sortOrder]);

  const applyFilters = () => {
    let filtered = symbolsWithLTP;
    if (searchQuery && searchQuery.trim() !== '') {
      filtered = filtered.filter(report =>
        (report.symbol || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (report.stockName || '').toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    if (startDate || endDate) {
      filtered = filtered.filter(report => {
        if (!report.sentAt) return true;
        const reportDate = new Date(report.sentAt);
        if (startDate) {
          const startDateTime = new Date(startDate);
          startDateTime.setHours(0, 0, 0, 0);
          if (reportDate < startDateTime) return false;
        }
        if (endDate) {
          const endDateTime = new Date(endDate);
          endDateTime.setHours(23, 59, 59, 999);
          if (reportDate > endDateTime) return false;
        }
        return true;
      });
    }
    filtered.sort((a, b) => {
      if (!a.sentAt || !b.sentAt) return 0;
      const dateA = new Date(a.sentAt);
      const dateB = new Date(b.sentAt);
      return sortOrder === 'latest' ? dateB - dateA : dateA - dateB;
    });
    setFilteredSymbols(filtered);
  };

  const clearDateFilter = () => {
    setStartDate('');
    setEndDate('');
  };

  const toggleDateFilter = () => {
    setIsDateFilterOpen(!isDateFilterOpen);
  };

  const toggleSortMenu = () => {
    setIsSortMenuOpen(!isSortMenuOpen);
  };

  const setSorting = (order) => {
    setSortOrder(order);
    setIsSortMenuOpen(false);
  };

  const fetchAvailableResearchReports = async () => {
    if (!userEmail) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const headers = {
        "Content-Type": "application/json",
        "X-Advisor-Subdomain":
          getTenantSubdomain(configData),
        "aq-encrypted-key": generateToken(
          Config.REACT_APP_AQ_KEYS,
          Config.REACT_APP_AQ_SECRET
        ),
      };

      // Fetch from all three sources in parallel (matching web app)
      const [ccxtResponse, backendResponse, uploadedResponse] = await Promise.allSettled([
        fetch(
          `${server.ccxtServer.baseUrl}misc/research-reports/user/${encodeURIComponent(userEmail)}`,
          { method: "GET", headers }
        ).then(res => res.json()),
        fetch(
          `${server.server.baseUrl}api/research-reports/user/${encodeURIComponent(userEmail)}`,
          { method: "GET", headers }
        ).then(res => res.json()),
        fetch(
          `${server.server.baseUrl}api/research-pdf/user/${encodeURIComponent(userEmail)}`,
          { method: "GET", headers }
        ).then(res => res.json()),
      ]);

      // CCXT reports
      const ccxtReports = ccxtResponse.status === "fulfilled" && ccxtResponse.value?.success
        ? (ccxtResponse.value.reports || []).map(r => ({
            _id: r._id,
            reportId: r.reportId,
            symbol: r.symbol || '',
            stockName: r.companyName || '',
            sector: '',
            currentPrice: null,
            targetPrice: r.targetPrice || null,
            stopLoss: null,
            recommendationType: '',
            timeHorizon: '',
            // The ccxt endpoint returns admin reports as `link` and
            // recommendation reports as `reportLink`. Preserve both, plus
            // the embedded base64 PDF that survives expired/dead object URLs.
            pdfPresignedUrl: firstReportUrl(r),
            pdfBase64: normalizePdfBase64(r.pdfData),
            sentAt: r.sentToUserAt ? new Date(r.sentToUserAt) : (r.createdAt ? new Date(r.createdAt) : null),
            researchDate: r.createdAt,
            source: r.source || 'ccxt',
          }))
        : [];

      // Backend reports (same source the app was already using)
      const backendReports = backendResponse.status === "fulfilled" && backendResponse.value?.success
        ? (backendResponse.value.data || []).map(report => ({
            _id: report._id,
            reportId: report.reportId,
            symbol: report.stockInfo?.stockSymbol || '',
            stockName: report.stockInfo?.stockName || '',
            sector: report.stockInfo?.sector || '',
            currentPrice: report.priceData?.currentPrice,
            targetPrice: report.priceData?.targetPrice,
            stopLoss: report.priceData?.stopLoss,
            recommendationType: report.recommendation?.type || '',
            timeHorizon: report.recommendation?.timeHorizon || '',
            pdfPresignedUrl: firstReportUrl(report),
            pdfBase64: normalizePdfBase64(report.pdfData),
            sentAt: report.sentAt ? new Date(report.sentAt) : null,
            researchDate: report.researchDate,
            source: report.source,
          }))
        : [];

      // Uploaded PDF reports
      const uploadedReports = uploadedResponse.status === "fulfilled" && uploadedResponse.value?.success
        ? (uploadedResponse.value.reports || []).map(r => ({
            _id: r.reportId,
            reportId: r.reportId,
            symbol: r.stockSymbol || '',
            stockName: r.stockName || '',
            sector: '',
            currentPrice: null,
            targetPrice: r.recommendation?.targetPrice || null,
            stopLoss: null,
            recommendationType: '',
            timeHorizon: '',
            pdfPresignedUrl: firstReportUrl(r),
            pdfBase64: normalizePdfBase64(r.pdfData),
            sentAt: null,
            researchDate: r.createdAt || r.researchDate,
            source: 'uploaded',
          }))
        : [];

      // The ccxt source historically matched `reportLink: null` because
      // `$ne: ""` also accepts null. Those rows are recommendations, not
      // downloadable reports, and produced the misleading download button
      // + "Failed to download report" shown in the QA document. Deduplication
      // supplements an assetless first row from a later source before filtering.
      const allReports = mergeReportsById(
        [...ccxtReports, ...backendReports, ...uploadedReports],
      );
      setAvailableSymbols(allReports);
      setSymbolsWithLTP(allReports);
    } catch (error) {
      console.error('Error fetching research reports:', error);
      setAvailableSymbols([]);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (text2, type = 'success') => {
    Toast.show({
      type,
      text2,
      position: 'bottom',
      text1Style: { color: 'black', fontSize: 11, fontFamily: designFont('Poppins-Medium') },
      text2Style: { color: 'black', fontSize: 12, fontFamily: designFont('Poppins-Regular') },
    });
  };

  const resolvePdfUrl = async (report) => {
    if (report.pdfPresignedUrl) return report.pdfPresignedUrl;
    const advisorTag = configData?.config?.REACT_APP_ADVISOR_SPECIFIC_TAG;
    const headers = {
      'Content-Type': 'application/json',
      'X-Advisor-Subdomain': getTenantSubdomain(configData),
      'aq-encrypted-key': generateToken(
        Config.REACT_APP_AQ_KEYS,
        Config.REACT_APP_AQ_SECRET,
      ),
    };
    const response = await fetch(
      `${server.ccxtServer.baseUrl}comms/research-report-link/${encodeURIComponent(advisorTag || '')}/${encodeURIComponent(report.symbol || '')}`,
      { method: 'GET', headers },
    );
    if (!response.ok) return null;
    const data = await response.json();
    return data?.link && data.link !== '-' ? data.link : null;
  };

  const handleDownloadResearchReport = async (report) => {
    try {
      setLoadingRowIndex(report._id || report.reportId);

      const safeSymbol = (report.symbol || 'report').replace(/[^\w-]/g, '_');
      const fileName = `${safeSymbol}_report_${Date.now()}.pdf`;
      const path =
        Platform.OS === 'android'
          ? `${RNFS.DownloadDirectoryPath}/${fileName}`
          : `${RNFS.DocumentDirectoryPath}/${fileName}`;

      const embeddedPdf = normalizePdfBase64(report.pdfBase64);
      if (isPdfBase64(embeddedPdf)) {
        try {
          await RNFS.writeFile(path, embeddedPdf, 'base64');
          if (await RNFS.exists(path)) {
            showToast('Report saved to Downloads', 'success');
            return;
          }
        } catch (embeddedError) {
          console.warn(
            'Embedded research PDF write failed; falling back to URL:',
            embeddedError,
          );
        }
      }

      const url = await resolvePdfUrl(report);
      if (!url) {
        showToast('No research report available', 'error');
        return;
      }

      const { promise } = RNFS.downloadFile({ fromUrl: url, toFile: path });
      const result = await promise;

      if (
        result.statusCode >= 200 &&
        result.statusCode < 300 &&
        (await RNFS.exists(path))
      ) {
        showToast('Report saved to Downloads', 'success');
      } else {
        showToast('Failed to download report', 'error');
      }
    } catch (error) {
      console.error('Error downloading research report:', error);
      showToast('Failed to download report', 'error');
    } finally {
      setLoadingRowIndex(null);
    }
  };

  // Determine dynamic month text
  const getMonthText = () => {
    if (!filteredSymbols.length) return '--';
    const mostRecent = filteredSymbols[0].sentAt;
    if (!mostRecent) return '--';
    return mostRecent.toLocaleDateString('en-US', { month: 'short' });
  };

  const Presentation = useComponent('screens.ResearchReportScreen');
  return (
    <Presentation
      viewModel={{
        gradient1, gradient2, mainColor, searchQuery, isDateFilterOpen,
        startDate, endDate, isSortMenuOpen, sortOrder, filteredSymbols,
        loading, livePrices, loadingRowIndex, symbolsWithLTP,
      }}
      actions={{
        onBack: () => navigation.goBack(),
        setSearchQuery, toggleSortMenu, toggleDateFilter, setStartDate,
        setEndDate, clearDateFilter, setSorting, handleDownloadResearchReport,
        formatReportDateTime, getMonthText,
      }}
    />
  );
};

export default ResearchReportScreen;
