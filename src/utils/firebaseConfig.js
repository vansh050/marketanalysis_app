import { firebase } from '@react-native-firebase/app';
import Config from 'react-native-config';

const firebaseConfig = {
  apiKey: Config.REACT_APP_FIREBASE_API_KEY || "AIzaSyBUhE6aDxu-Lquc4ZHhu-fY-kk-W-t2jO4",
  authDomain: Config.REACT_APP_FIREBASE_AUTH_DOMAIN || "marketanalysis-3a279.firebaseapp.com",
  projectId: Config.REACT_APP_FIREBASE_PROJECT_ID || "marketanalysis-3a279",
  storageBucket: Config.REACT_APP_FIREBASE_STORAGE_BUCKET || "marketanalysis-3a279.firebasestorage.app",
  messagingSenderId: Config.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "675041319268",
  appId: Config.REACT_APP_FIREBASE_APP_ID || "1:675041319268:web:17fb2829673daeafc94271",
  measurementId: Config.REACT_APP_FIREBASE_MEASUREMENT_ID || "G-6CKJ0H1NB9",
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

export default firebase;
