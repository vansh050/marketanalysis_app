/**
 * HomeScreen — design-system screen presentation (Phase E.3, 2026-05-02)
 *
 * Pure presentation extracted from src/screens/Home/HomeScreenLegacy.js.
 * Receives a flat `home` prop bag built by the container in
 * src/screens/Home/HomeScreen.js. All container state (8+ useEffect chains,
 * Firebase messaging, notifee, EventEmitter, Animated.Value refs, the
 * `allTabData` builder) stays in the container — this file is just the
 * JSX render + modal renders.
 *
 * Contract: ~40 keys in `home` — tabs/overlays, modal flags, selected
 * media, search, ethical list state, refresh callbacks, allTabData
 * pre-computed array, animated scroll value. See the destructure header
 * for the full list.
 */

import React from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    Animated,
    RefreshControl,
    SafeAreaView,
    FlatList,
    Modal,
    ActivityIndicator,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import YoutubePlayer from 'react-native-youtube-iframe';
import { ArrowLeft, XIcon } from 'lucide-react-native';
import Icon1 from 'react-native-vector-icons/Fontisto';
import Config from '../../../src/utils/safeConfig';

import EducationalBlogs from '../../../src/components/HomeScreenComponents/EducationalBlogs';
import EducationalVideos from '../../../src/components/HomeScreenComponents/EducationalVideos';
import EducationalPDF from '../../../src/components/HomeScreenComponents/EducationalPDF';
import StockAdvices from '../../../src/components/AdviceScreenComponents/StockAdvices';
import RebalanceAdvices from '../../../src/components/AdviceScreenComponents/RebalanceAdvices';
import ModelPortfolioScreen from '../../../src/screens/Drawer/ModelPortfolioScreen';
import LinkOpeningWeb from '../../../src/screens/Home/NewsScreen/LinkOpeningWeb';
import UpdateAppModal from '../../../src/UpdateAppModal';

import styles from '../../../src/screens/Home/HomeScreen.styles';

const selectedVariant = Config?.APP_VARIANT || 'rgxresearch';

// Mirror of ETHICAL_CONFIG from container — used in the ethical-list modal
// JSX. Kept in sync with src/screens/Home/HomeScreen.js.
const ETHICAL_CONFIG = {
    apiEndpoint:
        'https://opensheet.elk.sh/1CQsxO-jsel1YMAxzF-YXN8NmjNgLHrvN3DVTuL3ifVw/Sheet1',
    buttonText: '🕌 Halal Stocks List',
    modalTitle: 'Halal Stock List',
    searchPlaceholder: 'Search stocks...',
    columns: {
        srNo: 'Sr. No.',
        stockName: 'Stock Name',
        ticker: 'Ticker',
    },
};

const HomeScreenPresentation = ({ home }) => {
    const {
        // Tabs / overlays
        seeAllBespoke,
        seeAllBespokeplan,
        seeAllMP,
        seeAllMPplan,
        seeAllBlogs,
        seeAllVideos,
        seeAllPDFs,
        setSeeAllBespoke,
        setSeeAllBespokeplan,
        setSeeAllMP,
        setSeeAllMPplan,
        setSeeAllBlogs,
        setSeeAllVideos,
        setSeeAllPDFs,
        // Bespoke tab inside seeAllBespoke overlay
        bespokeListTab,
        setBespokeListTab,
        // User + config
        userEmail,
        config,
        // Refresh + search
        isRefreshing,
        onRefresh,
        searchQuery,
        setSearchQuery,
        OpenNewsScreen,
        // Animated
        scrollY,
        // List data
        allTabData,
        // Outer modal opens (separate from videoModalVisible/pdfModalVisible inner state)
        Openvideos,
        setOpenvideos,
        Openpdf,
        setOpenpdf,
        OpenBlogs,
        setOpenBlogs,
        // Selected media + per-modal visibility
        selectedVideo,
        setSelectedVideo,
        videoModalVisible,
        setVideoModalVisible,
        selectedBlog,
        blogModalVisible,
        setBlogModalVisible,
        selectedPDF,
        pdfModalVisible,
        setPdfModalVisible,
        // Ethical list modal
        showEthicalList,
        setShowEthicalList,
        ethicalLoading,
        ethicalList,
        ethicalSearchQuery,
        setEthicalSearchQuery,
        // App update modal
        showUpdateModal,
        setShowUpdateModal,
        // Helpers
        onStateChange,
        convertToTimeAgo,
    } = home;

    return (
        <SafeAreaView style={styles.container}>
            {!(
                seeAllBespoke ||
                seeAllMP ||
                seeAllBespokeplan ||
                seeAllMPplan ||
                seeAllBlogs ||
                seeAllVideos ||
                seeAllPDFs
            ) && (
                <View
                    style={{
                        backgroundColor: 'transparent',
                        paddingBottom: 0,
                        zIndex: 13,
                        borderBottomLeftRadius: 30,
                        borderBottomRightRadius: 30,
                    }}>
                    {/* Gradient Border */}
                    {selectedVariant === 'arfs' && (
                        <LinearGradient
                            colors={['#212121', '#212121']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.borderGradient}
                        >
                            <TouchableOpacity
                                onPress={OpenNewsScreen}
                                style={styles.searchBarContainer}>
                                <TextInput
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                    onPress={OpenNewsScreen}
                                    textAlignVertical="bottom"
                                    placeholderTextColor={'#fff'}
                                    style={styles.searchBar}
                                    placeholder="India's First AI News Search. Just Ask"
                                />
                                <Icon1 name="search" size={12} color={'#fff'} />
                            </TouchableOpacity>
                        </LinearGradient>
                    )}
                </View>
            )}

            <SafeAreaView style={{ flex: 1 }}>
                {seeAllMPplan && (
                    <View style={{ flex: 1, display: seeAllMPplan ? 'flex' : 'none' }}>
                        <View style={styles.backButton}>
                            <TouchableOpacity onPress={() => setSeeAllMPplan(false)}>
                                <ArrowLeft size={20} color={'black'} />
                            </TouchableOpacity>
                            <Text style={styles.StockTitle}>Model Portfolios</Text>
                        </View>
                        <ModelPortfolioScreen type={'mpvertical'} />
                    </View>
                )}

                {seeAllBespokeplan && (
                    <View style={{ flex: 1, display: seeAllBespokeplan ? 'flex' : 'none' }}>
                        <View style={styles.backButton}>
                            <TouchableOpacity onPress={() => setSeeAllBespokeplan(false)}>
                                <ArrowLeft size={20} color={'black'} />
                            </TouchableOpacity>
                            <Text style={styles.StockTitle}>Top Bespoke Plans</Text>
                        </View>
                        <ModelPortfolioScreen type={'bespokevertical'} />
                    </View>
                )}

                {seeAllBespoke && (
                    <View style={{ flex: 1 }}>
                        <View style={styles.backButton}>
                            <TouchableOpacity
                                style={{
                                    marginRight: 15,
                                    alignContent: 'center',
                                    alignItems: 'center',
                                    alignSelf: 'center',
                                    marginBottom: 5,
                                }}
                                onPress={() => setSeeAllBespoke(false)}>
                                <ArrowLeft size={20} color={'black'} />
                            </TouchableOpacity>
                            <Text style={styles.StockTitle}>Recommendations</Text>
                        </View>
                        <View style={styles.bespokeTabRow}>
                            {['active', 'rejected'].map(tab => {
                                const isActive = bespokeListTab === tab;
                                return (
                                    <TouchableOpacity
                                        key={tab}
                                        onPress={() => setBespokeListTab(tab)}
                                        activeOpacity={0.85}
                                        style={[
                                            styles.bespokeTabPill,
                                            {
                                                backgroundColor: isActive
                                                    ? config?.mainColor || '#0056B7'
                                                    : '#F4F4F4',
                                            },
                                        ]}>
                                        <Text
                                            style={[
                                                styles.bespokeTabPillText,
                                                { color: isActive ? '#fff' : '#808080' },
                                            ]}>
                                            {tab === 'active' ? 'Active' : 'Rejected'}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                        <StockAdvices
                            userEmail={userEmail}
                            type={bespokeListTab === 'rejected' ? 'OSrejected' : 'All'}
                        />
                    </View>
                )}

                <View style={{ flex: 1, display: seeAllMP ? 'flex' : 'none' }}>
                    <View style={[styles.backButton]}>
                        <TouchableOpacity
                            style={{ marginRight: 10 }}
                            onPress={() => setSeeAllMP(false)}>
                            <ArrowLeft size={20} color={'black'} />
                        </TouchableOpacity>
                        <Text style={styles.StockTitle}>Portfolio Recommendations</Text>
                    </View>
                    <RebalanceAdvices userEmail={userEmail} type={'All'} />
                </View>

                {seeAllBlogs && (
                    <View style={{ flex: 1 }}>
                        <View style={styles.backButton}>
                            <TouchableOpacity onPress={() => setSeeAllBlogs(false)}>
                                <ArrowLeft size={20} color={'black'} />
                            </TouchableOpacity>
                            <Text style={styles.StockTitle}>Latest Blogs</Text>
                        </View>
                        <EducationalBlogs
                            type={'allblogs'}
                            visible={true}
                            setOpenBlogs={setSeeAllBlogs}
                        />
                    </View>
                )}

                {seeAllVideos && (
                    <View style={{ flex: 1 }}>
                        <View style={styles.backButton}>
                            <TouchableOpacity onPress={() => setSeeAllVideos(false)}>
                                <ArrowLeft size={20} color={'black'} />
                            </TouchableOpacity>
                            <Text style={styles.StockTitle}>Educational Videos</Text>
                        </View>
                        <EducationalVideos visible={true} setOpenvideos={setSeeAllVideos} />
                    </View>
                )}

                {seeAllPDFs && (
                    <View style={{ flex: 1 }}>
                        <View style={styles.backButton}>
                            <TouchableOpacity onPress={() => setSeeAllPDFs(false)}>
                                <ArrowLeft size={20} color={'black'} />
                            </TouchableOpacity>
                            <Text style={styles.StockTitle}>PDF Resources</Text>
                        </View>
                        <EducationalPDF visible={true} setOpenpdf={setSeeAllPDFs} />
                    </View>
                )}

                <View
                    style={{
                        display:
                            seeAllBespoke ||
                                seeAllMP ||
                                seeAllMPplan ||
                                seeAllBespokeplan ||
                                seeAllBlogs ||
                                seeAllVideos ||
                                seeAllPDFs
                                ? 'none'
                                : 'flex',
                        flex: 1,
                    }}>
                    <Animated.FlatList
                        data={
                            seeAllBespoke ||
                                seeAllMPplan ||
                                seeAllMP ||
                                seeAllBespokeplan ||
                                seeAllBlogs ||
                                seeAllVideos ||
                                seeAllPDFs
                                ? []
                                : allTabData
                        }
                        nestedScrollEnabled={true}
                        keyExtractor={item => item.key}
                        style={{ zIndex: 11, paddingLeft: 0 }}
                        refreshControl={
                            <RefreshControl
                                style={{ borderBlockColor: 'red' }}
                                refreshing={isRefreshing}
                                onRefresh={onRefresh}
                            />
                        }
                        renderItem={({ item }) => <View>{item.component}</View>}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{
                            zIndex: 1000,
                            paddingBottom: 20,
                        }}
                        onScroll={Animated.event(
                            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                            { useNativeDriver: true },
                        )}
                    />

                    {/* Modal components for full-screen viewing */}
                    {Openvideos && (
                        <EducationalVideos
                            visible={Openvideos}
                            setOpenvideos={setOpenvideos}
                        />
                    )}

                    {Openpdf && (
                        <EducationalPDF visible={Openpdf} setOpenpdf={setOpenpdf} />
                    )}

                    {OpenBlogs && (
                        <EducationalBlogs
                            type={'allblogs'}
                            visible={OpenBlogs}
                            setOpenBlogs={setOpenBlogs}
                        />
                    )}

                    {/* Video Player Modal */}
                    {selectedVideo && (
                        <Modal
                            visible={videoModalVisible}
                            transparent={true}
                            animationType="fade"
                            onRequestClose={() => {
                                setVideoModalVisible(false);
                                setSelectedVideo(null);
                            }}>
                            <View style={styles.videoModalBackground}>
                                <View style={styles.videoModalContent}>
                                    <View style={styles.videoModalHeader}>
                                        <Text style={styles.videoModalTitle} numberOfLines={1}>
                                            {selectedVideo.title}
                                        </Text>
                                        <TouchableOpacity
                                            onPress={() => {
                                                setVideoModalVisible(false);
                                                setSelectedVideo(null);
                                            }}>
                                            <XIcon size={20} color="#fff" />
                                        </TouchableOpacity>
                                    </View>
                                    <YoutubePlayer
                                        height={250}
                                        play={true}
                                        videoId={selectedVideo.id}
                                        onChangeState={onStateChange}
                                    />
                                </View>
                            </View>
                        </Modal>
                    )}

                    {/* Blog Viewer Modal */}
                    {selectedBlog && (
                        <LinkOpeningWeb
                            symbol={selectedBlog.title}
                            setWebview={setBlogModalVisible}
                            webViewVisible={blogModalVisible}
                            currentUrl={
                                selectedBlog.content && selectedBlog.content.trim().length > 0
                                    ? `data:text/html;charset=utf-8,${encodeURIComponent(`
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <style>
                body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  line-height: 1.6;
                  margin: 0;
                  padding: 20px;
                  background-color: #ffffff;
                  color: #333;
                }
                h1, h2, h3, h4, h5, h6 {
                  color: #2c3e50;
                  margin-top: 24px;
                  margin-bottom: 16px;
                }
                p { margin-bottom: 16px; }
                img { max-width: 100%; height: auto; border-radius: 8px; }
                .ql-video { width: 100%; height: 200px; border-radius: 8px; }
                a { color: #3498db; text-decoration: none; }
                a:hover { text-decoration: underline; }
                strong { font-weight: 600; }
                em { font-style: italic; }
                ol, ul { padding-left: 20px; margin-bottom: 16px; }
                li { margin-bottom: 8px; }
              </style>
            </head>
            <body>
              <h1>${selectedBlog.title}</h1>
              <div style="color: #666; font-size: 14px; margin-bottom: 20px;">
                ${convertToTimeAgo(selectedBlog.created_at)}
              </div>
              ${selectedBlog.content}
            </body>
            </html>
          `)}`
                                    : selectedBlog.link ||
                                    selectedBlog.videoUrl ||
                                    `data:text/html;charset=utf-8,${encodeURIComponent(`
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <style>
                body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  text-align: center;
                  padding: 40px 20px;
                  background-color: #f8f9fa;
                  color: #666;
                }
                .message {
                  background: white;
                  padding: 30px;
                  border-radius: 12px;
                  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                }
              </style>
            </head>
            <body>
              <div class="message">
                <h2>${selectedBlog.title}</h2>
                <p>Content is not available for this blog post.</p>
                <p style="font-size: 14px; color: #999;">Published ${convertToTimeAgo(
                                                    selectedBlog.created_at,
                                                )}</p>
              </div>
            </body>
            </html>
          `)}`
                            }
                        />
                    )}

                    {/* PDF Viewer Modal */}
                    {selectedPDF && (
                        <EducationalPDF
                            visible={pdfModalVisible}
                            setOpenpdf={setPdfModalVisible}
                            selectedPDF={selectedPDF}
                        />
                    )}
                </View>
            </SafeAreaView>

            <Modal
                visible={showEthicalList}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowEthicalList(false)}>
                <View
                    style={{
                        flex: 1,
                        backgroundColor: 'rgba(0,0,0,0.4)',
                        justifyContent: 'center',
                        alignItems: 'center',
                    }}>
                    <View
                        style={{
                            backgroundColor: '#fff',
                            borderRadius: 24,
                            padding: 24,
                            width: '92%',
                            maxHeight: '100%',
                            minHeight: 700,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.2,
                            shadowRadius: 12,
                            elevation: 8,
                        }}>
                        <View
                            style={{
                                flexDirection: 'row',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: 10,
                            }}>
                            <Text
                                style={{
                                    fontSize: 20,
                                    fontFamily: 'Satoshi-Bold',
                                    color: '#00639C',
                                }}>
                                {ETHICAL_CONFIG.modalTitle}
                            </Text>
                            <TouchableOpacity onPress={() => setShowEthicalList(false)}>
                                <Text style={{ fontSize: 18, color: '#00639C' }}>Close</Text>
                            </TouchableOpacity>
                        </View>
                        {ethicalLoading ? (
                            <ActivityIndicator
                                size="large"
                                color="#00639C"
                                style={{ marginTop: 40 }}
                            />
                        ) : (
                            <View style={{ flex: 1, minHeight: 200 }}>
                                <TextInput
                                    value={ethicalSearchQuery}
                                    onChangeText={setEthicalSearchQuery}
                                    placeholder={ETHICAL_CONFIG.searchPlaceholder}
                                    placeholderTextColor="#8AA7C4"
                                    style={{
                                        borderColor: '#E0E0E0',
                                        borderWidth: 1,
                                        borderRadius: 8,
                                        paddingHorizontal: 12,
                                        paddingVertical: 8,
                                        marginBottom: 8,
                                        color: '#003A5C',
                                        fontFamily: 'Satoshi-Regular',
                                    }}
                                />
                                <View
                                    style={{
                                        flexDirection: 'row',
                                        backgroundColor: '#F0F4FF',
                                        borderRadius: 6,
                                        paddingVertical: 8,
                                        paddingHorizontal: 10,
                                        marginBottom: 4,
                                    }}>
                                    <Text style={{ flex: 1, fontWeight: 'bold', color: '#00639C' }}>
                                        {ETHICAL_CONFIG.columns.srNo}
                                    </Text>
                                    <Text style={{ flex: 3, fontWeight: 'bold', color: '#00639C' }}>
                                        {ETHICAL_CONFIG.columns.stockName}
                                    </Text>
                                    <Text style={{ flex: 2, fontWeight: 'bold', color: '#00639C' }}>
                                        {ETHICAL_CONFIG.columns.ticker}
                                    </Text>
                                </View>
                                <FlatList
                                    data={
                                        ethicalList.filter(item => {
                                            const q = (ethicalSearchQuery || '').trim().toLowerCase();
                                            if (!q) return true;
                                            const name = String(item[ETHICAL_CONFIG.columns.stockName] || '').toLowerCase();
                                            const ticker = String(item[ETHICAL_CONFIG.columns.ticker] || '').toLowerCase();
                                            return name.includes(q) || ticker.includes(q);
                                        })
                                    }
                                    keyExtractor={(_, idx) => idx.toString()}
                                    showsVerticalScrollIndicator={true}
                                    contentContainerStyle={{ paddingBottom: 10 }}
                                    renderItem={({ item }) => (
                                        <View
                                            style={{
                                                flexDirection: 'row',
                                                backgroundColor: '#F8F9FF',
                                                borderRadius: 6,
                                                paddingVertical: 8,
                                                paddingHorizontal: 10,
                                                marginBottom: 2,
                                            }}>
                                            <Text style={{ flex: 1, color: '#333' }}>
                                                {item[ETHICAL_CONFIG.columns.srNo]}
                                            </Text>
                                            <Text style={{ flex: 3, color: '#333' }}>
                                                {item[ETHICAL_CONFIG.columns.stockName]}
                                            </Text>
                                            <Text style={{ flex: 2, color: '#333' }}>
                                                {item[ETHICAL_CONFIG.columns.ticker]}
                                            </Text>
                                        </View>
                                    )}
                                />
                            </View>
                        )}
                    </View>
                </View>
            </Modal>

            {/* App Update Modal */}
            <UpdateAppModal
                visible={showUpdateModal}
                onClose={() => setShowUpdateModal(false)}
            />
        </SafeAreaView>
    );
};

export default HomeScreenPresentation;
