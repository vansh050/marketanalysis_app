import React, { useState, useEffect, useRef } from "react";
import {
  ScrollView,
  RefreshControl,
  Text,
  View,
  Dimensions,
} from "react-native";
import LottieView from "lottie-react-native";
import StockCardLoading from "./AdviceScreenComponents/StockCardLoading";

const { width: screenWidth } = Dimensions.get("window");
const BATCH_SIZE = 10; // Number of items to render in each batch

const StockScrollView = ({
  stockRecoNotExecuted,
  renderItemOrder,
  refreshing,
  onRefresh,
  isDatafetching,
  type,
  animationRef,
}) => {
  const [visibleData, setVisibleData] = useState(
    stockRecoNotExecuted.slice(0, BATCH_SIZE)
  );
  const scrollY = useRef(0);
  const isLoadingMore = useRef(false);

  useEffect(() => {
    // Reset visible data if new data comes in
    setVisibleData(stockRecoNotExecuted.slice(0, BATCH_SIZE));
  }, [stockRecoNotExecuted]);

  const loadMore = () => {
    if (isLoadingMore.current || visibleData.length >= stockRecoNotExecuted.length) return;
    isLoadingMore.current = true;

    setTimeout(() => {
      const nextBatch = stockRecoNotExecuted.slice(0, visibleData.length + BATCH_SIZE);
      setVisibleData(nextBatch);
      isLoadingMore.current = false;
    }, 300); // Adding a small delay for smooth transition
  };

  const handleScroll = (event) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    scrollY.current = contentOffset.y;

    // Detect if user scrolled near the bottom
    if (contentOffset.y + layoutMeasurement.height >= contentSize.height - 100) {
      loadMore();
    }
  };

  return (
    <ScrollView
    horizontal={type === "home"}
    contentContainerStyle={{ flex: 1, paddingHorizontal: 5,alignContent:'center' }}
    style={{alignContent:'center',flex:1}}
    showsHorizontalScrollIndicator={false}
    
    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="black" />}
    onScroll={handleScroll}
    scrollEventThrottle={16} // Improves scroll performance
  >
    {visibleData.length > 0 ? (
      visibleData.map((item, index) => (
        <View key={index}>{renderItemOrder({ item, index })}</View>
      ))
    ) : isDatafetching ? (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          width: screenWidth,
          padding: 20,
        }}
      >
        <StockCardLoading />
      </View>
    ) : (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          width: screenWidth,
          padding: 20,
        }}
      >
        <LottieView
          ref={animationRef}
          source={require(".././assets/EmptyAnimation.json")}
          autoPlay
          loop
          style={{ width: 150, height: 150 }}
        />
        <Text
          style={{
            fontFamily: "Satoshi-Medium",
            color: "grey",
            alignSelf: "center",
          }}
        >
          No Bespoke Advice Found!
        </Text>
      </View>
    )}
  </ScrollView>
  );
};

export default StockScrollView;