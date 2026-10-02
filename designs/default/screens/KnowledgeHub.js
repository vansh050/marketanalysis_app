import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Modal, SafeAreaView} from 'react-native';
import moment from 'moment';
import YoutubePlayer from 'react-native-youtube-iframe';
import RnVideo from 'react-native-video';
import {Video, Play, BookOpen, FileText, XIcon, Clock, ChevronLeft, ExternalLink} from 'lucide-react-native';
import {WebView} from 'react-native-webview';
import LinearGradient from 'react-native-linear-gradient';

import {designColor, designFont} from '../../../src/design/literalTokens';

const getVideoType = video => {
  if (video?.video_type) return video.video_type;
  const url = video?.youtube_url || video?.youtubeUrl || '';
  if (/vimeo\.com/i.test(url)) return 'vimeo';
  if (/\.(mp4|webm|m4v|mov)(\?|$)/i.test(url)) return 'direct';
  return 'youtube';
};
const getVimeoId = video => {
  const url = video?.youtube_url || video?.youtubeUrl || '';
  const match = url.match(/playback\/(\d+)/) || url.match(/vimeo\.com\/(\d+)/);
  return video?.video_id || match?.[1] || null;
};

const KnowledgeHub = ({viewModel, actions, slots}) => {
  const {
    type, maxItems, gradient1, gradient2, mainColor, activeTab,
    videos, blogs, pdf, modalVisible, title, currentUrl,
    selectedVideo, videoModalVisible, insightsUrl,
  } = viewModel;
  const {
    handleViewAllPress, handleTabPress, handleContentPress,
    setModalVisible, setVideoModalVisible, setSelectedVideo,
    onStateChange, formatFileSize, onBack, onOpenInsights,
  } = actions;
  const WebLink = slots.WebLink;
  const tabs = [
    {id: 'Videos', label: 'Videos', iconComponent: Video},
    {id: 'Blogs', label: 'Blogs', iconComponent: BookOpen},
    {id: 'PDFs', label: 'PDFs', iconComponent: FileText},
  ];
    // Reusable Empty State component
    const EmptyState = ({ type }) => {
        const messages = {
            Videos: {
                title: "No Videos Available",
                subtitle: "New learning videos will appear here once added.",
                emoji: "🎥",
            },
            Blogs: {
                title: "No Blogs Available",
                subtitle: "Stay tuned! Blogs will show up here once published.",
                emoji: "✍️",
            },
            PDFs: {
                title: "No PDFs Available",
                subtitle: "Your documents will be available here once uploaded.",
                emoji: "📄",
            },
        };

        const { title, subtitle, emoji } = messages[type] || {};

        return (
            <LinearGradient
                colors={[gradient1, gradient2]}
                style={{
                    flex: 1,
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 24,
                    marginVertical: 20,
                    marginHorizontal: 20,
                    borderRadius: 20,
                    overflow: "hidden",
                    width: "90%",
                    alignSelf: "center",
                }}
            >
                {/* Glow circles */}
                <View
                    style={{
                        position: "absolute",
                        top: -100,
                        right: -100,
                        width: 300,
                        height: 300,
                        borderRadius: 150,
                        backgroundColor: "rgba(255,255,255,0.12)",
                    }}
                />
                <View
                    style={{
                        position: "absolute",
                        bottom: -80,
                        left: -80,
                        width: 250,
                        height: 250,
                        borderRadius: 125,
                        backgroundColor: "rgba(255,255,255,0.08)",
                    }}
                />
                {/* Icon container */}
                <LinearGradient
                    colors={[gradient1, gradient2]}
                    style={{
                        width: 90,
                        height: 90,
                        borderRadius: 45,
                        justifyContent: "center",
                        alignItems: "center",
                        marginBottom: 20,
                        shadowColor: gradient2,
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.25,
                        shadowRadius: 8,
                        elevation: 6,
                    }}
                >
                    <View
                        style={{
                            width: 70,
                            height: 70,
                            borderRadius: 35,
                            backgroundColor: "rgba(255,255,255,0.2)",
                            justifyContent: "center",
                            alignItems: "center",
                        }}
                    >
                        <View
                            style={{
                                width: 50,
                                height: 50,
                                borderRadius: 25,
                                backgroundColor: "rgba(255,255,255,0.85)",
                                justifyContent: "center",
                                alignItems: "center",
                            }}
                        >
                            <Text style={{ fontSize: 28 }}>{emoji}</Text>
                        </View>
                    </View>
                </LinearGradient>
                {/* Title */}
                <Text
                    style={{
                        fontFamily: designFont('Satoshi-SemiBold'),
                        fontSize: 18,
                        color: "white",
                        textAlign: "center",
                        marginBottom: 12,
                    }}
                >
                    {title}
                </Text>
                {/* Subtitle */}
                <Text
                    style={{
                        fontFamily: designFont('Satoshi-Medium'),
                        fontSize: 14,
                        color: "rgba(255,255,255,0.85)",
                        textAlign: "center",
                        maxWidth: "85%",
                        lineHeight: 20,
                        marginBottom: 12,
                    }}
                >
                    {subtitle}
                </Text>
            </LinearGradient>
        );
    };

    // --- NEW Video Card UX here ---
    const renderContentItem = (item, contentType) => {
        if (contentType === "Videos") {
            return (
                <TouchableOpacity
                    key={item._id || item.video_id}
                    style={styles.videoCard}
                    onPress={() => handleContentPress(item, contentType)}
                    activeOpacity={0.94}
                >
                    <View style={styles.thumbnailContainer}>
                        {item.thumbnail_url ? (
                            <Image source={{ uri: item.thumbnail_url }} style={styles.thumbnailImage} />
                        ) : (
                            <View style={[styles.thumbnailImage, styles.thumbnailFallback]}>
                                <Play size={48} color={designColor('22c55e')} />
                            </View>
                        )}
                        <View style={styles.playIconOverlay}>
                            <Play size={40} color={designColor('fff')} />
                        </View>
                    </View>
                    <View style={styles.videoInfo}>
                        <Text style={styles.videoTitle} numberOfLines={2}>
                            {item.title}
                        </Text>
                        <Text style={styles.videoDescription} numberOfLines={1}>
                            {item.description}
                        </Text>
                        <View style={styles.videoFooter}>
                            <TouchableOpacity>
                                <Text style={styles.watchVideoButton}>Watch Video →</Text>
                            </TouchableOpacity>
                            <View style={styles.durationBox}>
                                <Clock size={15} color={designColor('6b7280')} />
                                <Text style={styles.durationText}>
                                    {moment(item.created_at).fromNow()}  {/* shows "2 days ago" */}
                                </Text>
                            </View>
                        </View>
                    </View>
                </TouchableOpacity>
            );
        }
        if (contentType === "Blogs") {
            return (
                <TouchableOpacity
                    key={item._id || item.blog_id}
                    style={styles.blogCard}
                    onPress={() => handleContentPress(item, contentType)}
                    activeOpacity={0.94}
                >
                    <View style={styles.blogThumbnailContainer}>
                        <Image
                            source={{ uri: item.imageUrl || "https://via.placeholder.com/350x160" }}
                            style={styles.blogThumbnail}
                        />
                    </View>
                    <View style={styles.blogInfo}>
                        <Text style={styles.blogTitle} numberOfLines={2}>{item.title}</Text>
                        <Text style={styles.blogDescription} numberOfLines={2}>{item.description}</Text>
                        <View style={styles.blogFooter}>
                            <View style={styles.blogMeta}>
                                <BookOpen size={15} color={designColor('6b7280')} />
                                <Text style={styles.blogMetaText}>{item.readTime ? item.readTime + " min read" : "Read"}</Text>
                            </View>
                            <Text style={styles.blogReadMore}>Read More</Text>
                        </View>
                    </View>
                </TouchableOpacity>
            );
        }
        if (contentType === "PDFs") {
            return (
                <TouchableOpacity
                    key={item._id}
                    style={styles.pdfCard}
                    onPress={() => handleContentPress(item, contentType)}
                    activeOpacity={0.94}
                >
                    <View style={styles.pdfIconContainer}>
                        <Image
                            source={{ uri: "https://cdn-icons-png.flaticon.com/512/337/337946.png" }}
                            style={styles.pdfIcon}
                        />
                    </View>
                    <View style={styles.pdfInfo}>
                        <Text style={styles.pdfTitle} numberOfLines={2}>{item.title}</Text>
                        <Text style={styles.pdfDescription} numberOfLines={2}>{item.description}</Text>
                        <View style={styles.pdfFooter}>
                            <View style={styles.pdfMeta}>
                                <BookOpen size={14} color={designColor('6b7280')} style={{ marginRight: 2 }} />
                                <Text style={styles.pdfMetaText}>{formatFileSize(item.file_size)}</Text>
                            </View>
                            <Text style={styles.pdfView}>View PDF</Text>
                        </View>
                    </View>
                </TouchableOpacity>
            );
        }

    };

    const contentData = {
        Videos: videos || [],
        Blogs: blogs || [],
        PDFs: pdf || [],
    };

    const displayContent =
        type === "home"
            ? contentData[activeTab]?.slice(0, maxItems)
            : contentData[activeTab];

    return (
        <View style={styles.container}>
            <View>
                <View style={styles.headerouter}>
                    {type === "home" && (
                        <View>
                            <Text style={styles.sectionTitle}>Knowledge Hub</Text>
                            <Text style={styles.sectionSubtitle}>
                                Learn with trusted manager content.
                            </Text>
                        </View>
                    )}
                    {type === "home" && (
                        <TouchableOpacity
                            onPress={handleViewAllPress}
                            style={styles.viewAllButton}
                        >
                            <Text style={styles.viewAllText}>View All</Text>
                        </TouchableOpacity>
                    )}
                </View>
                <View style={styles.header}>

                    {type === "home" && (
                        <View style={{ flexDirection: 'row', paddingVertical: 5, }}>
                            {tabs.map((tab) => {
                                const IconComponent = tab.iconComponent;
                                return (
                                    <TouchableOpacity
                                        key={tab.id}
                                        style={[styles.tabouter, activeTab === tab.id && { backgroundColor: mainColor, borderColor: mainColor }]}
                                        onPress={() => handleTabPress(tab.id)}
                                    >
                                        <IconComponent
                                            size={14}
                                            color={activeTab === tab.id ? designColor('ffffff') : mainColor}
                                            style={styles.tabIconStyleouter}
                                        />
                                        <Text
                                            style={[
                                                styles.tabTextouter,
                                                { color: mainColor },
                                                activeTab === tab.id && styles.activeTabTextouter,
                                            ]}
                                        >
                                            {tab.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    )}
                </View>
            </View>
            {!(type === "home") && (
                <LinearGradient
                    colors={[gradient1, gradient2]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={{ paddingHorizontal: 15, paddingTop: 10, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, marginBottom: 10, }}
                >
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, }}>
                        <TouchableOpacity style={styles.backButton} onPress={() => onBack()}>
                            <ChevronLeft size={24} color={designColor('000')} />
                        </TouchableOpacity>
                        <View style={{ justifyContent: 'center' }}>
                            <Text style={{ fontSize: 20, fontFamily: designFont('Poppins-Medium'), color: designColor('fff') }}>
                                Knowledge Hub
                            </Text>
                        </View>
                    </View>
                    <View style={{ marginLeft: 45, marginTop: 2 }}>
                        <Text style={{ fontSize: 12, fontFamily: designFont('Poppins-Regular'), color: designColor('f0f0f0') }}>
                            Learn with trusted manager content.
                        </Text>
                    </View>
                    <View style={styles.tabContainer}>
                        {tabs.map((tab) => {
                            const IconComponent = tab.iconComponent;
                            return (
                                <TouchableOpacity
                                    key={tab.id}
                                    style={[styles.tab, activeTab === tab.id && { backgroundColor: mainColor, borderColor: mainColor }]}
                                    onPress={() => handleTabPress(tab.id)}
                                >
                                    <IconComponent
                                        size={16}
                                        color={activeTab === tab.id ? designColor('ffffff') : designColor('fff')}
                                        style={styles.tabIconStyle}
                                    />
                                    <Text
                                        style={[
                                            styles.tabText,
                                            activeTab === tab.id && styles.activeTabText,
                                        ]}
                                    >
                                        {tab.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </LinearGradient>
            )}
            <SafeAreaView style={{ flex: 0, paddingHorizontal: 20, }}>
                {type === "home" ? (
                    <View>
                        {displayContent.length > 0 ? (
                            displayContent.map((item) => renderContentItem(item, activeTab))
                        ) : (
                            <EmptyState type={activeTab} />
                        )}
                        {/* Tenant-configured link to a website Insights page below
                            the videos (RA request 2026-08-13) — rendered only when
                            whitelabel/content.js insightsUrl is set. */}
                        {insightsUrl && (
                            <TouchableOpacity
                                accessibilityRole="link"
                                accessibilityLabel="For more insights, visit the MoneyMan website"
                                onPress={onOpenInsights}
                                style={styles.moreInsightsLink}>
                                <Text style={[styles.moreInsightsText, {color: mainColor}]}>
                                    For more insights
                                </Text>
                                <ExternalLink size={14} color={mainColor} />
                            </TouchableOpacity>
                        )}
                    </View>
                ) : (
                    <ScrollView
                        contentContainerStyle={{
                            paddingBottom: 200, // extra space only for View All
                        }}
                        showsVerticalScrollIndicator={false}
                    >
                        {displayContent.length > 0 ? (
                            displayContent.map((item) => renderContentItem(item, activeTab))
                        ) : (
                            <EmptyState type={activeTab} />
                        )}
                    </ScrollView>
                )}
            </SafeAreaView>
            {/* Conditionally mount the blog/PDF WebView modal. When KnowledgeHub
                is embedded inside a virtualized list cell (moneyman_app Home
                footer, 2026-08-13) an always-mounted Modal+WebView crashes
                Fabric with "The specified child already has a parent" during
                cell recycling — mount it only while it is actually open. */}
            {modalVisible && (
                <WebLink
                    symbol={title}
                    setWebview={setModalVisible}
                    webViewVisible={modalVisible}
                    currentUrl={currentUrl}
                />
            )}
            {selectedVideo && (
                <Modal
                    visible={videoModalVisible}
                    transparent={true}
                    animationType="fade"
                    onRequestClose={() => {
                        setVideoModalVisible(false);
                        setSelectedVideo(null);
                    }}
                >
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
                                    }}
                                >
                                    <XIcon size={20} color={designColor('fff')} />
                                </TouchableOpacity>
                            </View>
                            {getVideoType(selectedVideo) === "vimeo" && getVimeoId(selectedVideo) ? (
                                <WebView
                                    source={{ uri: `https://player.vimeo.com/video/${getVimeoId(selectedVideo)}` }}
                                    style={styles.videoWebView}
                                    allowsInlineMediaPlayback
                                    mediaPlaybackRequiresUserAction={false}
                                    javaScriptEnabled
                                    domStorageEnabled
                                />
                            ) : getVideoType(selectedVideo) === "direct" ? (
                                <RnVideo
                                    source={{ uri: selectedVideo.youtube_url || selectedVideo.youtubeUrl }}
                                    style={styles.videoWebView}
                                    controls
                                    resizeMode="contain"
                                    onError={(e) => console.log("[KnowledgeHub] direct video error", e?.error)}
                                />
                            ) : (
                                <YoutubePlayer height={250} play={true} videoId={selectedVideo.video_id} onChangeState={onStateChange} />
                            )}
                        </View>
                    </View>
                </Modal>
            )}
        </View>
    );
};
const styles = StyleSheet.create({
    container: {
        backgroundColor: "transparent",
        paddingVertical: 0,
        paddingHorizontal: 0,
    },
    moreInsightsLink: {
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
        marginTop: 14,
        paddingVertical: 4,
    },
    moreInsightsText: {
        fontFamily: designFont('Poppins-Medium'),
        fontSize: 12,
        marginRight: 5,
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 20,

    },
    headerouter: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 20,
        marginTop: 0,

    },
    backButton: { padding: 4, borderRadius: 5, backgroundColor: designColor('fff'), marginRight: 10 },
    sectionTitle: {
        fontSize: 18,
        fontWeight: "600",
        color: designColor('1a1a1a'),
        fontFamily: designFont('Poppins-SemiBold'),
        marginBottom: 4,
    },
    sectionSubtitle: {
        fontSize: 10,
        color: designColor('959595'),
        fontFamily: designFont('Poppins-Regular'),
    },
    viewAllButton: {
        borderWidth: 1,
        borderRadius: 3,
        borderColor: designColor('1f7ae0'),
        paddingHorizontal: 16,
        paddingVertical: 4,
    },
    viewAllText: {
        fontSize: 10,
        color: designColor('1f7ae0'),
        fontFamily: designFont('Poppins-Medium'),
    },
    tabContainer: {
        flexDirection: "row",
        borderRadius: 12,
        paddingHorizontal: 10,

    },
    tab: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 8,
        paddingHorizontal: 8,
        borderRadius: 3,
        marginTop: 10,
        marginHorizontal: 2,
    },
    activeTab: {
        backgroundColor: designColor('0056b7'),
        borderColor: designColor('0056b7'),
    },
    tabIconStyle: {
        marginRight: 6,
    },
    tabText: {
        fontSize: 14,
        fontFamily: designFont('Poppins-Medium'),
        color: designColor('fff'),
    },
    activeTabText: {
        color: designColor('ffffff'),
    },

    //
    tabouter: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 8,
        paddingHorizontal: 8,
        borderRadius: 3,
        marginTop: 5,
        backgroundColor: designColor('fff'),
        marginHorizontal: 2,
    },
    activeTabouter: {
        backgroundColor: designColor('0056b7'),
        borderColor: designColor('0056b7'),
    },
    tabIconStyleouter: {
        marginRight: 6,
    },
    tabTextouter: {
        fontSize: 12,
        fontFamily: designFont('Poppins-Medium'),
        color: designColor('0056b7'),
    },
    activeTabTextouter: {
        color: designColor('ffffff'),
    },
    contentContainer: {

    },

    // ----------- NEW Video Card Styles --------------
    videoCard: {
        backgroundColor: designColor('fff'),
        borderRadius: 10,
        overflow: "hidden",
        marginBottom: 22,
        borderWidth: 1,
        borderColor: designColor('e5e7eb'),
        shadowColor: designColor('111'),
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.09,
        shadowRadius: 8,
        elevation: 2,
    },
    thumbnailContainer: {
        width: "100%",
        height: 120,
        position: "relative",
        backgroundColor: designColor('f3f4f6'),
        overflow: "hidden",
        borderTopLeftRadius: 8,
        borderTopRightRadius: 8,
    },
    thumbnailImage: {
        width: "100%",
        height: "100%",
        resizeMode: "cover",
    },
    thumbnailFallback: {
        backgroundColor: designColor('0f172a'),
        alignItems: "center",
        justifyContent: "center",
    },
    videoWebView: {
        width: "100%",
        height: 250,
        backgroundColor: designColor('000'),
    },
    playIconOverlay: {
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: [{ translateX: -18 }, { translateY: -18 }],
        backgroundColor: "rgba(0,0,0,0.32)",
        borderRadius: 30,
        padding: 7,
        justifyContent: "center",
        alignItems: "center",
    },
    videoInfo: {
        paddingHorizontal: 16,
        paddingBottom: 16,
        paddingTop: 12,
    },
    videoTitle: {
        fontSize: 15,
        fontWeight: "bold",
        color: designColor('222'),
        fontFamily: designFont('Poppins-SemiBold'),
        marginBottom: 4,
    },
    videoDescription: {
        fontSize: 12,
        color: designColor('555'),
        fontFamily: designFont('Poppins-Regular'),
        marginBottom: 6,
    },
    videoFooter: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 2,
    },
    watchVideoButton: {
        fontSize: 13,
        color: designColor('1f7ae0'),
        fontFamily: designFont('Poppins-Medium'),
        paddingVertical: 2,
    },
    durationBox: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: designColor('f1f5f9'),
        borderRadius: 7,
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    durationText: {
        fontSize: 11,
        color: designColor('6b7280'),
        fontFamily: designFont('Poppins-Regular'),
        marginLeft: 5,
    },
    // ------------ End NEW Video Card Styles -----------

    contentItem: {
        flexDirection: "row",
        backgroundColor: designColor('ffffff'),
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: designColor('e5e7eb'),
        shadowColor: designColor('000'),
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    thumbnail: {
        width: 120,
        height: 80,
        borderRadius: 8,
        backgroundColor: designColor('f3f4f6'),
    },
    contentInfo: {
        flex: 1,
        marginLeft: 12,
    },
    contentTitle: {
        fontSize: 14,
        fontWeight: "600",
        color: designColor('1f2937'),
        fontFamily: designFont('Poppins-SemiBold'),
        marginBottom: 4,
    },
    contentDescription: {
        fontSize: 12,
        color: designColor('6b7280'),
        fontFamily: designFont('Poppins-Regular'),
        lineHeight: 16,
        marginBottom: 8,
    },
    contentMeta: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    metaText: {
        fontSize: 11,
        color: designColor('9ca3af'),
        fontFamily: designFont('Poppins-Regular'),
    },
    watchButton: {
        fontSize: 11,
        color: designColor('4a6cf7'),
        fontFamily: designFont('Poppins-Medium'),
    },
    modalHeader: {
        flexDirection: "row",
        alignItems: "center",
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: designColor('e5e7eb'),
    },
    modalTitle: {
        fontSize: 16,
        fontFamily: designFont('Poppins-SemiBold'),
        color: designColor('111'),
    },
    videoModalBackground: {
        flex: 1,
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        justifyContent: "center",
        alignItems: "center",
    },
    videoModalContent: {
        width: "90%",
        backgroundColor: designColor('000'),
        borderRadius: 12,
        overflow: "hidden",
    },
    videoModalHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        padding: 15,
        backgroundColor: designColor('111'),
    },
    videoModalTitle: {
        color: designColor('fff'),
        fontFamily: designFont('Satoshi-Bold'),
        fontSize: 16,
        flex: 1,
        marginRight: 10,
    },
    blogCard: {
        backgroundColor: designColor('fff'),
        borderRadius: 10,
        overflow: "hidden",
        marginBottom: 22,
        borderWidth: 1,
        borderColor: designColor('e5e7eb'),
        shadowColor: designColor('111'),
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.09,
        shadowRadius: 8,
        elevation: 2,
    },
    blogThumbnailContainer: {
        width: "100%",
        height: 120,
        backgroundColor: designColor('eef2f6'),
        overflow: "hidden",
        borderTopLeftRadius: 8,
        borderTopRightRadius: 8,
    },
    blogThumbnail: {
        width: "100%",
        height: "100%",
        resizeMode: "cover",
    },
    blogInfo: {
        paddingHorizontal: 16,
        paddingBottom: 14,
        paddingTop: 12,
    },
    blogTitle: {
        fontSize: 15,
        fontWeight: "bold",
        color: designColor('212121'),
        fontFamily: designFont('Poppins-SemiBold'),
        marginBottom: 4,
    },
    blogDescription: {
        fontSize: 12,
        color: designColor('555'),
        fontFamily: designFont('Poppins-Regular'),
        marginBottom: 6,
    },
    blogFooter: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 2,
    },
    blogMeta: {
        flexDirection: "row",
        alignItems: "center",
    },
    blogMetaText: {
        marginLeft: 4,
        fontSize: 11,
        color: designColor('6b7280'),
        fontFamily: designFont('Poppins-Regular'),
    },
    blogReadMore: {
        fontSize: 13,
        color: designColor('1f7ae0'),
        fontFamily: designFont('Poppins-Medium'),
    },

    pdfCard: {
        backgroundColor: designColor('fff'),
        borderRadius: 10,
        overflow: "hidden",
        marginBottom: 22,
        borderWidth: 1,
        borderColor: designColor('e5e7eb'),
        shadowColor: designColor('111'),
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.09,
        shadowRadius: 8,
        elevation: 2,
        alignItems: "center",
        paddingBottom: 13,
    },
    pdfIconContainer: {
        width: "100%",
        alignItems: "center",
        backgroundColor: designColor('f7f7fa'),
        paddingVertical: 20,
    },
    pdfIcon: {
        width: 52,
        height: 52,
        borderRadius: 0,
        backgroundColor: designColor('f7f7fa'),
    },
    pdfInfo: {
        width: "100%",
        paddingHorizontal: 18,
        paddingTop: 10,
    },
    pdfTitle: {
        fontSize: 15,
        fontWeight: "bold",
        color: designColor('353535'),
        fontFamily: designFont('Poppins-SemiBold'),
        marginBottom: 4,
    },
    pdfDescription: {
        fontSize: 12,
        color: designColor('666'),
        fontFamily: designFont('Poppins-Regular'),
        marginBottom: 6,
    },
    pdfFooter: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 2,
    },
    pdfMeta: {
        flexDirection: "row",
        alignItems: "center",
    },
    pdfMetaText: {
        marginLeft: 3,
        fontSize: 11,
        color: designColor('6b7280'),
        fontFamily: designFont('Poppins-Regular'),
    },
    pdfView: {
        fontSize: 13,
        color: designColor('1f7ae0'),
        fontFamily: designFont('Poppins-Medium'),
    },

});

export default KnowledgeHub;
