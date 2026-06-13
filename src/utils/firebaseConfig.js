import { firebase } from '@react-native-firebase/app';
import Config from 'react-native-config';

// Firebase configuration — every value read from `.env`. No hardcoded
// fallbacks: the previous fallback (apiKey, authDomain, ...) leaked the
// alphaquark-64c38 Firebase web client into source control. `.env` is
// gitignored, so values must live there. Missing env vars surface as a
// clear runtime error from Firebase init rather than silently using a
// wrong tenant's credentials.
const firebaseConfig = {
  apiKey: Config.REACT_APP_FIREBASE_API_KEY,
  authDomain: Config.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: Config.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: Config.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: Config.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: Config.REACT_APP_FIREBASE_APP_ID,
  measurementId: Config.REACT_APP_FIREBASE_MEASUREMENT_ID,
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

export default firebase;
