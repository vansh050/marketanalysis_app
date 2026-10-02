import React, {useState, useCallback, useEffect} from 'react';
import axios from 'axios';
import debounce from 'lodash.debounce';
import Config from 'react-native-config';

import TokenPurchaseModal from '../TokenPurchaseModal';
import Loader from '../../../utils/Loader';
import NewsInfoScreen from './NewsInfoScreen';
import Coin from '../../../assets/coin.svg';
import server from '../../../utils/serverConfig';
import {generateToken} from '../../../utils/SecurityTokenManager';
import {useTrade} from '../../TradeContext';
import {useConfig} from '../../../context/ConfigContext';
import {getAccountEmail} from '../../../utils/accountEmail';
import {useComponent} from '../../../design/useDesign';

const NewsScreen = ({isVisible}) => {
  const {configData} = useTrade();
  const config = useConfig();
  const {mainColor, secondaryColor} = config || {};

    const [searchQuery, setSearchQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [news, setNews] = useState([]);
    const [newsModalOpen, setNewsModalOpen] = useState(false);
    const [selectedNews, setSelectedNews] = useState(null);
    const [symbol, setSymbol] = useState('');

    const [daysAgo, setDaysAgo] = useState(7); // Dropdown default value
    const userEmail = getAccountEmail();

    const handleDaysAgoSelect = days => {
      setDaysAgo(days);

      const today = new Date();
      const startDate = new Date();
      startDate.setDate(today.getDate() - days);
      setSelectedStartDate(startDate);
      setSelectedEndDate(today);
    };
      const [selectedStartDate, setSelectedStartDate] = useState(null);
      const [selectedEndDate, setSelectedEndDate] = useState(null);
      const [modalVisible, setModalVisible] = useState(false);
      const [selectedCoin, setselectedCoin] = useState(false);
      const [clear,setClear] = useState(false);
      const minDate = new Date(2020, 1, 1); // e.g., February 1, 2020
      const maxDate = new Date(); // Today

      const options = [
        { label: '1 d', value: 1 },
        { label: '3 d', value: 3 },
        { label: '7 d', value: 7 },
        { label: '30 d', value: 30 },
      ];


        const handleOpenTokenPurchase = () => {
        //  console.log('hereee');
          setModalVisible(true);
          // Check if the user is logged in and if you want to minimize the app
        // Allow the default behavior (navigating back)
        };



      const onDateChange = (date, type) => {
        if (type === 'END_DATE') {
          setSelectedEndDate(date);
          setStartDateOpen(false);

        } else {
          setSelectedStartDate(date);
          setSelectedEndDate(null); // Reset end date when a new start date is selected
        }
      };

      const formatDate = (date) => {
        const d = new Date(date);
        const day = String(d.getDate()).padStart(2, '0'); // Ensures 2 digits
        const month = String(d.getMonth() + 1).padStart(2, '0'); // Months are 0-based
        const year = d.getFullYear(); // Full year
        return `${day}-${month}-${year}`;
      };
      const [showAlert, setShowAlert] = useState(false);
      const [showFailedAlert, setShowFailAlert] = useState(false);
    // Fetch symbols based on the search query
    const fetchSymbols = async (query) => {
      if (query.length < 3) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const response = await axios.post(
          `${server.ccxtServer.baseUrl}/angelone/get-symbol-name-exchange`,
          { symbol: query },
          { headers: {
                                  'Content-Type': 'application/json',
                                  'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
                                  'aq-encrypted-key': generateToken(
                                    Config.REACT_APP_AQ_KEYS,
                                    Config.REACT_APP_AQ_SECRET
                                  ),
                                } }
        );

        const uniqueResults = [];
        const seenNames = new Set();

        (response.data.match || []).forEach((item, index) => {
          if (!seenNames.has(item.name)) {
            uniqueResults.push({
              ...item,
              id: `${item.name}-${item.segment}-${index}`,
            });
            seenNames.add(item.name);
          }
        });

        setResults(uniqueResults);
      } catch (error) {
        console.error('Error fetching symbols:', error);
      } finally {
        setLoading(false);
      }
    };


    // The debounce instance must remain stable for cancellation on unmount.
    // fetchSymbols reads the latest tenant config from the enclosing screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const debouncedFetchSymbols = useCallback(debounce(fetchSymbols, 300), []);

    useEffect(() => {
      if (searchQuery) {
        debouncedFetchSymbols(searchQuery);
      } else {
        setResults([]);
      }
      return () => debouncedFetchSymbols.cancel();
    }, [searchQuery, debouncedFetchSymbols]);


    // Fetch stock news for the selected symbol
    const fetchStockNews = async (selectedSymbol,selectedStartDate,selectedEndDate) => {
    //  setLoading(true);
      console.log('payload to fjffjfjff:::',{
        email:userEmail,
        symbol: selectedSymbol,
        fromDate: formatDate(selectedStartDate).toString(),
        toDate: formatDate(selectedEndDate).toString(),
    });
     // console.log("Selected Date:666777",(formatDate(selectedStartDate)).toString(),(formatDate(selectedEndDate)).toString());
      try {
        const response = await axios.post(`${server.ccxtServer.baseUrl}misc/stock-news`,
          {
            headers: {
                                    'Content-Type': 'application/json',
                                    'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
                                    'aq-encrypted-key': generateToken(
                                      Config.REACT_APP_AQ_KEYS,
                                      Config.REACT_APP_AQ_SECRET
                                    ),
                                  },
          }, {
          symbol: selectedSymbol,
          fromDate: (formatDate(selectedStartDate)).toString(),
          toDate: (formatDate(selectedEndDate)).toString(),
        });

      //  console.log('news response:',response);
        if (response) {
          setFinalNewsData(response.data.stockNews);
        } else {
          console.log('Error fetching stock news:', response);
        }
      } catch (error) {
        console.error('Error fetching stock news:', error.response);
      } finally {
       // setLoading(false);
      }
    };
   // console.log('selected Date:',formatDate(selectedStartDate));
    const openNewsHistoryModal = async (newsItem) => {
      console.log('newss------------------------.......',newsItem);
      setSymbol(newsItem.name);
      setFinalNewsData([newsItem]);
      setsocketsymbol(newsItem?.orginal_symbol);
      setsocketseg(newsItem?.exchange);
    //  console.log('news item i pass:',newsItem);
      setNewsModalOpen(true);
      //await fetchNews(newsItem.name,selectedStartDate,selectedEndDate);
     // await fetchStockNews(newsItem.name); // Fetch news for the selected symbol

    };
    const [socketsymbol,setsocketsymbol] = useState();
    const [socketseg,setsocketseg] = useState();
    const openNewsModal = async (newsItem) => {
      console.log('news item i get:::::::::::::::::::::::::::::::::::',newsItem);
      setSymbol(newsItem.name);
      setsocketsymbol(newsItem.symbol);
      setsocketseg(newsItem.segment);
     // console.log('news item i pass:',newsItem);
      await fetchNews(newsItem.symbol,newsItem.segment,selectedStartDate,selectedEndDate); // Fetch news for the selected symbol
      setNewsModalOpen(true);

    };

      const [endDate, setEndDate] = useState(new Date());
      const [startDateOpen, setStartDateOpen] = useState(false);

    const closeNewsModal = () => {
      setNewsModalOpen(false);
      setFinalNewsData([]);
      fetchHistory();
      setSelectedNews(null);
    };

    const [historyNewsData, setHistoryNewsData] = useState([

    ]);
    //console.log('history data;',historyNewsData);
    const [finalNewsData, setFinalNewsData] = useState([]);

    const convertToIST = (dateString) => {
      const date = new Date(dateString);
      if (isNaN(date)) {
        throw new Error('Invalid date string provided');
      }

      // Check if the device is iOS
      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      if (isIOS) {
        // Fallback solution for iOS: Use UTC and manually adjust for IST offset (+5:30)
        const istOffset = 5.5 * 60; // 5 hours 30 minutes
        date.setMinutes(date.getMinutes() + date.getTimezoneOffset() + istOffset);
      }

      const options = {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      };

      return date.toLocaleString('en-IN', options);
   };


    useEffect(() => {
      const today = new Date();
      const startDate = new Date();
      startDate.setDate(today.getDate() - daysAgo); // Subtract the selected days from today

      // Update the state
      setSelectedStartDate(startDate);
      setSelectedEndDate(today);


      fetchHistory();
      getToken(userEmail,100);
    // The initial range and account history are refreshed when the signed-in
    // account changes; the helpers deliberately stay screen-local.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userEmail]);
 // console.log('reess',results);



 const fetchHistory = async () => {
 // setLoading(true);
  try {
    const payload = {
      email: userEmail,  // Replace with the dynamic email if needed
      length: 10,  // Set the length parameter as required
    };
    const response = await axios.post(
      `${server.ccxtServer.baseUrl}/misc/user_news_history`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
          'aq-encrypted-key': generateToken(
            Config.REACT_APP_AQ_KEYS,
            Config.REACT_APP_AQ_SECRET
          ),
        },
      }
    );
    setHistoryNewsData(response.data.data || []);
   // setLoading(false);
   // console.log('History news fetched:', response.data);
  } catch (error) {
  //  setLoading(false);
    console.error('Error fetching history:', error);
  }
};

 const consumeTokens = async (email, tokensToConsume, defaultTokens) => {
  const apiUrl = `${server.ccxtServer.baseUrl}misc/consume-tokens`;
  const payload = {
      email: email,
      tokens_to_consume: tokensToConsume,
      default_tokens: defaultTokens,
  };

  try {
      const response = await axios.post(apiUrl, payload, {
          headers: {
                                  'Content-Type': 'application/json',
                                  'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
                                  'aq-encrypted-key': generateToken(
                                    Config.REACT_APP_AQ_KEYS,
                                    Config.REACT_APP_AQ_SECRET
                                  ),
                                },
      });
     // console.log("API Response:", response.data);
      getToken(userEmail,100);
      return response.data;
  } catch (error) {
      console.log('Error consuming tokens:', error.response ? error.response.data : error.message);
      return null;
  }
};


const PurchaseToken = async (email, tokensToPurchase, defaultTokens) => {
  const apiUrl = `${server.ccxtServer.baseUrl}/misc/add-tokens`;
  const payload = {
      email: email,
      tokens_to_add: tokensToPurchase,
      default_tokens: defaultTokens,
  };
  try {
      const response = await axios.post(apiUrl, payload, {
          headers: {
                                  'Content-Type': 'application/json',
                                  'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
                                  'aq-encrypted-key': generateToken(
                                    Config.REACT_APP_AQ_KEYS,
                                    Config.REACT_APP_AQ_SECRET
                                  ),
                                },
      });
      getToken(userEmail,100);
      return response.data;
  } catch (error) {
      console.log('Error consuming tokens:', error.response ? error.response.data : error.message);
      return null;
  }
};


const [tokens,setToken] = useState();

const getToken = async (email, defaultTokens) => {
  try {
    const response = await axios.post(`${server.ccxtServer.baseUrl}misc/check-tokens`, {
      email: email,
      default_tokens: defaultTokens,
    }, {
     headers: {
                             'Content-Type': 'application/json',
                             'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
                             'aq-encrypted-key': generateToken(
                               Config.REACT_APP_AQ_KEYS,
                               Config.REACT_APP_AQ_SECRET
                             ),
                           },
    });
    const data = response.data;
    if (data.status === 0 && data.message === 'Tokens retrieved successfully') {
      setToken(data.tokens);
      return data.tokens; // Return the tokens
    } else {
      throw new Error('Failed to retrieve tokens');
    }
  } catch (error) {
    console.error('Error fetching tokens:', error);
    return null;
  }
};

 const fetchNews = async (stockSymbol,exchange, startDate, endDate) => {
  setLoading(true);
  await fetchHistory();
  try {
    const trimmedSymbol = stockSymbol;
    const daysAgo = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));

    // Check if news for this stock symbol and date range already exists in historyNewsData
    const existingNews = historyNewsData.find(
      (news) =>
        news.stock_symbol === trimmedSymbol &&
        new Date(news.date) >= startDate &&
        new Date(news.date) <= endDate
    );
    console.log('ExistingNews:',existingNews);
    if (existingNews) {
      // If news exists, set it as final news data
      setFinalNewsData([existingNews]);
      console.log('News fetched from histovrlly:', existingNews);
      setLoading(false);
      return;

    }

    // Fetch stock news if not found in history
   //await fetchStockNews(stockSymbol, startDate, endDate);
   console.log('final data fetch:',finalNewsData);
    // If still no data, summarize the news
    if (finalNewsData.length === 0) {
      const summarizePayload = {
        stockSymbols: [trimmedSymbol],
        exchanges:[exchange],
        days: daysAgo,
        sentiment: 0,
        email: userEmail,
      };
      console.log('Summarize Payload:', summarizePayload);
      const summarizeResponse = await axios.post(
        `${server.ccxtServer.baseUrl}/misc/summarize-stock-news`,
        summarizePayload, // Payload should be the second argument
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
            'aq-encrypted-key': generateToken(
              Config.REACT_APP_AQ_KEYS,
              Config.REACT_APP_AQ_SECRET
            ),
          },
        }
      );

     console.log('summarize response:', summarizeResponse);
//       const summarizeResponse = {
//   data: {
//     data: [{
//       Company: "IDEA",
//       "Full Summary": "Amid calls from some southern states favouring higher population to address disparities in Central funds, former RBI Governor D Subbarao on Thursday argued that population growth is not the solution.",
//       "Full_sentiment_score_description": "NA",
//       "List of new links/articles": [
//         "http://www.bing.com/news/apiclick.aspx?ref=FexRss&aid=&tid=679ba6f1b4c643889ed8f95014d85f01&url=https%3a%2f%2fwww.msn.com%2fen-in%2fmoney%2ftopstories%2fsouthern-states-pushing-for-more-population-not-good-idea-says-former-rbi-guv-subbarao%2far-AA1y73ik&c=11861539195369317305&mkt=en-in"
//       ],
//       "Num Articles": 1.0,
//       "Overall Sentiment Score": "NA"
//     }],
//     datetime: "Thu, 30 Jan 2025 16:21:12 GMT",
//     message: "Successfully processed <coroutine object MongoService.save_sentiment_data at 0x75243eb90630> stocks",
//     status: 0
//   },
//   status: 200
// };


// You can then use it like this:


//console.log(updatedData); // To verify the transformed data
      if (summarizeResponse.data.status === 0) {
        const updatedData = summarizeResponse.data.data.map(item => {
          const {
            Company,
            'Full Summary': fullSummary,
            'List of new links/articles': articleLinks,
            ...rest
          } = item;

          return {
            stock_symbol: Company,
            summary: fullSummary,
            datetime: summarizeResponse.data.datetime,
            sentiment_data: {
              article_links: articleLinks || [],
            },
            ...rest,
          };
        });
       consumeTokens(userEmail,10,100);
        console.log(';uuuuuuuuuuuuuoo', updatedData);
        setFinalNewsData(updatedData); // Set the updated data with the new structure
        setLoading(false);
      }

       else {
        setLoading(false);
        console.error('Error summarizing newsoo:', summarizeResponse.data);
      }
    }
  } catch (error) {
    setLoading(false);
    console.error('Error fetching news:', error.message);
  }
};

  const Presentation = useComponent('screens.NewsScreen');

  return (
    <Presentation
      viewModel={{
        mainColor,
        secondaryColor,
        searchQuery,
        tokens,
        options,
        daysAgo,
        selectedStartDate,
        selectedEndDate,
        loading,
        finalNewsData,
        results,
        historyNewsData,
        symbol,
        socketsymbol,
        socketseg,
        startDateOpen,
        minDate,
        maxDate,
        showFailedAlert,
        showAlert,
        selectedCoin,
        modalVisible,
        userEmail,
      }}
      actions={{
        setSearchQuery,
        handleOpenTokenPurchase,
        handleDaysAgoSelect,
        setStartDateOpen,
        closeNewsModal,
        openNewsModal,
        openNewsHistoryModal,
        convertToIST,
        onDateChange,
        setShowFailAlert,
        setShowAlert,
        setModalVisible,
        setselectedCoin,
        PurchaseToken,
        getToken,
      }}
      slots={{
        Coin,
        Loader,
        NewsInfoScreen,
        TokenPurchaseModal,
      }}
    />
  );
};

export default NewsScreen;
