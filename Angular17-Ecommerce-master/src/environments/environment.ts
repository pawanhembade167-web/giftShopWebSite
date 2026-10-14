// API hosts follow the page's own hostname. Browsers treat localhost and 127.0.0.1 as different
// sites, so using a fixed host would block the refresh cookie when the app is opened on the other one.
const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';

export const environment = {
  apiBaseUrl: `http://${host}:8000`,
  legacyApiBaseUrl: `http://${host}:5000`,
};
