export const isGoogleSignInCancellation = (error) => {
    const code = String(error?.code || '').toUpperCase();
    const message = String(error?.message || '').toLowerCase();

    return (
        code === 'SIGN_IN_CANCELLED' ||
        code === '12501' ||
        message.includes('cancel')
    );
};

export const isGoogleSignInConfigurationError = error => {
    const code = String(error?.code || '').toUpperCase();
    const message = String(error?.message || '').toUpperCase();

    return (
        code === '10' ||
        code === 'DEVELOPER_ERROR' ||
        message.includes('DEVELOPER_ERROR')
    );
};

export const getGoogleSignInUserMessage = error => {
    const code = String(error?.code || '');
    const message = String(error?.message || '').toLowerCase();

    if (isGoogleSignInConfigurationError(error)) {
        return 'Google sign-in is not configured for this build. Please use email sign-in or contact support.';
    }
    if (
        code === 'auth/network-request-failed' ||
        code === 'PLAY_SERVICES_NOT_AVAILABLE' ||
        message.includes('network') ||
        message.includes('socket') ||
        message.includes('econnrefused') ||
        message.includes('unable to resolve host')
    ) {
        return 'No internet connection. Please check your network and try again.';
    }
    if (message.includes('timeout') || message.includes('timed out')) {
        return 'Connection timed out. Please try again.';
    }
    if (code === 'auth/account-exists-with-different-credential') {
        return 'An account with this email already exists. Please sign in with your original method.';
    }
    if (code === 'auth/user-disabled') {
        return 'This account has been disabled. Please contact support.';
    }
    if (code === 'auth/too-many-requests') {
        return 'Too many attempts. Please try again later.';
    }
    if (error?.response?.status >= 500) {
        return 'Server error. Please try again in a moment.';
    }
    if (error?.response?.status === 401) {
        return 'This app build could not authenticate with the service. Please install the latest build or contact support.';
    }
    return 'Google sign-in failed. Please try again.';
};
