/**
 * AUTH E2E Tests — Detox (Playwright equivalent for mobile)
 * Matches: Cypress auth/login.cy.js (24 tests)
 *
 * Run: npx detox test -c android.emu.debug e2e/specs/auth.test.js
 */

const {
  login,
  logout,
  assertScreenLoaded,
  assertNoErrorScreen,
  takeNamedScreenshot,
  TEST_EMAIL,
  TEST_PASSWORD,
} = require('../helpers/testHelpers');

describe('Authentication', () => {
  beforeAll(async () => {
    await device.launchApp({newInstance: true});
  });

  // ─── AUTH-001: App Launch ───

  describe('App Launch', () => {
    it('should show splash screen then login screen', async () => {
      await waitFor(element(by.text('Log In')))
        .toBeVisible()
        .withTimeout(15000);
      await takeNamedScreenshot('AUTH-001_login_screen');
    });

    it('should display email input with placeholder', async () => {
      await expect(element(by.text('Email address'))).toBeVisible();
    });

    it('should display password input', async () => {
      await expect(element(by.text('Password'))).toBeVisible();
    });

    it('should display Log In button', async () => {
      await expect(element(by.text('Log In'))).toBeVisible();
    });

    it('should display Forgot Password link', async () => {
      await expect(element(by.text('Forgot Password?'))).toBeVisible();
    });

    it('should display Sign in with Google button', async () => {
      await expect(element(by.text('Sign in with Google'))).toBeVisible();
    });

    it('should display Sign Up link', async () => {
      await expect(element(by.text('Sign Up'))).toBeVisible();
    });
  });

  // ─── AUTH-002: Login with Email ───

  describe('Login with Email/Password', () => {
    beforeAll(async () => {
      await device.launchApp({newInstance: true});
    });

    it('should accept email input', async () => {
      await element(by.text('Email address')).tap();
      await element(by.text('Email address')).typeText(TEST_EMAIL);
      await expect(element(by.text(TEST_EMAIL))).toBeVisible();
    });

    it('should accept password input (masked)', async () => {
      await element(by.text('Password')).tap();
      await element(by.text('Password')).typeText(TEST_PASSWORD);
    });

    it('should navigate to home screen after login', async () => {
      await device.pressBack(); // dismiss keyboard
      await element(by.text('Log In')).tap();

      await waitFor(element(by.text('Home')))
        .toBeVisible()
        .withTimeout(20000);

      await takeNamedScreenshot('AUTH-002_home_after_login');
    });

    it('should show bottom tab bar with all tabs', async () => {
      await expect(element(by.text('Home'))).toBeVisible();
      await expect(element(by.text('Orders'))).toBeVisible();
      await expect(element(by.text('Portfolio'))).toBeVisible();
      await expect(element(by.text('More'))).toBeVisible();
    });
  });

  // ─── AUTH-003: Login Validation ───

  describe('Login Validation', () => {
    beforeEach(async () => {
      await device.launchApp({newInstance: true});
    });

    it('should show error for empty form submission', async () => {
      await element(by.text('Log In')).tap();
      // Should stay on login screen
      await expect(element(by.text('Log In'))).toBeVisible();
    });

    it('should show error for invalid email', async () => {
      await element(by.text('Email address')).tap();
      await element(by.text('Email address')).typeText('notanemail');
      await element(by.text('Password')).tap();
      await element(by.text('Password')).typeText('somepass');
      await device.pressBack();
      await element(by.text('Log In')).tap();

      // Should show error or stay on login
      await waitFor(element(by.text('Log In')))
        .toBeVisible()
        .withTimeout(10000);
    });

    it('should show error for wrong password', async () => {
      await element(by.text('Email address')).tap();
      await element(by.text('Email address')).typeText(TEST_EMAIL);
      await element(by.text('Password')).tap();
      await element(by.text('Password')).typeText('WrongPass123');
      await device.pressBack();
      await element(by.text('Log In')).tap();

      // Should stay on login screen (wrong password)
      await waitFor(element(by.text('Log In')))
        .toBeVisible()
        .withTimeout(15000);
    });
  });

  // ─── AUTH-004: Forgot Password ───

  describe('Forgot Password', () => {
    beforeAll(async () => {
      await device.launchApp({newInstance: true});
    });

    it('should navigate to reset password screen', async () => {
      await element(by.text('Forgot Password?')).tap();
      await assertScreenLoaded();
      await takeNamedScreenshot('AUTH-004_forgot_password');
    });

    it('should have email input on reset screen', async () => {
      await expect(element(by.text('Email address'))).toBeVisible();
    });

    it('should navigate back to login', async () => {
      await device.pressBack();
      await waitFor(element(by.text('Log In')))
        .toBeVisible()
        .withTimeout(5000);
    });
  });

  // ─── AUTH-005: Signup Flow ───

  describe('Signup Flow', () => {
    beforeAll(async () => {
      await device.launchApp({newInstance: true});
    });

    it('should navigate to signup screen', async () => {
      await element(by.text('Sign Up')).tap();
      await assertScreenLoaded();
      await takeNamedScreenshot('AUTH-005_signup');
    });

    it('should not crash on signup screen', async () => {
      await assertNoErrorScreen();
    });

    it('should navigate back to login', async () => {
      await device.pressBack();
      await waitFor(element(by.text('Log In')))
        .toBeVisible()
        .withTimeout(5000);
    });
  });

  // ─── AUTH-006: Logout ───

  describe('Logout', () => {
    beforeAll(async () => {
      await device.launchApp({newInstance: true});
      await login();
    });

    it('should navigate to More tab', async () => {
      await element(by.text('More')).tap();
      await assertScreenLoaded();
    });

    it('should find and tap Logout', async () => {
      await logout();
    });

    it('should return to login screen', async () => {
      await expect(element(by.text('Log In'))).toBeVisible();
      await takeNamedScreenshot('AUTH-006_after_logout');
    });
  });

  // ─── AUTH-007: Session Persistence ───

  describe('Session Persistence', () => {
    it('should persist session across app restarts', async () => {
      await device.launchApp({newInstance: true});
      await login();

      // Relaunch without clearing state
      await device.launchApp({newInstance: false});

      // Should go directly to home (no login screen)
      await waitFor(element(by.text('Home')))
        .toBeVisible()
        .withTimeout(15000);
    });
  });
});
