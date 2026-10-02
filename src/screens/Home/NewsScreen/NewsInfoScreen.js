import React, { useState, useMemo ,useEffect } from 'react';
import WebSocketManager from '../../../components/AdviceScreenComponents/DynamicText/WebSocketManager';
import LinkOpeningWeb from './LinkOpeningWeb';
import MissedGainText from '../../../components/AdviceScreenComponents/DynamicText/BestPerformerGainText';

import {useComponent} from '../../../design/useDesign';

const NewsInfoScreen = ({ imageUrl, symbol, news, onClose,socketsymbol,socketseg}) => {
  const [selectedNews, setSelectedNews] = useState(null);
  const [webViewVisible,setWebview]=useState(false);
  const [currentUrl, setCurrentUrl] = useState('');
 console.log('newsoooool----------------',socketsymbol);
  const groupNewsByDate = (news) => {
    const grouped = {};
    news.forEach((item) => {
    
      const date = new Date(item?.datetime).toLocaleDateString('en-GB', {  
        day: '2-digit',  
        month: '2-digit',  
        year: 'numeric'  
      });      
      console.log('dateeeeeeeeee:',date);
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(item);
    });
    return Object.entries(grouped).map(([date, items]) => ({
      date,
      items,
    }));
  };




  const subscribeToSymbols = async () => {
    const wsManager = WebSocketManager.getInstance();
    
    // Call subscribeToAllSymbols using wsManager
    console.log('here socket symb00000------',socketseg,socketsymbol);
    await wsManager.subscribeToAllSymbols([{socketsymbol,socketseg}]);
  };
  
  useEffect(() => {
    subscribeToSymbols();
  }, []);

  const OpenWebview = (url) => {
    setCurrentUrl(url);
    setWebview(true);
  };


  const groupedNews = useMemo(() => groupNewsByDate(news), [news]);




  const Presentation = useComponent('screens.NewsInfoScreen');
  return (
    <Presentation
      viewModel={{groupedNews, symbol, socketsymbol, socketseg, webViewVisible, currentUrl}}
      actions={{onOpenWebview: OpenWebview, onSetWebview: setWebview}}
      slots={{Price: MissedGainText, WebLink: LinkOpeningWeb}}
    />
  );
};

export default NewsInfoScreen;
