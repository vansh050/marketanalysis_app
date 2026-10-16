import auth from '@react-native-firebase/auth';
import {GoogleSignin} from '@react-native-google-signin/google-signin';

export const configureGoogleAuth = ({googleWebClientId, googleIosClientId} = {}) => {
    if (!googleWebClientId) {
        return false;
    }

    GoogleSignin.configure({
        webClientId: googleWebClientId,
        ...(googleIosClientId ? {iosClientId: googleIosClientId} : {}),
    });
    return true;
};

/**
 * Owns the native Google sheet and Firebase credential exchange shared by
 * Login and Signup. Backend user creation, tenant routing and navigation stay
 * in their screen containers because those are separate application flows.
 */
export const signInWithGoogleFirebase = async () => {
    await GoogleSignin.hasPlayServices({showPlayServicesUpdateDialog: true});
    const signInResult = await GoogleSignin.signIn();

    // @react-native-google-signin v12 returns the first shape. Retain the
    // older data wrapper for installed builds restored across upgrades.
    const idToken = signInResult?.idToken || signInResult?.data?.idToken || null;
    const sdkUser = signInResult?.user || signInResult?.data?.user || {};
    if (!idToken) {
        throw new Error('No ID token returned');
    }

    const credential = auth.GoogleAuthProvider.credential(idToken);
    const response = await auth().signInWithCredential(credential);
    const user = response?.user;
    const email = String(user?.email || sdkUser?.email || '').trim().toLowerCase();

    if (!email) {
        throw new Error('Google did not return an email for this account. Please try again.');
    }

    return {
        user,
        email,
        name: user?.displayName || sdkUser?.name || null,
        photo: user?.photoURL || sdkUser?.photo || null,
    };
};
