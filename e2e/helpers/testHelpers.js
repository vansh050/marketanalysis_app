/**
 * Shared test helpers for Detox E2E tests.
 * Equivalent to Cypress commands.js in the web app.
 */

const TEST_EMAIL = 'testuser@alphaquark.in';
const TEST_PASSWORD = 'Test@12345';

/**
 * Login with email and password.
 * Equivalent to: cy.mockLogin() / cy.loginViaFirebase()
 */
async function login(email = TEST_EMAIL, password = TEST_PASSWORD) {
  await waitFor(element(by.text('Log In')))
    .toBeVisible()
    .withTimeout(10000);

  // Enter email
  await element(by.text('Email address')).tap();
  await element(by.text('Email address')).typeText(email);

  // Enter password
  await element(by.text('Password')).tap();
  await element(by.text('Password')).typeText(password);

  // Dismiss keyboard
  await device.pressBack();

  // Tap Log In
  await element(by.text('Log In')).tap();

  // Wait for home screen
  await waitFor(element(by.text('Home')))
    .toBeVisible()
    .withTimeout(20000);
}

/**
 * Logout from the app.
 * Equivalent to: cy.logout()
 */
async function logout() {
  await navigateToTab('More');
  await scrollDownTo('Logout');
  await element(by.text('Logout')).tap();

  // Confirm dialog if present
  try {
    await element(by.text('Yes')).tap();
  } catch {
    // No confirmation dialog
  }

  await waitFor(element(by.text('Log In')))
    .toBeVisible()
    .withTimeout(10000);
}

/**
 * Navigate to a bottom tab.
 * Equivalent to: cy.visit('/route')
 */
async function navigateToTab(tabName) {
  await element(by.text(tabName)).tap();
  await waitFor(element(by.text(tabName)))
    .toBeVisible()
    .withTimeout(5000);
}

/**
 * Scroll down until text is visible.
 */
async function scrollDownTo(text) {
  await waitFor(element(by.text(text)))
    .toBeVisible()
    .whileElement(by.type('android.widget.ScrollView'))
    .scroll(300, 'down');
}

/**
 * Assert screen loaded (not crashed).
 * Equivalent to: cy.assertPageLoaded()
 */
async function assertScreenLoaded() {
  await expect(element(by.type('android.view.ViewGroup')).atIndex(0)).toExist();
}

/**
 * Assert no error screen.
 * Equivalent to: cy.assertNoConsoleErrors()
 */
async function assertNoErrorScreen() {
  await expect(element(by.text('Something went wrong'))).not.toBeVisible();
}

/**
 * Wait for loading to finish.
 */
async function waitForLoading() {
  // Wait for any loading indicator to disappear
  try {
    await waitFor(element(by.type('android.widget.ProgressBar')))
      .not.toBeVisible()
      .withTimeout(15000);
  } catch {
    // No loading indicator present, continue
  }
}

/**
 * Take screenshot with label.
 */
async function takeNamedScreenshot(name) {
  await device.takeScreenshot(name);
}

module.exports = {
  TEST_EMAIL,
  TEST_PASSWORD,
  login,
  logout,
  navigateToTab,
  scrollDownTo,
  assertScreenLoaded,
  assertNoErrorScreen,
  waitForLoading,
  takeNamedScreenshot,
};
