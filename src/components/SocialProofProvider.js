import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { View, Button } from 'react-native';
import SocialProofPopup from './SocialProofPopup';

const SocialProofContext = createContext();

export const SocialProofProvider = ({ children }) => {
  const [message, setMessage] = useState('');
  const [visible, setVisible] = useState(false);

  const showNotification = useCallback((msg) => {
    setMessage(msg);
    setVisible(true);
  }, []);

  const handlePopupHidden = () => {
    setVisible(false);
  };

  return (
    <SocialProofContext.Provider value={{ showNotification }}>
      {children}
      <SocialProofPopup
        message={message}
        visible={visible}
        onHidden={handlePopupHidden}
      />
    </SocialProofContext.Provider>
  );
};

export const useSocialProof = () => {
  const context = useContext(SocialProofContext);
  if (!context) {
    throw new Error('useSocialProof must be used within a SocialProofProvider');
  }
  return context.showNotification;
};

// Example screen component
const HomeScreen = () => {
    const[c,setc]=useState(0);
  const showNotification = useSocialProof();

  useEffect(() => {
    // Create a function to handle notifications
    const triggerNotifications = () => {
      console.log('Effect started'); // Debug log
      
      let counter = 0;
      const interval = setInterval(() => {
        console.log('Interval running', counter); // More detailed logging
        
        if (counter < 20) {
          console.log('Triggering notification', counter);
          showNotification(`Notification ${counter + 1}: New customer added to the Gold Plan!`);
          counter += 1;
          setc(counter);
        } else {
          console.log('Stopping interval');
          clearInterval(interval);
        }
      }, 5000);

      // Return cleanup function
      return () => {
        console.log('Cleaning up interval');
        clearInterval(interval);
      };
    };

    // Call the function
    const cleanupFunction = triggerNotifications();

    // Return cleanup
    return cleanupFunction;
  }, [c]); // Empty dependency array// Empty dependency array

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Button 
        title="Add Customer" 
        onPress={() => {
            setc(1);
            showNotification('New customer added to the Gold Plan!');
        }}
      />
    </View>
  );
};

export default HomeScreen;