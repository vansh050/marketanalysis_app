import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView, ActivityIndicator, Modal, TextInput} from 'react-native';
import {FileText, Search, Download, Filter, Calendar, ChevronLeft} from 'lucide-react-native';
import LinearGradient from 'react-native-linear-gradient';

import {designColor, designFont} from '../../../src/design/literalTokens';

const ResearchReportScreen = ({viewModel, actions}) => {
  const {
    gradient1, gradient2, mainColor, searchQuery, isDateFilterOpen,
    startDate, endDate, isSortMenuOpen, sortOrder, filteredSymbols,
    loading, livePrices, loadingRowIndex, symbolsWithLTP,
  } = viewModel;
  const {
    onBack, setSearchQuery, toggleSortMenu, toggleDateFilter,
    setStartDate, setEndDate, clearDateFilter, setSorting,
    handleDownloadResearchReport, formatReportDateTime, getMonthText,
  } = actions;
  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient   colors={[gradient1, gradient2]}
        start={{ x: 0, y: 0 }}
  end={{ x: 1, y: 1 }}
   style={styles.headerGradient}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
      <ChevronLeft size={24} color={designColor('000')} />
    </TouchableOpacity>
          <Text style={styles.headerTitle}>Research Report</Text>
        </View>
      </LinearGradient>
      {/* Search & Date Bar */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Search size={16} color={designColor('98aec7')} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by names, price"
            placeholderTextColor={designColor('a9b6d2')}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <TouchableOpacity style={styles.sortButton} onPress={toggleSortMenu}>
            <Filter size={18} color={designColor('93aad2')} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={[styles.dateFilterBtn, { backgroundColor: mainColor }]} onPress={toggleDateFilter}>
          <Calendar size={17} color={designColor('fff')} />
          <Text style={styles.dateFilterText}>Date</Text>
        </TouchableOpacity>
      </View>
      {/* Date Filter Modal */}
      <Modal
        visible={isDateFilterOpen}
        transparent
        animationType="fade"
        onRequestClose={toggleDateFilter}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.dateFilterPanel}>
            <Text style={styles.dateLabel}>Start Date</Text>
            <TextInput
              style={styles.dateInput}
              placeholder="YYYY-MM-DD"
              value={startDate}
              onChangeText={setStartDate}
              placeholderTextColor={designColor('999')}
            />
            <Text style={styles.dateLabel}>End Date</Text>
            <TextInput
              style={styles.dateInput}
              placeholder="YYYY-MM-DD"
              value={endDate}
              onChangeText={setEndDate}
              placeholderTextColor={designColor('999')}
            />
            <View style={styles.dateFilterActions}>
              <TouchableOpacity style={styles.clearButton} onPress={clearDateFilter}>
                <Text style={styles.clearButtonText}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.closeButton} onPress={toggleDateFilter}>
                <Text style={styles.closeButtonText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* Sort Menu */}
      {isSortMenuOpen && (
        <View style={styles.sortMenu}>
          <TouchableOpacity
            style={[styles.sortOption, sortOrder === 'latest' && styles.sortOptionActive]}
            onPress={() => setSorting('latest')}
          >
            <Text style={[styles.sortOptionText, sortOrder === 'latest' && styles.sortOptionTextActive]}>
              Latest First
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sortOption, sortOrder === 'oldest' && styles.sortOptionActive]}
            onPress={() => setSorting('oldest')}
          >
            <Text style={[styles.sortOptionText, sortOrder === 'oldest' && styles.sortOptionTextActive]}>
              Oldest First
            </Text>
          </TouchableOpacity>
        </View>
      )}
      {/* Active Filters Display */}
      {(startDate || endDate || sortOrder !== 'latest') && (
        <ScrollView
          horizontal
  style={{ maxHeight: 40 }}
  contentContainerStyle={{ alignItems: 'center' }}
  showsHorizontalScrollIndicator={false}
  >

          {startDate ? (
            <View style={styles.filterChip}>
              <Text style={styles.filterChipText}>From: {startDate}</Text>
            </View>
          ) : null}
          {endDate ? (
            <View style={styles.filterChip}>
              <Text style={styles.filterChipText}>To: {endDate}</Text>
            </View>
          ) : null}
          {sortOrder !== 'latest' ? (
            <View style={styles.filterChip}>
              <Text style={styles.filterChipText}>Sorted: {sortOrder}</Text>
            </View>
          ) : null}
        </ScrollView>
      )}
      {/* Section Label */}
      <View style={styles.sectionLabel}>
        <Text style={styles.monthLabel}>{getMonthText()}</Text>
        <Text style={styles.reportsLabel}>{filteredSymbols.length} Reports</Text>
      </View>
      {/* Table Rows */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={designColor('407bff')} />
            <Text style={styles.loadingText}>Loading research reports...</Text>
          </View>
        ) : filteredSymbols.length > 0 ? (
          filteredSymbols.map((report, idx) => {
            const recoType = (report.recommendationType || '').toUpperCase();
            const isBuy = recoType === 'BUY';
            const isSell = recoType === 'SELL';
            return (
              <View style={styles.reportCard} key={report._id || idx}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reportSymbol}>
                    {report.symbol} {report.stockName ? <Text style={styles.reportNSE}>({report.stockName})</Text> : null}
                  </Text>
                  <Text style={styles.reportLTP}>
                    LTP : <Text style={{ fontWeight: '700' }}>
                      {Number(livePrices[String(report.symbol || '').trim().toUpperCase()]) > 0
                        ? `₹${Number(livePrices[String(report.symbol || '').trim().toUpperCase()]).toLocaleString('en-IN')}`
                        : Number(report.currentPrice) > 0
                          ? `₹${Number(report.currentPrice).toLocaleString('en-IN')}`
                          : 'LTP unavailable'}
                    </Text>
                  </Text>
                </View>
                <View style={styles.reportCenter}>
                  {recoType ? (
                  <View
                    style={[
                      styles.tradeChip,
                      isBuy ? styles.buyChip : isSell ? styles.sellChip : styles.mixedChip,
                    ]}
                  >
                    <Text
                      style={[
                        styles.tradeChipText,
                        isBuy ? styles.buyChipText : isSell ? styles.sellChipText : styles.mixedChipText,
                      ]}
                    >
                      {isBuy ? 'Buy' : isSell ? 'Sell' : recoType}
                    </Text>
                  </View>
                  ) : null}
                  <Text style={styles.reportDate}>
                    {formatReportDateTime(report.sentAt)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.reportRight}
                  onPress={() => handleDownloadResearchReport(report)}
                  disabled={loadingRowIndex === report._id}
                >
                  {loadingRowIndex === report._id ? (
                    <ActivityIndicator size="small" color={designColor('045dff')} />
                  ) : (
                    <Download size={18} color={designColor('045dff')} />
                  )}
                </TouchableOpacity>
              </View>
            );
          })
        ) : (
          <View style={styles.emptyContainer}>
            <FileText size={48} color={designColor('ccc')} />
            <Text style={styles.emptyTitle}>
              {symbolsWithLTP.length > 0 ? 'No Results Found' : 'No Research Reports Available'}
            </Text>
            <Text style={styles.emptyDescription}>
              {symbolsWithLTP.length > 0
                ? 'Try adjusting your search or date filters.'
                : 'Research reports will appear here when available.'}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: designColor('f4f8fe') },
  headerGradient: {
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    paddingBottom: 10,
    paddingTop: 6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    height: 52,
  },
  headerBack: {
    padding: 4,
    marginRight: 6,
  },
  headerTitle: {
    flex: 1,
    color: designColor('fff'),
    fontWeight: '600',
    fontSize: 18,
    letterSpacing: 0.1,
  },
  headerAvatar: {
    width: 30,
    height: 30,
    backgroundColor: designColor('fff'),
    borderRadius: 15,
    marginLeft: 9,
  },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 17,
    marginHorizontal: 13,
    gap: 7,
  },
  searchBox: {
    flexDirection: 'row',
    backgroundColor: designColor('f4f8fe'),
    borderRadius: 7,
    borderWidth: 1,
    borderColor: designColor('dbe7ff'),
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 7,
    height: 42,
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: designColor('1f2b38'),
    fontWeight: '400',
    marginLeft: 7,
  },
  sortButton: {
    paddingHorizontal: 4,
  },
  dateFilterBtn: {
    flexDirection: 'row',
    backgroundColor: designColor('045dff'),
    borderRadius: 5,
    paddingHorizontal: 13,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  dateFilterText: {
    color: designColor('fff'),
    fontWeight: '500',
    fontSize: 14,
    marginLeft: 5,
  },
  sortMenu: {
    backgroundColor: designColor('fff'),
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    marginHorizontal: 13,
    shadowColor: designColor('000'),
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  sortOption: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
  },
  sortOptionActive: {
    backgroundColor: designColor('e0e3eb'),
    fontWeight: '600',
  },
  sortOptionText: {
    fontSize: 16,
    color: designColor('374151'),
    fontFamily: designFont('Helvetica Neue'),
  },
  sortOptionTextActive: {
    color: designColor('407bff'),
  },
activeFiltersWrap: {
  flexDirection: 'row',
  alignItems: 'center',
  height:10,

},


filterChip: {
  backgroundColor: designColor('f4f8fe'),
  borderRadius: 15,
  paddingHorizontal: 12,
  paddingVertical: 4, // Increase slightly for vertical spacing without making chip too tall
  marginHorizontal: 6,
  justifyContent: 'center',
  borderWidth: 1,
  borderColor: designColor('dbe7ff'),
  alignSelf: 'flex-start', // So multiple chips wrap nicely without stretching full width
  minHeight: 28,            // Explicit height to avoid large height
  height: 28,               // Fix height to 28 for uniformity
  flexDirection: 'row',     // To make text and possible icons align horizontally
  alignItems: 'center',     // Vertically center text
},
filterChipText: {
  color: designColor('374151'),
  fontSize: 13,
  fontWeight: '600',
  lineHeight: 18,           // Control line height for text vertical size
},

  dateInput: {
    backgroundColor: designColor('f4f8fe'),
    borderRadius: 5,
    borderWidth: 1,
    borderColor: designColor('dbe7ff'),
    paddingHorizontal: 12,
    height: 42,
    fontSize: 16,
    color: designColor('222'),
    marginBottom: 8,
  },
  sectionLabel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: designColor('f4f8fe'),
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 3,
    marginBottom: 6,
  },
  monthLabel: {
    color: designColor('284879'),
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  reportsLabel: {
    color: designColor('6983a3'),
    fontSize: 13,
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
    backgroundColor: designColor('f4f8fe'),
  },
  scrollContent: {
    paddingBottom: 18,
  },
  reportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: designColor('fff'),
    borderRadius: 10,
    marginHorizontal: 12,
    marginTop: 5,
    marginBottom: 7,
    paddingHorizontal: 17,
    paddingVertical: 15,
    elevation: 1,
    shadowColor: designColor('89abc6'),
    shadowOpacity: 0.09,
  },
  reportSymbol: { color: designColor('284879'), fontWeight: '600', fontSize: 15, marginBottom: 2 },
  reportNSE: { color: designColor('7ba2cb'), fontSize: 11, fontWeight: '400' },
  reportLTP: {
    color: designColor('68859d'),
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 6,
  },
  reportCenter: { minWidth: 62, alignItems: 'flex-end', marginRight: 6 },
  tradeChip: {
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginBottom: 5,
    minWidth: 50,
    alignItems: 'center',
  },
  buyChip: { backgroundColor: designColor('def7ec') },
  sellChip: { backgroundColor: designColor('fad3d5') },
  mixedChip: { backgroundColor: designColor('e5e7eb') },
  tradeChipText: { fontSize: 13, fontWeight: '700' },
  buyChipText: { color: designColor('21a862') },
  sellChipText: { color: designColor('e22525') },
  mixedChipText: { color: designColor('6b7280') },
  reportDate: {
    color: designColor('98a7bf'),
    fontSize: 9,
    fontWeight: '500',
  },
  reportRight: { padding: 4, marginLeft: 2 },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
    minHeight: 400,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: designColor('666'),
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: designColor('374151'),
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 16,
    color: designColor('6b7280'),
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: designColor('fff'),
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: designColor('e0e3eb'),
    backgroundColor: designColor('fff'),
  },
  closeButton: {
    padding: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: designColor('111827'),
  },
  webView: {
    flex: 1,
  },
  pdfLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: designColor('f8fafc'),
  },
  pdfLoadingText: {
    marginTop: 16,
    fontSize: 16,
    color: designColor('666'),
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(40,58,95,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },backButton: { padding: 4,borderRadius:5, backgroundColor: designColor('fff'),marginRight:10 },
  dateFilterPanel: {
    backgroundColor: designColor('fff'),
    borderRadius: 12,
    padding: 18,
    width: 285,
    shadowColor: designColor('000'),
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.11,
    shadowRadius: 12,
    elevation: 4,
  },
  dateLabel: {
    fontSize: 14,
    color: designColor('6b7280'),
    marginBottom: 4,
    marginTop: 11,
  },
  dateInput: {
    backgroundColor: designColor('f4f8fe'),
    borderRadius: 5,
    borderWidth: 1,
    borderColor: designColor('dbe7ff'),
    paddingHorizontal: 12,
    height: 42,
    fontSize: 16,
    color: designColor('222'),
    marginBottom: 8,
  },
  dateFilterActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
    gap: 11,
  },
  clearButton: {
    backgroundColor: designColor('407bff'),
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
  },
  clearButtonText: {
    color: designColor('fff'),
    fontSize: 14,
    fontWeight: '600',
  },
  closeButton: {
    backgroundColor: designColor('e0e3eb'),
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
  },
  closeButtonText: {
    color: designColor('374151'),
    fontSize: 14,
    fontWeight: '600',
  },
});

export default ResearchReportScreen;
