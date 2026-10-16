import axios from 'axios';

/**
 * Resolve the backend profile for a Firebase-authenticated user without
 * treating an existing account as a failed login.
 *
 * Login is intentionally GET-first. POST /api/user/ is a create endpoint and
 * may return 409 for an account that already exists; making it the first step
 * caused successful Google authentication to fall back to the login screen.
 */
export const getOrCreateBackendUser = async ({
    baseUrl,
    email,
    profile,
    headers,
    timeout = 10000,
    httpClient = axios,
}) => {
    const encodedEmail = encodeURIComponent(email);
    const getUrl = `${baseUrl}api/user/getUser/${encodedEmail}?includeAdvisorConfig=true`;
    const requestConfig = {headers, timeout};

    try {
        return await httpClient.get(getUrl, requestConfig);
    } catch (error) {
        if (error?.response?.status !== 404) {
            throw error;
        }
    }

    try {
        await httpClient.post(
            `${baseUrl}api/user/`,
            {email, ...profile},
            requestConfig,
        );
    } catch (error) {
        // Another client can create the same user between the GET and POST.
        // A conflict is therefore safe to resolve with the canonical GET.
        if (error?.response?.status !== 409) {
            throw error;
        }
    }

    return httpClient.get(getUrl, requestConfig);
};

