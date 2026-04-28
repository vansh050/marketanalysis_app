import React, { useState, useEffect, useRef } from "react";
import {
  FlatList,
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
  const isLoadingMore = useRef(false);

  useEffect(() => {
    setVisibleData(stockRecoNotExecuted.slice(0, BATCH_SIZE));
  }, [stockRecoNotExecuted]);
console.log('vdx');
  const loadMore = () => {
    if (isLoadingMore.current || visibleData.length >= stockRecoNotExecuted.length) return;
    isLoadingMore.current = true;

    setTimeout(() => {
      const nextBatch = stockRecoNotExecuted.slice(0, visibleData.length + BATCH_SIZE);
      setVisibleData(nextBatch);
      isLoadingMore.current = false;
    }, 300);
  };

  const renderFooter = () => {
    if (isDatafetching) {
      return (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <StockCardLoading />
        </View>
      );
    }
    return null;
  };

  return (
    <FlatList
      data={stockRecoNotExecuted}
      renderItem={renderItemOrder}
      keyExtractor={(item, index) => item.id?.toString() || index.toString()}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="black" />
      }
      ListFooterComponent={renderFooter}

      onEndReachedThreshold={0.1}
      horizontal={type === "home"}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 5 }}
      ListEmptyComponent={() =>
        !isDatafetching && (
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              width: screenWidth,
              padding: 20,
            }}
          >
            
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
        )
      }
    />
  );
};

export default StockScrollView;
