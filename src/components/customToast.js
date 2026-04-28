import React from 'react';
import { Toast } from 'react-native-toast-message';

// Define a function to show toast messages
const showToast = (message, type) => {
  Toast.show({
    type: type || 'success',
    text1: 'Notification',
    text2: message,
  });
};

export default showToast;
