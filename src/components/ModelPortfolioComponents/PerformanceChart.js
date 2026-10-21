// PerformanceChart.js
import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import Config from 'react-native-config';
import { generateToken } from '../../utils/SecurityTokenManager';
import server from '../../utils/serverConfig';
import { BarChart2, TrendingUp, TrendingDown } from 'lucide-react-native';
import { useTrade } from '../../screens/TradeContext';

import { designFont, designToken } from '../../design/literalTokens';

const screenWidth = Dimensions.get('window').width;

const TIME_PERIODS = [
  { key: '1M', label: '1M', days: 30 },
  { key: '3M', label: '3M', days: 90 },
  { key: '6M', label: '6M', days: 180 },
  { key: '1Y', label: '1Y', days: 365 },
  { key: 'ALL', label: 'All', days: null },
];

// Tab scenes can be detached and re-attached by React Navigation/TabView. The
// underlying daily series changes at most once per day, so do not turn those
// harmless UI remounts into duplicate CCXT + market-data requests. Cache the
// promise (not only the resolved value) to collapse concurrent mounts too.
const REQUEST_CACHE_TTL_MS = 30 * 60 * 1000;
const REQUEST_ERROR_TTL_MS = 60 * 1000;
const REQUEST_CACHE_MAX_ENTRIES = 64;
const REQUEST_TIMEOUT_MS = 12 * 1000;
const requestCache = new Map();

const cachedRequest = (key, operation) => {
  const now = Date.now();
  const cached = requestCache.get(key);
  const cachedTtl = cached?.failed
    ? REQUEST_ERROR_TTL_MS
    : REQUEST_CACHE_TTL_MS;
  if (cached && now - cached.createdAt < cachedTtl) {
    return cached.promise;
  }

  const entry = {
    createdAt: now,
    failed: false,
    promise: Promise.resolve().then(operation),
  };
  requestCache.set(key, entry);

  if (requestCache.size > REQUEST_CACHE_MAX_ENTRIES) {
    requestCache.delete(requestCache.keys().next().value);
  }

  entry.promise.catch(() => {
    // Keep failures briefly as a circuit breaker. A remount storm during an
    // outage must not immediately create another request for every scene.
    entry.failed = true;
    entry.createdAt = Date.now();
  });
  return entry.promise;
};

const fetchWithTimeout = async (url, options = {}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, {...options, signal: controller.signal});
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('PERFORMANCE_REQUEST_TIMEOUT');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

// showTitle=false lets a design that already titles the card (e.g. Kyzen's
// "Performance vs index") omit the chart's own "Performance" heading.
const PerformanceChart = ({ modelName, advisor, showTitle = true }) => {
  const { configData } = useTrade();
  const [selectedIndex] = useState('^NSEI');
  const [allAlignedData, setAllAlignedData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cardWidth, setCardWidth] = useState(0);
  const [selectedPeriod, setSelectedPeriod] = useState('1Y');
  const [selectedPoint, setSelectedPoint] = useState(null);

  // Normalize modelName: replace underscores with spaces for API
  const normalizedModelName = useMemo(
    () => (modelName ? modelName.replace(/_/g, ' ') : modelName),
    [modelName],
  );

  // Resolve advisor tag: prefer prop from strategy data, then configData, then .env
  const advisorTag =
    advisor ||
    configData?.config?.REACT_APP_ADVISOR_SPECIFIC_TAG ||
    Config.REACT_APP_ADVISOR_SPECIFIC_TAG;

  // Resolve header name: prefer configData, fallback to .env Config
  const headerName =
    configData?.config?.REACT_APP_HEADER_NAME ||
    Config.REACT_APP_ADVISOR_SUBDOMAIN;

  const fetchIndexData = async () => {
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const endDate = tomorrow.toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 366 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];

      return cachedRequest(
        `index:${selectedIndex}:${startDate}:${endDate}`,
        async () => {
          const response = await fetchWithTimeout(
            `${server.ccxtServer.baseUrl}misc/data-fetcher?symbol=${selectedIndex}&start_date=${startDate}&end_date=${endDate}`,
            {
              headers: {
                'X-Advisor-Subdomain': headerName,
                'aq-encrypted-key': generateToken(
                  Config.REACT_APP_AQ_KEYS,
                  Config.REACT_APP_AQ_SECRET,
                ),
              },
            },
          );
          if (!response.ok) throw new Error(`Index service returned ${response.status}`);
          const data = await response.json();
          return data.data || [];
        },
      );
    } catch (err) {
      console.error('Error fetching index data:', err);
      throw err;
    }
  };

  const fetchPortfolioData = async () => {
    try {
      console.log('📊 PerformanceChart: Fetching with advisor:', advisorTag, 'modelName:', normalizedModelName);

      return cachedRequest(
        `portfolio:${headerName}:${advisorTag}:${normalizedModelName}`,
        async () => {
          const response = await fetchWithTimeout(
            `${server.ccxtServer.baseUrl}rebalance/v2/get-portfolio-performance`,
            {
              method: 'POST',
              body: JSON.stringify({
                advisor: advisorTag,
                modelName: normalizedModelName,
              }),
              headers: {
                'Content-Type': 'application/json',
                'X-Advisor-Subdomain': headerName,
                'aq-encrypted-key': generateToken(
                  Config.REACT_APP_AQ_KEYS,
                  Config.REACT_APP_AQ_SECRET,
                ),
              },
            },
          );

          if (!response.ok) {
            if (response.status === 404) return [];
            const errorText = await response.text().catch(() => '');
            console.error(`📊 PerformanceChart API error: ${response.status}`, errorText);
            throw new Error(`Performance service returned ${response.status}`);
          }

          const data = await response.json();
          console.log('📊 PerformanceChart: API response status:', data.status, 'data length:', data.data?.length || 0);

          if (data.status === 0 && data.message === 'No performance data found.') {
            return [];
          }

          return data.data || [];
        },
      );
    } catch (err) {
      console.error('Error fetching portfolio data:', err);
      throw err;
    }
  };

  const fetchData = async ({force = false} = {}) => {
    // Don't fetch if we don't have the advisor tag yet
    if (!advisorTag) {
      console.log('📊 PerformanceChart: Waiting for advisor config...');
      return;
    }

    // Hosts pass modelName from async-loaded strategy details — on first
    // render it's undefined, and firing anyway earns a guaranteed 400
    // ("modelName is missing") console error. The deps effect re-runs
    // once the real name arrives.
    if (!normalizedModelName) {
      console.log('📊 PerformanceChart: Waiting for modelName...');
      return;
    }

    setLoading(true);
    setError(null);
    setSelectedPoint(null);

    try {
      if (force) {
        requestCache.delete(
          `portfolio:${headerName}:${advisorTag}:${normalizedModelName}`,
        );
      }

      // Portfolio history is the primary content and is a cheap Mongo read.
      // Do not launch the external benchmark request unless there is actually
      // portfolio data to chart.
      const portfolio = await fetchPortfolioData();

      if (!portfolio?.length) {
        setAllAlignedData([]);
        return;
      }

      if (force) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const endDate = tomorrow.toISOString().split('T')[0];
        const startDate = new Date(Date.now() - 366 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0];
        requestCache.delete(`index:${selectedIndex}:${startDate}:${endDate}`);
      }

      // Benchmark failure must not hide valid portfolio performance.
      const indexData = await fetchIndexData().catch(indexError => {
        console.warn('Benchmark data unavailable:', indexError);
        return [];
      });

      // Build a map of index data by date for faster lookup
      const indexMap = {};
      indexData.forEach(n => {
        const dateStr = new Date(n.Date).toISOString().split('T')[0];
        indexMap[dateStr] = n.Close;
      });

      const portfolioDates = portfolio.map(p =>
        new Date(p.date).toISOString().split('T')[0],
      );
      const startDate = portfolioDates[0];
      const firstPortfolioValue =
        portfolio.find(
          p => new Date(p.date).toISOString().split('T')[0] === startDate,
        )?.value || 100;

      // Find closest index value to start date
      let firstIndexValue = indexMap[startDate];
      if (!firstIndexValue) {
        // Try finding closest date within 5 days
        for (let i = 1; i <= 5; i++) {
          const d = new Date(startDate);
          d.setDate(d.getDate() + i);
          const dStr = d.toISOString().split('T')[0];
          if (indexMap[dStr]) {
            firstIndexValue = indexMap[dStr];
            break;
          }
          d.setDate(d.getDate() - 2 * i);
          const dStr2 = d.toISOString().split('T')[0];
          if (indexMap[dStr2]) {
            firstIndexValue = indexMap[dStr2];
            break;
          }
        }
      }
      if (!firstIndexValue && indexData.length) firstIndexValue = 100;

      // Align data - use nearest date matching for index
      const alignedData = portfolio
        .map(p => {
          const pDate = new Date(p.date).toISOString().split('T')[0];

          // Try exact match first, then nearest within 3 days
          let indexClose = indexMap[pDate];
          if (!indexClose) {
            for (let i = 1; i <= 3; i++) {
              const d = new Date(pDate);
              d.setDate(d.getDate() - i);
              const dStr = d.toISOString().split('T')[0];
              if (indexMap[dStr]) {
                indexClose = indexMap[dStr];
                break;
              }
            }
          }

          return {
            date: pDate,
            portfolioValue: (p.value / firstPortfolioValue) * 100,
            indexValue: indexClose && firstIndexValue ? (indexClose / firstIndexValue) * 100 : null,
            actualIndexValue: indexClose || null,
            actualPortfolioValue: p.value,
          };
        })
        .sort((a, b) => new Date(a.date) - new Date(b.date));

      setAllAlignedData(alignedData);
    } catch (err) {
      console.error('Error in fetchData:', err);
      setError('Performance is temporarily unavailable. Please try again shortly.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedIndex, normalizedModelName, advisorTag]);

  // Filter data by selected time period
  const portfolioData = useMemo(() => {
    if (!allAlignedData.length) return [];
    const period = TIME_PERIODS.find(p => p.key === selectedPeriod);
    if (!period?.days) return allAlignedData;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - period.days);
    const filtered = allAlignedData.filter(d => new Date(d.date) >= cutoff);

    if (filtered.length < 2) return allAlignedData;

    // Re-normalize to base 100 for the filtered period
    const firstP = filtered[0].portfolioValue;
    const firstI = filtered.find(d => d.indexValue != null)?.indexValue;
    return filtered.map(d => ({
      ...d,
      portfolioValue: (d.portfolioValue / firstP) * 100,
      indexValue: d.indexValue != null && firstI ? (d.indexValue / firstI) * 100 : null,
    }));
  }, [allAlignedData, selectedPeriod]);

  // Calculate summary stats
  const stats = useMemo(() => {
    if (!portfolioData.length) return null;
    const last = portfolioData[portfolioData.length - 1];
    const portfolioReturn = last.portfolioValue - 100;
    const indexReturn = last.indexValue == null ? null : last.indexValue - 100;
    const alpha = indexReturn == null ? null : portfolioReturn - indexReturn;
    return { portfolioReturn, indexReturn, alpha };
  }, [portfolioData]);

  if (loading) {
    return (
      <View style={{ padding: 40, alignItems: 'center' }}>
        <ActivityIndicator size="large" color={designToken('perfChart.color.0070d0')} />
        <Text
          style={{
            color: designToken('perfChart.color.888'),
            fontFamily: designFont('Poppins-Regular'),
            fontSize: 12,
            marginTop: 12,
          }}>
          Loading performance data...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ padding: 16, alignItems: 'center' }}>
        <Text style={{ color: designToken('perfChart.color.d00'), fontFamily: designFont('Poppins-Medium') }}>
          {error}
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => fetchData({force: true})}
          style={{
            marginTop: 12,
            borderWidth: 1,
            borderColor: designToken('perfChart.borderColor.0070d0'),
            borderRadius: 8,
            paddingHorizontal: 18,
            paddingVertical: 8,
          }}>
          <Text style={{color: designToken('perfChart.color.0070d0'), fontFamily: designFont('Poppins-Medium')}}>
            Try again
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!portfolioData.length) {
    return (
      <View
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 20,
          paddingVertical: 40,
        }}>
        <BarChart2 size={48} color={designToken('perfChart.color.888')} style={{ marginBottom: 16 }} />
        <Text
          style={{
            color: designToken('perfChart.color.000'),
            fontFamily: designFont('Poppins-SemiBold'),
            fontSize: 16,
            marginBottom: 8,
          }}>
          No performance data available
        </Text>
        <Text
          style={{
            color: designToken('perfChart.color.666'),
            fontFamily: designFont('Poppins-Regular'),
            fontSize: 14,
            textAlign: 'center',
            lineHeight: 20,
            maxWidth: 280,
          }}>
          We couldn't find any data for this model. Please try again later or
          select a different model.
        </Text>
      </View>
    );
  }

  // Sample data to fit within screen - show max ~60 points for clarity
  const maxPoints = 60;
  const step = Math.max(1, Math.floor(portfolioData.length / maxPoints));
  const sampledData = portfolioData.filter(
    (_, i) => i % step === 0 || i === portfolioData.length - 1,
  );

  const portfolioValues = sampledData.map(d => d.portfolioValue);
  const indexValues = sampledData.map(d => d.indexValue).filter(Number.isFinite);
  const hasBenchmark = indexValues.length >= 2;

  // Generate labels - show ~5 evenly spaced dates
  const labelCount = 5;
  const labelInterval = Math.floor(sampledData.length / (labelCount - 1)) || 1;
  const labels = sampledData.map((d, i) => {
    if (
      i === 0 ||
      i === sampledData.length - 1 ||
      i % labelInterval === 0
    ) {
      return new Date(d.date).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
      });
    }
    return '';
  });

  // gifted-charts datasets: value + sparse x-label + date (for the pointer
  // tooltip). data = portfolio (line 1, area-filled), data2 = index (line 2).
  const giftedPortfolio = sampledData.map((d, i) => ({
    value: d.portfolioValue,
    label: labels[i] || undefined,
    date: d.date,
  }));
  const giftedIndex = hasBenchmark
    ? sampledData.map(d => ({ value: Number.isFinite(d.indexValue) ? d.indexValue : undefined }))
    : undefined;
  // Non-zero baseline: chart-kit used fromZero={false}; gifted-charts achieves
  // it with yAxisOffset (baseline) + maxValue (range above the offset).
  const allVals = [...portfolioValues, ...indexValues];
  const yMin = Math.floor(Math.min(...allVals) - 2);
  const yMax = Math.ceil(Math.max(...allVals) + 2);

  // Size from the card actually rendered (designs wrap the chart in their own
  // gutters), not from the screen: a screen-based width overflowed the card,
  // so gifted-charts scrolled sideways and the right edge looked empty
  // (Kyzen tester report 2026-10-21). Until measured, use the old estimate.
  const chartWidth = cardWidth || screenWidth - 40;
  const chartHeight = 220;

  return (
    <View style={{ paddingTop: 4 }}>
      {/* Header */}
      {showTitle ? (
        <Text
          style={{
            fontFamily: designFont('Poppins-SemiBold'),
            fontSize: 15,
            color: designToken('perfChart.color.1a1a1a'),
            marginBottom: 4,
          }}>
          Performance
        </Text>
      ) : null}
      <Text
        style={{
          fontFamily: designFont('Poppins-Regular'),
          fontSize: 11,
          color: designToken('perfChart.color.888'),
          marginBottom: 12,
          lineHeight: 16,
        }}>
        Simulated portfolio performance{hasBenchmark ? ` vs ${selectedIndex === '^NSEI' ? 'Nifty 50' : selectedIndex}` : ''} (base 100)
      </Text>
      {/* Summary Stats Cards */}
      {stats && (
        <View
          style={{
            flexDirection: 'row',
            marginBottom: 16,
            gap: 10,
          }}>
          {stats.indexReturn != null && <View
            style={{
              flex: 1,
              backgroundColor: stats.portfolioReturn >= 0 ? designToken('perfChart.backgroundColor.f0fdf4') : designToken('perfChart.backgroundColor.fef2f2'),
              borderRadius: 10,
              padding: 12,
              borderWidth: 1,
              borderColor: stats.portfolioReturn >= 0 ? designToken('perfChart.borderColor.dcfce7') : designToken('perfChart.borderColor.fecaca'),
            }}>
            <Text
              style={{
                fontFamily: designFont('Poppins-Regular'),
                fontSize: 10,
                color: designToken('perfChart.color.666'),
                marginBottom: 4,
              }}>
              Portfolio
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {stats.portfolioReturn >= 0 ? (
                <TrendingUp size={14} color={designToken('perfChart.color.16a34a')} />
              ) : (
                <TrendingDown size={14} color={designToken('perfChart.color.dc2626')} />
              )}
              <Text
                style={{
                  fontFamily: designFont('Poppins-SemiBold'),
                  fontSize: 16,
                  color: stats.portfolioReturn >= 0 ? designToken('perfChart.color.16a34a') : designToken('perfChart.color.dc2626'),
                  marginLeft: 4,
                }}>
                {stats.portfolioReturn >= 0 ? '+' : ''}
                {stats.portfolioReturn.toFixed(2)}%
              </Text>
            </View>
          </View>}

          {stats.alpha != null && <View
            style={{
              flex: 1,
              backgroundColor: stats.indexReturn >= 0 ? designToken('perfChart.backgroundColor.f0fdf4') : designToken('perfChart.backgroundColor.fef2f2'),
              borderRadius: 10,
              padding: 12,
              borderWidth: 1,
              borderColor: stats.indexReturn >= 0 ? designToken('perfChart.borderColor.dcfce7') : designToken('perfChart.borderColor.fecaca'),
            }}>
            <Text
              style={{
                fontFamily: designFont('Poppins-Regular'),
                fontSize: 10,
                color: designToken('perfChart.color.666'),
                marginBottom: 4,
              }}>
              {selectedIndex === '^NSEI' ? 'Nifty 50' : selectedIndex}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {stats.indexReturn >= 0 ? (
                <TrendingUp size={14} color={designToken('perfChart.color.16a34a')} />
              ) : (
                <TrendingDown size={14} color={designToken('perfChart.color.dc2626')} />
              )}
              <Text
                style={{
                  fontFamily: designFont('Poppins-SemiBold'),
                  fontSize: 16,
                  color: stats.indexReturn >= 0 ? designToken('perfChart.color.16a34a') : designToken('perfChart.color.dc2626'),
                  marginLeft: 4,
                }}>
                {stats.indexReturn >= 0 ? '+' : ''}
                {stats.indexReturn.toFixed(2)}%
              </Text>
            </View>
          </View>}

          <View
            style={{
              flex: 1,
              backgroundColor: stats.alpha >= 0 ? designToken('perfChart.backgroundColor.eff6ff') : designToken('perfChart.backgroundColor.fef2f2'),
              borderRadius: 10,
              padding: 12,
              borderWidth: 1,
              borderColor: stats.alpha >= 0 ? designToken('perfChart.borderColor.dbeafe') : designToken('perfChart.borderColor.fecaca'),
            }}>
            <Text
              style={{
                fontFamily: designFont('Poppins-Regular'),
                fontSize: 10,
                color: designToken('perfChart.color.666'),
                marginBottom: 4,
              }}>
              Alpha
            </Text>
            <Text
              style={{
                fontFamily: designFont('Poppins-SemiBold'),
                fontSize: 16,
                color: stats.alpha >= 0 ? designToken('perfChart.color.2563eb') : designToken('perfChart.color.dc2626'),
              }}>
              {stats.alpha >= 0 ? '+' : ''}
              {stats.alpha.toFixed(2)}%
            </Text>
          </View>
        </View>
      )}
      {/* Time Period Selector */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'center',
          marginBottom: 12,
          gap: 6,
        }}>
        {TIME_PERIODS.map(period => {
          const isActive = selectedPeriod === period.key;
          return (
            <TouchableOpacity
              key={period.key}
              onPress={() => {
                setSelectedPeriod(period.key);
                setSelectedPoint(null);
              }}
              style={{
                paddingVertical: 6,
                paddingHorizontal: 14,
                borderRadius: 20,
                backgroundColor: isActive ? designToken('perfChart.backgroundColor.1a1a1a') : designToken('perfChart.backgroundColor.f5f5f5'),
              }}>
              <Text
                style={{
                  fontFamily: designFont('Poppins-Medium'),
                  fontSize: 12,
                  color: isActive ? designToken('perfChart.color.fff') : designToken('perfChart.color.666'),
                }}>
                {period.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {/* Chart Card */}
      <View
        style={{
          backgroundColor: designToken('perfChart.backgroundColor.fff'),
          borderRadius: 14,
          elevation: 3,
          paddingTop: 12,
          paddingBottom: 6,
          shadowColor: designToken('perfChart.shadowColor.000'),
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
        }}>
        <View
          style={{ position: 'relative', paddingLeft: 4 }}
          onLayout={e => {
            const w = Math.round(e.nativeEvent.layout.width);
            if (w > 0 && w !== cardWidth) setCardWidth(w);
          }}>
          <LineChart
            data={giftedPortfolio}
            {...(giftedIndex ? {data2: giftedIndex} : {})}
            height={chartHeight}
            // card width − paddingLeft (4) − yAxisLabelWidth (34) − spacing slack
            width={Math.max(120, chartWidth - 50)}
            adjustToWidth
            disableScroll
            curved
            thickness={2.5}
            thickness2={2}
            color1={designToken('perfChart.value.07bad1')}
            color2={designToken('perfChart.value.ff6347')}
            hideDataPoints
            areaChart
            startFillColor={designToken('perfChart.startFillColor.07bad1')}
            endFillColor={designToken('perfChart.endFillColor.07bad1')}
            startOpacity={0.18}
            endOpacity={0.012}
            yAxisOffset={yMin}
            maxValue={Math.max(1, yMax - yMin)}
            noOfSections={4}
            yAxisColor="transparent"
            xAxisColor={designToken('perfChart.xAxisColor.rgba_0_0_0_0_08')}
            rulesType="dashed"
            rulesColor={designToken('perfChart.rulesColor.rgba_0_0_0_0_05')}
            initialSpacing={6}
            endSpacing={6}
            yAxisLabelWidth={34}
            yAxisTextStyle={{
              color: designToken('perfChart.color.9aa0a6'),
              fontSize: 9,
              fontFamily: designFont('Poppins-Regular'),
            }}
            xAxisLabelTextStyle={{
              color: designToken('perfChart.color.9aa0a6'),
              fontSize: 9,
              fontFamily: designFont('Poppins-Regular'),
            }}
            pointerConfig={{
              pointerStripHeight: chartHeight,
              pointerStripColor: designToken('perfChart.pointerStripColor.rgba_0_0_0_0_12'),
              pointerStripWidth: 1,
              pointerColor: designToken('perfChart.pointerColor.07bad1'),
              radius: 4,
              pointerLabelWidth: 150,
              pointerLabelHeight: 80,
              activatePointersOnLongPress: false,
              autoAdjustPointerLabelPosition: true,
              pointerLabelComponent: items => {
                const pt = items?.[0];
                const ix = items?.[1];
                return (
                  <View
                    style={{
                      backgroundColor: designToken('perfChart.backgroundColor.rgba_0_0_0_0_88'),
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 10,
                      minWidth: 140,
                    }}>
                    {hasBenchmark && <Text
                      style={{
                        color: designToken('perfChart.color.rgba_255_255_255_0_7'),
                        fontSize: 10,
                        fontFamily: designFont('Poppins-Regular'),
                        marginBottom: 3,
                      }}>
                      {pt?.date
                        ? new Date(pt.date).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })
                        : ''}
                    </Text>}
                    <Text
                      style={{
                        color: designToken('perfChart.color.07bad1'),
                        fontSize: 12,
                        fontFamily: designFont('Poppins-SemiBold'),
                      }}>
                      Portfolio: {Number(pt?.value || 0).toFixed(2)}
                    </Text>
                    <Text
                      style={{
                        color: designToken('perfChart.color.ff6347'),
                        fontSize: 12,
                        fontFamily: designFont('Poppins-SemiBold'),
                      }}>
                      {selectedIndex === '^NSEI' ? 'Nifty 50' : selectedIndex}:{' '}
                      {Number(ix?.value || 0).toFixed(2)}
                    </Text>
                  </View>
                );
              },
            }}
          />
        </View>

        {/* Legend */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'center',
            paddingVertical: 8,
            gap: 20,
          }}>
          {hasBenchmark && <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View
              style={{
                width: 16,
                height: 3,
                backgroundColor: designToken('perfChart.backgroundColor.07bad1'),
                marginRight: 6,
                borderRadius: 2,
              }}
            />
            <Text
              style={{
                color: designToken('perfChart.color.555'),
                fontFamily: designFont('Poppins-Medium'),
                fontSize: 11,
              }}>
              Portfolio
            </Text>
          </View>}

          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View
              style={{
                width: 16,
                height: 3,
                backgroundColor: designToken('perfChart.backgroundColor.ff6347'),
                marginRight: 6,
                borderRadius: 2,
              }}
            />
            <Text
              style={{
                color: designToken('perfChart.color.555'),
                fontFamily: designFont('Poppins-Medium'),
                fontSize: 11,
              }}>
              {selectedIndex === '^NSEI' ? 'Nifty 50' : selectedIndex}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

export default PerformanceChart;
