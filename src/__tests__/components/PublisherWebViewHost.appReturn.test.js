/**
 * After a Kite basket, Kite returns to <tenant>.alphaquark.in with a status.
 * The window must report that status and never load the page: it is the web
 * site, and the tester was left on "Page not found" and then the web home page
 * inside the app (2026-10-26).
 */
import React from 'react';
import renderer, {act} from 'react-test-renderer';

jest.mock('react-native-webview', () => {
  const {View} = require('react-native');
  return {WebView: props => <View testID="kite-webview" {...props} />};
});
jest.mock('lucide-react-native', () => ({XIcon: () => null}));
jest.mock('../../design/literalTokens', () => ({designColor: () => '#fff'}));

const {
  default: PublisherWebViewOverlay,
  PublisherWebViewHost,
} = require('../../components/PublisherWebViewOverlay');
const {isPublisherAppReturnUrl} = require('../../utils/publisherOutcome');

const RETURN =
  'https://prod.alphaquark.in/stock-recommendation/?type=basket&status=success';

function mount(props) {
  let tree;
  act(() => {
    tree = renderer.create(
      <>
        <PublisherWebViewOverlay source={{html: '<html/>'}} {...props} />
        <PublisherWebViewHost />
      </>,
    );
  });
  return tree.root.findByProps({testID: 'kite-webview'}).props;
}

describe('isPublisherAppReturnUrl', () => {
  it('matches the tenant page with a final status', () => {
    expect(isPublisherAppReturnUrl(RETURN)).toBe(true);
    expect(
      isPublisherAppReturnUrl('https://markup.alphaquark.in/stock-recommendation/?status=cancelled'),
    ).toBe(true);
  });
  it('leaves the ccxt callback, Kite, CDSL and status-less pages alone', () => {
    expect(
      isPublisherAppReturnUrl('https://ccxtprod.alphaquark.in/zerodha/callback?type=basket&status=success'),
    ).toBe(false);
    expect(isPublisherAppReturnUrl('https://kite.zerodha.com/connect/basket?status=success')).toBe(false);
    expect(isPublisherAppReturnUrl('https://edis.cdslindia.com/x?status=success')).toBe(false);
    expect(isPublisherAppReturnUrl('https://prod.alphaquark.in/error?status=2')).toBe(false);
    expect(isPublisherAppReturnUrl('https://evilalphaquark.in/?status=success')).toBe(false);
  });
});

describe('PublisherWebViewHost app return', () => {
  it('reports the status once and does not load the page', () => {
    const onNav = jest.fn();
    const web = mount({stopAtAppReturn: true, onNavigationStateChange: onNav});
    expect(web.onShouldStartLoadWithRequest({url: RETURN})).toBe(false);
    expect(onNav).toHaveBeenCalledTimes(1);
    expect(onNav.mock.calls[0][0].url).toBe(RETURN);
    // The same URL arriving again (iOS nav state, a second shouldStart) is ignored.
    web.onNavigationStateChange({url: RETURN});
    expect(web.onShouldStartLoadWithRequest({url: RETURN})).toBe(false);
    expect(onNav).toHaveBeenCalledTimes(1);
  });

  it('loads Kite pages and passes their navigation through', () => {
    const onNav = jest.fn();
    const web = mount({stopAtAppReturn: true, onNavigationStateChange: onNav});
    expect(web.onShouldStartLoadWithRequest({url: 'https://kite.zerodha.com/connect/basket'})).toBe(true);
    web.onNavigationStateChange({url: 'https://kite.zerodha.com/connect/basket'});
    expect(onNav).toHaveBeenCalledTimes(1);
  });

  it('does nothing for flows that did not opt in (TPIN windows)', () => {
    const own = jest.fn(() => true);
    const onNav = jest.fn();
    const web = mount({onShouldStartLoadWithRequest: own, onNavigationStateChange: onNav});
    expect(web.onShouldStartLoadWithRequest({url: RETURN})).toBe(true);
    expect(own).toHaveBeenCalledTimes(1);
    expect(onNav).not.toHaveBeenCalled();
  });
});

describe('other broker returns (2026-10-26 audit)', () => {
  const {classifyZerodhaAuthReturn} = require('../../utils/publisherOutcome');
  const fs = require('fs');
  const path = require('path');
  const read = rel => fs.readFileSync(path.join(__dirname, '../..', rel), 'utf8');

  it('classifies the Zerodha CDSL authorisation return', () => {
    expect(
      classifyZerodhaAuthReturn('https://ccxtprod.alphaquark.in/zerodha/callback?type=holdings_auth&status=success&request_id=x'),
    ).toBe('success');
    expect(
      classifyZerodhaAuthReturn('https://prod.alphaquark.in/stock-recommendation/?type=holdings_auth&status=cancelled'),
    ).toBe('other');
    expect(classifyZerodhaAuthReturn('https://x/?callback_url=1')).toBe('success');
    expect(classifyZerodhaAuthReturn('https://kite.zerodha.com/connect/portfolio/authorise/holdings/k/r')).toBeNull();
  });

  it('Dhan and AliceBlue stop on ccxt error returns', () => {
    expect(read('components/BrokerConnectionModal/DhanConnectModal.js')).toMatch(/status=error/);
    expect(read('components/BrokerConnectionModal/AliceBlueConnect.js')).toContain("status && status !== '0'");
  });
});
