import {getAuth} from '@react-native-firebase/auth';

/**
 * Build the verified identity header required by customer-scoped APIs.
 * Unlike the global best-effort interceptor, this helper waits for Firebase
 * because an unauthenticated first request must not be mistaken for an empty
 * recommendation feed.
 */
export async function getCustomerAuthHeaders({attempts = 10, delayMs = 200} = {}) {
  try {
    const firebaseAuth = getAuth();
    let user = firebaseAuth?.currentUser;
    for (let attempt = 1; !user && attempt < attempts; attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
      user = firebaseAuth?.currentUser;
    }
    if (!user) return null;
    const token = await user.getIdToken();
    return token ? {Authorization: `Bearer ${token}`} : null;
  } catch (_) {
    return null;
  }
}

export default getCustomerAuthHeaders;
