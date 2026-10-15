// The server forwards Upstox's own rejection (HTTP 400, error_code /
// error_message). Every failure used to show "Incorrect Credentials", which
// hid the real cause; a Kyzen tester's key was refused with UDAPI100068
// because the app's Redirect URL was not registered (2026-10-15).
export const describeUpstoxConnectError = (error, redirectUrl) => {
  const body = error?.response?.data || {};
  const code = String(body.error_code || '');
  const upstoxMessage = body.error_message || '';
  if (code === 'UDAPI100068') {
    return {
      title: 'Upstox did not accept this API key',
      message:
        `Upstox says the API key and Redirect URL do not match (UDAPI100068). ` +
        `In the Upstox developer portal, open the app with this API key and set its Redirect URL to exactly:\n` +
        `${redirectUrl || 'the Redirect URL shown above'}\n` +
        `If no app there has this API key, create one and paste its API key and Secret key here.`,
    };
  }
  if (upstoxMessage) {
    return {
      title: 'Upstox Connection Failed',
      message: `${upstoxMessage}${code ? ` (${code})` : ''}`,
    };
  }
  if (!error?.response) {
    return {
      title: 'Could not reach the server',
      message: 'Check your internet connection and try again.',
    };
  }
  return {
    title: 'Incorrect Credentials',
    message: 'Please check your API Key and Secret Key and try again.',
  };
};
