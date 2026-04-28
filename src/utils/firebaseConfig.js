import { firebase } from '@react-native-firebase/app';
import Config from 'react-native-config';

// Firebase configuration from environment variables
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: Config.REACT_APP_FIREBASE_API_KEY || "AIzaSyDR0RsT5LSv11APTJdhcDvInesOFeHb2qw",
  authDomain: Config.REACT_APP_FIREBASE_AUTH_DOMAIN || "alphaquark-64c38.firebaseapp.com",
  projectId: Config.REACT_APP_FIREBASE_PROJECT_ID || "alphaquark-64c38",
  storageBucket: Config.REACT_APP_FIREBASE_STORAGE_BUCKET || "alphaquark-64c38.appspot.com",
  messagingSenderId: Config.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "700438699014",
  appId: Config.REACT_APP_FIREBASE_APP_ID || "1:700438699014:web:1ee2a00a419f9a909ef787",
  measurementId: Config.REACT_APP_FIREBASE_MEASUREMENT_ID || "G-EQK21ENC7S",
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

export default firebase;
