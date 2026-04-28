// PerformanceChart.js
import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import Config from 'react-native-config';
import { generateToken } from '../../utils/SecurityTokenManager';
import server from '../../utils/serverConfig';
import { BarChart2, TrendingUp, TrendingDown } from 'lucide-react-native';
import { useTrade } from '../../screens/TradeContext';

const screenWidth = Dimensions.get('window').width;

const TIME_PERIODS = [
  { key: '1M', label: '1M', days: 30 },
  { key: '3M', label: '3M', days: 90 },
  { key: '6M', label: '6M', days: 180 },
  { key: '1Y', label: '1Y', days: 365 },
  { key: 'ALL', label: 'All', days: null },
];

const PerformanceChart = ({ modelName, advisor }) => {
  const { configData } = useTrade();
  const [selectedIndex] = useState('^NSEI');
  const [allAlignedData, setAllAlignedData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
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

      const response = await fetch(
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
      const data = await response.json();
      return data.data || [];
    } catch (err) {
      console.error('Error fetching index data:', err);
      return [];
    }
  };

  const fetchPortfolioData = async () => {
    try {
      console.log('📊 PerformanceChart: Fetching with advisor:', advisorTag, 'modelName:', normalizedModelName);

      const response = await fetch(
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
        const errorText = await response.text().catch(() => '');
        console.error(`📊 PerformanceChart API error: ${response.status}`, errorText);
        return [];
      }

      const data = await response.json();
      console.log('📊 PerformanceChart: API response status:', data.status, 'data length:', data.data?.length || 0);

      if (data.status === 0 && data.message === 'No performance data found.') {
        return [];
      }

      return data.data || [];
    } catch (err) {
      console.error('Error fetching portfolio data:', err);
      return [];
    }
  };

  const fetchData = async () => {
    // Don't fetch if we don't have the advisor tag yet
    if (!advisorTag) {
      console.log('📊 PerformanceChart: Waiting for advisor config...');
      return;
    }

    setLoading(true);
    setError(null);
    setSelectedPoint(null);

    try {
      const [portfolio, indexData] = await Promise.all([
        fetchPortfolioData(),
        fetchIndexData(),
      ]);

      if (!portfolio?.length || !indexData?.length) {
        setAllAlignedData([]);
        setLoading(false);
        return;
      }

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
      if (!firstIndexValue) firstIndexValue = 100;

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

          if (!indexClose) return null;

          return {
            date: pDate,
            portfolioValue: (p.value / firstPortfolioValue) * 100,
            indexValue: (indexClose / firstIndexValue) * 100,
            actualIndexValue: indexClose,
            actualPortfolioValue: p.value,
          };
        })
        .filter(d => d !== null)
        .sort((a, b) => new Date(a.date) - new Date(b.date));

      setAllAlignedData(alignedData);
    } catch (err) {
      console.error('Error in fetchData:', err);
      setError(err?.message || 'Something went wrong');
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
    const firstI = filtered[0].indexValue;
    return filtered.map(d => ({
      ...d,
      portfolioValue: (d.portfolioValue / firstP) * 100,
      indexValue: (d.indexValue / firstI) * 100,
    }));
  }, [allAlignedData, selectedPeriod]);

  // Calculate summary stats
  const stats = useMemo(() => {
    if (!portfolioData.length) return null;
    const last = portfolioData[portfolioData.length - 1];
    const portfolioReturn = last.portfolioValue - 100;
    const indexReturn = last.indexValue - 100;
    const alpha = portfolioReturn - indexReturn;
    return { portfolioReturn, indexReturn, alpha };
  }, [portfolioData]);

  if (loading) {
    return (
      <View style={{ padding: 40, alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#0070D0" />
        <Text
          style={{
            color: '#888',
            fontFamily: 'Poppins-Regular',
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
        <Text style={{ color: '#D00', fontFamily: 'Poppins-Medium' }}>
          {error}
        </Text>
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
        <BarChart2 size={48} color="#888" style={{ marginBottom: 16 }} />
        <Text
          style={{
            color: '#000',
            fontFamily: 'Poppins-SemiBold',
            fontSize: 16,
            marginBottom: 8,
          }}>
          No performance data available
        </Text>
        <Text
          style={{
            color: '#666',
            fontFamily: 'Poppins-Regular',
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
  const indexValues = sampledData.map(d => d.indexValue);

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

  const chartWidth = screenWidth - 40; // fit within screen with padding
  const chartHeight = 220;

  return (
    <View style={{ paddingTop: 4 }}>
      {/* Header */}
      <Text
        style={{
          fontFamily: 'Poppins-SemiBold',
          fontSize: 15,
          color: '#1a1a1a',
          marginBottom: 4,
        }}>
        Performance
      </Text>
      <Text
        style={{
          fontFamily: 'Poppins-Regular',
          fontSize: 11,
          color: '#888',
          marginBottom: 12,
          lineHeight: 16,
        }}>
        Simulated portfolio performance vs{' '}
        {selectedIndex === '^NSEI' ? 'Nifty 50' : selectedIndex} (base 100)
      </Text>

      {/* Summary Stats Cards */}
      {stats && (
        <View
          style={{
            flexDirection: 'row',
            marginBottom: 16,
            gap: 10,
          }}>
          <View
            style={{
              flex: 1,
              backgroundColor: stats.portfolioReturn >= 0 ? '#f0fdf4' : '#fef2f2',
              borderRadius: 10,
              padding: 12,
              borderWidth: 1,
              borderColor: stats.portfolioReturn >= 0 ? '#dcfce7' : '#fecaca',
            }}>
            <Text
              style={{
                fontFamily: 'Poppins-Regular',
                fontSize: 10,
                color: '#666',
                marginBottom: 4,
              }}>
              Portfolio
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {stats.portfolioReturn >= 0 ? (
                <TrendingUp size={14} color="#16a34a" />
              ) : (
                <TrendingDown size={14} color="#dc2626" />
              )}
              <Text
                style={{
                  fontFamily: 'Poppins-SemiBold',
                  fontSize: 16,
                  color: stats.portfolioReturn >= 0 ? '#16a34a' : '#dc2626',
                  marginLeft: 4,
                }}>
                {stats.portfolioReturn >= 0 ? '+' : ''}
                {stats.portfolioReturn.toFixed(2)}%
              </Text>
            </View>
          </View>

          <View
            style={{
              flex: 1,
              backgroundColor: stats.indexReturn >= 0 ? '#f0fdf4' : '#fef2f2',
              borderRadius: 10,
              padding: 12,
              borderWidth: 1,
              borderColor: stats.indexReturn >= 0 ? '#dcfce7' : '#fecaca',
            }}>
            <Text
              style={{
                fontFamily: 'Poppins-Regular',
                fontSize: 10,
                color: '#666',
                marginBottom: 4,
              }}>
              {selectedIndex === '^NSEI' ? 'Nifty 50' : selectedIndex}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {stats.indexReturn >= 0 ? (
                <TrendingUp size={14} color="#16a34a" />
              ) : (
                <TrendingDown size={14} color="#dc2626" />
              )}
              <Text
                style={{
                  fontFamily: 'Poppins-SemiBold',
                  fontSize: 16,
                  color: stats.indexReturn >= 0 ? '#16a34a' : '#dc2626',
                  marginLeft: 4,
                }}>
                {stats.indexReturn >= 0 ? '+' : ''}
                {stats.indexReturn.toFixed(2)}%
              </Text>
            </View>
          </View>

          <View
            style={{
              flex: 1,
              backgroundColor: stats.alpha >= 0 ? '#eff6ff' : '#fef2f2',
              borderRadius: 10,
              padding: 12,
              borderWidth: 1,
              borderColor: stats.alpha >= 0 ? '#dbeafe' : '#fecaca',
            }}>
            <Text
              style={{
                fontFamily: 'Poppins-Regular',
                fontSize: 10,
                color: '#666',
                marginBottom: 4,
              }}>
              Alpha
            </Text>
            <Text
              style={{
                fontFamily: 'Poppins-SemiBold',
                fontSize: 16,
                color: stats.alpha >= 0 ? '#2563eb' : '#dc2626',
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
                backgroundColor: isActive ? '#1a1a1a' : '#f5f5f5',
              }}>
              <Text
                style={{
                  fontFamily: 'Poppins-Medium',
                  fontSize: 12,
                  color: isActive ? '#fff' : '#666',
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
          backgroundColor: '#fff',
          borderRadius: 14,
          elevation: 3,
          paddingTop: 12,
          paddingBottom: 6,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
        }}>
        <View style={{ position: 'relative' }}>
          <LineChart
            data={{
              labels: labels,
              datasets: [
                {
                  data: portfolioValues,
                  color: (opacity = 1) => `rgba(7, 186, 209, ${opacity})`,
                  strokeWidth: 2.5,
                },
                {
                  data: indexValues,
                  color: (opacity = 1) => `rgba(255, 99, 71, ${opacity})`,
                  strokeWidth: 2,
                },
              ],
            }}
            width={chartWidth}
            height={chartHeight}
            chartConfig={{
              backgroundColor: '#fff',
              backgroundGradientFrom: '#fff',
              backgroundGradientTo: '#fff',
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(0,0,0,${opacity})`,
              labelColor: () => 'rgba(130,130,130,1)',
              propsForDots: { r: '0' },
              propsForBackgroundLines: {
                stroke: 'rgba(0,0,0,0.05)',
                strokeDasharray: '4,4',
              },
              fillShadowGradient: 'rgba(7, 186, 209, 0.1)',
              fillShadowGradientOpacity: 0.15,
            }}
            bezier
            withInnerLines
            withOuterLines={false}
            withDots={false}
            yLabelsOffset={8}
            xLabelsOffset={-4}
            fromZero={false}
            segments={4}
            style={{ borderRadius: 14, marginLeft: -6 }}
            onDataPointClick={data => {
              const idx = data.index;
              const ds = data.datasetIndex ?? 0;
              const x = Number(data.x);
              const y = Number(data.y);
              const dataPoint = sampledData[idx];
              if (!dataPoint) return;

              const pointInfo = {
                index: idx,
                datasetIndex: ds,
                x,
                y,
                portfolio: dataPoint.portfolioValue,
                nifty: dataPoint.indexValue,
                date: dataPoint.date,
              };

              if (
                selectedPoint &&
                selectedPoint.index === idx &&
                selectedPoint.datasetIndex === ds
              ) {
                setSelectedPoint(null);
              } else {
                setSelectedPoint(pointInfo);
              }
            }}
          />

          {/* Tooltip */}
          {selectedPoint && (
            <View
              style={{
                position: 'absolute',
                left: Math.max(
                  8,
                  Math.min(
                    chartWidth - 160,
                    selectedPoint.x - 70,
                  ),
                ),
                top: Math.max(4, Math.min(chartHeight - 80, selectedPoint.y - 75)),
                backgroundColor: 'rgba(0,0,0,0.88)',
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 10,
                zIndex: 30,
                minWidth: 140,
              }}>
              <Text
                style={{
                  color: 'rgba(255,255,255,0.7)',
                  fontSize: 10,
                  fontFamily: 'Poppins-Regular',
                  marginBottom: 3,
                }}>
                {new Date(selectedPoint.date).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </Text>
              <Text
                style={{
                  color: '#07BAD1',
                  fontSize: 12,
                  fontFamily: 'Poppins-SemiBold',
                }}>
                Portfolio: {selectedPoint.portfolio?.toFixed(2)}
              </Text>
              <Text
                style={{
                  color: '#FF6347',
                  fontSize: 12,
                  fontFamily: 'Poppins-SemiBold',
                }}>
                Nifty: {selectedPoint.nifty?.toFixed(2)}
              </Text>
            </View>
          )}
        </View>

        {/* Legend */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'center',
            paddingVertical: 8,
            gap: 20,
          }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View
              style={{
                width: 16,
                height: 3,
                backgroundColor: '#07BAD1',
                marginRight: 6,
                borderRadius: 2,
              }}
            />
            <Text
              style={{
                color: '#555',
                fontFamily: 'Poppins-Medium',
                fontSize: 11,
              }}>
              Portfolio
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View
              style={{
                width: 16,
                height: 3,
                backgroundColor: '#FF6347',
                marginRight: 6,
                borderRadius: 2,
              }}
            />
            <Text
              style={{
                color: '#555',
                fontFamily: 'Poppins-Medium',
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